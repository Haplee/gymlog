import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { History, CopyCheck, TrendingUp } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { fetchLastExerciseSets } from '@shared/api/queries';
import { suggestProgression } from '@shared/lib/progression';
import { useWeight } from '@shared/hooks/useWeight';

interface LastSessionCardProps {
  userId: string;
  exerciseId: string;
  onCopySets: (sets: { reps: number; weight: number }[]) => void;
}

export function LastSessionCard({ userId, exerciseId, onCopySets }: LastSessionCardProps) {
  const { t } = useTranslation();
  const { unit, convert } = useWeight();
  const { data: lastSets = [] } = useQuery({
    queryKey: ['lastExerciseSets', userId, exerciseId],
    queryFn: () => fetchLastExerciseSets(userId, exerciseId),
    staleTime: 1000 * 60 * 5,
    enabled: !!userId && !!exerciseId,
  });

  const suggestion = suggestProgression(lastSets.map((s) => ({ reps: s.reps, weight: s.weight })));

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
          <div className="p-3 rounded-2xl bg-surface-2 border border-line">
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
              <button
                onClick={() =>
                  onCopySets(lastSets.map((s) => ({ reps: s.reps, weight: s.weight })))
                }
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-pill font-medium bg-accent text-accent-fg transition-transform active:scale-95"
              >
                <CopyCheck className="w-3 h-3" />
                {t('workout.copy')}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {lastSets.map((s, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-lg font-mono font-medium bg-surface border border-line text-fg-muted"
                >
                  {convert(s.weight).toFixed(1).replace(/\.0$/, '')}×{s.reps}
                </span>
              ))}
            </div>

            {suggestion && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-line">
                <div className="flex items-center gap-1.5 text-xs text-accent">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="font-medium">{t('workout.progression_hint')}:</span>
                  <span className="font-mono">
                    {convert(suggestion.weight).toFixed(1).replace(/\.0$/, '')} {unit} ×{' '}
                    {suggestion.reps}
                  </span>
                </div>
                <button
                  onClick={() =>
                    onCopySets(
                      Array.from({ length: lastSets.length || 1 }, () => ({
                        reps: suggestion.reps,
                        weight: suggestion.weight,
                      })),
                    )
                  }
                  className="text-xs px-2 py-1 rounded-pill font-medium bg-surface border border-line-accent text-accent transition-transform active:scale-95"
                >
                  {t('workout.apply')}
                </button>
              </div>
            )}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
