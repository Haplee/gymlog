import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { History, CopyCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchLastExerciseSets } from '@shared/api/queries';

interface LastSessionCardProps {
  userId: string;
  exerciseId: string;
  onCopySets: (sets: { reps: number; weight: number }[]) => void;
}

export function LastSessionCard({ userId, exerciseId, onCopySets }: LastSessionCardProps) {
  const { data: lastSets = [] } = useQuery({
    queryKey: ['lastExerciseSets', userId, exerciseId],
    queryFn: () => fetchLastExerciseSets(userId, exerciseId),
    staleTime: 1000 * 60 * 5,
    enabled: !!userId && !!exerciseId,
  });

  return (
    <AnimatePresence>
      {lastSets.length > 0 && (
        <motion.div
          key="last-session"
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          className="overflow-hidden"
        >
          <div
            className="p-3 rounded-[var(--radius-lg)]"
            style={{
              backgroundColor: 'var(--bg-surface-2)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                <span
                  className="text-[0.6875rem] font-medium"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Última sesión
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
                className="flex items-center gap-1 text-[0.6875rem] px-2 py-0.5 rounded-[var(--radius-pill)] font-medium"
                style={{
                  backgroundColor: 'var(--interactive-primary)',
                  color: 'var(--interactive-primary-fg)',
                }}
              >
                <CopyCheck className="w-3 h-3" />
                Copiar
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {lastSets.map((s, i) => (
                <span
                  key={i}
                  className="text-[0.75rem] px-2.5 py-1 rounded-lg font-mono font-medium"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {s.weight}×{s.reps}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
