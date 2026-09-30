import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { m, AnimatePresence } from 'framer-motion';
import { fetchLastExerciseSets } from '@shared/api/queries';
import { useWeight } from '@shared/hooks/useWeight';
import { formatWeightInput } from '@shared/lib/weight';
import { CopySuccess, History } from '@shared/components/icons';

interface LastSessionCardProps {
  userId: string;
  exerciseId: string;
  onCopySets: (sets: { reps: number; weight: number }[]) => void;
}

export function LastSessionCard({ userId, exerciseId, onCopySets }: LastSessionCardProps) {
  const { t } = useTranslation();
  const { convert } = useWeight();
  const { data: lastSets = [] } = useQuery({
    queryKey: ['lastExerciseSets', userId, exerciseId],
    queryFn: () => fetchLastExerciseSets(userId, exerciseId),
    staleTime: 1000 * 60 * 5,
    enabled: !!userId && !!exerciseId,
  });

  return (
    <AnimatePresence>
      {lastSets.length > 0 && (
        <m.div
          key="last-session"
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          className="overflow-hidden"
        >
          <div className="p-3 rounded-card bg-surface-2 border border-line">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-fg-subtle" />
                <span className="text-xs font-medium text-fg-subtle">
                  {t('workout.last_session')}
                  {lastSets[0]?.workout_started_at && (
                    <>
                      {' · '}
                      {formatDistanceToNow(parseISO(lastSets[0].workout_started_at), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </>
                  )}
                </span>
              </div>
              {/* «Copiar» era un `bg-accent` y con eso había dos botones
                  primarios en la misma pantalla. Es una comodidad dentro de una
                  tarjeta plegable, no la acción principal —esa es confirmar la
                  serie—, así que pasa a secundario. El borde se queda en
                  `line-interactive` porque sigue siendo un control y necesita
                  el 3:1 de WCAG 1.4.11. */}
              <button
                type="button"
                onClick={() =>
                  onCopySets(lastSets.map((s) => ({ reps: s.reps, weight: s.weight })))
                }
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-pill border border-line-interactive bg-surface-2 font-medium text-fg-muted transition-colors active:bg-hover"
              >
                <CopySuccess className="w-3 h-3" />
                {t('workout.copy')}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {lastSets.map((s, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-card font-mono font-medium bg-surface border border-line text-fg-muted"
                >
                  {formatWeightInput(convert(s.weight))}×{s.reps}
                </span>
              ))}
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
