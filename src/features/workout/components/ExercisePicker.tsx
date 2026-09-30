import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { m, AnimatePresence } from 'framer-motion';
import { ExerciseSelector } from '@shared/components/ExerciseSelector';
import type { ExerciseNote } from '@shared/lib/types';
import { BookOpen, Plus, Stickynote, Trash2 } from '@shared/components/icons';
import { ConfirmDialog } from '@shared/components/ui';

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
}: ExercisePickerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

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
            className="flex min-h-11 flex-1 items-center gap-2 rounded-card border border-line bg-surface-2 px-3 text-left transition-colors active:bg-hover"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
              {exerciseName}
            </span>
            <span className="label-caps flex-shrink-0 text-fg-muted">{t('workout.change')}</span>
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
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent px-1 text-2xs font-bold text-accent-fg">
                {notes.length}
              </span>
            )}
          </button>

          {canDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label={t('common.delete')}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-card border border-line text-error"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        /* Sin panel alrededor. Aquí se apilaban tres materiales: el
           `glass-2` de fuera, el `bg-surface-2` del input y el `glass-1` del
           botón de biblioteca —cristal dentro de cristal— y encima el
           `shadow-card` se sumaba al `box-shadow` que `glass-2` ya trae, o sea
           dos sombras en la misma caja. El buscador ya es una superficie con
           fondo y borde: ponerle un marco alrededor solo añade una caja que
           no aporta nada. Y la biblioteca, que es la salida secundaria, baja
           a texto y deja de competir con el campo por el mismo ancho. */
        <div>
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
            className="flex min-h-11 w-full items-center gap-1.5 px-1 pt-1 text-left text-xs text-fg-subtle transition-colors active:text-fg-muted"
          >
            <BookOpen className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            {t('library.open')}
          </button>

          {activeExerciseId && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="flex min-h-11 w-full items-center justify-center text-xs text-fg-subtle"
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
            {/* El panel de notas era `glass-2` y dentro llevaba un `glass-1` en el
                campo, más un `bg-surface-2` en cada nota: cristal dentro de
                cristal, el mismo anidamiento que se quitó del buscador. Ahora el
                panel no es una caja —el contador de notas y el campo ya la
                delimitan— y solo el campo lleva superficie, porque es lo único
                que se toca. El botón de guardar baja a secundario: estaba en
                acento y eso lo convertía en un segundo primario en pantalla. */}
            <div className="mt-3">
              {notes.length === 0 ? (
                <div className="mb-2 text-xs text-fg-subtle">{t('workout.no_notes')}</div>
              ) : (
                <div className="mb-3 max-h-24 divide-y divide-line overflow-y-auto">
                  {notes.map((note) => (
                    <div key={note.id} className="flex items-start justify-between gap-2 py-2">
                      <div className="text-xs text-fg">{note.note}</div>
                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        aria-label={t('common.delete')}
                        className="tap-44 -mr-2 -mt-2 flex-shrink-0 text-xs text-error"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                {/* El campo es la única superficie del panel: es lo único que se
                    toca. Borde `line-interactive` por el 3:1 de WCAG 1.4.11, y
                    píldora porque es un control. */}
                <input
                  type="text"
                  placeholder={t('workout.new_note')}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="min-w-0 flex-1 rounded-pill border border-line-interactive bg-surface-2 px-3 py-2 text-xs text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-accent"
                />
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={!noteText.trim()}
                  aria-label={t('common.save')}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-pill bg-surface-2 text-fg-muted transition-colors active:bg-hover disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Antes aquí iban los hijos —el contexto de la última sesión y la
          recomendación del motor— y quedaban entre el selector y el listado de
          series. En el emulador se veía: al elegir ejercicio había que pasar
          por dos tarjetas para llegar al peso. Lo que haces va encima de lo que
          consultas, así que el contexto se renderiza en `WorkoutPage`, debajo
          del registro, y este componente ya no tiene hijos. */}

      <ConfirmDialog
        open={confirmDelete}
        title={t('workout.delete_exercise_title', { name: exerciseName })}
        description={t('workout.delete_exercise_body')}
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          setConfirmDelete(false);
          onDeleteExercise();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
