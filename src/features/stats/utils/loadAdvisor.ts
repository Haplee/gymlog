/**
 * Punto único donde se decide la carga recomendada.
 *
 * Antes cada pantalla encadenaba a mano el motor y sus moduladores, y encadenar
 * a mano en dos sitios acaba siempre igual: una pantalla aplica un filtro que la
 * otra no, y el mismo ejercicio recomienda cosas distintas según por dónde se
 * entre. Eso ya pasó una vez con el rango de repeticiones (ver
 * `suggestionParity.test.ts`), así que aquí la cadena vive en un solo sitio.
 *
 * El orden de los frenos no es casual: van de lo más específico a lo más
 * general, porque el más específico es el que más sabe.
 *
 *  1. **Motor de esfuerzo** (`suggestNextLoad`), o doble progresión sobre la
 *     última sesión si no hay RIR/RPE registrado.
 *  2. **Estancamiento** del propio ejercicio: si el tope no se mueve, no se sube.
 *  3. **Volumen semanal** del grupo muscular: si la semana ya va disparada
 *     respecto a las cuatro anteriores, o por encima del máximo recuperable, la
 *     subida pasa a mantenimiento.
 *  4. **Recuperación del día** (wearable): dormir poco o pulso alto también
 *     aplaza la subida.
 *
 * Ninguno de los tres frenos puede subir la carga; solo bajarla o dejarla
 * quieta. Un modulador que pudiera subir sería un segundo motor escondido.
 */

import {
  applyReadiness,
  applyStall,
  detectStall,
  suggestFromLastSession,
  suggestNextLoad,
  type AutoRegSession,
  type LoadSuggestion,
  type StallResult,
} from './autoregulation';
import { applyVolumeContext, type VolumeContext } from './trainingLoad';

export interface LoadAdviceInput {
  sessions: AutoRegSession[];
  /** Suelo y techo del rango objetivo, p. ej. [8, 10] de «8-10». */
  repMin?: number;
  repMax?: number;
  /** En peso corporal no se sugiere subir carga: solo repeticiones. */
  bodyweight?: boolean;
  /** Escalón mínimo montable con los discos del usuario. */
  stepKg?: number;
  /** Contexto de volumen del grupo muscular, si se conoce. */
  volume?: VolumeContext | null;
  /** Recuperación del día según el wearable, si hay. */
  readiness?: { holdLoad: boolean; reasonKey: string } | null;
}

export interface LoadAdvice {
  suggestion: LoadSuggestion;
  stall: StallResult | null;
  volume: VolumeContext | null;
}

export function buildLoadAdvice(input: LoadAdviceInput): LoadAdvice | null {
  const { sessions, repMin, repMax, bodyweight, stepKg } = input;
  if (sessions.length === 0) return null;

  const base =
    suggestNextLoad(sessions, { repMin, repMax, bodyweight, stepKg }) ??
    suggestFromLastSession(sessions, { repMin, repMax, bodyweight, stepKg });
  if (!base) return null;

  const stall = detectStall(sessions);
  const suggestion = applyReadiness(
    applyVolumeContext(applyStall(base, stall, { stepKg }), input.volume ?? null),
    input.readiness ?? null,
  );
  if (!suggestion) return null;

  return { suggestion, stall, volume: input.volume ?? null };
}
