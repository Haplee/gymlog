import { m, type Variants } from 'framer-motion';

interface RoutineDayHeaderProps {
  name: string;
  weekdayName: string;
  isIdle: boolean;
  exercises: { name: string }[];
  variants: Variants;
  /**
   * Hay al menos una serie registrada, así que la pantalla ya no está
   * presentándose: está entrenando.
   *
   * El nombre de la rutina es el título de la pantalla cuando aún no has
   * empezado —«esto es lo que toca hoy»—, y en cuanto hay una serie registrada
   * pasa a ser una línea de contexto. No se oculta: si se escondiera, la
   * pantalla se quedaría sin su único `h1`, y el nombre del ejercicio es un
   * `span` dentro de un componente de listado, no un encabezado de página.
   * Lo que cambia es el peso visual, que es lo que compite con el peso que
   * estás a punto de levantar.
   */
  compact?: boolean;
}

export function RoutineDayHeader({
  name,
  weekdayName,
  isIdle,
  exercises,
  variants,
  compact = false,
}: RoutineDayHeaderProps) {
  return (
    <m.div
      variants={variants}
      initial="hidden"
      animate="show"
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={compact ? 'mb-6' : 'mb-10'}
    >
      <h1
        className={
          compact
            ? 'label-caps text-fg-muted truncate'
            : 'font-display text-2xl font-bold tracking-tight text-fg'
        }
      >
        {name} · <span className={compact ? '' : 'capitalize'}>{weekdayName}</span>
      </h1>
      {isIdle && !compact && (
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
