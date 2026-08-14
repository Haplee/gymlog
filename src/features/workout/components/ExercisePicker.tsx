import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { m, AnimatePresence } from 'framer-motion';
import { ExerciseSelector } from '@shared/components/ExerciseSelector';
import type { ExerciseNote } from '@shared/lib/types';
import { BookOpen, Plus, Stickynote, Trash2 } from '@shared/components/icons';

interface ExercisePickerProps {
  userId: string;
  activeExerciseId: string | null;
  /** Nombre del ejercicio elegido; vacío mientras no hay ninguno. */
  exerciseName: string;
  /** True si el ejercicio lo creó el usuario y por tanto puede borrarlo. */
  canDelete: boolean;
  notes: ExerciseNote[];
  onSelect: (id: string) => void;
  onDeleteExercise: () => void;
  onSaveNote: (text: string) => void;
  onDeleteNote: (noteId: string) => void;
  /** Referencias que solo tienen sentido con ejercicio elegido (última sesión, autorregulación). */
  children?: ReactNode;
}

/**
 * Elegir el ejercicio y todo lo que cuelga de él.
 *
 * Con un ejercicio ya elegido esto se pliega a **una línea** con su nombre y un
 * botón de cambiar. Antes el buscador y el acceso a la biblioteca se quedaban
 * desplegados toda la sesión ocupando el primer tercio de la pantalla, justo
 * por encima de los campos de KG y REPS, que es donde va la vista.
 *
 * Las notas del ejercicio viven aquí y no entre los chips del bloque de series:
 * allí quedaban pegadas a la nota de la serie, dos botones idénticos con
 * significados distintos.
 */
export function ExercisePicker({
  userId,
  activeExerciseId,
  exerciseName,
  canDelete,
  notes,
  onSelect,
  onDeleteExercise,
  onSaveNote,
  onDeleteNote,
  children,
}: ExercisePickerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState('');

  const collapsed = !!activeExerciseId && !expanded;

  const handleSaveNote = () => {
    const text = noteText.trim();
    if (!text) return;
    setNoteText('');
    onSaveNote(text);
  };

  return (
    <div className="mb-4">
      {collapsed ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex min-h-11 flex-1 items-center gap-2 rounded-card border border-line bg-surface px-3 text-left transition-colors active:bg-hover"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
              {exerciseName}
            </span>
            <span className="label-caps flex-shrink-0 text-accent">{t('workout.change')}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            aria-expanded={showNotes}
            aria-label={`${t('workout.notes')} (${notes.length})`}
            className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-card border transition-colors ${
              notes.length > 0 ? 'border-accent text-accent' : 'border-line text-fg-subtle'
            }`}
          >
            <Stickynote className="h-4 w-4" />
            {notes.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent px-1 text-[0.625rem] font-bold text-accent-fg">
                {notes.length}
              </span>
            )}
          </button>

          {canDelete && (
            <button
              type="button"
              onClick={onDeleteExercise}
              aria-label={t('common.delete')}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-card border border-line text-error"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-card border border-line-strong bg-surface p-4 shadow-card">
          <ExerciseSelector
            userId={userId}
            onSelect={(id) => {
              onSelect(id);
              setExpanded(false);
            }}
            activeExerciseId={activeExerciseId}
          />

          <button
            type="button"
            onClick={() => navigate('/exercises')}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-card border border-line bg-surface-2 px-2 py-2 text-xs text-fg-muted transition-colors active:bg-hover"
          >
            <BookOpen className="h-3.5 w-3.5" />
            {t('library.open')}
          </button>

          {activeExerciseId && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="mt-2 min-h-11 w-full text-xs text-fg-subtle"
            >
              {t('common.close')}
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {showNotes && activeExerciseId && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-card border border-line-strong bg-surface p-3">
              {notes.length === 0 ? (
                <div className="mb-2 text-xs text-fg-subtle">{t('workout.no_notes')}</div>
              ) : (
                <div className="mb-3 max-h-24 space-y-2 overflow-y-auto">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-start justify-between gap-2 rounded bg-surface-2 p-2"
                    >
                      <div className="text-xs text-fg">{note.note}</div>
                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        aria-label={t('common.delete')}
                        className="text-xs text-error"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t('workout.new_note')}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="flex-1 rounded-card border border-line bg-surface-2 p-2 text-xs text-fg outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={!noteText.trim()}
                  aria-label={t('common.save')}
                  className="flex h-11 w-11 items-center justify-center rounded-card bg-accent text-accent-fg disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {children}
    </div>
  );
}
