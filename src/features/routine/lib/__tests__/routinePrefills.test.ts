import { describe, it, expect } from 'vitest';
import type { Exercise, WorkoutSetWithDetails } from '@shared/lib/types';
import { buildExercisePrefills } from '../routinePrefills';

/** Fila mínima de catálogo; solo importa el nombre y `load_type`. */
function catalogRow(name: string, loadType = 'barbell'): Exercise {
  return { id: name, name, load_type: loadType } as unknown as Exercise;
}

/** Serie reciente mínima; solo importan nombre, peso y calentamiento. */
function set(name: string, weight: number, isWarmup = false): WorkoutSetWithDetails {
  return {
    weight,
    is_warmup: isWarmup,
    exercise: { name },
  } as unknown as WorkoutSetWithDetails;
}

const sinProgresion = () => null;

describe('buildExercisePrefills', () => {
  it('rellena con el último peso registrado cuando no hay ciclo', () => {
    const prefills = buildExercisePrefills(
      [{ name: 'Press banca' }],
      [set('Press banca', 80)],
      [catalogRow('Press banca')],
      'kg',
      (name, last) => (name === 'Press banca' ? last : null),
    );
    expect(prefills).toEqual({ 'press banca': '80' });
  });

  it('gana el primero de la lista: las series llegan de más nueva a más vieja', () => {
    const prefills = buildExercisePrefills(
      [{ name: 'Press banca' }],
      [set('Press banca', 82.5), set('Press banca', 80)],
      [catalogRow('Press banca')],
      'kg',
      (_name, last) => last,
    );
    expect(prefills['press banca']).toBe('82.5');
  });

  it('en peso corporal no rellena carga', () => {
    const prefills = buildExercisePrefills(
      [{ name: 'Dominadas' }],
      [set('Dominadas', 90)],
      [catalogRow('Dominadas', 'bodyweight')],
      'kg',
      () => 90,
    );
    expect(prefills).toEqual({});
  });

  it('ignora las series de calentamiento y los pesos no utilizables', () => {
    const prefills = buildExercisePrefills(
      [{ name: 'Press banca' }],
      [set('Press banca', 100, true), set('Press banca', 0), set('Press banca', 80)],
      [catalogRow('Press banca')],
      'kg',
      (_name, last) => last,
    );
    expect(prefills['press banca']).toBe('80');
  });

  it('convierte a libras cuando esa es la unidad del usuario', () => {
    const prefills = buildExercisePrefills(
      [{ name: 'Press banca' }],
      [set('Press banca', 100)],
      [catalogRow('Press banca')],
      'lb',
      (_name, last) => last,
    );
    expect(prefills['press banca']).toBe('220.5');
  });

  it('sin ciclo ni historial no propone nada', () => {
    const prefills = buildExercisePrefills(
      [{ name: 'Press banca' }],
      [],
      [catalogRow('Press banca')],
      'kg',
      sinProgresion,
    );
    expect(prefills).toEqual({});
  });

  it('un ejercicio sin fila de catálogo se trata como no corporal', () => {
    const prefills = buildExercisePrefills(
      [{ name: 'Inventado' }],
      [set('Inventado', 40)],
      [],
      'kg',
      (_name, last) => last,
    );
    expect(prefills.inventado).toBe('40');
  });

  it('normaliza el nombre: mayúsculas y espacios de sobra no duplican la clave', () => {
    const prefills = buildExercisePrefills(
      [{ name: '  Press Banca  ' }],
      [set('PRESS BANCA', 60)],
      [catalogRow('Press banca')],
      'kg',
      (_name, last) => last,
    );
    expect(Object.keys(prefills)).toEqual(['press banca']);
    expect(prefills['press banca']).toBe('60');
  });

  it('las tildes del nombre no separan la clave del historial', () => {
    const prefills = buildExercisePrefills(
      [{ name: 'Sentadilla búlgara' }],
      [set('Sentadilla bulgara', 40)],
      [catalogRow('Sentadilla búlgara')],
      'kg',
      (_name, last) => last,
    );
    expect(prefills['sentadilla bulgara']).toBe('40');
  });
});
