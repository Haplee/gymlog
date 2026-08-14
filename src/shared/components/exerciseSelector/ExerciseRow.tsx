import { useTranslation } from 'react-i18next';
import { MuscleGroupPills } from './MuscleGroupPills';
import { Check, Edit, Loader, Trash2 } from '@shared/components/icons';

export interface ExerciseOption {
  id: string;
  name: string;
  muscle_group: string;
  user_id: string | null;
}

interface ExerciseRowProps {
  exercise: ExerciseOption;
  userId: string;
  isActive: boolean;
  isEditing: boolean;
  editingValue: string;
  deletePending: boolean;
  updatePending: boolean;
  onSelect: () => void;
  onToggleEdit: () => void;
  onSetEditingValue: (value: string) => void;
  onDelete: (e: React.MouseEvent) => void;
  onSave: () => void;
}

export function ExerciseRow({
  exercise,
  userId,
  isActive,
  isEditing,
  editingValue,
  deletePending,
  updatePending,
  onSelect,
  onToggleEdit,
  onSetEditingValue,
  onDelete,
  onSave,
}: ExerciseRowProps) {
  const { t } = useTranslation();
  const isOwn = exercise.user_id === userId;
  return (
    <div
      className="flex flex-col"
      style={isActive ? { backgroundColor: 'var(--interactive-hover)' } : {}}
    >
      <div className="flex items-center">
        <button
          type="button"
          onClick={onSelect}
          className="flex-1 px-3 py-3 text-left flex items-center justify-between transition-colors text-fg hover:bg-hover active:bg-hover"
          role="option"
          aria-selected={isActive}
        >
          <span className="text-base font-medium">{exercise.name}</span>
          {isOwn && (
            <span
              className="text-[0.5625rem] px-1.5 py-0.5 rounded-sm font-medium ml-2 flex-shrink-0"
              style={{
                backgroundColor: 'rgba(200,255,0,0.1)',
                color: 'var(--interactive-primary)',
              }}
            >
              {t('workout.custom_badge')}
            </span>
          )}
        </button>
        {/* Editar grupo muscular (solo ejercicios propios) */}
        {isOwn && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleEdit();
            }}
            className="px-2 py-2 transition-colors"
            style={{
              color: isEditing ? 'var(--interactive-primary)' : 'var(--text-tertiary)',
            }}
            aria-label={`Editar grupo muscular de ${exercise.name}`}
            title={`Editar grupo muscular de ${exercise.name}`}
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
        )}
        {isOwn && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deletePending}
            className="px-2 py-2 transition-colors text-fg-subtle"
            aria-label={`Eliminar ejercicio ${exercise.name}`}
            title={`Eliminar ejercicio ${exercise.name}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {/* Inline muscle group editor */}
      {isEditing && (
        <div
          className="px-3 pb-3 pt-1"
          onMouseDown={(e) => e.preventDefault()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <MuscleGroupPills active={editingValue} onSelect={onSetEditingValue} className="mb-2" />
          <button
            type="button"
            onClick={onSave}
            disabled={updatePending}
            className="w-full flex items-center justify-center py-2 rounded-md text-sm font-semibold transition-transform active:scale-[0.98]"
            style={{
              backgroundColor: 'var(--interactive-primary)',
              color: '#000',
            }}
          >
            {updatePending ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Guardar grupo muscular
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
