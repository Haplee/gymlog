import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WearableProvider } from '../types';

// Hoisted mocks to avoid initialization order issues
const { mockFrom, mockRpc, chain, mockHealthBridge, mockHasHealthConsent } = vi.hoisted(() => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
    insert: vi.fn(),
  };
  return {
    mockFrom: vi.fn(() => chain),
    mockRpc: vi.fn().mockResolvedValue({ data: 1, error: null }),
    chain,
    mockHealthBridge: {
      isAvailable: vi.fn().mockResolvedValue({ available: true }),
      hasPermissions: vi.fn().mockResolvedValue({ granted: true }),
      readAll: vi.fn().mockResolvedValue({
        daily: [],
        sleep: [],
        workouts: [],
        strengthSessions: [],
        errors: [],
      }),
    },
    mockHasHealthConsent: vi.fn().mockReturnValue(true),
  };
});

// Mock modules using hoisted factories
vi.mock('@shared/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

vi.mock('@shared/lib/healthBridge', () => ({
  default: mockHealthBridge,
}));

vi.mock('@shared/lib/devtools', () => ({
  devError: vi.fn(),
}));

vi.mock('@features/privacy/consent/healthConsent', () => ({
  hasHealthConsent: mockHasHealthConsent,
}));

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Capacitor: {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
    },
  };
});

// Import AFTER mocks
import * as healthAggregatorModule from '../healthAggregator';

const MOCK_USER_ID = 'user-123';
const MOCK_SOURCE: WearableProvider = 'health_connect';

function resetChain(): void {
  chain.select.mockClear().mockReturnThis();
  chain.eq.mockClear().mockReturnThis();
  chain.maybeSingle.mockClear();
  chain.upsert.mockClear();
  chain.insert.mockClear();
}

function setupWearableConnectionsMock(lastSyncAt: string | null | undefined = null): void {
  chain.maybeSingle.mockResolvedValue({
    data: lastSyncAt ? { last_sync_at: lastSyncAt } : null,
    error: null,
  });
}

