import { useTranslation } from 'react-i18next';
import { Backpack, IconDumbbell, Man } from '@shared/components/icons';
import type { LoadType } from '@shared/lib/loadType';

/**
 * Distintivo de la modalidad de carga de un ejercicio, para reconocerla de un
 * vistazo en las listas sin abrir el detalle.
 *
 * Tres categorías, cada una con su icono:
 *   - external          → mancuerna (el kg es el peso levantado)
 *   - bodyweight        → figura (el kg, si lo hay, es lastre)
 *   - bodyweight_loaded → mochila/chaleco (el kg es el lastre)
 *
 * El acento se reserva para las variantes de peso corporal: son las que cambian
 * cómo se interpreta el kg que se teclea, y por tanto las que conviene notar.
 */
export function LoadTypeBadge({
  loadType,
  className = '',
}: {
  loadType: string | null | undefined;
  className?: string;
}) {
  const { t } = useTranslation();

  // Sin dato explícito se asume carga externa, igual que en el resto de la app.
  const type = (loadType ?? 'external') as LoadType;

  const { Icon, label, tone } = {
    external: {
      Icon: IconDumbbell,
      label: t('workout.load_type_external'),
      tone: 'bg-surface-2 text-fg-subtle',
    },
    bodyweight: {
      Icon: Man,
      label: t('workout.load_type_bodyweight'),
      tone: 'bg-accent/10 text-accent',
    },
    bodyweight_loaded: {
      Icon: Backpack,
      label: t('workout.load_type_bodyweight_loaded'),
      tone: 'bg-accent/10 text-accent',
    },
  }[type];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide ${tone} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
