// La biblioteca filtra por tres ejes a la vez y con listas adaptativas: cada
// lista de opciones se calcula sobre lo que dejan los otros. Son las reglas que
// un cambio de UI puede romper en silencio (un chip que desaparece, un recuento
// que no cuadra, una búsqueda que deja de encontrar «gluteo»), así que se fijan
// aquí sin montar React.
import { describe, it, expect } from 'vitest';
import type { LibraryExercise } from '@shared/api/queries';
import {
  EMPTY_FILTERS,
  availableEquipments,
  availableMuscleGroups,
  countByCompoundFilter,
  countByEquipment,
  countByMuscleGroup,
  filterExercises,
  hasActiveFilters,
  matchesQuery,
  normalize,
  type ExerciseFilterState,
} from '../exerciseFilters';

/** Ejercicio de prueba: rellena lo que no importa para que el caso se lea claro. */
function ex(partial: Partial<LibraryExercise> & { id: string; name: string }): LibraryExercise {
  return {
    muscle_group: 'Pecho',
    muscle_detail: null,
    equipment: null,
    movement: null,
    description: null,
    media_url: null,
    is_compound: false,
    is_bilateral: null,
    load_type: 'external',
    ...partial,
  };
}

const banca = ex({
  id: '1',
  name: 'Press banca',
  muscle_group: 'Pecho',
  equipment: 'Barra',
  is_compound: true,
  is_bilateral: true,
});
const aperturas = ex({
  id: '2',
  name: 'Aperturas',
  muscle_group: 'Pecho',
  equipment: 'Mancuernas',
  is_compound: false,
  is_bilateral: true,
});
const remo = ex({
  id: '3',
  name: 'Remo con barra',
  muscle_group: 'Espalda',
  equipment: 'Barra',
  is_compound: true,
  is_bilateral: true,
});
const dominadas = ex({
  id: '4',
  name: 'Dominadas',
  muscle_group: 'Espalda',
  equipment: 'Peso corporal',
  is_compound: true,
  is_bilateral: true,
});
const curl = ex({
  id: '5',
  name: 'Curl de bíceps',
  muscle_group: 'Bíceps',
  equipment: 'Mancuernas',
  is_compound: false,
  is_bilateral: false,
});
const plancha = ex({
  id: '6',
  name: 'Plancha',
  muscle_group: 'Core',
  equipment: 'Peso corporal',
  // Sin marcar: cuenta como aislado, no como compuesto.
  is_compound: null,
  is_bilateral: true,
});
const patadaGluteo = ex({
  id: '7',
  name: 'Patada de glúteo',
  muscle_group: 'Glúteo',
  equipment: 'Polea',
  is_compound: false,
  is_bilateral: false,
});

const todos = [banca, aperturas, remo, dominadas, curl, plancha, patadaGluteo];

function withFilters(partial: Partial<ExerciseFilterState>): ExerciseFilterState {
  return { ...EMPTY_FILTERS, ...partial };
}

describe('normalize', () => {
  it('pasa a minúsculas, recorta y quita los acentos', () => {
    expect(normalize('  Glúteo ')).toBe('gluteo');
    expect(normalize('BÍCEPS')).toBe('biceps');
    expect(normalize('Máquina')).toBe('maquina');
  });
});

describe('matchesQuery', () => {
  it('sin texto encaja siempre', () => {
    expect(matchesQuery(banca, '')).toBe(true);
    expect(matchesQuery(banca, '   ')).toBe(true);
  });

  it('no depende de acentos ni de mayúsculas', () => {
    expect(matchesQuery(patadaGluteo, 'GLUTEO')).toBe(true);
    expect(matchesQuery(curl, 'biceps')).toBe(true);
  });

  it('busca también por material, no solo por nombre', () => {
    // «mancuerna» es una búsqueda que la gente hace para ver todo lo que se
    // hace con mancuernas, aunque la palabra no esté en el nombre.
    expect(matchesQuery(curl, 'mancuerna')).toBe(true);
    expect(matchesQuery(banca, 'mancuerna')).toBe(false);
  });
});

describe('filterExercises', () => {
  it('sin filtros devuelve todo', () => {
    expect(filterExercises(todos, EMPTY_FILTERS)).toHaveLength(todos.length);
  });

  it('combina músculo, material y tipo a la vez', () => {
    const resultado = filterExercises(
      todos,
      withFilters({ muscleGroup: 'Pecho', equipment: 'Barra', compound: 'compound' }),
    );
    expect(resultado.map((e) => e.id)).toEqual(['1']);
  });

  it('el lado «aislado» incluye lo que no está marcado como compuesto', () => {
    const resultado = filterExercises(
      todos,
      withFilters({ muscleGroup: 'Pecho', compound: 'isolation' }),
    );
    expect(resultado.map((e) => e.id)).toEqual(['2']);
    // La plancha tiene is_compound null: entra en aislado, no en compuesto.
    expect(
      filterExercises(todos, withFilters({ compound: 'isolation' })).map((e) => e.id),
    ).toContain('6');
    expect(
      filterExercises(todos, withFilters({ compound: 'compound' })).map((e) => e.id),
    ).not.toContain('6');
  });

  it('acumula búsqueda y filtros en lugar de pisarse', () => {
    const resultado = filterExercises(
      todos,
      withFilters({ query: 'remo', muscleGroup: 'Espalda' }),
    );
    expect(resultado.map((e) => e.id)).toEqual(['3']);
    // El mismo texto con otro músculo no encuentra nada.
    expect(filterExercises(todos, withFilters({ query: 'remo', muscleGroup: 'Pecho' }))).toEqual(
      [],
    );
  });

  it('limpiar los filtros devuelve la lista entera', () => {
    const filtrado = filterExercises(todos, withFilters({ muscleGroup: 'Pecho', query: 'press' }));
    expect(filtrado).toHaveLength(1);
    // Lo que hace el botón «Limpiar» es volver al estado inicial.
    expect(filterExercises(todos, EMPTY_FILTERS)).toHaveLength(todos.length);
  });
});

