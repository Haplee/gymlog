import { HealthMetricsCard } from './HealthMetricsCard';
import { useWearableDaily, useWearableSleep } from '../hooks/useWearableConnections';

/**
 * Resumen de wearables (todas las métricas del último día) para UserStatsPage.
 * Se oculta por completo si no hay datos, para no ensuciar la página.
 */
export function WearablesSummary() {
  const { data: daily } = useWearableDaily(1);
  const { data: sleep } = useWearableSleep(1);

  if (!daily?.length && !sleep?.length) return null;

  return <HealthMetricsCard daily={daily?.[0]} sleep={sleep?.[0]} />;
}
