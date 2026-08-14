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
      <div className={`glass-2 rounded-card p-4 space-y-3 ${className}`}>
        <div className="skeleton h-4 w-2/3 rounded-md" />
        <div className="skeleton h-3 w-full rounded-md" />
        <div className="skeleton h-3 w-4/5 rounded-md" />
        <div className="flex gap-2 mt-4">
          <div className="skeleton h-8 w-20 rounded-md" />
          <div className="skeleton h-8 w-16 rounded-md" />
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
            className={`skeleton h-4 rounded-md ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
          />
        ))}
      </div>
    );
  }

  return <div className={`skeleton rounded-md ${className}`} />;
};

export const Skeleton = memo(SkeletonComponent);

export const PageSkeleton = memo(function PageSkeleton() {
  return (
    <div className="p-4 space-y-4 min-h-[80vh] flex flex-col">
      <div className="flex flex-col items-center justify-center flex-1 py-10 opacity-40">
        <GymLogLogo size="lg" variant="icon" className="animate-pulse mb-4" />
        <div className="skeleton h-6 w-32 rounded-card" />
      </div>
      <div className="space-y-4">
        <Skeleton card />
        <Skeleton card />
      </div>
    </div>
  );
});
