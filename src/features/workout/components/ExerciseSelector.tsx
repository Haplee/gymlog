import { useTranslation } from 'react-i18next';
import { useState, useCallback, useRef, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, X, Loader2, AlertCircle, Trash2, Clock, Pencil, Check } from 'lucide-react';
import { useExerciseSearch, trackRecentExercise } from '../hooks/useExerciseSearch';
import { createCustomExercise } from '../api/workoutMutations';
import { Button } from '@shared/components/ui';
import { MuscleGroupIcon } from '@shared/components/CardioIcons';
import { supabase } from '@shared/lib/supabase';
import { toast } from 'sonner';

interface ExerciseSelectorProps {
  userId: string;
  onSelect: (exerciseId: string, isCustom: boolean) => void;
  activeExerciseId?: string | null;
}

interface ExerciseOption {
  id: string;
  name: string;
  muscle_group: string;
  user_id: string | null;
}

const MUSCLE_GROUPS = [
  'Pecho',
  'Espalda',
  'Hombro',
  'Pierna',
  'Glúteo',
  'Bíceps',
  'Tríceps',
  'Antebrazo',
  'Core',
  'Cardio',
  'Otro',
];

function suggestMuscleGroup(name: string): string | null {
  const n = name.toLowerCase();
  if (!n.trim()) return null;
  if (/antebrazo/.test(n)) return 'Antebrazo';
  if (/bíceps|biceps|curl|martillo/.test(n)) return 'Bíceps';
  if (/tríceps|triceps|press francés|fondos/.test(n)) return 'Tríceps';
  if (/pecho|press banca|aperturas|fly/.test(n)) return 'Pecho';
  if (/espalda|dominada|remo|jalón|jalon|pull/.test(n)) return 'Espalda';
  if (/hombro|militar|lateral|pájaro|pajaro/.test(n)) return 'Hombro';
  if (/glúteo|gluteo|hip thrust|puente/.test(n)) return 'Glúteo';
  if (
    /pierna|cuádriceps|cuadriceps|sentadilla|squat|peso muerto|femoral|isquio|gemelo|pantorrilla|lunge|zancada/.test(
      n,
    )
  )
    return 'Pierna';
  if (/abdomen|core|plancha|crunch|abdominal/.test(n)) return 'Core';
  if (/correr|bici|cardio|elíptica|eliptica/.test(n)) return 'Cardio';
  return null;
}

