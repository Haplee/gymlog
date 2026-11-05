/**
 * Topes de cordura compartidos por la importación de historial.
 *
 * Los usa la validación Zod del JSON (`importSchema`) y los importadores de
 * terceros (`importTrackers`). Fuera de estos rangos el dato no es un entreno,
 * es basura, y debe rechazarse en la frontera.
 */
export const MAX_REPS = 1000;
export const MAX_WEIGHT_KG = 2000;
