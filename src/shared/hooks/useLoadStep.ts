import { useCallback } from 'react';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { loadStepForExercise } from '@shared/lib/loadStep';

/** Opciones de escalón que necesita el motor, sacadas del store. */
export function settingsLoadOptions() {
  const { availablePlatesKg, dumbbellStepsKg, machineStepsKg, dumbbellStepKg, machineStepKg } =
    useSettingsStore.getState();
  return {
    platesKg: availablePlatesKg,
    dumbbellStepsKg,
    machineStepsKg,
    dumbbellStepKg,
    machineStepKg,
  };
}

/**
 * Escalón mínimo montable por ejercicio, según su material y el gimnasio del
 * usuario.
 *
 * Existe por el mismo motivo que `useExerciseRepRange`: es un dato que decide
 * la sugerencia de carga y que cuatro pantallas resolvían por su cuenta —las
 * cuatro con `smallestLoadStep(discos)`, es decir, asumiendo barra siempre—.
 * Un único punto de entrada es lo que evita que vuelvan a divergir.
 *
 * Devuelve una **función** y no un número porque una misma pantalla mezcla
 * materiales: la sesión de rutina tiene sentadilla, mancuernas y polea en la
 * misma lista, y cada una salta lo suyo.
 */
export function useLoadStep(): (equipment: string | null | undefined) => number {
  const platesKg = useSettingsStore((s) => s.availablePlatesKg);
  const dumbbellStepsKg = useSettingsStore((s) => s.dumbbellStepsKg);
  const machineStepsKg = useSettingsStore((s) => s.machineStepsKg);
  const dumbbellStepKg = useSettingsStore((s) => s.dumbbellStepKg);
  const machineStepKg = useSettingsStore((s) => s.machineStepKg);

  return useCallback(
    (equipment) =>
      loadStepForExercise(equipment, {
        platesKg,
        dumbbellStepsKg,
        machineStepsKg,
        dumbbellStepKg,
        machineStepKg,
      }),
    [platesKg, dumbbellStepsKg, machineStepsKg, dumbbellStepKg, machineStepKg],
  );
}

/**
 * Misma resolución, fuera de React.
 *
 * La sesión de rutina la necesita dentro de `handleFinish`, que es un manejador
 * y no puede llamar a hooks. Lee el store con `getState()`, igual que hacía
 * antes con los discos.
 */
export function loadStepFromSettings(equipment: string | null | undefined): number {
  return loadStepForExercise(equipment, settingsLoadOptions());
}
