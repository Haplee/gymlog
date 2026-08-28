// Mismo reparto que en `muscleGroupLabel`: el valor guardado manda y solo se
// traduce la etiqueta. Aquí importa además no confundir este camino con
// `translateEquipment` de `exerciseVocab`, que va en la dirección contraria.
import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import { equipmentLabel } from '../equipmentLabel';
import { EQUIPMENT_TYPES } from '@shared/constants/equipment';
import { resources } from '../i18n/resources';

const tCon = (diccionario: Record<string, string>): TFunction =>
  ((clave: string, opciones?: { defaultValue?: string }) =>
    diccionario[clave] ?? opciones?.defaultValue ?? clave) as unknown as TFunction;

const conPrefijo = (bloque: Record<string, string>) =>
  tCon(Object.fromEntries(Object.entries(bloque).map(([k, v]) => [`equipment.${k}`, v])));

const EN = resources.en.translation.equipment as Record<string, string>;
const ES = resources.es.translation.equipment as Record<string, string>;
const tEn = conPrefijo(EN);

describe('equipmentLabel', () => {
  it('traduce el equipamiento del catálogo propio', () => {
    expect(equipmentLabel('Mancuernas', tEn)).toBe('Dumbbells');
    expect(equipmentLabel('Máquina', tEn)).toBe('Machine');
    expect(equipmentLabel('Polea', tEn)).toBe('Cable');
  });

  it('resuelve los valores de varias palabras', () => {
    // «Peso corporal» lleva espacio: la clave es `peso_corporal`, y si la
    // normalización dejara de sustituirlo el valor saldría sin traducir.
    expect(equipmentLabel('Peso corporal', tEn)).toBe('Bodyweight');
    expect(equipmentLabel('peso corporal', tEn)).toBe('Bodyweight');
  });

  it('devuelve tal cual lo que no conoce', () => {
    // El catálogo público de ExerciseDB trae los suyos en inglés («assisted»,
    // «smith machine»): no son de este enum y no se tocan.
    expect(equipmentLabel('assisted', tEn)).toBe('assisted');
    expect(equipmentLabel(null, tEn)).toBe('');
  });

  it('TODO equipamiento del enum tiene su clave en los dos idiomas', () => {
    for (const equipo of EQUIPMENT_TYPES) {
      const clave = equipo
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, '_');
      expect(ES[clave], `falta equipment.${clave} en español`).toBeTruthy();
      expect(EN[clave], `falta equipment.${clave} en inglés`).toBeTruthy();
    }
  });

  it('en español la etiqueta es el propio valor guardado', () => {
    const tEs = conPrefijo(ES);
    for (const equipo of EQUIPMENT_TYPES) {
      expect(equipmentLabel(equipo, tEs)).toBe(equipo);
    }
  });
});
