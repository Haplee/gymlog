import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useRoutineStore } from '@features/routine/stores/routineStore';
import type { RoutineDays } from '@features/routine/lib/dayEdits';

/** Quién persiste la rutina tras editar; lo aporta la página (avisaba en remoto). */
export type PersistRoutines = () => Promise<void>;

/**
 * Escrituras sobre los días del plan de la rutina activa.
 *
 * Cada edición tiene que hacer dos cosas que se repetían en cinco handlers:
 * (1) garantizar que la rutina activa es editable —una plantilla se clona sola
 * al primer cambio, o el cambio se perdería al reiniciar la app— y (2)
 * persistir en remoto, que era justo lo que se olvidaba en silencio.
 *
 * El orden importa: `ensureEditableRoutine` puede cambiar la rutina activa, así
 * que el `getState()` de dentro de `editDay` tiene que ir *después* para leer
 * la rutina recién clonada.
 */
export function useRoutineDayEditor(persistRoutines: PersistRoutines) {
  const { t } = useTranslation();

  const ensureEditableRoutine = useCallback((): string | null => {
    const store = useRoutineStore.getState();
    const routine = store.getActiveRoutine();
    if (!routine) return null;
    if (routine.isCustom) return routine.id;

    const newId = store.cloneRoutine(routine.id);
    if (!newId) return null;
    store.setActiveRoutine(newId);
    toast.success(t('routine.cloned'));
    void persistRoutines();
    return newId;
  }, [t, persistRoutines]);

  /**
   * Aplica `update` a los días de la rutina activa y guarda.
   *
   * `update` recibe el mapa de días ya resuelto: quien llama solo describe el
   * cambio (`appendExerciseToDay`, `replaceExerciseInDay`, …).
   */
  const editDay = useCallback(
    (update: (days: RoutineDays) => RoutineDays) => {
      const editableId = ensureEditableRoutine();
      if (!editableId) return;

      const routine = useRoutineStore.getState().routines.find((r) => r.id === editableId);
      if (!routine) return;

      useRoutineStore.getState().updateRoutine(editableId, { days: update(routine.days) });
      void persistRoutines();
    },
    [ensureEditableRoutine, persistRoutines],
  );

  return { editDay };
}
