interface SkeletonProps {
  className?: string;
  lines?: number;
  /** Para skeletons de tipo tarjeta */
  card?: boolean;
}

/**
 * Skeleton loader. Usa la animación shimmer de index.css.
 *
 * @example
 * <Skeleton lines={3} />
 * <Skeleton card />
 */
export function Skeleton({ className = '', lines, card }: SkeletonProps) {
  if (card) {
    return (
      <div
        className={`rounded-[--radius-xl] bg-[--bg-surface] border border-[--border-default] p-4 space-y-3 ${className}`}
      >
        <div className="skeleton h-4 w-2/3 rounded-[--radius-md]" />
        <div className="skeleton h-3 w-full rounded-[--radius-md]" />
        <div className="skeleton h-3 w-4/5 rounded-[--radius-md]" />
        <div className="flex gap-2 mt-4">
          <div className="skeleton h-8 w-20 rounded-[--radius-md]" />
          <div className="skeleton h-8 w-16 rounded-[--radius-md]" />
        </div>
      </div>
    );
  }

  if (lines) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={`skeleton h-4 rounded-[--radius-md] ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
          />
        ))}
      </div>
    );
  }

  return <div className={`skeleton rounded-[--radius-md] ${className}`} />;
}

/** Skeleton para lista de ejercicios */
export function ExerciseListSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="skeleton h-12 rounded-[--radius-lg]"
          style={{ opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  );
}

/** Skeleton página completa */
export function PageSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="skeleton h-8 w-40 rounded-[--radius-lg]" />
      <Skeleton card />
      <Skeleton card />
      <Skeleton card />
    </div>
  );
}
