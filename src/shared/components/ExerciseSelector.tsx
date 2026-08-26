import { useTranslation } from 'react-i18next';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { m, AnimatePresence } from 'framer-motion';
import { useExerciseSearch, trackRecentExercise } from '@shared/hooks/useExerciseSearch';
import {
  createCustomExercise,
  type CreateCustomExerciseInput,
} from '@shared/api/exerciseMutations';
import { MuscleGroupIcon } from '@shared/components/CardioIcons';
import { ConfirmDialog } from '@shared/components/ui';
import { supabase } from '@shared/lib/supabase';
import { DEFAULT_MUSCLE_GROUP } from '@shared/constants/muscleGroups';
import { toast } from 'sonner';
import { ExerciseRow, type ExerciseOption } from './exerciseSelector/ExerciseRow';
import { CreateExerciseForm } from './exerciseSelector/CreateExerciseForm';
import { Clock, Loader, Plus, Search, X } from '@shared/components/icons';

interface ExerciseSelectorProps {
  userId: string;
  onSelect: (exerciseId: string, isCustom: boolean) => void;
  activeExerciseId?: string | null;
  excludeIds?: string[];
  /**
   * Muestra la lista de ejercicios sin esperar a que el input de búsqueda tenga
   * el foco. Lo usa el picker de rutinas (dentro de un BottomSheet): allí el
   * dropdown cerrado por defecto hacía que la hoja pareciera vacía.
   */
  defaultOpen?: boolean;
}

