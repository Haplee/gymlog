import { memo } from 'react';
import type { ReactNode } from 'react';
import { m } from 'framer-motion';
import { ArrowLeft } from '@shared/components/icons';

interface PageHeaderProps {
  /** Rótulo de la pantalla. Se pinta como el único `<h1>` de la página. */
  title: string;
  /** Bajada opcional: qué es esta pantalla, en una línea. */
  subtitle?: string;
  /** Si se pasa, aparece el botón de volver a su izquierda. */
  onBack?: () => void;
  /** Etiqueta accesible del botón de volver (obligatoria si hay `onBack`). */
  backLabel?: string;
  /** Acción a la derecha del título (botón de texto, icono…). */
  action?: ReactNode;
  className?: string;
}

/**
 * Cabecera de pantalla secundaria: volver + título + bajada.
 *
 * Existe porque varias pantallas se quedaron sin rótulo dando por hecho que lo
 * ponía la cabecera del `Layout` —tres de ellas lo dicen en un comentario—, y
 * esa cabecera solo pinta el wordmark GYMLOG. El resultado eran pantallas con
 * una flecha de volver flotando sola y una bajada huérfana sin título encima.
 *
 * Ojo con la jerarquía: los rótulos de sección (`SectionHeader`, `SectionLabel`)
 * van en acento por el idiom de FitBody, así que el título de pantalla va en
 * `text-fg`. Si fuera también de acento, el h1 competiría con cada h2 de la
 * pantalla y el acento dejaría de señalar nada.
 */
const PageHeaderComponent = ({
  title,
  subtitle,
  onBack,
  backLabel,
  action,
  className = '',
}: PageHeaderProps) => (
  <m.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    className={`flex items-center gap-3 mb-4 ${className}`}
  >
    {onBack && (
      <button
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        className="h-11 w-11 flex-shrink-0 rounded-full flex items-center justify-center bg-surface border border-line active:bg-surface-2 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 text-fg-muted" />
      </button>
    )}
    <div className="min-w-0 flex-1">
      <h1 className="font-display text-xl font-bold leading-tight text-fg truncate">{title}</h1>
      {subtitle && <p className="text-xs text-fg-subtle mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </m.div>
);

export const PageHeader = memo(PageHeaderComponent);
