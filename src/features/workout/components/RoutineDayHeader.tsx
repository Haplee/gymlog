import { m, type Variants } from 'framer-motion';

interface RoutineDayHeaderProps {
  name: string;
  weekdayName: string;
  isIdle: boolean;
  exercises: { name: string }[];
  variants: Variants;
}

export function RoutineDayHeader({
  name,
  weekdayName,
  isIdle,
  exercises,
  variants,
}: RoutineDayHeaderProps) {
  return (
    <m.div
      variants={variants}
      initial="hidden"
      animate="show"
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="mb-4"
    >
      <h1 className="font-display text-2xl font-bold tracking-tight text-fg">
        {name} · <span className="capitalize">{weekdayName}</span>
      </h1>
      {isIdle && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {exercises.slice(0, 4).map((ex) => (
            <span
              key={ex.name}
              className="rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg-muted"
            >
              {ex.name}
            </span>
          ))}
          {exercises.length > 4 && (
            <span className="px-1 py-1 text-xs text-fg-subtle">+{exercises.length - 4}</span>
          )}
        </div>
      )}
    </m.div>
  );
}
