import { afterEach, describe, expect, it, vi } from 'vitest';
import { isIdempotencyConflict, newIdempotencyKey, retryOnNetwork } from '../idempotency';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('newIdempotencyKey', () => {
  it('genera UUID v4 distintos para operaciones nuevas', () => {
    const primera = newIdempotencyKey();
    const segunda = newIdempotencyKey();

    expect(primera).toMatch(UUID_V4);
    expect(segunda).toMatch(UUID_V4);
    expect(primera).not.toBe(segunda);
  });
});

describe('isIdempotencyConflict', () => {
  it('reconoce el error del contrato del servidor', () => {
    expect(isIdempotencyConflict(new Error('idempotency_conflict'))).toBe(true);
    expect(isIdempotencyConflict('idempotency_conflict')).toBe(true);
    expect(isIdempotencyConflict({ message: 'idempotency_conflict' })).toBe(true);
  });

  it('no confunde otros errores con un conflicto', () => {
    expect(isIdempotencyConflict(new Error('Failed to fetch'))).toBe(false);
    expect(isIdempotencyConflict({ code: '23505', message: 'duplicate key' })).toBe(false);
    expect(isIdempotencyConflict(null)).toBe(false);
  });
});

describe('retryOnNetwork', () => {
  it('reintenta la misma operación ante fallos de red, con esperas crecientes', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const operacion = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('NetworkError when attempting'))
      .mockResolvedValue('guardado');
    const esperas: number[] = [];

    const resultado = await retryOnNetwork(operacion, {
      sleep: async (ms) => {
        esperas.push(ms);
      },
    });

    expect(resultado).toBe('guardado');
    expect(operacion).toHaveBeenCalledTimes(3);
    expect(esperas).toEqual([250, 500]);
  });

  it('no reintenta un error del servidor: repetirlo daría lo mismo', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const errorServidor = Object.assign(new Error('failed to fetch unique row'), {
      code: '23505',
    });
    const operacion = vi.fn().mockRejectedValue(errorServidor);
    const sleep = vi.fn();

    await expect(retryOnNetwork(operacion, { sleep })).rejects.toBe(errorServidor);

    expect(operacion).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('sin conexión no gasta reintentos: encolar es decisión de quien llama', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const operacion = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const sleep = vi.fn();

    await expect(retryOnNetwork(operacion, { sleep })).rejects.toThrow('Failed to fetch');

    expect(operacion).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('agota los intentos y propaga el último error', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const ultimo = new TypeError('Failed to fetch');
    const operacion = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('timeout'))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockRejectedValueOnce(ultimo);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(retryOnNetwork(operacion, { sleep })).rejects.toBe(ultimo);

    expect(operacion).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('con un solo intento no duplica la petición', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const operacion = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(retryOnNetwork(operacion, { attempts: 1 })).rejects.toThrow('Failed to fetch');

    expect(operacion).toHaveBeenCalledTimes(1);
  });
});
