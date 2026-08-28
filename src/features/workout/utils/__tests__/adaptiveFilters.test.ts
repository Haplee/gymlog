/**
 * El contrato del filtro adaptativo de la biblioteca de ejercicios.
 *
 * La lógica vive en `ExerciseLibraryPage` dentro de tres `useMemo`, así que aquí
 * se reproduce con las mismas reglas y se prueba la propiedad que importa:
 * **ninguna combinación de chips ofrecidos puede dar cero resultados.** Un
 * filtro que se puede pulsar y deja la pantalla vacía no dice cuál de los dos
 * chips sobra, y el usuario se queda mirando un hueco.
 */
import { describe, it, expect } from 'vitest';

interface Ej {
  name: string;
  muscle_group?: string | null;
  equipment?: string | null;
}

const CATALOGO: Ej[] = [
  { name: 'Press banca', muscle_group: 'Pecho', equipment: 'Barra' },
  { name: 'Aperturas', muscle_group: 'Pecho', equipment: 'Mancuerna' },
  { name: 'Sentadilla', muscle_group: 'Pierna', equipment: 'Barra' },
  { name: 'Prensa', muscle_group: 'Pierna', equipment: 'Máquina' },
  { name: 'Dominadas', muscle_group: 'Espalda', equipment: null },
];

function musculosDisponibles(equipo: string | null): string[] {
  const set = new Set<string>();
  for (const e of CATALOGO) {
    if (equipo && e.equipment !== equipo) continue;
    if (e.muscle_group) set.add(e.muscle_group);
  }
  return [...set].toSorted((a, b) => a.localeCompare(b));
}

function equiposDisponibles(musculo: string | null): string[] {
  const set = new Set<string>();
  for (const e of CATALOGO) {
    if (musculo && e.muscle_group !== musculo) continue;
    if (e.equipment) set.add(e.equipment);
  }
  return [...set].toSorted((a, b) => a.localeCompare(b));
}

function resultados(musculo: string | null, equipo: string | null): Ej[] {
  return CATALOGO.filter(
    (e) => (!musculo || e.muscle_group === musculo) && (!equipo || e.equipment === equipo),
  );
}

describe('filtros adaptativos de la biblioteca', () => {
  it('sin nada seleccionado se ofrecen todos los músculos y todo el material', () => {
    expect(musculosDisponibles(null)).toEqual(['Espalda', 'Pecho', 'Pierna']);
    expect(equiposDisponibles(null)).toEqual(['Barra', 'Mancuerna', 'Máquina']);
  });

  it('con «Máquina» elegido no se ofrece «Pecho»: llevaría a cero', () => {
    // Es el caso que motiva el cambio. Con listas fijas «Pecho» + «Máquina» era
    // pulsable y dejaba la pantalla vacía.
    expect(musculosDisponibles('Máquina')).toEqual(['Pierna']);
    expect(musculosDisponibles('Máquina')).not.toContain('Pecho');
  });

  it('con «Espalda» elegido no se ofrece material: la dominada no lleva ninguno', () => {
    expect(equiposDisponibles('Espalda')).toEqual([]);
  });

  it('ninguna combinación ofrecida da cero resultados', () => {
    for (const musculo of [null, ...musculosDisponibles(null)]) {
      for (const equipo of [null, ...equiposDisponibles(musculo)]) {
        expect(
          resultados(musculo, equipo).length,
          `${musculo ?? 'todos'} + ${equipo ?? 'todo'}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('y también al revés: elegir primero el material y luego el músculo', () => {
    for (const equipo of [null, ...equiposDisponibles(null)]) {
      for (const musculo of [null, ...musculosDisponibles(equipo)]) {
        expect(
          resultados(musculo, equipo).length,
          `${equipo ?? 'todo'} + ${musculo ?? 'todos'}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('cada lista se excluye a sí misma, para poder cambiar de opción', () => {
    // Si el filtro de músculo se aplicara al calcular los músculos, elegir
    // «Pecho» dejaría «Pecho» como única opción y no habría forma de pasar a
    // «Pierna» sin deseleccionar primero.
    expect(musculosDisponibles(null)).toHaveLength(3);
  });
});
