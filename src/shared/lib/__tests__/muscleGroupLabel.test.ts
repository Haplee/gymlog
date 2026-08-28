// El dato guardado y la etiqueta que se lee son cosas distintas: `muscle_group`
// vale «Bíceps» en la base pase lo que pase, y esto solo decide cómo se pinta.
// Estos tests fijan las dos mitades de esa frontera.
import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import { muscleGroupLabel } from '../muscleGroupLabel';
import { MUSCLE_GROUPS } from '@shared/constants/muscleGroups';
import { resources } from '../i18n/resources';

/** `t` de mentira con la misma regla que i18next: si no hay clave, defaultValue. */
const tCon = (diccionario: Record<string, string>): TFunction =>
  ((clave: string, opciones?: { defaultValue?: string }) =>
    diccionario[clave] ?? opciones?.defaultValue ?? clave) as unknown as TFunction;

const EN = resources.en.translation.muscleGroups as Record<string, string>;
const tEn = tCon(Object.fromEntries(Object.entries(EN).map(([k, v]) => [`muscleGroups.${k}`, v])));

describe('muscleGroupLabel', () => {
  it('traduce los grupos del catálogo', () => {
    expect(muscleGroupLabel('Bíceps', tEn)).toBe('Biceps');
    expect(muscleGroupLabel('Pierna', tEn)).toBe('Legs');
    expect(muscleGroupLabel('Glúteo', tEn)).toBe('Glutes');
  });

  it('no depende de acentos ni de mayúsculas', () => {
    // Los nombres llegan de la base, de importaciones y de lo que teclea el
    // usuario: «gluteo» sin tilde es el mismo músculo.
    expect(muscleGroupLabel('gluteo', tEn)).toBe('Glutes');
    expect(muscleGroupLabel('BÍCEPS', tEn)).toBe('Biceps');
    expect(muscleGroupLabel('  Pecho  ', tEn)).toBe('Chest');
  });

  it('devuelve tal cual lo que no está en el catálogo', () => {
    // Un historial importado de Strong puede traer cualquier cosa. Enseñarlo
    // como vino es mejor que enseñar «muscleGroups.lats» o un hueco.
    expect(muscleGroupLabel('Lats', tEn)).toBe('Lats');
    expect(muscleGroupLabel('mi grupo raro', tEn)).toBe('mi grupo raro');
  });

  it('con nada devuelve cadena vacía, no «undefined»', () => {
    expect(muscleGroupLabel(null, tEn)).toBe('');
    expect(muscleGroupLabel(undefined, tEn)).toBe('');
    expect(muscleGroupLabel('', tEn)).toBe('');
  });

  it('TODO grupo del catálogo tiene su clave en los dos idiomas', () => {
    // Este es el test que caza el olvido: si alguien añade un grupo a
    // MUSCLE_GROUPS y no lo traduce, en inglés saldría el literal español y
    // nadie se daría cuenta hasta verlo en el móvil.
    const es = resources.es.translation.muscleGroups as Record<string, string>;
    for (const grupo of MUSCLE_GROUPS) {
      const clave = grupo
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
      expect(es[clave], `falta muscleGroups.${clave} en español`).toBeTruthy();
      expect(EN[clave], `falta muscleGroups.${clave} en inglés`).toBeTruthy();
    }
  });

  it('en español la etiqueta es el propio valor guardado', () => {
    const es = resources.es.translation.muscleGroups as Record<string, string>;
    const tEs = tCon(
      Object.fromEntries(Object.entries(es).map(([k, v]) => [`muscleGroups.${k}`, v])),
    );
    for (const grupo of MUSCLE_GROUPS) {
      expect(muscleGroupLabel(grupo, tEs)).toBe(grupo);
    }
  });
});
