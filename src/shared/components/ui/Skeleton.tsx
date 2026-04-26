import { GymLogLogo } from './GymLogLogo';
import { memo } from 'react';

interface SkeletonProps {
  className?: string;
  lines?: number;
  card?: boolean;
}

const SkeletonComponent = ({ className = '', lines, card }: SkeletonProps) => {
  if (card) {
    return (
      <div
        className={`rounded-[var(--radius-xl)] bg-[var(--bg-surface)] border border-[var(--border-default)] p-4 space-y-3 ${className}`}
      >
        <div className="skeleton h-4 w-2/3 rounded-[var(--radius-md)]" />
        <div className="skeleton h-3 w-full rounded-[var(--radius-md)]" />
        <div className="skeleton h-3 w-4/5 rounded-[var(--radius-md)]" />
        <div className="flex gap-2 mt-4">
          <div className="skeleton h-8 w-20 rounded-[var(--radius-md)]" />
          <div className="skeleton h-8 w-16 rounded-[var(--radius-md)]" />
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
            className={`skeleton h-4 rounded-[var(--radius-md)] ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
          />
        ))}
      </div>
    );
  }

  return <div className={`skeleton rounded-[var(--radius-md)] ${className}`} />;
};

export const Skeleton = memo(SkeletonComponent);

export const ExerciseListSkeleton = memo(function ExerciseListSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="skeleton h-12 rounded-[var(--radius-lg)]"
          style={{ opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  );
});

export const ChartSkeleton = memo(function ChartSkeleton() {
  const heights = [45, 70, 55, 85, 40, 65, 50];
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-end gap-1 h-32">
        {heights.map((h, i) => (
          <div
            key={i}
            className="flex-1 skeleton rounded-t-[var(--radius-md)]"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="skeleton h-3 w-full rounded-[var(--radius-md)]" />
    </div>
  );
});

export const KPICardSkeleton = memo(function KPICardSkeleton() {
  return <div className="skeleton h-24 rounded-[var(--radius-xl)]" />;
});

export const HistoryListSkeleton = memo(function HistoryListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-[var(--radius-lg)] skeleton">
          <div className="skeleton w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-1/2 rounded-[var(--radius-md)]" />
            <div className="skeleton h-3 w-1/3 rounded-[var(--radius-md)]" />
          </div>
        </div>
      ))}
    </div>
  );
});

export const PageSkeleton = memo(function PageSkeleton() {
  return (
    <div className="p-4 space-y-4 min-h-[80vh] flex flex-col">
      <div className="flex flex-col items-center justify-center flex-1 py-10 opacity-40">
        <GymLogLogo size="lg" variant="icon" className="animate-pulse mb-4" />
        <div className="skeleton h-6 w-32 rounded-[var(--radius-lg)]" />
      </div>
      <div className="space-y-4">
        <Skeleton card />
        <Skeleton card />
      </div>
    </div>
  );
});
