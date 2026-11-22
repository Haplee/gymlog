// Modalidad de carga de un ejercicio. Fuente única de verdad para el tipo y los
// helpers derivados. Persiste en `exercises.load_type` (ver migración
// 20260720120000_exercise_load_type.sql).
//
//   - external           → carga externa (barra, mancuerna, máquina). El kg = peso levantado.
//   - bodyweight         → peso corporal puro. El kg (opcional) = lastre.
//   - bodyweight_loaded  → peso corporal + lastre. El kg = lastre (habitual).
//   - band_resistance    → resistencia con gomas/bandas. El kg = tensión de referencia (opcional).
//   - plyometrics        → pliometría/saltos. No hay peso (opcional: altura caja, distancia).
//
// Las variantes de peso corporal comparten la lógica de volumen: el peso
// guardado es (peso corporal vigente + lastre). Solo cambia la presentación.

export type LoadType =
  'external' | 'bodyweight' | 'bodyweight_loaded' | 'band_resistance' | 'plyometrics';

export const LOAD_TYPES: readonly LoadType[] = [
  'external',
  'bodyweight',
  'bodyweight_loaded',
  'band_resistance',
  'plyometrics',
] as const;

/** ¿La modalidad usa el peso corporal como base (con lastre opcional)? */
export function isBodyweightLoad(loadType: string | null | undefined): boolean {
  return loadType === 'bodyweight' || loadType === 'bodyweight_loaded';
}

/** ¿La modalidad es resistencia con gomas/bandas? */
export function isBandResistance(loadType: string | null | undefined): boolean {
  return loadType === 'band_resistance';
}

/** ¿La modalidad es pliometría? */
export function isPlyometrics(loadType: string | null | undefined): boolean {
  return loadType === 'plyometrics';
}

/**
 * ¿La serie solo consta si se escribe un peso?
 *
 * Sí únicamente cuando el catálogo dice **carga externa**. Que el ejercicio no
 * esté en la biblioteca (una plantilla que usa un nombre todavía sin ficha, o un
 * ejercicio escrito a mano) no es lo mismo que saber que lleva kilos: ahí no hay
 * nada que pedir y darlo por externo dejaba la rutina imposible de terminar con
 * el plan entero delante.
 */
export function pideCargaExterna(loadType: string | null | undefined): boolean {
  return loadType === 'external';
}

/** Modalidad por defecto a partir del equipamiento de ExerciseDB. */
export function loadTypeFromEquipment(equipment: readonly string[]): LoadType {
  return equipment.some((e) => /body\s*weight/i.test(e)) ? 'bodyweight' : 'external';
}

/** Etiqueta legible para la modalidad de carga (para badges/UI). */
export function loadTypeLabel(loadType: LoadType, t: (key: string) => string): string {
  switch (loadType) {
    case 'external':
      return t('load_type.external');
    case 'bodyweight':
      return t('load_type.bodyweight');
    case 'bodyweight_loaded':
      return t('load_type.bodyweight_loaded');
    case 'band_resistance':
      return t('load_type.band_resistance');
    case 'plyometrics':
      return t('load_type.plyometrics');
    default:
      return loadType;
  }
}

/** Icono/badge color hint para la modalidad (para UI). */
export function loadTypeColor(loadType: LoadType): string {
  switch (loadType) {
    case 'external':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'bodyweight':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'bodyweight_loaded':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'band_resistance':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'plyometrics':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    default:
      return 'bg-surface-2 text-fg-muted border-line';
  }
}
