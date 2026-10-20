import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { readSuggestionFromState } from '../utils/suggestionTarget';
import { Sparkles, X } from '@shared/components/icons';

/**
 * Recordatorio de la sugerencia que el usuario acaba de aceptar en `/coach`.
 *
 * Es un recordatorio y nada más: no rellena campos ni toca la rutina. La regla
 * de la feature es que el coach propone y el usuario aplica, así que lo máximo
 * que hace esto es tener el consejo a la vista mientras se edita.
 *
 * Se dibuja solo si venimos de «Aplicar» (la sugerencia viaja en el estado del
 * router), así que en el resto de visitas no ocupa nada.
 */
export function CoachSuggestionBanner() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const suggestion = readSuggestionFromState(location.state);

  if (!suggestion) return null;

  // Limpiar el estado evita que el aviso reaparezca al volver atrás.
  const dismiss = () => navigate(location.pathname, { replace: true, state: null });

  return (
    <div
      className="rounded-card border border-accent/40 bg-accent/10 p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-fg">{t('coach.banner_title')}</h2>
          <p className="mt-1 text-sm text-fg">{suggestion.action}</p>
          {suggestion.exercise_name && (
            <p className="mt-0.5 text-xs text-fg-subtle">{suggestion.exercise_name}</p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('coach.banner_dismiss')}
          className="-m-2 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-pill text-fg-subtle hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
