import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: { from: vi.fn() } }));

import { supabase } from '../supabase';
import { resolveOrCreateExercise } from '../resolveOrCreateExercise';

const mockFrom = vi.mocked(supabase.from);

interface ChainOptions {
  /** Resultado del primer select (búsqueda previa). */
  found?: { id: string } | null;
  /** Resultado del insert. */
  insertResult?: { data: { id: string } | null; error: { code?: string; message: string } | null };
  /** Resultado del select de reintento tras un 23505. */
  raced?: { id: string } | null;
}

function mockExerciseChain({ found = null, insertResult, raced = null }: ChainOptions) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValueOnce({ data: found, error: null })
    .mockResolvedValue({ data: raced, error: null });
  const ilike = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn(() => ({ ilike }));
  const select = vi.fn(() => ({ eq }));

  const single = vi.fn().mockResolvedValue(insertResult ?? { data: { id: 'new-id' }, error: null });
  const insertSelect = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select: insertSelect }));

  mockFrom.mockImplementation(
    () => ({ select, insert }) as unknown as ReturnType<typeof supabase.from>,
  );
  return { insert, ilike, maybeSingle };
}

describe('resolveOrCreateExercise', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('devuelve el id existente sin insertar (case-insensitive)', async () => {
    const { insert } = mockExerciseChain({ found: { id: 'existing-id' } });
    const id = await resolveOrCreateExercise('user-1', '  Press Banca ', 'Pecho');
    expect(id).toBe('existing-id');
    expect(insert).not.toHaveBeenCalled();
  });

  it('crea el ejercicio si no existe y devuelve el id nuevo', async () => {
    const { insert } = mockExerciseChain({
      insertResult: { data: { id: 'created-id' }, error: null },
    });
    const id = await resolveOrCreateExercise('user-1', ' Remo Gironda ', 'Espalda');
    expect(id).toBe('created-id');
    expect(insert).toHaveBeenCalledWith({
      name: 'Remo Gironda',
      user_id: 'user-1',
      muscle_group: 'Espalda',
    });
  });

  it('resuelve la carrera 23505 re-seleccionando el existente', async () => {
    // Escenario del bug §4.2: el INSERT previo tuvo éxito pero la respuesta se
    // perdió (o dos flush concurrentes) → el reintento choca con el índice único.
    const { maybeSingle } = mockExerciseChain({
      found: null,
      insertResult: { data: null, error: { code: '23505', message: 'duplicate key value' } },
      raced: { id: 'raced-id' },
    });
    const id = await resolveOrCreateExercise('user-1', 'Press banca', 'Pecho');
    expect(id).toBe('raced-id');
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });

  it('propaga errores de insert que no son unique violation', async () => {
    mockExerciseChain({
      insertResult: { data: null, error: { code: '23514', message: 'check constraint' } },
    });
    await expect(resolveOrCreateExercise('user-1', 'Press banca', 'Pecho')).rejects.toMatchObject({
      code: '23514',
    });
  });

  it('escapa comodines de ILIKE en el nombre', async () => {
    const { ilike } = mockExerciseChain({ found: { id: 'x' } });
    await resolveOrCreateExercise('user-1', 'Press 100%_raro', 'Pecho');
    expect(ilike).toHaveBeenCalledWith('name', 'Press 100\\%\\_raro');
  });
});
