import { MuscleGroupIcon } from '@shared/components/CardioIcons';
import { MUSCLE_GROUPS } from '@shared/constants/muscleGroups';

interface MuscleGroupPillsProps {
  active: string;
  onSelect: (mg: string) => void;
  className?: string;
}

export function MuscleGroupPills({ active, onSelect, className = '' }: MuscleGroupPillsProps) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {MUSCLE_GROUPS.map((mg) => {
        const isActive = active === mg;
        return (
          <button
            type="button"
            key={mg}
            onClick={() => onSelect(mg)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-sm transition-colors border"
            style={{
              backgroundColor: isActive ? 'var(--interactive-primary)' : 'var(--bg-surface-2)',
              color: isActive ? '#000' : 'var(--text-secondary)',
              borderColor: isActive ? 'var(--interactive-primary)' : 'var(--border-subtle)',
              fontWeight: isActive ? 'bold' : 'normal',
            }}
          >
            <MuscleGroupIcon name={mg} className="w-3 h-3" />
            {mg}
          </button>
        );
      })}
    </div>
  );
}
