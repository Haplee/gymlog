/**
 * La tabla de alias del mapa muscular.
 *
 * Es la pieza frágil: los nombres de grupo llegan de sitios que no controlamos
 * —ejercicios creados a mano, importaciones de Strong o Hevy, el catálogo
 * público— y un nombre que no se reconoce deja el músculo en gris. El fallo sería
 * silencioso: una silueta apagada parece «no entrenado», no «no te he entendido».
 */
import { describe, it, expect } from 'vitest';
import {
  GRUPOS_DEL_MAPA,
  MAPA_ESPALDA,
  MAPA_FRENTE,
  MAPA_VIEWBOX,
  grupoDelMapa,
} from '../muscleMap';
import { MUSCLE_GROUPS, DEFAULT_MUSCLE_GROUP } from '../muscleGroups';

describe('grupoDelMapa', () => {
  it('reconoce los grupos del catálogo tal cual', () => {
    for (const g of ['Pecho', 'Espalda', 'Hombro', 'Pierna', 'Glúteo', 'Core']) {
      expect(grupoDelMapa(g), g).toBe(g);
    }
  });

  it('no depende de acentos ni mayúsculas', () => {
    // «Gluteo» sin tilde es lo que escribe media España en un ejercicio propio.
    expect(grupoDelMapa('gluteo')).toBe('Glúteo');
    expect(grupoDelMapa('GLÚTEO')).toBe('Glúteo');
    expect(grupoDelMapa('  Bíceps  ')).toBe('Bíceps');
    expect(grupoDelMapa('biceps')).toBe('Bíceps');
  });

  it('entiende los nombres en inglés de los importadores', () => {
    expect(grupoDelMapa('chest')).toBe('Pecho');
    expect(grupoDelMapa('hamstrings')).toBe('Pierna');
    expect(grupoDelMapa('glutes')).toBe('Glúteo');
    expect(grupoDelMapa('abs')).toBe('Core');
  });

  it('agrupa los músculos que el mapa dibuja juntos', () => {
    // Cuádriceps, femoral y gemelo son una sola región: el catálogo no los
    // separa, así que el mapa tampoco puede fingir que sí.
    expect(grupoDelMapa('cuadriceps')).toBe('Pierna');
    expect(grupoDelMapa('gemelos')).toBe('Pierna');
    expect(grupoDelMapa('dorsales')).toBe('Espalda');
    expect(grupoDelMapa('trapecio')).toBe('Espalda');
    expect(grupoDelMapa('lumbar')).toBe('Core');
  });

  it('devuelve null para lo que no tiene sitio en un cuerpo', () => {
    // Pintarlos en alguna región elegida a dedo sería inventarse un músculo.
    expect(grupoDelMapa('Cardio')).toBeNull();
    expect(grupoDelMapa(DEFAULT_MUSCLE_GROUP)).toBeNull();
    expect(grupoDelMapa('Chikung lunar')).toBeNull();
  });

  it('no revienta con nada vacío', () => {
    expect(grupoDelMapa(null)).toBeNull();
    expect(grupoDelMapa(undefined)).toBeNull();
    expect(grupoDelMapa('')).toBeNull();
    expect(grupoDelMapa('   ')).toBeNull();
  });

  it('TODO grupo del catálogo se dibuja o se descarta a propósito', () => {
    // El invariante que importa: si mañana alguien añade un grupo a
    // `MUSCLE_GROUPS` y no lo mapea, este test lo caza en vez de dejar un
    // músculo apagado para siempre.
    const sinSitio = ['Cardio', DEFAULT_MUSCLE_GROUP];
    for (const g of MUSCLE_GROUPS) {
      if (sinSitio.includes(g)) {
        expect(grupoDelMapa(g), `${g} no debería mapearse`).toBeNull();
      } else {
        expect(grupoDelMapa(g), `${g} no está en la tabla de alias`).not.toBeNull();
      }
    }
  });
});

describe('geometría del mapa', () => {
  it('todo grupo dibujado es un grupo real del catálogo', () => {
    for (const g of GRUPOS_DEL_MAPA) {
      expect(MUSCLE_GROUPS, `${g} no existe en MUSCLE_GROUPS`).toContain(g);
    }
  });

  it('ninguna forma se sale del lienzo', () => {
    // Una forma fuera del viewBox se recorta sin avisar y el músculo desaparece.
    for (const region of [...MAPA_FRENTE, ...MAPA_ESPALDA]) {
      for (const f of region.formas) {
        const [x1, y1, x2, y2] =
          f.k === 'e'
            ? [f.cx - f.rx, f.cy - f.ry, f.cx + f.rx, f.cy + f.ry]
            : [f.x, f.y, f.x + f.w, f.y + f.h];

        expect(x1, `${region.grupo} se sale por la izquierda`).toBeGreaterThanOrEqual(0);
        expect(y1, `${region.grupo} se sale por arriba`).toBeGreaterThanOrEqual(0);
        expect(x2, `${region.grupo} se sale por la derecha`).toBeLessThanOrEqual(
          MAPA_VIEWBOX.ancho,
        );
        expect(y2, `${region.grupo} se sale por abajo`).toBeLessThanOrEqual(MAPA_VIEWBOX.alto);
      }
    }
  });

  it('la vista frontal no dibuja músculos de espalda, ni al revés', () => {
    const frente = MAPA_FRENTE.map((r) => r.grupo);
    const espalda = MAPA_ESPALDA.map((r) => r.grupo);

    expect(frente).toContain('Pecho');
    expect(frente).toContain('Bíceps');
    expect(frente).not.toContain('Espalda');
    expect(frente).not.toContain('Glúteo');
    expect(frente).not.toContain('Tríceps');

    expect(espalda).toContain('Espalda');
    expect(espalda).toContain('Glúteo');
    expect(espalda).toContain('Tríceps');
    expect(espalda).not.toContain('Pecho');
    expect(espalda).not.toContain('Bíceps');
  });

  it('ninguna región se queda sin formas', () => {
    for (const region of [...MAPA_FRENTE, ...MAPA_ESPALDA]) {
      expect(region.formas.length, `${region.grupo} no dibuja nada`).toBeGreaterThan(0);
    }
  });
});
