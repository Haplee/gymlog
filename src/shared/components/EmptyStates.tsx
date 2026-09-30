import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Calendar, ChartBar, CheckSquare, Dumbbell } from '@shared/components/icons';

/**
 * Estado vacío: icono + título + una línea que dice qué hacer + un botón.
 *
 * El orden y el peso son los que seprograms de los sistemas que lo hacen bien
 * (Geist, Polaris): el icono es pequeño y decorativo, el texto hace el trabajo
 * y solo hay UN botón. Antes esto ocupaba un círculo de 96px con un icono de
 * 48px, un `Sparkles` latiendo en bucle infinito al lado y un CTA en `rounded-sm`
 * de 8px mientras el resto de la app iba en píldora: la pantalla más vacía de
 * la app era la más ruidosa.
 *
 * Dos reglas más que vienen del mismo sitio y que se notan:
 *   · la descripción NO repite el título. Si dice «aún no hay historial», sobra.
 *   · el CTA es verbo + sustantivo y dice a dónde lleva. «Empezar» no dice nada;
 *     «Registrar entrenamiento» sí.
 */
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24 } },
};

interface EmptyStateProps {
  title: string;
  description: string;
  icon: 'workout' | 'history' | 'stats' | 'routine';
  action?: { label: string; onClick: () => void };
}

const icons = {
  workout: Dumbbell,
  history: Calendar,
  stats: ChartBar,
  routine: CheckSquare,
};

export function EmptyState({
  type,
  action,
  title: titleProp,
  description: descProp,
}: {
  type: EmptyStateProps['icon'];
  action?: { label: string; onClick: () => void };
  /** Copia propia cuando el vacío es de un caso concreto y no del tipo entero. */
  title?: string;
  description?: string;
}) {
  const { t } = useTranslation();
  const title = titleProp ?? t(`empty.${type}_title`);
  const desc = descProp ?? t(`empty.${type}_desc`);
  const Icon = icons[type];

  return (
    <m.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="flex flex-col items-center text-center py-12 px-6"
    >
      {/* 32px, no 48. A este tamaño el icono acompaña al texto; a 48 compite
          con él. El círculo de fondo mantiene el aire sin gritar. */}
      <m.div
        variants={itemVariants}
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-surface-2"
      >
        <Icon className="h-8 w-8 text-accent" />
      </m.div>

      <m.h3 variants={itemVariants} className="font-display text-lg font-bold text-fg max-w-xs">
        {title}
      </m.h3>

      <m.p variants={itemVariants} className="text-base text-fg-muted max-w-xs mt-2">
        {desc}
      </m.p>

      {action && (
        <m.button
          variants={itemVariants}
          onClick={action.onClick}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-pill bg-accent px-6 text-base font-semibold text-accent-fg shadow-btn-accent transition-transform active:scale-95"
        >
          {action.label}
        </m.button>
      )}
    </m.div>
  );
}

interface EmptyActionProps {
  action?: { label: string; onClick: () => void };
}

export function EmptyWorkout({ action }: EmptyActionProps) {
  return <EmptyState type="workout" action={action} />;
}

export function EmptyHistory({ action }: EmptyActionProps) {
  return <EmptyState type="history" action={action} />;
}

export function EmptyStats({ action }: EmptyActionProps) {
  return <EmptyState type="stats" action={action} />;
}

export function EmptyRoutine({ action }: EmptyActionProps) {
  return <EmptyState type="routine" action={action} />;
}
