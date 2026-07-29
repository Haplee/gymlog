// Tests de la memoria del entrenador.
//
// Lo que se fija aquí no es "que funcione": es que el modelo no pueda escribir
// donde no debe, que la lista no crezca sin fin y que un hecho demasiado largo
// no tumbe la respuesta entera por el CHECK de 200 caracteres de la tabla.

import { describe, it, expect } from 'vitest';
import {
  sanitizeFacts,
  pickEvictions,
  persistFacts,
  type MemoryClient,
  type StoredFact,
} from './memory.ts';
import { MEMORY_FACT_MAX_CHARS, MEMORY_MAX_PER_USER } from './schema.ts';
import type { CoachMemoryFact } from './schema.ts';

const fact = (over: Partial<CoachMemoryFact> = {}): CoachMemoryFact => ({
  category: 'preference',
  fact: 'Prefiere mancuernas a barra',
  confidence: 'medium',
  ...over,
});

const stored = (over: Partial<StoredFact> = {}): StoredFact => ({
  id: 'id-1',
  fact: 'algo',
  confidence: 'medium',
  created_at: '2026-01-01T00:00:00.000Z',
  ...over,
});

/** Cliente falso: registra lo que se le pide sin tocar base de datos. */
function fakeClient(existing: StoredFact[] = []) {
  const calls = {
    deleted: [] as { userId: string; ids: string[] }[],
    inserted: [] as { userId: string; facts: CoachMemoryFact[] }[],
    listedFor: [] as string[],
  };
  const client: MemoryClient = {
    listFacts: (userId) => {
      calls.listedFor.push(userId);
      return Promise.resolve(existing);
    },
    deleteFacts: (userId, ids) => {
      calls.deleted.push({ userId, ids });
      return Promise.resolve();
    },
    insertFacts: (userId, facts) => {
      calls.inserted.push({ userId, facts });
      return Promise.resolve();
    },
  };
  return { client, calls };
}

describe('sanitizeFacts', () => {
  it('trunca en vez de rechazar: el CHECK de la tabla tumbaría el INSERT entero', () => {
    const largo = 'a'.repeat(MEMORY_FACT_MAX_CHARS + 50);
    const { facts } = sanitizeFacts([fact({ fact: largo })]);
    expect(facts).toHaveLength(1);
    expect(facts[0].fact).toHaveLength(MEMORY_FACT_MAX_CHARS);
  });

  it('descarta nutrición y farmacología disfrazadas de preferencia', () => {
    const { facts, rejected } = sanitizeFacts([
      fact({ fact: 'Toma 5 g de creatina al día' }),
      fact({ fact: 'Prefiere entrenar por la mañana' }),
    ]);
    expect(facts.map((f) => f.fact)).toEqual(['Prefiere entrenar por la mañana']);
    expect(rejected).toContain('fuera_de_alcance');
  });

  it('no repite un hecho que ya está guardado, aunque cambie mayúsculas y espacios', () => {
    const { facts, rejected } = sanitizeFacts(
      [fact({ fact: '  PREFIERE   mancuernas a barra ' })],
      [{ fact: 'Prefiere mancuernas a barra' }],
    );
    expect(facts).toHaveLength(0);
    expect(rejected).toEqual(['duplicado']);
  });

  it('no repite un hecho duplicado dentro de la misma respuesta', () => {
    const { facts } = sanitizeFacts([fact(), fact()]);
    expect(facts).toHaveLength(1);
  });

  it('descarta hechos vacíos o de solo espacios', () => {
    const { facts, rejected } = sanitizeFacts([fact({ fact: '   ' })]);
    expect(facts).toHaveLength(0);
    expect(rejected).toEqual(['vacio']);
  });

  it('nunca deja pasar más de 3 hechos por respuesta', () => {
    const { facts } = sanitizeFacts([
      fact({ fact: 'uno' }),
      fact({ fact: 'dos' }),
      fact({ fact: 'tres' }),
      fact({ fact: 'cuatro' }),
    ]);
    expect(facts).toHaveLength(3);
  });
});

