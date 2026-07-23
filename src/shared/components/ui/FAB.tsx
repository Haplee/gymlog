import { memo } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface FABProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icono lucide */
  icon: ReactNode;
  /** Label caps; si se omite, FAB cuadrado solo-icono (requiere aria-label) */
  label?: string;
}

/**
 * FAB extendido estilo Stitch: angular (rounded-sm), acento, sombra fab.
 * Posicionado fijo sobre la bottom nav respetando safe-area.
 */
const FABComponent = ({ icon, label, className = '', ...props }: FABProps) => (
  <button
    type="button"
    className={`fixed right-4 z-(--z-floating) inline-flex items-center justify-center gap-2 min-h-12 rounded-sm bg-accent text-accent-fg shadow-fab cursor-pointer active:scale-95 transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
      label ? 'px-4' : 'w-12'
    } ${className}`}
    style={{
      bottom:
        'calc(var(--bottom-nav-height) + var(--inset-bottom, env(safe-area-inset-bottom)) + 16px)',
    }}
    {...props}
  >
    {icon}
    {label && <span className="label-caps">{label}</span>}
  </button>
);

export const FAB = memo(FABComponent);
