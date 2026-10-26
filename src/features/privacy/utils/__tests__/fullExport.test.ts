import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_EXPORT_SCHEMA,
  ACCOUNT_EXPORT_VERSION,
  EXPORT_TABLE_ORDER,
  buildAccountExport,
  countRows,
  exportFileName,
  redactPushTokens,
} from '../fullExport';

const baseInput = {
  exportedAt: '2026-10-26T10:00:00.000Z',
  user: {
    id: 'user-1',
    email: 'persona@example.test',
    createdAt: '2025-01-02T00:00:00.000Z',
    lastSignInAt: '2026-10-25T00:00:00.000Z',
    provider: 'email',
  },
};

describe('redactPushTokens', () => {
  it('quita el valor del token y deja el resto de la fila', () => {
    const [row] = redactPushTokens([
      {
        user_id: 'user-1',
        token: 'fcm-secreto',
        platform: 'android',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]) as Record<string, unknown>[];

    expect(row.token).toBeNull();
    expect(row.token_redacted).toBe(true);
    expect(row.platform).toBe('android');
    expect(row.user_id).toBe('user-1');
    expect(JSON.stringify(row)).not.toContain('fcm-secreto');
  });

  it('no rompe con filas que no son objetos', () => {
    expect(redactPushTokens([null, 'texto', 42, ['a']])).toEqual([null, 'texto', 42, ['a']]);
  });
});

describe('buildAccountExport', () => {
  it('incluye esquema, versión, usuario, conteos y notas', () => {
    const json = buildAccountExport({
      ...baseInput,
      snapshot: {
        tables: {
          profiles: [{ id: 'user-1' }],
          workouts: [{ id: 'w1' }, { id: 'w2' }],
          exercise_muscles: [{ exercise_id: 'ex-1', muscle_group: 'Pecho' }],
          push_tokens: [{ token: 'secreto', platform: 'ios' }],
        },
      },
    });
    const parsed = JSON.parse(json);

    expect(parsed.schema).toBe(ACCOUNT_EXPORT_SCHEMA);
    expect(parsed.version).toBe(ACCOUNT_EXPORT_VERSION);
    expect(parsed.user.email).toBe('persona@example.test');
    expect(parsed.counts.workouts).toBe(2);
    expect(parsed.counts['push_tokens']).toBe(1);
    expect(parsed.notes.join(' ')).toContain('tokens push');
    expect(json).not.toContain('"token": "secreto"');
    expect(parsed.data.push_tokens[0].token_redacted).toBe(true);
  });

  it('respeta el orden público de las secciones', () => {
    const json = buildAccountExport({
      ...baseInput,
      snapshot: {
        tables: {
          workouts: [{ id: 'w1' }],
          profiles: [{ id: 'user-1' }],
          body_measurements: [],
        },
      },
    });
    const keys = Object.keys(JSON.parse(json).data);
    const expected = EXPORT_TABLE_ORDER.filter((table) => keys.includes(table));

    expect(keys).toEqual([...expected]);
    expect(keys).toEqual(['profiles', 'body_measurements', 'workouts']);
  });

  it('omite las tablas que no están en la instantánea', () => {
    const parsed = JSON.parse(
      buildAccountExport({ ...baseInput, snapshot: { tables: { profiles: [] } } }),
    );
    expect(parsed.data).toEqual({ profiles: [] });
    expect(parsed.counts).toEqual({ profiles: 0 });
  });

  it('conserva los errores de las tablas opcionales para que se vean', () => {
    const parsed = JSON.parse(
      buildAccountExport({
        ...baseInput,
        snapshot: {
          tables: { profiles: [] },
          errors: { ai_coach_memory: 'relation does not exist' },
        },
      }),
    );
    expect(parsed.errors.ai_coach_memory).toBe('relation does not exist');
  });

  it('no inventa secciones del entrenador si no hay datos', () => {
    const parsed = JSON.parse(
      buildAccountExport({ ...baseInput, snapshot: { tables: { profiles: [] } } }),
    );
    expect(parsed.data.ai_coach_messages).toBeUndefined();
    expect(parsed.counts.ai_coach_messages).toBeUndefined();
  });
});

describe('countRows', () => {
  it('cuenta solo arrays presentes', () => {
    expect(countRows({ profiles: [1, 2], workouts: [], push_tokens: undefined as never })).toEqual({
      profiles: 2,
      workouts: 0,
    });
  });
});

describe('exportFileName', () => {
  it('usa la fecha ISO y el nombre estable', () => {
    expect(exportFileName(new Date('2026-10-26T23:59:00.000Z'))).toBe(
      'gymlog-datos-2026-10-26.json',
    );
  });
});
