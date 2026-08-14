import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { KPICard } from './KPICards';
import { CardioTypeIcon } from '@shared/components/CardioIcons';
import { formatSeconds } from '@features/stats/utils/statsData';
import { CHART_COLORS } from '../constants';

export interface CardioStats {
  sessionsThisWeek: number;
  totalTimeWeek: number;
  totalDistWeek: number;
  totalSessions: number;
  totalDistAll: number;
  totalTimeAll: number;
  totalCalAll: number;
  avgDur: number;
}

export interface CardioTypeSlice {
  type: string;
  duration: number;
  label: string;
}

interface CardioStatsSectionProps {
  stats: CardioStats;
  breakdown: CardioTypeSlice[];
  /** Rótulo de sección de la página; se recibe para no duplicar el estilo. */
  Label: (props: { children: React.ReactNode }) => React.ReactElement;
}

/**
 * Bloque de cardio de la pantalla de estadísticas: KPIs de la semana, totales
 * históricos y reparto por tipo de actividad.
 *
 * Vivía dentro de `StatsPage`, que pasaba de las 800 líneas que fija CLAUDE.md.
 * Es un corte limpio: solo depende de los dos agregados que recibe.
 */
export function CardioStatsSection({ stats, breakdown, Label }: CardioStatsSectionProps) {
  const { t } = useTranslation();

  if (stats.totalSessions === 0) return null;

  return (
    <section className="space-y-3">
      <Label>{t('stats.section_cardio')}</Label>

      <m.div
        className="grid grid-cols-2 gap-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <KPICard
          title={t('stats.kpi_week_sessions')}
          value={stats.sessionsThisWeek}
          subtitle={t('stats.kpi_this_week')}
          icon="cardio-sessions"
        />
        <KPICard
          title={t('stats.kpi_cardio_time')}
          value={formatSeconds(stats.totalTimeWeek)}
          subtitle={t('stats.kpi_this_week')}
          icon="cardio-time"
        />
        {stats.totalDistWeek > 0 && (
          <KPICard
            title={t('stats.kpi_distance')}
            value={`${stats.totalDistWeek.toFixed(1)}km`}
            subtitle={t('stats.kpi_this_week')}
            icon="cardio-dist"
          />
        )}
        <KPICard
          title={t('stats.kpi_total_sessions')}
          value={stats.totalSessions}
          subtitle={t('stats.kpi_history')}
          icon="cardio-sessions"
          accentColor="var(--accent-sky)"
        />
      </m.div>

      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="grid grid-cols-3 gap-3"
      >
        <KPICard
          size="sm"
          title={t('stats.kpi_total_time')}
          value={formatSeconds(stats.totalTimeAll)}
          subtitle={t('stats.kpi_all_time')}
          icon="cardio-time"
        />
        <KPICard
          size="sm"
          title={t('stats.kpi_total_distance')}
          value={stats.totalDistAll > 0 ? `${stats.totalDistAll.toFixed(1)}km` : '—'}
          subtitle={t('stats.kpi_all_time')}
          icon="cardio-dist"
        />
        <KPICard
          size="sm"
          title={t('stats.kpi_avg_duration')}
          value={stats.avgDur > 0 ? formatSeconds(stats.avgDur) : '—'}
          subtitle={t('stats.kpi_per_session')}
          icon="duration"
        />
      </m.div>

      {breakdown.length > 0 && (
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="rounded-card p-4 bg-surface"
        >
          <div className="flex items-center gap-2 mb-3">
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4"
              fill="none"
              stroke="var(--interactive-primary)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 13c2-2.5 4-2.5 6 0 2 2.5 4 2.5 6 0 2-2.5 4-2.5 6 0" />
              <path d="M2 17.5c2-2.5 4-2.5 6 0 2 2.5 4 2.5 6 0 2-2.5 4-2.5 6 0" />
            </svg>
            <span className="text-sm font-medium text-fg-muted">
              {t('stats.cardio_activities')}
            </span>
          </div>
          <div className="space-y-2.5">
            {breakdown.map(({ type, duration, label }, i) => {
              const maxDur = breakdown[0].duration;
              const pct = Math.round((duration / maxDur) * 100);
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-fg-subtle">
                        <CardioTypeIcon
                          type={type as Parameters<typeof CardioTypeIcon>[0]['type']}
                          className="w-3.5 h-3.5"
                        />
                      </span>
                      <span className="text-sm text-fg-muted">{label}</span>
                    </div>
                    <span className="text-xs font-mono font-medium text-fg">
                      {formatSeconds(duration)}
                    </span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden bg-surface-2">
                    <m.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </m.div>
      )}
    </section>
  );
}
