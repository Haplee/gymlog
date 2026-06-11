import { describe, it, expect } from 'vitest';
import { resources } from '../i18n';

type Tree = { [key: string]: string | Tree };

function collectKeys(obj: Tree, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null ? collectKeys(v as Tree, path) : [path];
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
