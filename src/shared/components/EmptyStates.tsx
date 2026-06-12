import { Dumbbell, Calendar, BarChart3, CheckSquare, Sparkles } from 'lucide-react';
import { m } from 'framer-motion';

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

const labels = {
  workout: {
    title: 'Empieza a entrenar',
    desc: 'Selecciona un ejercicio, añade tus series y guarda tu primer entrenamiento.',
  },
  history: {
    title: 'Sin historial aún',
    desc: 'Guarda entrenamientos y aparecerán aquí para que puedas revisarlos.',
  },
  stats: {
    title: 'Sin estadísticas',
    desc: 'Completa entrenamientos para ver tu progreso y tendencias aquí.',
  },
  routine: {
    title: 'Sin rutina configurada',
    desc: 'Planifica tu semana asignando ejercicios a cada día.',
  },
};

export function EmptyState({ type }: { type: EmptyStateProps['icon'] }) {
  const { title, desc } = labels[type];
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
    </m.div>
  );
}

export function EmptyWorkout() {
  return <EmptyState type="workout" />;
}

export function EmptyHistory() {
  return <EmptyState type="history" />;
}

export function EmptyStats() {
  return <EmptyState type="stats" />;
}

export function EmptyRoutine() {
  return <EmptyState type="routine" />;
}
