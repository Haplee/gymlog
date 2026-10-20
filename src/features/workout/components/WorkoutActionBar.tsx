import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { m, AnimatePresence } from 'framer-motion';
import { Check, Star, Trash2, X } from '@shared/components/icons';
import { impact, ImpactStyle } from '@shared/lib/haptics';

interface WorkoutActionBarProps {
  /** Mensaje de resultado del guardado. */
  message: string;
  /**
   * Tono del mensaje, explícito.
   *
   * Antes se deducía del texto —«¿empieza por ✓?»— y por eso el aviso de récord
   * personal salía en rojo: `handleSave` sobreescribe el «✓ Entrenamiento
   * guardado» con «Nuevo PR: …», que no lleva el símbolo. Celebrar un PR con el
   * color de error es exactamente lo contrario de lo que se quería decir, y con
   * el tono deducido del texto el fallo vuelve en cuanto alguien cambie una
   * cadena o traduzca la app.
   */
  messageTone?: 'success' | 'error';
  saving: boolean;
  saveSuccess: boolean;
  /** El botón de borrar todo solo aparece con más de una serie. */
  canRemoveAll: boolean;
  hasRating: boolean;
  hasNotes: boolean;
  onAddSet: () => void;
  onRemoveAll: () => void;
  onOpenRating: () => void;
  onSave: () => void;
}

/**
 * Barra fija de acciones de la sesión: añadir serie, borrar todas, valorar y
 * guardar.
 *
 * La confirmación de «borrar todas» vive aquí porque solo la usa este botón.
 * Extraído de `WorkoutPage` para bajar del límite de 800 líneas de CLAUDE.md.
 */
export function WorkoutActionBar({
  message,
  messageTone = 'error',
  saving,
  saveSuccess,
  canRemoveAll,
  hasRating,
  hasNotes,
  onAddSet,
  onRemoveAll,
  onOpenRating,
  onSave,
}: WorkoutActionBarProps) {
  const { t } = useTranslation();
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  return (
    <div className="-mx-4 mt-3 px-4 pt-3 pb-3 bg-canvas border-t border-line">
      {message && (
        <div
          className="mb-2 text-center text-sm"
          style={{ color: messageTone === 'success' ? 'var(--success)' : 'var(--error)' }}
        >
          {message}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAddSet}
          className="flex-1 py-2 px-3 border border-dashed rounded-card text-sm font-medium cursor-pointer border-line-strong text-fg-muted transition-transform active:scale-[0.98]"
        >
          {t('workout.add_set')}
        </button>

        {canRemoveAll && (
          <AnimatePresence mode="wait">
            {confirmDeleteAll ? (
              <m.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex gap-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    void impact(ImpactStyle.Medium);
                    onRemoveAll();
                    setConfirmDeleteAll(false);
                  }}
                  aria-label={t('common.confirm')}
                  className="py-2 px-3 rounded-card text-sm font-medium bg-error text-white transition-transform active:scale-95"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAll(false)}
                  aria-label={t('common.cancel')}
                  className="py-2 px-3 rounded-card text-sm border border-line-strong text-fg-subtle transition-transform active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </m.div>
            ) : (
              <m.button
                key="delete-all"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setConfirmDeleteAll(true)}
                className="py-2 px-3 border border-dashed rounded-card text-sm font-medium cursor-pointer border-line-strong text-error transition-transform active:scale-95"
                title={t('workout.remove_all')}
              >
                <Trash2 className="w-4 h-4" />
              </m.button>
            )}
          </AnimatePresence>
        )}

        {/* Valorar la sesión no ocupa sitio en la pantalla: es este icono, que
            abre una hoja. La mayoría de entrenos se guardan sin nota, y quien
            quiera ponerla la pone antes de guardar (así sigue yendo en el mismo
            insert, sin actualizaciones posteriores). El punto de acento avisa de
            que ya hay algo escrito. */}
        <button
          type="button"
          onClick={onOpenRating}
          aria-label={t('workout.rate_session')}
          className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-card border border-line-strong text-fg-subtle transition-transform active:scale-95"
        >
          <Star
            className={`h-4 w-4 ${hasRating ? 'fill-accent text-accent' : ''}`}
            aria-hidden="true"
          />
          {!hasRating && hasNotes && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
          )}
        </button>

        <button
          type="button"
          // Envuelto a propósito: `onClick={onSave}` le pasaría el evento del
          // click como primer argumento, y quien guarda espera ahí el alcance
          // del guardado.
          onClick={() => onSave()}
          disabled={saving}
          className={`flex-1 py-3 px-4 rounded-pill text-base font-semibold cursor-pointer transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 border-none text-accent-fg ${
            saveSuccess ? 'bg-success' : 'bg-accent'
          }`}
        >
          {saving ? (
            t('workout.saving')
          ) : saveSuccess ? (
            <Check className="mx-auto h-5 w-5" />
          ) : (
            t('workout.save_workout')
          )}
        </button>
      </div>
    </div>
  );
}
