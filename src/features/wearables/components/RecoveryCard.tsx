import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Progress } from '@shared/components/ui';
import type { ScoreConfidence } from '@shared/lib/scoring/types';
import type { WearableDaily, WearableSleep } from '../types';
import { computeReadiness } from '../utils/readiness';

interface RecoveryCardProps {
  daily?: WearableDaily[];
  sleep?: WearableSleep[];
}

const CONFIDENCE_VARIANT: Record<ScoreConfidence, 'default' | 'info' | 'success'> = {
  calibrating: 'default',
  building: 'info',
  solid: 'success',
};

/**
 * Tarjeta de recuperación: resume las señales que ya alimentan la sugerencia de
 * carga (sueño y FC de reposo) para que el usuario vea POR QUÉ se le pide
 * mantener la carga. No calcula nada nuevo: lee `computeReadiness`.
 */
export function RecoveryCard({ daily, sleep }: RecoveryCardProps) {
  const { t } = useTranslation();
  const readiness = useMemo(() => computeReadiness(daily, sleep), [daily, sleep]);

  if (!readiness) return null;

  const calibrating = readiness.confidence === 'calibrating';
  const hasScores =
    readiness.sleepDebtMin !== null ||
    readiness.restScore !== null ||
    readiness.sleepConsistency !== null;

  const fmtDuration = (minutes: number) => {
    const total = Math.max(0, Math.round(minutes));
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return hours > 0
      ? t('wearables.recovery.duration_hm', { hours, minutes: rest })
      : t('wearables.recovery.duration_m', { minutes: rest });
  };

  return (
    <div className="rounded-card p-4 bg-surface border border-line-strong">
      <div className="flex items-center justify-between gap-2">
        <span className="label-caps text-fg-subtle">{t('wearables.recovery.title')}</span>
        <Badge variant={CONFIDENCE_VARIANT[readiness.confidence]}>
          {t(`wearables.recovery.confidence_${readiness.confidence}`)}
        </Badge>
      </div>

      <p className="mt-2 text-sm text-fg">
        {t(readiness.reasonKey, { minutes: readiness.avgSleepMin ?? 0 })}
      </p>

      {calibrating ? (
        <p className="mt-2 text-xs text-fg-subtle">{t('wearables.recovery.collecting')}</p>
      ) : hasScores ? (
        <dl className="mt-3 space-y-3">
          {readiness.sleepDebtMin !== null ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-fg-subtle">{t('wearables.recovery.sleep_debt')}</dt>
              <dd className="font-mono text-sm text-fg">
                {readiness.sleepDebtMin <= 0
                  ? t('wearables.recovery.sleep_debt_none')
                  : fmtDuration(readiness.sleepDebtMin)}
              </dd>
            </div>
          ) : null}

          {readiness.restScore !== null ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-xs text-fg-subtle">{t('wearables.recovery.rest_score')}</dt>
                <dd className="font-mono text-sm text-fg">{Math.round(readiness.restScore)}/100</dd>
              </div>
              <Progress
                value={readiness.restScore}
                label={t('wearables.recovery.rest_score')}
                valueText={`${Math.round(readiness.restScore)}/100`}
                className="mt-1.5"
              />
            </div>
          ) : null}

          {readiness.sleepConsistency !== null ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-fg-subtle">{t('wearables.recovery.consistency')}</dt>
              <dd className="font-mono text-sm text-fg">
                {t('wearables.recovery.consistency_value', {
                  percent: Math.round(readiness.sleepConsistency * 100),
                })}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="mt-2 text-xs text-fg-subtle">{t('wearables.recovery.not_available')}</p>
      )}
    </div>
  );
}
