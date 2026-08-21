import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from '@shared/components/icons';
import { KPICard } from './KPICards';

export interface StagnantExercise {
  id: string;
  name: string;
  weeks: number;
}

export function StatsSummary({
  maxStreak,
  totalPRs,
  stagnantExercises,
}: {
  maxStreak: number;
  totalPRs: number;
  stagnantExercises: StagnantExercise[];
}) {
  const { t } = useTranslation();
  return (
    <>
      {/* Racha máxima + PRs. Eran dos tarjetas escritas a mano que copiaban el
          marcado de KPICard —mismo raíl, mismo rótulo, mismo número mono— con
          dos tonos decorativos por encima: la racha máxima en `--warning`, que
          es el token de aviso, para celebrar un logro. Ahora usan el componente,
          y con él la regla de que el color solo aparece cuando hay estado. */}
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="grid grid-cols-2 gap-3"
      >
        <KPICard
          title={t('stats.max_streak')}
          value={maxStreak}
          subtitle={t('stats.days')}
          icon="flame"
        />
        <KPICard
          title={t('stats.personal_records')}
          value={totalPRs}
          subtitle={t('stats.total_prs')}
          icon="prs"
        />
      </m.div>

      {stagnantExercises.length > 0 && (
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-card p-4 bg-surface border border-line"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-sm font-semibold text-fg">{t('stats.possible_stall')}</span>
          </div>
          <div className="space-y-2">
            {stagnantExercises.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between">
                <span className="text-sm text-fg-muted truncate pr-2">{ex.name}</span>
                <span className="text-xs font-mono tabular-nums text-warning flex-shrink-0">
                  {t('stats.weeks_without_pr', { count: ex.weeks })}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-fg-subtle mt-3">{t('stats.stall_tip')}</p>
        </m.div>
      )}
    </>
  );
}
