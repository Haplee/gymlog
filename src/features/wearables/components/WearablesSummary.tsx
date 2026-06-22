import { useTranslation } from 'react-i18next';
import { SleepCard } from './SleepCard';
import { useWearableDaily, useWearableSleep } from '../hooks/useWearableConnections';

/**
 * Resumen compacto de wearables (sueño + pasos + FC) para UserStatsPage.
 * Se oculta por completo si no hay datos, para no ensuciar la página.
 */
export function WearablesSummary() {
  const { t } = useTranslation();
  const { data: daily } = useWearableDaily(1);
  const { data: sleep } = useWearableSleep(1);

  if (!daily?.length && !sleep?.length) return null;

  return (
    <section className="space-y-3">
      <div className="text-2xs uppercase font-semibold tracking-wider text-fg-subtle px-1">
        {t('wearables.title')}
      </div>
      <SleepCard sleep={sleep?.[0]} daily={daily?.[0]} />
    </section>
  );
}
