/**
 * Geometría del mapa muscular y normalización de los nombres del catálogo.
 *
 * **Las formas son propias.** Se construyen con primitivas de SVG —elipses y
 * rectángulos redondeados— en vez de con curvas bezier calcadas de ninguna
 * parte: openGym, que inspiró la idea, es AGPL-3.0 y GymLog es MIT, así que sus
 * paths no se pueden tocar ni «adaptar». Además una figura esquemática encaja
 * mejor con el lenguaje visual de la app que un dibujo anatómico, y se mantiene
 * cambiando cuatro números.
 *
 * La geometría vive aquí y no en el componente porque es **dato**, no
 * presentación: el componente decide colores y estados, este fichero dice dónde
 * está cada músculo.
 */

/** Lienzo común de las dos vistas. Todas las coordenadas son de aquí. */
export const MAPA_VIEWBOX = { ancho: 100, alto: 210 } as const;

interface Elipse {
  k: 'e';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

interface Rectangulo {
  k: 'r';
  x: number;
  y: number;
  w: number;
  h: number;
  /** Radio de esquina. Sin él la figura parece un robot, no un cuerpo. */
  rx: number;
}

export type FormaMapa = Elipse | Rectangulo;

export interface RegionMuscular {
  /** Grupo del catálogo, tal y como lo devuelve `MUSCLE_GROUPS`. */
  grupo: string;
  formas: FormaMapa[];
}

/**
 * Partes que no son músculo entrenable: cabeza, cuello, manos y pies.
 *
 * Se pintan en gris neutro y sin estado. Sin ellas las regiones flotan sueltas y
 * no se lee que aquello es una persona.
 */
/**
 * El cuerpo de fondo: cabeza, cuello, torso, brazos, piernas, manos y pies.
 *
 * Va **debajo** de los músculos y en gris. Sin él las regiones flotaban sueltas
 * —cuatro píldoras en fila y dos brazos separados del tronco— y no se leía que
 * aquello fuera una persona. Es la pieza que convierte seis manchas en una
 * figura, y se vio recorriendo la APK, no en el editor.
 */
export const SILUETA_NEUTRA: FormaMapa[] = [
  { k: 'e', cx: 50, cy: 14, rx: 9, ry: 11 }, // cabeza
  { k: 'r', x: 45, y: 22, w: 10, h: 8, rx: 3 }, // cuello
  { k: 'r', x: 32, y: 28, w: 36, h: 58, rx: 11 }, // tronco
  { k: 'r', x: 35, y: 80, w: 30, h: 20, rx: 9 }, // cadera
  { k: 'e', cx: 26, cy: 56, rx: 8, ry: 20 }, // brazo izquierdo
  { k: 'e', cx: 74, cy: 56, rx: 8, ry: 20 }, // brazo derecho
  { k: 'e', cx: 23, cy: 88, rx: 7, ry: 17 }, // antebrazo izquierdo
  { k: 'e', cx: 77, cy: 88, rx: 7, ry: 17 }, // antebrazo derecho
  { k: 'e', cx: 22, cy: 108, rx: 5, ry: 6 }, // mano izquierda
  { k: 'e', cx: 78, cy: 108, rx: 5, ry: 6 }, // mano derecha
  { k: 'r', x: 36, y: 96, w: 12, h: 80, rx: 6 }, // pierna izquierda
  { k: 'r', x: 52, y: 96, w: 12, h: 80, rx: 6 }, // pierna derecha
  { k: 'e', cx: 41, cy: 180, rx: 6, ry: 4 }, // pie izquierdo
  { k: 'e', cx: 59, cy: 180, rx: 6, ry: 4 }, // pie derecho
];

/**
 * Vista frontal.
 *
 * Los hombros van **más arriba y más afuera** que el pecho a propósito: con
 * todo a la misma altura los cuatro bultos se fundían en una sola barra y no
 * había forma de distinguir un deltoides de un pectoral.
 */
export const MAPA_FRENTE: RegionMuscular[] = [
  {
    grupo: 'Hombro',
    formas: [
      { k: 'e', cx: 30, cy: 35, rx: 8, ry: 7 },
      { k: 'e', cx: 70, cy: 35, rx: 8, ry: 7 },
    ],
  },
  {
    grupo: 'Pecho',
    formas: [
      { k: 'r', x: 36, y: 41, w: 13, h: 13, rx: 5 },
      { k: 'r', x: 51, y: 41, w: 13, h: 13, rx: 5 },
    ],
  },
  { grupo: 'Core', formas: [{ k: 'r', x: 40, y: 57, w: 20, h: 25, rx: 6 }] },
  {
    grupo: 'Bíceps',
    formas: [
      { k: 'e', cx: 26, cy: 58, rx: 6, ry: 13 },
      { k: 'e', cx: 74, cy: 58, rx: 6, ry: 13 },
    ],
  },
  {
    grupo: 'Antebrazo',
    formas: [
      { k: 'e', cx: 23, cy: 88, rx: 5, ry: 14 },
      { k: 'e', cx: 77, cy: 88, rx: 5, ry: 14 },
    ],
  },
  {
    // Cuádriceps y espinilla: en el catálogo son el mismo grupo, así que aquí
    // también. Separarlos daría una precisión que el dato no tiene.
    grupo: 'Pierna',
    formas: [
      { k: 'r', x: 37, y: 100, w: 10, h: 40, rx: 5 },
      { k: 'r', x: 53, y: 100, w: 10, h: 40, rx: 5 },
      { k: 'r', x: 38, y: 144, w: 8, h: 30, rx: 4 },
      { k: 'r', x: 54, y: 144, w: 8, h: 30, rx: 4 },
    ],
  },
];

/** Vista trasera: lo que no se ve en el espejo y por eso se olvida de entrenar. */
export const MAPA_ESPALDA: RegionMuscular[] = [
  {
    grupo: 'Hombro',
    formas: [
      { k: 'e', cx: 30, cy: 35, rx: 8, ry: 7 },
      { k: 'e', cx: 70, cy: 35, rx: 8, ry: 7 },
    ],
  },
  {
    grupo: 'Espalda',
    formas: [
      { k: 'r', x: 40, y: 32, w: 20, h: 10, rx: 4 }, // trapecio
      { k: 'r', x: 36, y: 44, w: 28, h: 22, rx: 7 }, // dorsales
    ],
  },
  { grupo: 'Core', formas: [{ k: 'r', x: 41, y: 68, w: 18, h: 12, rx: 5 }] }, // lumbar
  {
    grupo: 'Tríceps',
    formas: [
      { k: 'e', cx: 26, cy: 58, rx: 6, ry: 13 },
      { k: 'e', cx: 74, cy: 58, rx: 6, ry: 13 },
    ],
  },
  {
    grupo: 'Antebrazo',
    formas: [
      { k: 'e', cx: 23, cy: 88, rx: 5, ry: 14 },
      { k: 'e', cx: 77, cy: 88, rx: 5, ry: 14 },
    ],
  },
  {
    grupo: 'Glúteo',
    formas: [
      { k: 'r', x: 37, y: 83, w: 12, h: 15, rx: 6 },
      { k: 'r', x: 51, y: 83, w: 12, h: 15, rx: 6 },
    ],
  },
  {
    grupo: 'Pierna',
    formas: [
      { k: 'r', x: 37, y: 101, w: 10, h: 38, rx: 5 }, // femoral
      { k: 'r', x: 53, y: 101, w: 10, h: 38, rx: 5 },
      { k: 'r', x: 38, y: 143, w: 8, h: 30, rx: 4 }, // gemelo
      { k: 'r', x: 54, y: 143, w: 8, h: 30, rx: 4 },
    ],
  },
];

/**
 * Nombres alternativos → grupo del catálogo.
 *
 * Hace falta porque los nombres llegan de sitios que no controlamos: ejercicios
 * creados a mano, importaciones de Strong o Hevy y el catálogo público. «Gluteo»
 * sin tilde, «Cuádriceps» y «Quads» son el mismo músculo del mapa, y sin esta
 * tabla la silueta se quedaría en gris justo para quien importó su historial.
 *
 * Las claves van ya normalizadas (minúsculas, sin acentos): comparar así evita
 * repetir cada entrada con y sin tilde.
 */
const ALIAS: Record<string, string> = {
  // Pecho
  pecho: 'Pecho',
  pectoral: 'Pecho',
  pectorales: 'Pecho',
  chest: 'Pecho',
  // Espalda
  espalda: 'Espalda',
  dorsal: 'Espalda',
  dorsales: 'Espalda',
  trapecio: 'Espalda',
  lats: 'Espalda',
  back: 'Espalda',
  // Hombro
  hombro: 'Hombro',
  hombros: 'Hombro',
  deltoides: 'Hombro',
  shoulders: 'Hombro',
  // Pierna
  pierna: 'Pierna',
  piernas: 'Pierna',
  cuadriceps: 'Pierna',
  femoral: 'Pierna',
  isquiotibiales: 'Pierna',
  gemelo: 'Pierna',
  gemelos: 'Pierna',
  pantorrilla: 'Pierna',
  quads: 'Pierna',
  hamstrings: 'Pierna',
  calves: 'Pierna',
  legs: 'Pierna',
  // Glúteo
  gluteo: 'Glúteo',
  gluteos: 'Glúteo',
  glutes: 'Glúteo',
  // Brazos
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  antebrazo: 'Antebrazo',
  antebrazos: 'Antebrazo',
  forearms: 'Antebrazo',
  // Core
  core: 'Core',
  abdomen: 'Core',
  abdominales: 'Core',
  abs: 'Core',
  lumbar: 'Core',
  oblicuos: 'Core',
};

/** Minúsculas y sin acentos, para comparar nombres que llegan de cualquier sitio. */
function normalizar(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Grupo del mapa al que corresponde un nombre, o `null` si no se representa.
 *
 * Devuelve `null` —y no un grupo por defecto— para «Cardio» y «Otro»: pintarlos
 * en algún sitio de la silueta sería inventarse un músculo. Lo que no se sabe
 * localizar se queda fuera del dibujo, que es honesto y además visible.
 */
export function grupoDelMapa(nombre: string | null | undefined): string | null {
  if (!nombre) return null;
  return ALIAS[normalizar(nombre)] ?? null;
}

/** Todos los grupos que el mapa sabe pintar, sin repetidos. */
export const GRUPOS_DEL_MAPA: string[] = [
  ...new Set([...MAPA_FRENTE, ...MAPA_ESPALDA].map((r) => r.grupo)),
];
