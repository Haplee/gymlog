// @vitest-environment jsdom
// shareRoutine importa el store de rutinas, que arrastra el cliente de Supabase
// y este necesita `window`. El módulo bajo prueba es puro; el entorno es por la
// cadena de imports, no por lo que se prueba.
import { describe, it, expect } from 'vitest';
import {
  buildSharedRoutine,
  serializeSharedRoutine,
  sharedRoutineFileName,
  parseSharedRoutine,
  sharedRoutineToStore,
  SharedRoutineError,
  SHARE_KIND,
} from '../shareRoutine';
import { DAY_ORDER, type Routine } from '@features/routine/stores/routineStore';
import { buildRoutinePrintHtml, formatearReps } from '../printRoutine';

const vacios = (): Routine['days'] => {
  const days = {} as Routine['days'];
  for (const d of DAY_ORDER) days[d] = { name: '', exercises: [] };
  return days;
};

const rutina = (): Routine => ({
  id: 'r1',
  name: 'Fuerza básica',
  description: 'Tres días a la semana',
  days: {
    ...vacios(),
    monday: {
      name: 'Empuje',
      exercises: [
        { name: 'Press banca', sets: 3, reps: '6-8', notes: 'Codos 45°' },
        { name: 'Fondos', sets: 3, reps: 'AMRAP' },
      ],
    },
    thursday: { name: 'Tirón', exercises: [{ name: 'Dominadas', sets: 4, reps: '5' }] },
  },
  isCustom: true,
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('buildSharedRoutine', () => {
  it('solo incluye los días con ejercicios', () => {
    const s = buildSharedRoutine(rutina());
    expect(s.days.map((d) => d.day)).toEqual(['monday', 'thursday']);
  });

  it('mantiene el orden de la semana aunque el objeto no lo tenga', () => {
    const r = rutina();
    const s = buildSharedRoutine(r);
    expect(s.days[0].day).toBe('monday');
    expect(s.days[1].day).toBe('thursday');
  });

  it('no filtra nada personal: ni id, ni fecha de creación, ni entrenamientos', () => {
    const serializado = serializeSharedRoutine(rutina());
    expect(serializado).not.toContain('r1');
    expect(serializado).not.toContain('createdAt');
    expect(serializado).not.toContain('isCustom');
    // Ni rastro de pesos levantados o pesajes: el fichero es solo el plan.
    expect(serializado).not.toMatch(/weight|workout|body_measurement/i);
  });

  it('omite los campos opcionales vacíos', () => {
    const s = buildSharedRoutine(rutina());
    const fondos = s.days[0].exercises[1];
    expect(fondos).not.toHaveProperty('notes');
    expect(fondos.reps).toBe('AMRAP');
  });
});

describe('sharedRoutineFileName', () => {
  it('quita acentos y espacios', () => {
    expect(sharedRoutineFileName(rutina())).toBe('rutina-fuerza-basica.json');
  });

  it('aguanta un nombre solo de símbolos', () => {
    const r = { ...rutina(), name: '★★★' };
    expect(sharedRoutineFileName(r)).toBe('rutina-gymlog.json');
  });
});

describe('parseSharedRoutine', () => {
  const bueno = () => JSON.parse(serializeSharedRoutine(rutina()));

  it('acepta un fichero generado por la propia app (ida y vuelta)', () => {
    const leido = parseSharedRoutine(bueno());
    expect(leido.name).toBe('Fuerza básica');
    expect(leido.days).toHaveLength(2);
    expect(leido.days[0].exercises[0].name).toBe('Press banca');
  });

  it('rechaza algo que no es una rutina de GymLog', () => {
    expect(() => parseSharedRoutine({ hola: 'mundo' })).toThrow(SharedRoutineError);
    expect(() => parseSharedRoutine(null)).toThrow(SharedRoutineError);
    expect(() => parseSharedRoutine('texto')).toThrow(SharedRoutineError);
  });

  it('rechaza un formato más nuevo en vez de leerlo a medias', () => {
    expect(() => parseSharedRoutine({ ...bueno(), version: 99 })).toThrow(SharedRoutineError);
  });

  it('descarta días inventados y ejercicios sin nombre', () => {
    const sucio = {
      ...bueno(),
      days: [
        { day: 'lunesdeverdad', name: 'X', exercises: [{ name: 'A' }] },
        { day: 'monday', name: 'Empuje', exercises: [{ name: '' }, { name: 'Press banca' }] },
      ],
    };
    const leido = parseSharedRoutine(sucio);
    expect(leido.days).toHaveLength(1);
    expect(leido.days[0].exercises).toHaveLength(1);
  });

  it('recorta textos desmedidos en vez de tragárselos', () => {
    const largo = 'x'.repeat(5000);
    const leido = parseSharedRoutine({
      ...bueno(),
      name: largo,
      days: [{ day: 'monday', name: 'D', exercises: [{ name: largo }] }],
    });
    expect(leido.name.length).toBeLessThanOrEqual(200);
    expect(leido.days[0].exercises[0].name.length).toBeLessThanOrEqual(200);
  });

  it('rechaza una rutina que se queda sin ningún día válido', () => {
    expect(() => parseSharedRoutine({ ...bueno(), days: [] })).toThrow(SharedRoutineError);
  });

  it('ignora un número de series absurdo', () => {
    const leido = parseSharedRoutine({
      ...bueno(),
      days: [{ day: 'monday', name: 'D', exercises: [{ name: 'Press', sets: 9999 }] }],
    });
    expect(leido.days[0].exercises[0].sets).toBeUndefined();
  });
});

describe('sharedRoutineToStore', () => {
  it('genera un id nuevo: importar dos veces no machaca la primera', () => {
    const shared = parseSharedRoutine(JSON.parse(serializeSharedRoutine(rutina())));
    let n = 0;
    const a = sharedRoutineToStore(shared, () => `id-${++n}`);
    const b = sharedRoutineToStore(shared, () => `id-${++n}`);
    expect(a.id).not.toBe(b.id);
    expect(a.id).not.toBe('r1');
  });

  it('deja los siete días presentes, vacíos los que no vienen', () => {
    const shared = parseSharedRoutine(JSON.parse(serializeSharedRoutine(rutina())));
    const r = sharedRoutineToStore(shared, () => 'x');
    expect(Object.keys(r.days).sort()).toEqual([...DAY_ORDER].sort());
    expect(r.days.tuesday.exercises).toEqual([]);
    expect(r.days.monday.exercises).toHaveLength(2);
  });

  it('la rutina importada queda marcada como propia', () => {
    const shared = parseSharedRoutine(JSON.parse(serializeSharedRoutine(rutina())));
    expect(sharedRoutineToStore(shared, () => 'x').isCustom).toBe(true);
  });
});

describe('buildRoutinePrintHtml', () => {
  const html = () => buildRoutinePrintHtml(buildSharedRoutine(rutina()), new Date('2026-08-25'));

  it('saca los días y ejercicios en la hoja', () => {
    const h = html();
    expect(h).toContain('Fuerza básica');
    expect(h).toContain('Lunes');
    expect(h).toContain('Jueves');
    expect(h).toContain('Press banca');
    expect(h).toContain('Dominadas');
  });

  it('dibuja una casilla por serie para apuntar a boli', () => {
    const h = html();
    // 3 + 3 + 4 series = 10 casillas
    expect((h.match(/class="casilla"/g) ?? []).length).toBe(10);
  });

  it('escapa el HTML que venga en el nombre de un ejercicio', () => {
    const r = rutina();
    r.days.monday.exercises[0].name = '<script>alert(1)</script>';
    const h = buildRoutinePrintHtml(buildSharedRoutine(r));
    expect(h).not.toContain('<script>alert(1)</script>');
    expect(h).toContain('&lt;script&gt;');
  });

  it('es un documento autocontenido, sin recursos externos', () => {
    const h = html();
    expect(h).not.toMatch(/https?:\/\//);
    expect(h).not.toContain('<img');
    expect(h).not.toContain('<link');
  });

  it('evita que un día se parta entre dos hojas', () => {
    expect(html()).toContain('page-break-inside: avoid');
  });

  it('no pega «reps» a un objetivo que ya es una frase', () => {
    // El campo es texto libre: «12 por lado reps» es una errata en papel.
    expect(formatearReps('12 por lado')).toBe('12 por lado');
    expect(formatearReps('AMRAP')).toBe('AMRAP');
    expect(formatearReps('5 sobre cabeza + 5 por lado')).toBe('5 sobre cabeza + 5 por lado');
  });

  it('sí lo pega cuando el objetivo es un número o un rango', () => {
    expect(formatearReps('8')).toBe('8 reps');
    expect(formatearReps('6-8')).toBe('6-8 reps');
    expect(formatearReps('10, 8, 6')).toBe('10, 8, 6 reps');
  });

  it('el CSS de la hoja no lleva comillas invertidas', () => {
    // El CSS vive dentro de un template literal: una comilla invertida en un
    // comentario lo cierra a mitad y el fichero deja de compilar. Ya pasó una
    // vez escribiendo `nowrap` entre comillas dentro de un comentario.
    const css = html().split('<style>')[1].split('</style>')[0];
    expect(css).not.toContain(String.fromCharCode(96));
  });

  it('el objetivo no puede impedir que quepan las casillas', () => {
    // `nowrap` en la columna del objetivo estiraba la tabla y sacaba la última
    // casilla fuera del papel.
    const css = html().split('<style>')[1].split('</style>')[0];
    const reglaObjetivo = css.match(/\.objetivo \{[^}]*\}/)?.[0] ?? '';
    expect(reglaObjetivo).not.toContain('nowrap');
  });

  it('no marca el fichero como rutina compartible por error', () => {
    // La hoja impresa es para leer, no para reimportar: no debe llevar la marca.
    expect(html()).not.toContain(SHARE_KIND);
  });
});
