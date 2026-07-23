import { describe, it, expect } from 'vitest';
import { resources } from '../i18n';

type Tree = { [key: string]: string | string[] | Tree };

// Las listas (t(..., { returnObjects: true })) son hojas: comparamos la clave y
// su longitud, no cada índice, para que el fallo señale la lista y no 4 índices.
function collectKeys(obj: Tree, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) return [`${path}[${v.length}]`];
    return typeof v === 'object' && v !== null ? collectKeys(v, path) : [path];
  });
}

describe('paridad de claves i18n es/en', () => {
  it('es y en tienen exactamente las mismas claves', () => {
    const esKeys = collectKeys(resources.es.translation as Tree).sort();
    const enKeys = collectKeys(resources.en.translation as Tree).sort();

    const missingInEn = esKeys.filter((k) => !enKeys.includes(k));
    const missingInEs = enKeys.filter((k) => !esKeys.includes(k));

    expect(missingInEn, `Claves sin traducir a en: ${missingInEn.join(', ')}`).toEqual([]);
    expect(missingInEs, `Claves sin traducir a es: ${missingInEs.join(', ')}`).toEqual([]);
  });
});
