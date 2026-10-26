import { describe, expect, it } from 'vitest';
import { deriveImportKey, newImportId } from '../importIdentity';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('newImportId', () => {
  it('genera una identidad nueva para cada importación manual', () => {
    const primera = newImportId();
    const segunda = newImportId();

    expect(primera).toMatch(UUID_V4);
    expect(segunda).toMatch(UUID_V4);
    expect(primera).not.toBe(segunda);
  });
});

describe('deriveImportKey', () => {
  const importId = '7a4b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d';

  it('es determinista para el mismo lote', () => {
    const primera = deriveImportKey(importId, 'workout:2026-01-05');
    const segunda = deriveImportKey(importId, 'workout:2026-01-05');

    expect(primera).toBe(segunda);
    expect(primera).toMatch(UUID_V4);
  });

  it('separa lotes de la misma importación', () => {
    const loteA = deriveImportKey(importId, 'workout:2026-01-05');
    const loteB = deriveImportKey(importId, 'workout:2026-01-06');
    const cardio = deriveImportKey(importId, 'cardio:0');

    expect(new Set([loteA, loteB, cardio]).size).toBe(3);
  });

  it('no comparte claves entre importaciones distintas del mismo día', () => {
    const otraImportacion = newImportId();

    expect(deriveImportKey(importId, 'workout:2026-01-05')).not.toBe(
      deriveImportKey(otraImportacion, 'workout:2026-01-05'),
    );
  });

  it('no depende del orden de creación de la importación', () => {
    const clave = deriveImportKey(importId, 'cardio:0');
    const misma = deriveImportKey(importId, 'cardio:0');

    expect(clave).toBe(misma);
  });
});
