/**
 * Escalón mínimo por tipo de material.
 *
 * El bug que cubre: `smallestLoadStep(discos)` se llamaba en las cuatro
 * pantallas sin decir de qué material se hablaba, así que devolvía siempre «el
 * doble del disco más fino». Eso es la barra. Unas elevaciones laterales con
 * mancuerna recibían un escalón de 2,5 kg —inexistente si las mancuernas van de
 * dos en dos— y una prensa de placas, lo mismo, cuando su salto lo marca la
 * columna y no el rack de discos.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DUMBBELL_STEP_KG,
  DEFAULT_MACHINE_STEP_KG,
  equipmentFamily,
  loadStepForExercise,
  smallestLoadStep,
} from '../loadStep';

const discos = [20, 10, 5, 2.5, 1.25];

describe('equipmentFamily', () => {
  it('clasifica lo que trae el catálogo de ExerciseDB', () => {
    expect(equipmentFamily('barbell')).toBe('barbell');
    expect(equipmentFamily('Smith machine')).toBe('barbell');
    expect(equipmentFamily('dumbbell')).toBe('dumbbell');
    expect(equipmentFamily('leverage machine')).toBe('machine');
    expect(equipmentFamily('cable')).toBe('machine');
  });

  it('entiende también lo que escribe un usuario en español', () => {
    expect(equipmentFamily('Barra olímpica')).toBe('barbell');
    expect(equipmentFamily('Mancuernas')).toBe('dumbbell');
    expect(equipmentFamily('Polea alta')).toBe('machine');
    expect(equipmentFamily('Máquina de placas')).toBe('machine');
  });

  it('lo que no reconoce cae en «other», no en una familia inventada', () => {
    expect(equipmentFamily('band')).toBe('other');
    expect(equipmentFamily('')).toBe('other');
    expect(equipmentFamily(null)).toBe('other');
  });
});

describe('loadStepForExercise', () => {
  it('barra: el disco más fino, por pares', () => {
    expect(loadStepForExercise('barbell', { platesKg: discos })).toBe(2.5);
  });

  it('mancuerna: su propio salto, no el de los discos', () => {
    expect(loadStepForExercise('dumbbell', { platesKg: discos, dumbbellStepKg: 2 })).toBe(2);
    expect(loadStepForExercise('dumbbell', { platesKg: discos })).toBe(DEFAULT_DUMBBELL_STEP_KG);
  });

  it('máquina: el salto de la columna de placas', () => {
    expect(loadStepForExercise('cable', { platesKg: discos, machineStepKg: 5 })).toBe(5);
    expect(loadStepForExercise('leverage machine', { platesKg: discos })).toBe(
      DEFAULT_MACHINE_STEP_KG,
    );
  });

  it('material desconocido conserva el comportamiento de siempre', () => {
    // Es lo conservador: es lo que la app hacía con absolutamente todo.
    expect(loadStepForExercise(null, { platesKg: discos })).toBe(smallestLoadStep(discos));
  });

  it('un escalón de cero o negativo no se acepta: se cae al valor por defecto', () => {
    // Un escalón de 0 dejaría al motor sin salto montable y respondería siempre
    // «por carga no toca».
    expect(loadStepForExercise('dumbbell', { dumbbellStepKg: 0 })).toBe(DEFAULT_DUMBBELL_STEP_KG);
    expect(loadStepForExercise('machine', { machineStepKg: -5 })).toBe(DEFAULT_MACHINE_STEP_KG);
  });

  it('el gimnasio del usuario manda en la barra', () => {
    // Solo discos de 5 kg: el salto real es 10, no 2,5.
    expect(loadStepForExercise('barbell', { platesKg: [20, 10, 5] })).toBe(10);
    // Con micro-discos, la progresión fina que sí tiene disponible.
    expect(loadStepForExercise('barbell', { platesKg: [20, 10, 5, 1.25, 0.5] })).toBe(1);
  });
});