describe('hasActiveFilters', () => {
  it('el estado inicial no está filtrado', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('un texto en blanco no cuenta como filtro', () => {
    expect(hasActiveFilters(withFilters({ query: '   ' }))).toBe(false);
  });

  it('cualquier eje activo lo enciende', () => {
    expect(hasActiveFilters(withFilters({ query: 'press' }))).toBe(true);
    expect(hasActiveFilters(withFilters({ muscleGroup: 'Pecho' }))).toBe(true);
    expect(hasActiveFilters(withFilters({ equipment: 'Barra' }))).toBe(true);
    expect(hasActiveFilters(withFilters({ compound: 'compound' }))).toBe(true);
  });
});

describe('countByMuscleGroup / countByEquipment', () => {
  it('cuenta los ejercicios de cada grupo y de cada material', () => {
    const musculos = countByMuscleGroup(todos);
    expect(musculos.get('Pecho')).toBe(2);
    expect(musculos.get('Espalda')).toBe(2);

    const materiales = countByEquipment(todos);
    expect(materiales.get('Barra')).toBe(2);
    expect(materiales.get('Peso corporal')).toBe(2);
  });

  it('ignora los valores vacíos sin crear una opción fantasma', () => {
    const sinDatos = [ex({ id: 'x', name: 'Suelto', muscle_group: '', equipment: null })];
    expect(countByMuscleGroup(sinDatos).size).toBe(0);
    expect(countByEquipment(sinDatos).size).toBe(0);
  });
});

describe('availableMuscleGroups', () => {
  it('ordena por el catálogo, no por el idioma, y deja los desconocidos al final', () => {
    const conDesconocido = [...todos, ex({ id: '8', name: 'Jalón', muscle_group: 'Lats' })];
    const opciones = availableMuscleGroups(conDesconocido, EMPTY_FILTERS).map((o) => o.value);
    // Orden de MUSCLE_GROUPS: Pecho, Espalda, Glúteo, Bíceps, Core… y «Lats» al final.
    expect(opciones).toEqual(['Pecho', 'Espalda', 'Glúteo', 'Bíceps', 'Core', 'Lats']);
  });

  it('cuenta lo que quedaría al elegir cada grupo', () => {
    const opciones = availableMuscleGroups(todos, EMPTY_FILTERS);
    expect(opciones.find((o) => o.value === 'Pecho')?.count).toBe(2);
    expect(opciones.find((o) => o.value === 'Bíceps')?.count).toBe(1);
  });

  it('se calcula sin aplicarse a sí mismo: al elegir un grupo siguen estando los demás', () => {
    // Es la propiedad que evita quedarse atrapado: si el filtro de músculo se
    // aplicara a su propia lista, al elegir «Pecho» desaparecerían los otros
    // grupos y no habría forma de cambiar sin limpiar antes.
    const opciones = availableMuscleGroups(todos, withFilters({ muscleGroup: 'Pecho' })).map(
      (o) => o.value,
    );
    expect(opciones).toContain('Espalda');
    expect(opciones).toContain('Bíceps');
  });

  it('sí respeta los otros ejes', () => {
    const opciones = availableMuscleGroups(todos, withFilters({ equipment: 'Barra' })).map(
      (o) => o.value,
    );
    expect(opciones).toEqual(['Pecho', 'Espalda']);
  });

  it('conserva el grupo activo aunque se quede sin resultados', () => {
    // Quitarle el chip de debajo al usuario dejaría la pantalla vacía sin nada
    // que pulsar para volver.
    const opciones = availableMuscleGroups(
      todos,
      withFilters({ muscleGroup: 'Pecho', equipment: 'Polea' }),
    );
    expect(opciones.find((o) => o.value === 'Pecho')?.count).toBe(0);
  });
});

describe('availableEquipments', () => {
  it('ordena por el catálogo de materiales', () => {
    const opciones = availableEquipments(todos, EMPTY_FILTERS).map((o) => o.value);
    expect(opciones).toEqual(['Barra', 'Mancuernas', 'Polea', 'Peso corporal']);
  });

  it('es adaptativo al grupo muscular elegido', () => {
    const opciones = availableEquipments(todos, withFilters({ muscleGroup: 'Pecho' })).map(
      (o) => o.value,
    );
    expect(opciones).toEqual(['Barra', 'Mancuernas']);
  });

  it('cuenta lo que quedaría al elegir cada material', () => {
    const opciones = availableEquipments(todos, EMPTY_FILTERS);
    expect(opciones.find((o) => o.value === 'Barra')?.count).toBe(2);
    expect(opciones.find((o) => o.value === 'Polea')?.count).toBe(1);
  });
});

describe('countByCompoundFilter', () => {
  it('cuenta compuestos y aislados y da el total', () => {
    expect(countByCompoundFilter(todos, EMPTY_FILTERS)).toEqual({
      all: 7,
      compound: 3,
      isolation: 4,
    });
  });

  it('el recuento respeta los otros ejes', () => {
    expect(countByCompoundFilter(todos, withFilters({ muscleGroup: 'Pecho' }))).toEqual({
      all: 2,
      compound: 1,
      isolation: 1,
    });
  });
});
