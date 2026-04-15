import { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, X, Loader2, AlertCircle } from 'lucide-react';
import { useExerciseSearch } from '../hooks/useExerciseSearch';
import { createCustomExercise } from '../api/workoutMutations';
import { Button } from '@shared/components/ui';

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

export function ExerciseSelector({ userId, onSelect, activeExerciseId }: ExerciseSelectorProps) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseMuscle, setNewExerciseMuscle] = useState('Otro');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { query, setQuery, exercises, isLoading, isFocused, onFocus, onBlur } = useExerciseSearch({
    debounceMs: 250,
    userId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; muscle_group: string; equipment?: string }) =>
      createCustomExercise(userId, data),
    onSuccess: (newExercise) => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      queryClient.invalidateQueries({ queryKey: ['exerciseSearch'] });
      onSelect(newExercise.id, true);
      setIsCreating(false);
      setNewExerciseName('');
      setNewExerciseMuscle('Otro');
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Error creando ejercicio');
    },
  });

  const handleSelect = useCallback(
    (ex: ExerciseOption) => {
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
    createMutation.mutate({
      name: newExerciseName.trim(),
      muscle_group: newExerciseMuscle,
    });
  }, [newExerciseName, newExerciseMuscle, createMutation]);

  const handleCancelCreate = useCallback(() => {
    setIsCreating(false);
    setNewExerciseName('');
    setError(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCreating) {
          handleCancelCreate();
        }
        inputRef.current?.blur();
      }
    },
    [isCreating, handleCancelCreate],
  );

  const groupedExercises = exercises.reduce<Record<string, ExerciseOption[]>>((acc, ex) => {
    const group = ex.muscle_group;
    if (!acc[group]) acc[group] = [];
    acc[group].push(ex);
    return acc;
  }, {});

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-muted]"
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
          className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm outline-none transition-all focus:ring-2 focus:ring-[--color-primary] bg-[--bg-surface] border border-[--border-default] text-[--text-primary]"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[--bg-elevated]"
            aria-label="Limpiar búsqueda"
          >
            <X className="w-4 h-4 text-[--text-muted]" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            id="exercise-list"
            role="listbox"
            className="absolute z-50 top-full left-0 right-0 mt-2 max-h-72 overflow-y-auto rounded-lg border border-[--border-default] bg-[--bg-surface] shadow-lg"
          >
            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-5 h-5 animate-spin text-[--text-muted]" />
              </div>
            )}

            {!isLoading && exercises.length === 0 && query && (
              <div className="p-4 text-center text-sm text-[--text-muted]">
                No se encontraron ejercicios
              </div>
            )}

            {!isLoading && exercises.length > 0 && (
              <div className="py-1">
                {Object.entries(groupedExercises).map(([group, exs]) => (
                  <div key={group}>
                    <div className="px-3 py-1.5 text-xs font-medium text-[--text-muted] bg-[--bg-surface-2] sticky top-0">
                      {group}
                    </div>
                    {exs.map((ex) => (
                      <button
                        key={ex.id}
                        onClick={() => handleSelect(ex)}
                        className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-[--bg-elevated] focus:outline-none focus:bg-[--bg-elevated] ${
                          activeExerciseId === ex.id ? 'bg-[--bg-elevated]' : ''
                        }`}
                        role="option"
                        aria-selected={activeExerciseId === ex.id}
                      >
                        <span className="text-[--text-primary]">{ex.name}</span>
                        {ex.user_id === userId && (
                          <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-[--color-primary]/10 text-[--color-primary]">
                            Propio
                          </span>
                        )}
                      </button>
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
                className="w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 text-[--color-primary] hover:bg-[--bg-elevated] focus:outline-none border-t border-[--border-default]"
              >
                <Plus className="w-4 h-4" />
                <span>Crear nuevo ejercicio</span>
              </button>
            )}

            {isCreating && (
              <div className="p-3 border-t border-[--border-default]">
                <div className="text-xs font-medium text-[--text-primary] mb-2">
                  Nuevo ejercicio
                </div>
                <input
                  type="text"
                  value={newExerciseName}
                  onChange={(e) => setNewExerciseName(e.target.value)}
                  placeholder="Nombre del ejercicio"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-[--bg-surface-2] border border-[--border-default] text-[--text-primary] outline-none focus:ring-2 focus:ring-[--color-primary]"
                  autoFocus
                />
                <select
                  value={newExerciseMuscle}
                  onChange={(e) => setNewExerciseMuscle(e.target.value)}
                  className="w-full mt-2 px-3 py-2 rounded-lg text-sm bg-[--bg-surface-2] border border-[--border-default] text-[--text-primary] outline-none focus:ring-2 focus:ring-[--color-primary]"
                >
                  <option value="Pecho">Pecho</option>
                  <option value="Espalda">Espalda</option>
                  <option value="Hombro">Hombro</option>
                  <option value="Pierna">Pierna</option>
                  <option value="Glúteo">Glúteo</option>
                  <option value="Brazos">Brazos</option>
                  <option value="Core">Core</option>
                  <option value="Cardio">Cardio</option>
                  <option value="Otro">Otro</option>
                </select>

                {error && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-[--color-error]">
                    <AlertCircle className="w-3 h-3" />
                    {error}
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <Button variant="ghost" size="sm" onClick={handleCancelCreate} className="flex-1">
                    Cancelar
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
                      'Crear'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {isFocused && (
        <div
          className="fixed inset-0 z-40"
          aria-hidden="true"
          onClick={() => inputRef.current?.blur()}
        />
      )}
    </div>
  );
}
