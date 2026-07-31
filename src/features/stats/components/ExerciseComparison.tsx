import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

// recharts es pesado: se carga bajo demanda, igual que en la página.
const ExerciseComparisonChart = lazy(() =>
  import('./Charts').then((mod) => ({ default: mod.ExerciseComparisonChart })),
);

interface ExerciseComparisonProps {
  exercises: string[];
  a: string;
  b: string;
  onChangeA: (name: string) => void;
  onChangeB: (name: string) => void;
  data: Parameters<typeof ExerciseComparisonChart>[0]['data'];
}

/**
 * Comparador de dos ejercicios. Extraído de `StatsPage` para bajar del límite
 * de 800 líneas; el estado de qué dos ejercicios se comparan sigue en la página
 * porque la lista viene de sus datos.
 */
export function ExerciseComparison({
  exercises,
  a,
  b,
  onChangeA,
  onChangeB,
  data,
}: ExerciseComparisonProps) {
  const { t } = useTranslation();

  if (exercises.length < 2) return null;

  const selectClass =
    'w-full rounded-md text-sm p-2.5 bg-surface-2 border border-line-strong text-fg';

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-card p-4 bg-surface"
    >
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-accent" />
        <span className="text-sm font-semibold text-fg">{t('stats.compare_exercises')}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <select
          value={a}
          onChange={(e) => onChangeA(e.target.value)}
          aria-label={t('stats.exercise_a')}
          className={selectClass}
        >
          {exercises.map((ex) => (
            <option key={ex} value={ex}>
              {ex}
            </option>
          ))}
        </select>
        <select
          value={b}
          onChange={(e) => onChangeB(e.target.value)}
          aria-label={t('stats.exercise_b')}
          className={selectClass}
        >
          {exercises.map((ex) => (
            <option key={ex} value={ex}>
              {ex}
            </option>
          ))}
        </select>
      </div>
      {a === b ? (
        <div className="text-center py-8 text-sm text-fg-subtle">{t('stats.pick_two')}</div>
      ) : (
        <Suspense fallback={<div className="h-56 skeleton rounded-card" aria-hidden="true" />}>
          <ExerciseComparisonChart data={data} nameA={a} nameB={b} />
        </Suspense>
      )}
    </m.div>
  );
}
