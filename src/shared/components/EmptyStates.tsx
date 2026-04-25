import { Dumbbell, Calendar, BarChart3, CheckSquare, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

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
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <motion.div variants={itemVariants} className="relative mb-6">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-surface-2)' }}
        >
          <Icon className="w-12 h-12" style={{ color: 'var(--interactive-primary)' }} />
        </div>
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="absolute -top-1 -right-1"
        >
          <Sparkles className="w-6 h-6" style={{ color: 'var(--interactive-primary)' }} />
        </motion.div>
      </motion.div>

      <motion.h3
        variants={itemVariants}
        className="text-xl font-bold mb-2"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </motion.h3>

      <motion.p
        variants={itemVariants}
        className="text-sm max-w-xs mb-6"
        style={{ color: 'var(--text-secondary)' }}
      >
        {desc}
      </motion.p>
    </motion.div>
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
