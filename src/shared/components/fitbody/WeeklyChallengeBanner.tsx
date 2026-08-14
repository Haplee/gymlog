import { memo } from 'react';
import { Zap, ChevronRight } from 'lucide-react';

interface WeeklyChallengeBannerProps {
  /** Etiqueta corta (píldora amarilla), p.ej. "Reto semanal" */
  label: string;
  /** Título del reto */
  title: string;
  /** Descripción opcional */
  subtitle?: string;
  /** Texto del CTA */
  ctaLabel: string;
  /** Imagen de fondo opcional (se atenúa bajo el texto) */
  imageUrl?: string;
  onCta?: () => void;
  className?: string;
}

/**
 * Banner destacado estilo FitBody: píldora de acento, título display y CTA
 * relleno. Componente nuevo del reskin (los textos llegan por props → i18n
 * lo resuelve quien lo usa).
 */
const WeeklyChallengeBannerComponent = ({
  label,
  title,
  subtitle,
  ctaLabel,
  imageUrl,
  onCta,
  className = '',
}: WeeklyChallengeBannerProps) => {
  return (
    <section className={`glass-2 relative overflow-hidden rounded-card ${className}`}>
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
      )}
      {/* Degradado para legibilidad del texto sobre la imagen */}
      {imageUrl && (
        <div className="absolute inset-0 bg-gradient-to-r from-canvas/90 via-canvas/60 to-transparent" />
      )}
      <div className="relative flex flex-col gap-3 p-5">
        <span className="inline-flex items-center gap-1.5 self-start rounded-pill bg-accent px-3 py-1 label-caps text-accent-fg">
          <Zap className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </span>
        <div>
          <h3 className="font-display text-xl font-bold leading-tight text-fg">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onCta}
          className="inline-flex h-11 items-center justify-center gap-1.5 self-start rounded-pill bg-accent px-5 font-semibold text-accent-fg shadow-btn-accent transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          {ctaLabel}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};

export const WeeklyChallengeBanner = memo(WeeklyChallengeBannerComponent);
