import { useTranslation } from 'react-i18next';
import { LastSessionCard } from '@features/workout/components/LastSessionCard';
import { ChevronDown } from '@shared/components/icons';

interface ExerciseContextBlockProps {
  userId: string;
  exerciseId: string;
  /** Si el contexto está desplegado. Lo decide la página (ver `contextoAbierto`). */
  open: boolean;
  /** ¿Hay ya alguna serie dada por hecha? Si la hay, se ofrece plegarlo. */
  hasDoneSet: boolean;
  onToggle: (open: boolean) => void;
  onCopySets: (copied: { reps: number; weight: number }[]) => void;
}

/**
 * Contexto para decidir el peso: qué se hizo la última vez.
 *
 * Va **debajo** del registro, no encima: lo que haces va antes que lo que
 * consultas. Aquí vive solo lo que se hizo la última vez; la recomendación de
 * carga se cuenta en la pantalla de rutina, junto al plan del día.
 */
export function ExerciseContextBlock({
  userId,
  exerciseId,
  open,
  hasDoneSet,
  onToggle,
  onCopySets,
}: ExerciseContextBlockProps) {
  const { t } = useTranslation();

  return (
    <div className="mt-10">
      {open ? (
        <>
          <LastSessionCard userId={userId} exerciseId={exerciseId} onCopySets={onCopySets} />

          {hasDoneSet && (
            <button
              type="button"
              onClick={() => onToggle(false)}
              className="label-caps mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 text-fg-subtle active:opacity-60"
            >
              <ChevronDown className="h-3.5 h-3.5 rotate-180" aria-hidden="true" />
              {t('workout.context_hide')}
            </button>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={() => onToggle(true)}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-pill bg-surface-2 px-4 text-left transition-colors active:bg-hover"
        >
          <span className="label-caps text-fg-muted">{t('workout.context_show')}</span>
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-fg-subtle" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