export function ExerciseSelector({
  userId,
  onSelect,
  activeExerciseId,
  excludeIds,
  defaultOpen = false,
}: ExerciseSelectorProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseMuscle, setNewExerciseMuscle] = useState(DEFAULT_MUSCLE_GROUP);
  const [newSecondaries, setNewSecondaries] = useState<Record<string, number>>({});
  const [newIsBodyweight, setNewIsBodyweight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingMuscleId, setEditingMuscleId] = useState<string | null>(null);
  const [editingMuscleValue, setEditingMuscleValue] = useState('');
  /** Ejercicio pendiente de confirmar su borrado; null = nada que borrar. */
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    query,
    setQuery,
    exercises: searchExercises,
    recentIds,
    isLoading,
    isFocused,
    onFocus,
    onBlur,
  } = useExerciseSearch({ debounceMs: 250, userId });

  const excludeSet = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);
  const exercises = useMemo(
    () =>
      excludeSet.size === 0
        ? searchExercises
        : searchExercises.filter((ex) => !excludeSet.has(ex.id)),
    [searchExercises, excludeSet],
  );

  const createMutation = useMutation({
    mutationFn: (data: CreateCustomExerciseInput) => createCustomExercise(userId, data),
    onSuccess: (newExercise) => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      queryClient.invalidateQueries({ queryKey: ['exerciseLibrary'] });
      onSelect(newExercise.id, true);
      setIsCreating(false);
      setNewExerciseName('');
      setNewExerciseMuscle(DEFAULT_MUSCLE_GROUP);
      setNewSecondaries({});
      setNewIsBodyweight(false);
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
      queryClient.invalidateQueries({ queryKey: ['exerciseLibrary'] });
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
      // Mantener coherente el primario ponderado en exercise_muscles.
      const { data: existing } = await supabase
        .from('exercise_muscles')
        .select('muscle_group')
        .eq('exercise_id', id)
        .eq('role', 'primary')
        .maybeSingle();
      await supabase.from('exercise_muscles').delete().eq('exercise_id', id).eq('role', 'primary');
      await supabase
        .from('exercise_muscles')
        .upsert(
          { exercise_id: id, muscle_group, role: 'primary', weight: 100 },
          { onConflict: 'exercise_id,muscle_group' },
        );
      void existing;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      queryClient.invalidateQueries({ queryKey: ['exerciseLibrary'] });
      setEditingMuscleId(null);
      toast.success('Grupo muscular actualizado');
    },
    onError: () => {
      toast.error('Error al actualizar grupo muscular');
    },
  });

  const handleDeleteExercise = useCallback((e: React.MouseEvent, exerciseId: string) => {
    e.stopPropagation();
    setExerciseToDelete(exerciseId);
  }, []);

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
      setError(t('workout.name_required'));
      return;
    }
    setError(null);
    const secondaries = Object.entries(newSecondaries)
      .filter(([mg]) => mg !== newExerciseMuscle)
      .map(([muscle_group, weight]) => ({ muscle_group, weight }));
    createMutation.mutate({
      name: newExerciseName.trim(),
      muscle_group: newExerciseMuscle,
      secondaries,
      is_bodyweight: newIsBodyweight,
    });
  }, [newExerciseName, newExerciseMuscle, newSecondaries, newIsBodyweight, createMutation, t]);

  const toggleSecondary = useCallback((mg: string) => {
    setNewSecondaries((prev) => {
      const next = { ...prev };
      if (mg in next) delete next[mg];
      else next[mg] = 30;
      return next;
    });
  }, []);

  const adjustSecondary = useCallback((mg: string, delta: number) => {
    setNewSecondaries((prev) => {
      const current = prev[mg] ?? 30;
      const value = Math.max(5, Math.min(100, current + delta));
      return { ...prev, [mg]: value };
    });
  }, []);

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

  const isOpen = isFocused || editingMuscleId !== null || isCreating || defaultOpen;

  /**
   * Distancia del borde superior de la pantalla al final del buscador.
   *
   * Es **lo único que CSS no puede saber** de este cálculo, así que es lo único
   * que se mide en JS: el resto —alto del viewport, alto de la barra inferior y
   * el área segura de los gestos de Android— lo resuelve la propia hoja de
   * estilos, que sí sabe leer `env(safe-area-inset-bottom)`.
   *
   * Hacerlo entero en JS fue el primer intento y se quedó corto: `env()` no se
   * puede leer desde `getComputedStyle`, así que la lista descontaba los 52 px
   * de la barra pero no los ~48 de la franja de gestos, y la última fila
   * («crear ejercicio propio») quedaba tapada.
   */
  const [topOffset, setTopOffset] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || defaultOpen) return;

    const medir = () => {
      const input = inputRef.current;
      if (!input) return;
      setTopOffset(Math.round(input.getBoundingClientRect().bottom));
    };

    // Tras el layout, no en el cuerpo del efecto: medir antes de que el
    // navegador coloque el desplegable da la posición del render anterior.
    const raf = requestAnimationFrame(medir);
    window.addEventListener('resize', medir);
    window.visualViewport?.addEventListener('resize', medir);
    window.visualViewport?.addEventListener('scroll', medir);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', medir);
      window.visualViewport?.removeEventListener('resize', medir);
      window.visualViewport?.removeEventListener('scroll', medir);
    };
  }, [isOpen, defaultOpen]);

  const dropdownStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-surface-3)',
    border: '1px solid var(--border-default)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    // `100dvh` y no `100vh`: en Android el teclado encoge el viewport dinámico,
    // que es justo lo que hay que descontar para que la lista no acabe debajo.
    // El suelo de 160px evita que con el teclado abierto quede un hueco inútil.
    ...(!defaultOpen && topOffset != null
      ? {
          maxHeight: `max(160px, calc(100dvh - ${topOffset}px - var(--bottom-nav-height) - env(safe-area-inset-bottom) - 12px))`,
        }
      : {}),
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
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle"
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
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          aria-expanded={isFocused}
          aria-controls="exercise-list"
          // `transition-all` animaba también las propiedades geométricas, y un
          // elemento que se mueve entre el touchstart y el touchend no llega a
          // generar el click: la X de al lado solo respondía si se mantenía el
          // dedo. Aquí solo cambian colores al enfocar, así que se anima eso.
          className="w-full pl-10 pr-10 py-2.5 rounded-card text-sm outline-none transition-colors bg-surface-2 border border-line-strong text-fg"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            // El icono sigue midiendo 16 px, pero el botón que lo envuelve pasa
            // de 20 px a los 44 de la regla: era el objetivo más pequeño de la
            // pantalla y fallarlo dejaba el buscador con texto y sin resultados.
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full"
            aria-label={t('search.clear')}
          >
            <X className="w-4 h-4 text-fg-subtle" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <m.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            id="exercise-list"
            role="listbox"
            className={
              defaultOpen
                ? 'relative z-50 mt-1.5 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-card'
                : 'absolute z-50 top-full left-0 right-0 mt-1.5 overflow-y-auto overscroll-contain rounded-card'
            }
            style={dropdownStyle}
            onMouseDown={(e) => {
              const tag = (e.target as HTMLElement).tagName;
              if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'BUTTON') {
                e.preventDefault();
              }
            }}
            // Aquí NO se hace `preventDefault` en `touchstart`, y es deliberado:
            // hacerlo cancela el desplazamiento por defecto del navegador —es la
            // forma canónica de *desactivar* el scroll táctil—, así que el dedo
            // no movía esta lista por bien que cupiera. Era el motivo real de que
            // no se pudiera llegar a los últimos ejercicios en el móvil.
            //
            // Estaba puesto para que tocar la lista no le robara el foco al
            // buscador y se cerrara el desplegable, pero eso ya lo cubre el
            // retardo de 200 ms del blur (`useExerciseSearch`): sobra tiempo para
            // que el toque llegue a su destino. El `onMouseDown` de arriba sí se
            // mantiene, porque con ratón no hay gesto de desplazamiento que romper.
          >
            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <Loader className="w-5 h-5 animate-spin text-fg-subtle" />
              </div>
            )}

            {!isLoading && exercises.length === 0 && query && (
              <div className="p-4 text-center text-sm text-fg-subtle">
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
                        <Clock className="w-3 h-3 flex-shrink-0 text-fg-subtle" />
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
                      <span className="text-2xs font-bold uppercase tracking-[0.12em] text-fg-subtle">
                        {group === activeMuscleGroup && group !== 'Recientes'
                          ? `${group} — Sugerido`
                          : group}
                      </span>
                    </div>

                    {/* Exercise rows */}
                    {exs.map((ex) => (
                      <ExerciseRow
                        key={ex.id}
                        exercise={ex}
                        userId={userId}
                        isActive={activeExerciseId === ex.id}
                        isEditing={editingMuscleId === ex.id}
                        editingValue={editingMuscleValue}
                        deletePending={deleteMutation.isPending}
                        updatePending={updateMuscleMutation.isPending}
                        onSelect={() => handleSelect(ex)}
                        onToggleEdit={() => {
                          if (editingMuscleId === ex.id) {
                            setEditingMuscleId(null);
                            // Devolver el foco al input para que el dropdown siga visible
                            requestAnimationFrame(() => inputRef.current?.focus());
                          } else {
                            setEditingMuscleId(ex.id);
                            setEditingMuscleValue(ex.muscle_group);
                          }
                        }}
                        onSetEditingValue={setEditingMuscleValue}
                        onDelete={(e) => handleDeleteExercise(e, ex.id)}
                        onSave={() =>
                          updateMuscleMutation.mutate({
                            id: ex.id,
                            muscle_group: editingMuscleValue,
                          })
                        }
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {!isLoading && !isCreating && (
              <button
                type="button"
                onClick={() => {
                  setIsCreating(true);
                  setQuery('');
                }}
                className="w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 transition-colors text-accent border-t border-line hover:bg-hover active:bg-hover"
              >
                <Plus className="w-4 h-4" />
                <span>{t('workout.create_custom_exercise')}</span>
              </button>
            )}

            {isCreating && (
              <CreateExerciseForm
                name={newExerciseName}
                onNameChange={setNewExerciseName}
                muscle={newExerciseMuscle}
                onMuscleChange={setNewExerciseMuscle}
                secondaries={newSecondaries}
                onToggleSecondary={toggleSecondary}
                onAdjustSecondary={adjustSecondary}
                isBodyweight={newIsBodyweight}
                onToggleBodyweight={() => setNewIsBodyweight((v) => !v)}
                error={error}
                isPending={createMutation.isPending}
                onCancel={handleCancelCreate}
                onCreate={handleCreate}
              />
            )}
          </m.div>
        )}
      </AnimatePresence>

      {/* Borrar un ejercicio propio se pregunta con el diálogo de la app, no con
          el del sistema: es destructivo y arrastra su historial. */}
      <ConfirmDialog
        open={exerciseToDelete !== null}
        title={t('workout.confirm_delete_exercise')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={() => {
          if (exerciseToDelete) deleteMutation.mutate(exerciseToDelete);
          setExerciseToDelete(null);
        }}
        onCancel={() => setExerciseToDelete(null)}
      />

      {/* Backdrop to close dropdown */}
      {isOpen && !defaultOpen && (
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
