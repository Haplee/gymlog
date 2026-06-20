import { Dumbbell, Calendar, BarChart3, CheckSquare, Sparkles } from 'lucide-react';
import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1 },
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
  stats: BarChart3,
  routine: CheckSquare,
};

export function EmptyState({
  type,
  action,
}: {
  type: EmptyStateProps['icon'];
  action?: { label: string; onClick: () => void };
}) {
  const { t } = useTranslation();
  const title = t(`empty.${type}_title`);
  const desc = t(`empty.${type}_desc`);
  const Icon = icons[type];

  return (
    <m.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <m.div variants={itemVariants} className="relative mb-6">
        <div className="w-24 h-24 rounded-full flex items-center justify-center bg-surface-2">
          <Icon className="w-12 h-12 text-accent" />
        </div>
        <m.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="absolute -top-1 -right-1"
        >
          <Sparkles className="w-6 h-6 text-accent" />
        </m.div>
      </m.div>

      <m.h3 variants={itemVariants} className="text-xl font-bold mb-2 text-fg">
        {title}
      </m.h3>

      <m.p variants={itemVariants} className="text-sm max-w-xs mb-6 text-fg-muted">
        {desc}
      </m.p>

      {action && (
        <m.button
          variants={itemVariants}
          onClick={action.onClick}
          className="px-5 py-2.5 rounded-pill text-sm font-semibold bg-accent text-accent-fg shadow-btn-accent transition-transform active:scale-[0.97]"
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