describe('pickEvictions', () => {
  it('no saca nada mientras quepa', () => {
    const existing = Array.from({ length: 10 }, (_, i) => stored({ id: `id-${i}` }));
    expect(pickEvictions(existing, 3)).toEqual([]);
  });

  it('saca justo los que sobran para no pasar del tope', () => {
    const existing = Array.from({ length: MEMORY_MAX_PER_USER }, (_, i) =>
      stored({ id: `id-${i}` }),
    );
    expect(pickEvictions(existing, 2)).toHaveLength(2);
  });

  it('cae antes el de menor confianza que el más antiguo', () => {
    const existing = [
      stored({ id: 'antiguo-alto', confidence: 'high', created_at: '2020-01-01T00:00:00.000Z' }),
      stored({ id: 'nuevo-bajo', confidence: 'low', created_at: '2026-07-01T00:00:00.000Z' }),
    ];
    // Con el tope lleno hasta el borde, solo cabe uno más.
    const relleno = Array.from({ length: MEMORY_MAX_PER_USER - 2 }, (_, i) =>
      stored({ id: `relleno-${i}`, confidence: 'high', created_at: '2026-07-02T00:00:00.000Z' }),
    );
    expect(pickEvictions([...existing, ...relleno], 1)).toEqual(['nuevo-bajo']);
  });

  it('a igual confianza, cae el más antiguo', () => {
    const existing = [
      stored({ id: 'viejo', created_at: '2020-01-01T00:00:00.000Z' }),
      stored({ id: 'reciente', created_at: '2026-07-01T00:00:00.000Z' }),
      ...Array.from({ length: MEMORY_MAX_PER_USER - 2 }, (_, i) =>
        stored({ id: `relleno-${i}`, created_at: '2026-07-02T00:00:00.000Z' }),
      ),
    ];
    expect(pickEvictions(existing, 1)).toEqual(['viejo']);
  });
});

describe('persistFacts', () => {
  it('escribe siempre con el user_id que le pasa el servidor', async () => {
    const { client, calls } = fakeClient();
    await persistFacts(client, 'usuario-del-jwt', [fact()]);

    expect(calls.listedFor).toEqual(['usuario-del-jwt']);
    expect(calls.inserted).toHaveLength(1);
    expect(calls.inserted[0].userId).toBe('usuario-del-jwt');
  });

  it('un user_id colado en el hecho no llega a la escritura', async () => {
    const { client, calls } = fakeClient();
    // Lo que mandaría un modelo intentando escribir en la memoria de otro.
    const envenenado = { ...fact(), user_id: 'victima' } as CoachMemoryFact;
    await persistFacts(client, 'usuario-del-jwt', [envenenado]);

    expect(calls.inserted[0].userId).toBe('usuario-del-jwt');
    // El campo puede viajar en el objeto, pero el destinatario lo pone el
    // servidor: `insertFacts` recibe el userId como parámetro aparte.
    expect(calls.inserted[0].userId).not.toBe('victima');
  });

  it('no toca la base de datos si no hay nada que recordar', async () => {
    const { client, calls } = fakeClient();
    const result = await persistFacts(client, 'u1', []);

    expect(result).toEqual({ inserted: 0, evicted: 0, rejected: [] });
    expect(calls.listedFor).toEqual([]);
    expect(calls.inserted).toEqual([]);
  });

  it('no inserta ni desaloja nada si todo lo nuevo se descarta', async () => {
    const { client, calls } = fakeClient();
    const result = await persistFacts(client, 'u1', [fact({ fact: 'Toma 5 g de creatina' })]);

    expect(result.inserted).toBe(0);
    expect(calls.inserted).toEqual([]);
    expect(calls.deleted).toEqual([]);
  });

  it('desaloja para hacer sitio cuando la memoria está llena', async () => {
    const existing = Array.from({ length: MEMORY_MAX_PER_USER }, (_, i) =>
      stored({ id: `id-${i}`, fact: `hecho ${i}` }),
    );
    const { client, calls } = fakeClient(existing);
    const result = await persistFacts(client, 'u1', [fact({ fact: 'nuevo hecho' })]);

    expect(result).toMatchObject({ inserted: 1, evicted: 1 });
    expect(calls.deleted[0].ids).toHaveLength(1);
    expect(calls.deleted[0].userId).toBe('u1');
  });
});