export function ExerciseSelector({ userId, onSelect, activeExerciseId }: ExerciseSelectorProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseMuscle, setNewExerciseMuscle] = useState('Otro');
  const [error, setError] = useState<string | null>(null);
  const [editingMuscleId, setEditingMuscleId] = useState<string | null>(null);
  const [editingMuscleValue, setEditingMuscleValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { query, setQuery, exercises, recentIds, isLoading, isFocused, onFocus, onBlur } =
    useExerciseSearch({ debounceMs: 250, userId });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; muscle_group: string; equipment?: string }) =>
      createCustomExercise(userId, data),
    onSuccess: (newExercise) => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      onSelect(newExercise.id, true);
      setIsCreating(false);
      setNewExerciseName('');
      setNewExerciseMuscle('Otro');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Error creando ejercicio');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (exerciseId: string) => {
      const { error } = await supabase.from('exercises').delete().eq('id', exerciseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      toast.success('Ejercicio eliminado');
    },
    onError: () => {
      toast.error('Error al eliminar ejercicio');
    },
  });

  const updateMuscleMutation = useMutation({
    mutationFn: async ({ id, muscle_group }: { id: string; muscle_group: string }) => {
      const { error } = await supabase.from('exercises').update({ muscle_group }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      setEditingMuscleId(null);
      toast.success('Grupo muscular actualizado');
    },
    onError: () => {
      toast.error('Error al actualizar grupo muscular');
    },
  });

  const handleDeleteExercise = useCallback(
    (e: React.MouseEvent, exerciseId: string) => {
      e.stopPropagation();
      if (confirm(t('workout.confirm_delete_exercise'))) {
        deleteMutation.mutate(exerciseId);
      }
    },
    [deleteMutation, t],
  );

  const handleSelect = useCallback(
    (ex: ExerciseOption) => {
      trackRecentExercise(ex.id);
      onSelect(ex.id, ex.user_id === userId);
      setQuery('');
    },
    [onSelect, setQuery, userId],
  );

  const handleCreate = useCallback(() => {
    if (!newExerciseName.trim()) {
      setError('El nombre es requerido');
      return;
    }
    setError(null);
    createMutation.mutate({ name: newExerciseName.trim(), muscle_group: newExerciseMuscle });
  }, [newExerciseName, newExerciseMuscle, createMutation]);

  const handleCancelCreate = useCallback(() => {
    setIsCreating(false);
    setNewExerciseName('');
    setError(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCreating) handleCancelCreate();
        inputRef.current?.blur();
      }
    },
    [isCreating, handleCancelCreate],
  );

  const recentSet = useMemo(() => new Set(recentIds), [recentIds]);

  // Active exercise muscle group — used to surface same-group exercises first
  const activeMuscleGroup = useMemo(() => {
    if (!activeExerciseId) return null;
    return exercises.find((ex) => ex.id === activeExerciseId)?.muscle_group ?? null;
  }, [activeExerciseId, exercises]);

  const groupedExercises = useMemo((): [string, ExerciseOption[]][] => {
    const recentExercises = exercises.filter((ex) => recentSet.has(ex.id));
    const rest = exercises.filter((ex) => !recentSet.has(ex.id));

    const result: [string, ExerciseOption[]][] = [];

    // Same muscle group first (if active exercise exists)
    if (activeMuscleGroup) {
      const sameGroup = rest.filter((ex) => ex.muscle_group === activeMuscleGroup);
      if (sameGroup.length > 0) result.push([activeMuscleGroup, sameGroup]);
    }

    // Recientes
    if (recentExercises.length > 0) result.push(['Recientes', recentExercises]);

    // Rest of groups
    const otherMap: Record<string, ExerciseOption[]> = {};
    rest.forEach((ex) => {
      if (ex.muscle_group === activeMuscleGroup) return;
      if (!otherMap[ex.muscle_group]) otherMap[ex.muscle_group] = [];
      otherMap[ex.muscle_group].push(ex);
    });
    Object.entries(otherMap).forEach(([group, exs]) => result.push([group, exs]));

    return result;
  }, [exercises, recentSet, activeMuscleGroup]);

  const dropdownStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-surface-3)',
    border: '1px solid var(--border-default)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  };

  const groupHeaderStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-surface-2)',
    color: 'var(--text-tertiary)',
    position: 'sticky',
    top: 0,
  };

  return (
    <div className="relative">
      {/* Search input */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: 'var(--text-tertiary)' }}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          placeholder="Buscar ejercicio..."
          aria-label="Buscar ejercicio"
          aria-expanded={isFocused}
          aria-controls="exercise-list"
          className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm outline-none transition-all"
          style={{
            backgroundColor: 'var(--bg-surface-2)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
          }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full"
            aria-label="Limpiar búsqueda"
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {(isFocused || editingMuscleId !== null || isCreating) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            id="exercise-list"
            role="listbox"
            className="absolute z-50 top-full left-0 right-0 mt-1.5 max-h-[26rem] overflow-y-auto rounded-[var(--radius-lg)]"
            style={dropdownStyle}
            onMouseDown={(e) => {
              const tag = (e.target as HTMLElement).tagName;
              if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'BUTTON') {
                e.preventDefault();
              }
            }}
            onTouchStart={(e) => {
              const tag = (e.target as HTMLElement).tagName;
              // No prevenimos para input/select para poder escribir y elegir
              // Tampoco para los botones de las píldoras de grupos musculares
              if (tag !== 'INPUT' && tag !== 'SELECT') {
                // Except for our Pill buttons which we do want to preventDefault on
                // so they don't steal focus from the search input when editing a muscle group.
                // But wait, the edit muscle group doesn't steal focus if we handle it well,
                // actually we can just preventDefault if it's NOT an input or select.
                e.preventDefault();
              }
            }}
          >
            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <Loader2
                  className="w-5 h-5 animate-spin"
                  style={{ color: 'var(--text-tertiary)' }}
                />
              </div>
            )}

            {!isLoading && exercises.length === 0 && query && (
              <div className="p-4 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Sin resultados para "{query}"
              </div>
            )}

            {!isLoading && exercises.length > 0 && (
              <div className="py-1">
                {groupedExercises.map(([group, exs]) => (
                  <div key={group}>
                    {/* Group header */}
                    <div className="px-3 py-2 flex items-center gap-1.5" style={groupHeaderStyle}>
                      {group === 'Recientes' ? (
                        <Clock
                          className="w-3 h-3 flex-shrink-0"
                          style={{ color: 'var(--text-tertiary)' }}
                        />
                      ) : (
                        <span
                          className="flex-shrink-0"
                          style={{
                            color:
                              group === activeMuscleGroup
                                ? 'var(--interactive-primary)'
                                : 'var(--text-tertiary)',
                          }}
                        >
                          <MuscleGroupIcon name={group} className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <span
                        className="text-[0.625rem] font-bold uppercase tracking-[0.12em]"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {group === activeMuscleGroup && group !== 'Recientes'
                          ? `${group} — Sugerido`
                          : group}
                      </span>
                    </div>

                    {/* Exercise rows */}
                    {exs.map((ex) => (
                      <div
                        key={ex.id}
                        className="flex flex-col"
                        style={
                          activeExerciseId === ex.id
                            ? { backgroundColor: 'var(--interactive-hover)' }
                            : {}
                        }
                      >
                        <div className="flex items-center">
                          <button
                            onClick={() => handleSelect(ex)}
                            className="flex-1 px-3 py-3 text-left flex items-center justify-between transition-colors"
                            style={{ color: 'var(--text-primary)' }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor = 'var(--interactive-hover)')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = 'transparent')
                            }
                            role="option"
                            aria-selected={activeExerciseId === ex.id}
                          >
                            <span className="text-[0.9375rem] font-medium">{ex.name}</span>
                            {ex.user_id === userId && (
                              <span
                                className="text-[0.5625rem] px-1.5 py-0.5 rounded-[var(--radius-pill)] font-medium ml-2 flex-shrink-0"
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
                          {ex.user_id === userId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (editingMuscleId === ex.id) {
                                  setEditingMuscleId(null);
                                  // Devolver el foco al input para que el dropdown siga visible
                                  requestAnimationFrame(() => inputRef.current?.focus());
                                } else {
                                  setEditingMuscleId(ex.id);
                                  setEditingMuscleValue(ex.muscle_group);
                                }
                              }}
                              className="px-2 py-2 transition-colors"
                              style={{
                                color:
                                  editingMuscleId === ex.id
                                    ? 'var(--interactive-primary)'
                                    : 'var(--text-tertiary)',
                              }}
                              aria-label={`Editar grupo muscular de ${ex.name}`}
                              title={`Editar grupo muscular de ${ex.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {ex.user_id === userId && (
                            <button
                              onClick={(e) => handleDeleteExercise(e, ex.id)}
                              disabled={deleteMutation.isPending}
                              className="px-2 py-2 transition-colors"
                              style={{ color: 'var(--text-tertiary)' }}
                              aria-label={`Eliminar ejercicio ${ex.name}`}
                              title={`Eliminar ejercicio ${ex.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {/* Inline muscle group editor */}
                        {editingMuscleId === ex.id && (
                          <div
                            className="px-3 pb-3 pt-1"
                            onMouseDown={(e) => e.preventDefault()}
                            onTouchStart={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {MUSCLE_GROUPS.map((mg) => {
                                const active = editingMuscleValue === mg;
                                return (
                                  <button
                                    key={mg}
                                    onClick={() => setEditingMuscleValue(mg)}
                                    className="flex items-center gap-1 px-2.5 py-1 text-[0.6875rem] rounded-[var(--radius-pill)] transition-colors border"
                                    style={{
                                      backgroundColor: active
                                        ? 'var(--interactive-primary)'
                                        : 'var(--bg-surface-2)',
                                      color: active ? '#000' : 'var(--text-secondary)',
                                      borderColor: active
                                        ? 'var(--interactive-primary)'
                                        : 'var(--border-subtle)',
                                      fontWeight: active ? 'bold' : 'normal',
                                    }}
                                  >
                                    <MuscleGroupIcon name={mg} className="w-3 h-3" />
                                    {mg}
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              onClick={() =>
                                updateMuscleMutation.mutate({
                                  id: ex.id,
                                  muscle_group: editingMuscleValue,
                                })
                              }
                              disabled={updateMuscleMutation.isPending}
                              className="w-full flex items-center justify-center py-2 rounded-[var(--radius-md)] text-sm font-semibold transition-transform active:scale-[0.98]"
                              style={{
                                backgroundColor: 'var(--interactive-primary)',
                                color: '#000',
                              }}
                            >
                              {updateMuscleMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
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
                    ))}
                  </div>
                ))}
              </div>
            )}

            {!isLoading && !isCreating && (
              <button
                onClick={() => {
                  setIsCreating(true);
                  setQuery('');
                }}
                className="w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 transition-colors"
                style={{
                  color: 'var(--interactive-primary)',
                  borderTop: '1px solid var(--border-subtle)',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = 'var(--interactive-hover)')
                }
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Plus className="w-4 h-4" />
                <span>{t('workout.create_custom_exercise')}</span>
              </button>
            )}

            {isCreating && (
              <div className="p-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <div
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {t('workout.new_exercise')}
                </div>
                <input
                  type="text"
                  value={newExerciseName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNewExerciseName(v);
                    const suggested = suggestMuscleGroup(v);
                    if (suggested) setNewExerciseMuscle(suggested);
                  }}
                  placeholder={t('workout.exercise_name_placeholder')}
                  className="w-full px-3 py-2 rounded-[var(--radius-md)] text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--bg-surface-2)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                  autoFocus
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {MUSCLE_GROUPS.map((mg) => {
                    const active = newExerciseMuscle === mg;
                    return (
                      <button
                        key={mg}
                        type="button"
                        onClick={() => setNewExerciseMuscle(mg)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[0.6875rem] rounded-[var(--radius-pill)] transition-colors border"
                        style={{
                          backgroundColor: active
                            ? 'var(--interactive-primary)'
                            : 'var(--bg-surface-2)',
                          color: active ? '#000' : 'var(--text-secondary)',
                          borderColor: active
                            ? 'var(--interactive-primary)'
                            : 'var(--border-subtle)',
                          fontWeight: active ? 'bold' : 'normal',
                        }}
                      >
                        <MuscleGroupIcon name={mg} className="w-3 h-3" />
                        {mg}
                      </button>
                    );
                  })}
                </div>

                {error && (
                  <div
                    className="flex items-center gap-1 mt-2 text-xs"
                    style={{ color: 'var(--error)' }}
                  >
                    <AlertCircle className="w-3 h-3" />
                    {error}
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <Button variant="ghost" size="sm" onClick={handleCancelCreate} className="flex-1">
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCreate}
                    disabled={createMutation.isPending || !newExerciseName.trim()}
                    className="flex-1"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t('common.create')
                    )}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop to close dropdown */}
      {(isFocused || editingMuscleId !== null || isCreating) && (
        <div
          className="fixed inset-0 z-40"
          aria-hidden="true"
          onClick={() => {
            inputRef.current?.blur();
            setEditingMuscleId(null);
            setIsCreating(false);
          }}
        />
      )}
    </div>
  );
}
