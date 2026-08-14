import { useTranslation } from 'react-i18next';
import type { DeloadSuggestion } from '@features/stats/utils/autoregulation';
import { Coffee } from '@shared/components/icons';

/**
 * Tarjeta de descarga del motor determinista (sin IA ni red).
 *
 * Recomienda una semana de descarga cuando el volumen lleva ≥3 semanas al alza
 * y el RIR cae; si no hay señales lo dice con el mismo cartel, para que el
 * usuario entienda qué está vigilando el entrenador.
 */
export function DeloadCard({ suggestion }: { suggestion: DeloadSuggestion }) {
  const { t } = useTranslation();
  const recommended = suggestion.recommended;

  return (
    <article
      className={`rounded-card border p-4 ${
        recommended ? 'border-warning/30 bg-warning/10' : 'border-line bg-surface shadow-card'
      }`}
    >
      <header className="flex items-center gap-2">
        <Coffee
          className={`h-4 w-4 flex-shrink-0 ${recommended ? 'text-warning' : 'text-fg-muted'}`}
          aria-hidden="true"
        />
        <h3 className="text-sm font-semibold text-fg">{t('coach.kind.deload')}</h3>
      </header>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{t(suggestion.reasonKey)}</p>
    </article>
  );
}
