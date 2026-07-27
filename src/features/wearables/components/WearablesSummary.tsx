import { HealthMetricsCard } from './HealthMetricsCard';
import { useWearableDaily, useWearableSleep } from '../hooks/useWearableConnections';
import { pickDaily, pickSleepFor } from '../utils/pickDaily';

/**
 * Resumen de wearables (todas las métricas del último día) para UserStatsPage.
 * Se oculta por completo si no hay datos, para no ensuciar la página.
 */
export function WearablesSummary() {
  // Varios días, no uno: de madrugada el día en curso no tiene pulsaciones y
  // hay que caer al último con datos reales (ver pickDaily).
  const { data: daily } = useWearableDaily(7);
  const { data: sleep } = useWearableSleep(7);

  if (!daily?.length && !sleep?.length) return null;

  const day = pickDaily(daily);
  return <HealthMetricsCard daily={day} sleep={pickSleepFor(day, sleep)} />;
}
