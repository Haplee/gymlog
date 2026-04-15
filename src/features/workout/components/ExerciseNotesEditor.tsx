import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StickyNote, X, Check, Loader2 } from 'lucide-react';
import { useUpdateExerciseNotes } from '../hooks/useWorkoutExercises';

interface ExerciseNotesEditorProps {
  workoutId: string;
  workoutExerciseId: string;
  initialNotes?: string | null;
  exerciseName: string;
}

export function ExerciseNotesEditor({
  workoutId,
  workoutExerciseId,
  initialNotes = '',
  exerciseName,
}: ExerciseNotesEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [localNotes, setLocalNotes] = useState(initialNotes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const updateNotesMutation = useUpdateExerciseNotes(workoutId);

  useEffect(() => {
    if (initialNotes !== undefined) {
      setLocalNotes(initialNotes || '');
    }
  }, [initialNotes]);

  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setLocalNotes(initialNotes || '');
    setTimeout(autoResize, 0);
  }, [initialNotes, autoResize]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setLocalNotes(initialNotes || '');
  }, [initialNotes]);

  const handleSave = useCallback(async () => {
    if (localNotes === initialNotes) {
      setIsOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateNotesMutation.mutateAsync({
        workoutExerciseId,
        notes: localNotes,
      });
      setLastSaved(new Date().toISOString());
      setIsOpen(false);
    } catch (err) {
      console.error('Error saving notes:', err);
      setLocalNotes(initialNotes || '');
    } finally {
      setIsSaving(false);
    }
  }, [localNotes, initialNotes, workoutExerciseId, updateNotesMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        handleClose();
      }
    },
    [handleSave, handleClose],
  );

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg border border-[--border-default] bg-[--bg-surface] text-[--text-secondary] hover:bg-[--bg-surface-2] transition-colors"
        aria-label={`Añadir notas a ${exerciseName}`}
        aria-expanded={isOpen}
      >
        <StickyNote className="w-4 h-4" />
        <span>Notas</span>
        {localNotes && (
          <span className="w-2 h-2 rounded-full bg-[--color-primary]" aria-hidden="true" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full left-0 right-0 mt-2 p-3 rounded-lg border border-[--border-default] bg-[--bg-surface] shadow-lg"
            role="dialog"
            aria-label={`Editar notas de ${exerciseName}`}
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[--text-secondary]">
                Notas para {exerciseName}
              </span>
              <button
                onClick={handleClose}
                className="p-1 rounded hover:bg-[--bg-elevated]"
                aria-label="Cerrar notas"
              >
                <X className="w-3 h-3 text-[--text-muted]" />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={localNotes}
              onChange={(e) => {
                setLocalNotes(e.target.value);
                setTimeout(autoResize, 0);
              }}
              onFocus={autoResize}
              placeholder="Añade notas sobre este ejercicio (tempo, descanso, sensaciones...)"
              className="w-full min-h-[60px] max-h-[120px] px-3 py-2 rounded-lg text-sm bg-[--bg-surface-2] border border-[--border-default] text-[--text-primary] outline-none resize-none focus:ring-2 focus:ring-[--color-primary]"
              aria-label="Notas del ejercicio"
            />

            <div className="flex items-center justify-between mt-2.5">
              <span className="text-[0.625rem] text-[--text-muted]">
                Ctrl+Enter para guardar
                {lastSaved && ' · Guardado'}
              </span>
              <button
                onClick={handleSave}
                disabled={isSaving || localNotes === initialNotes}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm bg-[--color-primary] text-[--color-primary-fg] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {isSaving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                <span>Guardar</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isOpen && <div className="fixed inset-0 z-40" aria-hidden="true" onClick={handleClose} />}
    </div>
  );
}
