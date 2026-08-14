// Paleta para gráficos (recharts/SVG no resuelve var() de forma fiable
// en atributos fill/stroke, así que se usan valores literales).
export const CHART_COLORS = [
  '#ffd93d',
  '#ffa93d',
  '#38bdf8',
  '#fbbf24',
  '#fb7185',
  '#818cf8',
  '#c4b5fd',
  '#2dd4bf',
  '#4ade80',
  '#94a3b8',
];

/**
 * Podio del top de ejercicios: oro, plata y bronce.
 *
 * Estos NO siguen al acento que elija el usuario, y es a propósito: aquí el
 * color es el significado (1.º, 2.º, 3.º), no decoración. Una plata que se
 * vuelve lavanda deja de decir "segundo".
 *
 * Estaban escritos a pelo en `TopExercisesList.tsx`; viven aquí porque este es
 * uno de los dos sitios donde el proyecto admite hex literal.
 */
export const MEDAL_COLORS = ['#fbbf24', '#a3a3a3', '#92400e'] as const;

/** Texto sobre medalla: fijo y oscuro, porque las tres son claras en ambos temas. */
export const MEDAL_FG = '#000';
