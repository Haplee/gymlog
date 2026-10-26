import { afterEach, describe, expect, it, vi } from 'vitest';
import { withImportLock } from '../importLock';

/** Web Locks falso con la misma semántica de turno que el del navegador. */
function instalarWebLocksFalsos() {
  let cadena: Promise<unknown> = Promise.resolve();
  let enCurso = 0;
  const estado = { maxConcurrentes: 0, nombres: [] as string[] };
  const request = vi.fn((nombre: string, tarea: () => Promise<unknown>) => {
    estado.nombres.push(nombre);
    const ejecutar = async () => {
      enCurso += 1;
      estado.maxConcurrentes = Math.max(estado.maxConcurrentes, enCurso);
      try {
        return await tarea();
      } finally {
        enCurso -= 1;
      }
    };
    const run = cadena.then(ejecutar, ejecutar);
    cadena = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  });
  vi.stubGlobal('navigator', { locks: { request } });
  return { request, estado };
}

/** Tarea que se queda a medias hasta que el test la suelta. */
function tareaControlada(orden: string[], nombre: string) {
  let soltar!: () => void;
  const espera = new Promise<void>((resolve) => {
    soltar = resolve;
  });
  const tarea = async () => {
    orden.push(`${nombre}:entra`);
    await espera;
    orden.push(`${nombre}:sale`);
    return nombre;
  };
  return { tarea, soltar };
}

describe('withImportLock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sin Web Locks serializa dentro de la pestaña', async () => {
    vi.stubGlobal('navigator', {});
    const orden: string[] = [];
    const a = tareaControlada(orden, 'a');
    const b = tareaControlada(orden, 'b');

    const primera = withImportLock(a.tarea);
    const segunda = withImportLock(b.tarea);

    // La segunda no puede entrar hasta que la primera termine.
    await Promise.resolve();
    await Promise.resolve();
    expect(orden).toEqual(['a:entra']);

    a.soltar();
    await expect(primera).resolves.toBe('a');
    await Promise.resolve();
    expect(orden).toEqual(['a:entra', 'a:sale', 'b:entra']);

    b.soltar();
    await expect(segunda).resolves.toBe('b');
    expect(orden).toEqual(['a:entra', 'a:sale', 'b:entra', 'b:sale']);
  });

  it('con Web Locks usa el cerrojo del origen', async () => {
    const { request, estado } = instalarWebLocksFalsos();
    const orden: string[] = [];
    const a = tareaControlada(orden, 'a');
    const b = tareaControlada(orden, 'b');

    const primera = withImportLock(a.tarea);
    const segunda = withImportLock(b.tarea);

    await Promise.resolve();
    expect(estado.nombres).toEqual(['gymlog-history-import', 'gymlog-history-import']);
    expect(request).toHaveBeenCalledTimes(2);

    a.soltar();
    await primera;
    b.soltar();
    await segunda;

    expect(estado.maxConcurrentes).toBe(1);
    expect(orden).toEqual(['a:entra', 'a:sale', 'b:entra', 'b:sale']);
  });

  it('un fallo no deja la cola atascada ni se traga el error', async () => {
    vi.stubGlobal('navigator', {});
    const fallo = new Error('boom');

    await expect(withImportLock(async () => Promise.reject(fallo))).rejects.toBe(fallo);
    await expect(withImportLock(async () => 'siguiente')).resolves.toBe('siguiente');
  });
});
