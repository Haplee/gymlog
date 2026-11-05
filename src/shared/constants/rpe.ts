/**
 * Escala de RPE que ofrecen los selectores de esfuerzo.
 *
 * Vive en un solo sitio porque la sesión de rutina y el entreno libre mostraban
 * la misma lista copiada en cada componente, y cualquier ajuste futuro tenía que
 * hacerse dos veces.
 */
export const RPE_OPTIONS = ['6', '7', '8', '9', '10'] as const;
