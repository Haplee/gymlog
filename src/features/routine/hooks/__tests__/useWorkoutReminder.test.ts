// @vitest-environment jsdom
/**
 * `useWorkoutReminder`: el aviso inmediato al abrir la app + la
 * re-reconciliación de las alarmas semanales cuando cambia la rutina.
 *
 * El aviso inmediato vive en web y está acotado: solo entre las 12:00 y las
 * 22:00, solo si hoy toca rutina, solo si aún no ha entrenado y solo una vez
 * al día (clave con fecha local en localStorage). En nativo no avisa para no
 * duplicar la alarma del sistema. El re-reconciliado es lo que hacía que, al
 * mover un día de la semana o tocar el calendario, las alarmas se
 * re-horneasen en vez de quedar nombrando el día vacío.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

/** Estado compartido que leen los mocks de stores (patrón selector). */
const h = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  getTodayRoutine: vi.fn<() => { name: string; exercises: unknown[] } | null>(),
  routines: [] as unknown[],
  activeRoutineId: 'r1',
  weekPlan: null as unknown,
  schedule: {} as Record<string, string>,
  lastScheduledApply: null as string | null,
  trainingReminders: true,
  trainedToday: false as boolean | undefined,
  notify: vi.fn(),
  reconcileReminders: vi.fn(async () => undefined),
  isNative: vi.fn(() => false),
}));

vi.mock('@features/auth/stores/authStore', () => ({
  useAuthStore: (sel: (s: typeof h) => unknown) => sel(h),
}));
vi.mock('@features/routine/stores/routineStore', () => ({
  useRoutineStore: (sel: (s: typeof h) => unknown) => sel(h),
}));
vi.mock('@shared/stores/settingsStore', () => ({
  useSettingsStore: (sel: (s: typeof h) => unknown) => sel(h),
}));
// El hook solo consulta «¿ha entrenado hoy?»; el dato se inyecta por test.
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: h.trainedToday }),
}));
// getRoutineReminderDays ya está probado aparte (con el store real); aquí se
// stubba para aislar el cableado del hook.
vi.mock('@features/routine/lib/routineReminders', () => ({
  getRoutineReminderDays: () => [{ weekday: 2, routineName: 'Push' }],
}));
vi.mock('@shared/lib/notifications', () => ({
  notify: h.notify,
  getRoutineReminderCopy: (name: string) => ({ title: `Hoy: ${name}`, body: 'A entrenar' }),
  isNative: h.isNative,
}));
vi.mock('@shared/lib/reminderReconcile', () => ({
  reconcileReminders: h.reconcileReminders,
  hasTrainedToday: vi.fn(async () => false),
}));
vi.mock('@shared/lib/dateKeys', () => ({ toLocalDateKey: () => '2026-01-05' }));

import { useWorkoutReminder } from '../useWorkoutReminder';

const HOY_CON_RUTINA = { name: 'Push', exercises: [{ name: 'Press banca' }] };

function reset() {
  h.user = { id: 'u1' };
  h.getTodayRoutine.mockReturnValue(HOY_CON_RUTINA);
  h.routines = [];
  h.activeRoutineId = 'r1';
  h.weekPlan = null;
  h.schedule = {};
  h.lastScheduledApply = null;
  h.trainingReminders = true;
  h.trainedToday = false;
  h.isNative.mockReturnValue(false);
}

describe('useWorkoutReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    reset();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /* --------------------------- aviso inmediato ---------------------------- */

  it('avisa al abrir en web dentro de la ventana si hoy toca rutina y no ha entrenado', () => {
    vi.setSystemTime(new Date('2026-01-05T13:05:00')); // 13:05 → dentro de 12–22

    renderHook(() => useWorkoutReminder());

    expect(h.notify).toHaveBeenCalledTimes(1);
    expect(h.notify.mock.calls[0][0]).toBe('Hoy: Push');
  });

  it('no avisa fuera de la ventana horaria', () => {
    vi.setSystemTime(new Date('2026-01-05T08:05:00')); // 08:05 → antes de las 12

    renderHook(() => useWorkoutReminder());

    expect(h.notify).not.toHaveBeenCalled();
  });

  it('no avisa si ya ha entrenado hoy', () => {
    vi.setSystemTime(new Date('2026-01-05T13:05:00'));
    h.trainedToday = true;

    renderHook(() => useWorkoutReminder());

    expect(h.notify).not.toHaveBeenCalled();
  });

  it('no avisa en nativo (para no duplicar la alarma del sistema)', () => {
    vi.setSystemTime(new Date('2026-01-05T13:05:00'));
    h.isNative.mockReturnValue(true);

    renderHook(() => useWorkoutReminder());

    expect(h.notify).not.toHaveBeenCalled();
  });

  it('no avisa si el usuario tiene los recordatorios desactivados', () => {
    vi.setSystemTime(new Date('2026-01-05T13:05:00'));
    h.trainingReminders = false;

    renderHook(() => useWorkoutReminder());

    expect(h.notify).not.toHaveBeenCalled();
  });

  it('no avisa si hoy es descanso (sin rutina)', () => {
    vi.setSystemTime(new Date('2026-01-05T13:05:00'));
    h.getTodayRoutine.mockReturnValue(null);

    renderHook(() => useWorkoutReminder());

    expect(h.notify).not.toHaveBeenCalled();
  });

  it('no repite el aviso dos veces el mismo día (clave con fecha)', () => {
    vi.setSystemTime(new Date('2026-01-05T13:05:00'));

    renderHook(() => useWorkoutReminder());
    // Un segundo montaje el mismo día (p.ej. recargar la pantalla).
    renderHook(() => useWorkoutReminder());

    expect(h.notify).toHaveBeenCalledTimes(1);
  });

  /* --------------------- re-reconciliación de alarmas --------------------- */

  it('reconcilia las alarmas al montar', () => {
    renderHook(() => useWorkoutReminder());

    expect(h.reconcileReminders).toHaveBeenCalledWith('u1', [{ weekday: 2, routineName: 'Push' }]);
  });

  it('re-reconcilia cuando cambia el calendario de rutinas (schedule)', () => {
    const { rerender } = renderHook(() => useWorkoutReminder());
    const before = h.reconcileReminders.mock.calls.length;

    h.schedule = { 'r-nuevo': '2026-01-10' };
    rerender();

    expect(h.reconcileReminders.mock.calls.length).toBeGreaterThan(before);
  });

  it('re-reconcilia cuando se reorganiza la semana (weekPlan)', () => {
    const { rerender } = renderHook(() => useWorkoutReminder());
    const before = h.reconcileReminders.mock.calls.length;

    h.weekPlan = { weekStart: '2026-01-05', map: { monday: null } };
    rerender();

    expect(h.reconcileReminders.mock.calls.length).toBeGreaterThan(before);
  });
});