describe('healthAggregator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasHealthConsent.mockReturnValue(true);
    resetChain();
    setupWearableConnectionsMock(null);

    mockHealthBridge.isAvailable.mockResolvedValue({ available: true });
    mockHealthBridge.hasPermissions.mockResolvedValue({ granted: true });
    mockHealthBridge.readAll.mockResolvedValue({
      daily: [],
      sleep: [],
      workouts: [],
      strengthSessions: [],
      errors: [],
    });
    mockRpc.mockResolvedValue({ data: 1, error: null });
  });

  describe('syncAggregator', () => {
    it('lanza no_permission si HealthBridge.hasPermissions devuelve false (Android)', async () => {
      mockHealthBridge.hasPermissions.mockResolvedValue({ granted: false });

      await expect(healthAggregatorModule.syncAggregator(MOCK_USER_ID)).rejects.toThrow(
        'no_permission',
      );

      // No debe llamar a readAll ni RPCs de upsert
      expect(mockHealthBridge.readAll).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
      // No debe registrar sync_start (se lanza antes)
      expect(mockFrom).not.toHaveBeenCalledWith('health_connect_audit');
    });

    it('envía resting_hr en upsert_daily y registra auditoría sin PHI cuando readAll lo devuelve', async () => {
      const mockDaily = [
        {
          date: '2026-01-15',
          steps: 8000,
          resting_hr: 58,
          avg_hr: 72,
          max_hr: 110,
          distance_km: 5.2,
          calories: 2300,
        },
      ];

      mockHealthBridge.readAll.mockResolvedValue({
        daily: mockDaily,
        sleep: [],
        workouts: [],
        strengthSessions: [],
        errors: [],
      });

      const result = await healthAggregatorModule.syncAggregator(MOCK_USER_ID);

      // Verificar que se llamó upsert_wearable_daily con resting_hr
      expect(mockRpc).toHaveBeenCalledWith(
        'upsert_wearable_daily',
        expect.objectContaining({
          p_user_id: MOCK_USER_ID,
          p_rows: expect.arrayContaining([
            expect.objectContaining({
              date: '2026-01-15',
              resting_hr: 58,
              source: MOCK_SOURCE,
            }),
          ]),
        }),
      );

      // Verificar auditoría sync_complete con record_types incluyendo resting_heart_rate
      expect(mockFrom).toHaveBeenCalledWith('health_connect_audit');
      const auditInsert = mockFrom.mock.results.find((r) => r.value.insert)?.value.insert;
      expect(auditInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: MOCK_USER_ID,
          event_type: 'sync_complete',
          record_types: expect.arrayContaining(['resting_heart_rate']),
          record_count: expect.any(Number),
          error_code: null,
        }),
      );

      expect(result.daily).toBe(1);
    });

    it('registra sync_error en auditoría cuando falla el upsert', async () => {
      mockHealthBridge.readAll.mockResolvedValue({
        daily: [{ date: '2026-01-15', resting_hr: 60 }],
        sleep: [],
        workouts: [],
        strengthSessions: [],
        errors: [],
      });

      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'RLS violation' } });

      await expect(healthAggregatorModule.syncAggregator(MOCK_USER_ID)).rejects.toThrow(
        'upsert_daily: RLS violation',
      );

      // Verificar auditoría sync_error
      const auditInsert = mockFrom.mock.results.find((r) => r.value.insert)?.value.insert;
      expect(auditInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: MOCK_USER_ID,
          event_type: 'sync_error',
          error_code: 'UNKNOWN_ERROR',
        }),
      );
    });

    it('no incluye valores fisiológicos ni IDs externos en la auditoría', async () => {
      mockHealthBridge.readAll.mockResolvedValue({
        daily: [{ date: '2026-01-15', resting_hr: 58, avg_hr: 72 }],
        sleep: [{ date: '2026-01-15', duration_min: 480 }],
        workouts: [
          {
            external_id: 'hc:abc123',
            type: 'running',
            started_at: '2026-01-15T10:00:00Z',
            duration: 1800,
          },
        ],
        strengthSessions: [],
        errors: [],
      });

      await healthAggregatorModule.syncAggregator(MOCK_USER_ID);

      const auditInsert = mockFrom.mock.results.find((r) => r.value.insert)?.value.insert;
      const auditCall = auditInsert.mock.calls.find((c) => c[0]?.event_type === 'sync_complete');

      expect(auditCall).toBeDefined();
      const auditPayload = auditCall[0];

      // Verificar que NO hay PHI
      expect(JSON.stringify(auditPayload)).not.toContain('58');
      expect(JSON.stringify(auditPayload)).not.toContain('72');
      expect(JSON.stringify(auditPayload)).not.toContain('480');
      expect(JSON.stringify(auditPayload)).not.toContain('hc:abc123');
      expect(JSON.stringify(auditPayload)).not.toContain('2026-01-15T10:00:00Z');

      // Verificar que SÍ hay metadata estructural
      expect(auditPayload.record_types).toContain('resting_heart_rate');
      expect(auditPayload.record_types).toContain('sleep');
      expect(auditPayload.record_types).toContain('exercise');
      expect(auditPayload.record_count).toBeGreaterThan(0);
    });

    it('registra sync_start y sync_complete en orden', async () => {
      mockHealthBridge.readAll.mockResolvedValue({
        daily: [{ date: '2026-01-15', resting_hr: 60 }],
        sleep: [],
        workouts: [],
        strengthSessions: [],
        errors: [],
      });

      await healthAggregatorModule.syncAggregator(MOCK_USER_ID);

      const auditInsert = mockFrom.mock.results.find((r) => r.value.insert)?.value.insert;
      const calls = auditInsert.mock.calls;

      // Primera llamada: sync_start
      expect(calls[0][0].event_type).toBe('sync_start');
      // Segunda llamada: sync_complete
      expect(calls[1][0].event_type).toBe('sync_complete');
    });

    // VS2: Sleep tests
    it('envía sleep stages y efficiency_pct en upsert_wearable_sleep y registra auditoría con sleep', async () => {
      const mockSleep = [
        {
          date: '2026-01-15',
          duration_min: 480,
          deep_min: 120,
          light_min: 180,
          rem_min: 120,
          awake_min: 60,
          efficiency_pct: 87,
        },
      ];

      mockHealthBridge.readAll.mockResolvedValue({
        daily: [],
        sleep: mockSleep,
        workouts: [],
        strengthSessions: [],
        errors: [],
      });

      const result = await healthAggregatorModule.syncAggregator(MOCK_USER_ID);

      // Verificar que se llamó upsert_wearable_sleep con todos los stages
      expect(mockRpc).toHaveBeenCalledWith(
        'upsert_wearable_sleep',
        expect.objectContaining({
          p_user_id: MOCK_USER_ID,
          p_rows: expect.arrayContaining([
            expect.objectContaining({
              date: '2026-01-15',
              duration_min: 480,
              deep_min: 120,
              light_min: 180,
              rem_min: 120,
              awake_min: 60,
              efficiency_pct: 87,
              source: MOCK_SOURCE,
            }),
          ]),
        }),
      );

      // Verificar auditoría sync_complete con record_types incluyendo 'sleep'
      expect(mockFrom).toHaveBeenCalledWith('health_connect_audit');
      const auditInsert = mockFrom.mock.results.find((r) => r.value.insert)?.value.insert;
      expect(auditInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: MOCK_USER_ID,
          event_type: 'sync_complete',
          record_types: expect.arrayContaining(['sleep']),
          record_count: expect.any(Number),
          error_code: null,
        }),
      );

      expect(result.sleep).toBe(1);
    });

    it('auditoría incluye sleep cuando hay datos de sueño junto con daily', async () => {
      mockHealthBridge.readAll.mockResolvedValue({
        daily: [{ date: '2026-01-15', resting_hr: 58 }],
        sleep: [
          {
            date: '2026-01-15',
            duration_min: 480,
            deep_min: 100,
            light_min: 200,
            rem_min: 80,
            awake_min: 50,
            efficiency_pct: 79,
          },
        ],
        workouts: [],
        strengthSessions: [],
        errors: [],
      });

      await healthAggregatorModule.syncAggregator(MOCK_USER_ID);

      const auditInsert = mockFrom.mock.results.find((r) => r.value.insert)?.value.insert;
      const auditCall = auditInsert.mock.calls.find((c) => c[0]?.event_type === 'sync_complete');

      expect(auditCall).toBeDefined();
      const auditPayload = auditCall[0];

      expect(auditPayload.record_types).toContain('sleep');
      expect(auditPayload.record_types).toContain('resting_heart_rate');
      // No PHI en auditoría
      expect(JSON.stringify(auditPayload)).not.toContain('480');
      expect(JSON.stringify(auditPayload)).not.toContain('100');
      expect(JSON.stringify(auditPayload)).not.toContain('79');
    });

    it('sleep sin stages opcionales solo envía duration_min y efficiency_pct', async () => {
      mockHealthBridge.readAll.mockResolvedValue({
        daily: [],
        sleep: [{ date: '2026-01-15', duration_min: 420, efficiency_pct: 100 }], // Solo light sleep
        workouts: [],
        strengthSessions: [],
        errors: [],
      });

      const result = await healthAggregatorModule.syncAggregator(MOCK_USER_ID);

      expect(mockRpc).toHaveBeenCalledWith(
        'upsert_wearable_sleep',
        expect.objectContaining({
          p_user_id: MOCK_USER_ID,
          p_rows: expect.arrayContaining([
            expect.objectContaining({
              date: '2026-01-15',
              duration_min: 420,
              efficiency_pct: 100,
              // deep_min, light_min, rem_min, awake_min no presentes (undefined)
              source: MOCK_SOURCE,
            }),
          ]),
        }),
      );

      expect(result.sleep).toBe(1);
    });
  });

  describe('logHealthConnectAudit', () => {
    it('inserta en health_connect_audit con datos correctos', async () => {
      chain.insert.mockResolvedValue({ error: null });

      await healthAggregatorModule.logHealthConnectAudit(MOCK_USER_ID, 'sync_complete', {
        recordTypes: ['resting_heart_rate', 'sleep'],
        recordCount: 5,
      });

      expect(mockFrom).toHaveBeenCalledWith('health_connect_audit');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: MOCK_USER_ID,
          event_type: 'sync_complete',
          record_types: ['resting_heart_rate', 'sleep'],
          record_count: 5,
          error_code: null,
        }),
      );
    });

    it('falla en silencio si la inserción falla (no lanza)', async () => {
      chain.insert.mockResolvedValue({ error: { message: 'RLS violation' } });

      await expect(
        healthAggregatorModule.logHealthConnectAudit(MOCK_USER_ID, 'sync_complete', {}),
      ).resolves.not.toThrow();
    });
  });
});
