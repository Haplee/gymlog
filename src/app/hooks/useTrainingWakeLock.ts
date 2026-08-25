import { useWorkoutStore } from '@features/workout/stores/workoutStore';
import { useCardioStore } from '@features/cardio/stores/cardioStore';
import { useRoutineSessionStore } from '@features/routine/stores/routineSessionStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { useWakeLock } from '@shared/hooks/useWakeLock';

/**
 * Decide si la pantalla debe seguir encendida: hay entrenamiento en marcha y el
 * usuario no ha desactivado el ajuste.
 *
 * Vive en la capa `app` y no en `shared` porque necesita mirar tres stores de
 * features distintas, y que `shared` importe de `features` invertiría la
 * dirección de las dependencias.
 *
 * Se monta una sola vez, desde `Layout`, en lugar de una por pantalla: así el
 * bloqueo sobrevive a navegar de la rutina al historial y volver, que es algo
 * que se hace a mitad de sesión.
 */
export function useTrainingWakeLock(): void {
  const habilitado = useSettingsStore((s) => s.keepScreenAwake);

  // Entrenamiento libre: hay sesión abierta y al menos una serie en la hoja.
  const workoutStartedAt = useWorkoutStore((s) => s.startedAt);
  const workoutSets = useWorkoutStore((s) => s.sets);
  // Sesión de rutina en curso.
  const rutinaActiva = useRoutineSessionStore((s) => s.startedAt !== null);
  // Cardio con el cronómetro corriendo.
  const cardioActivo = useCardioStore((s) => s.isActive);

  const entrenando = (!!workoutStartedAt && workoutSets.length > 0) || rutinaActiva || cardioActivo;

  useWakeLock(habilitado && entrenando);
}
