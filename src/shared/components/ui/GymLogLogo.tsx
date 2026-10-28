// Usage examples:
// <GymLogLogo />                     → stacked, default size
// <GymLogLogo variant="icon" size="sm" />
// <GymLogLogo variant="horizontal" />

import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface GymLogLogoProps {
  /**
   * Pixel sizes for icon mode: xs=24, sm=32, md=48, lg=64, xl=96.
   * In stacked/horizontal, this acts as a scale factor.
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /**
   * 'icon': Only the accent square.
   * 'stacked': Accent square with text inside (app icon style).
   * 'horizontal': Icon + text to the right.
   */
  variant?: 'icon' | 'stacked' | 'horizontal';
  className?: string;
  style?: React.CSSProperties;
  /**
   * Play entrance animation on first mount (app init). Defaults to true.
   */
  animated?: boolean;
  /**
   * Play click/tap animation. If true and onClick provided or interactive, enables tap animation.
   */
  interactive?: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  /**
   * aria-label for accessibility when interactive
   */
  'aria-label'?: string;
  role?: string;
  tabIndex?: number;
}

const SIZES = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

const BASE_SIZE = 120; // Base size for stacked variant

const textStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  letterSpacing: '-0.03em',
};

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
};

let globalEntrancePlayed = false;

const GymLogLogo: React.FC<GymLogLogoProps> = ({
  size = 'md',
  variant = 'stacked',
  className,
  style,
  animated = true,
  interactive = false,
  onClick,
  'aria-label': ariaLabel,
  role,
  tabIndex,
}) => {
  const pixelSize = SIZES[size] || SIZES.md;
  const scale = pixelSize / SIZES.md;
  const reducedMotion = usePrefersReducedMotion();

  const initialShouldAnimate = animated && !reducedMotion && !globalEntrancePlayed;
  const [entrancePlayed, setEntrancePlayed] = useState(!initialShouldAnimate);
  const [tapActive, setTapActive] = useState(false);
  const tapTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!initialShouldAnimate) {
      return;
    }
    globalEntrancePlayed = true;
    const t = window.setTimeout(() => setEntrancePlayed(true), 1100);
    return () => window.clearTimeout(t);
  }, [initialShouldAnimate]);

  const triggerTap = useCallback(() => {
    if (reducedMotion) return;
    setTapActive(false);
    // Force reflow/restart by toggling
    requestAnimationFrame(() => {
      setTapActive(true);
      if (tapTimeoutRef.current) {
        window.clearTimeout(tapTimeoutRef.current);
      }
      tapTimeoutRef.current = window.setTimeout(() => {
        setTapActive(false);
        tapTimeoutRef.current = null;
      }, 600);
    });
  }, [reducedMotion]);

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        window.clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (interactive || onClick) {
        triggerTap();
      }
      onClick?.(e);
    },
    [interactive, onClick, triggerTap],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if ((e.key === 'Enter' || e.key === ' ') && (interactive || onClick)) {
        e.preventDefault();
        triggerTap();
        if (onClick) {
          onClick(e as unknown as React.MouseEvent<HTMLElement>);
        }
      }
    },
    [interactive, onClick, triggerTap],
  );

  const containerBaseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--interactive-primary)',
    color: 'var(--interactive-primary-fg)',
    borderRadius: '18%',
    overflow: 'hidden',
    userSelect: 'none',
    boxSizing: 'border-box',
    position: 'relative',
    ...style,
  };

  const isInteractive = interactive || !!onClick;
  const interactiveProps: React.HTMLAttributes<HTMLElement> = isInteractive
    ? {
        role: role || 'button',
        tabIndex: tabIndex ?? 0,
        onClick: handleClick,
        onKeyDown: handleKeyDown,
        'aria-label': ariaLabel || 'GymLog',
        style: { cursor: 'pointer', ...containerBaseStyle },
      }
    : { style: containerBaseStyle };

  if (variant === 'icon') {
    return (
      <div
        className={`${className || ''} ${!entrancePlayed && animated && !reducedMotion ? 'gymlog-logo-entrance' : ''} ${tapActive && !reducedMotion ? 'gymlog-logo-tap-press' : ''}`}
        {...interactiveProps}
        style={{
          ...(isInteractive ? (interactiveProps.style as React.CSSProperties) : containerBaseStyle),
          width: pixelSize,
          height: pixelSize,
        }}
      >
        {!entrancePlayed && animated && !reducedMotion && (
          <div className="gymlog-logo-shine-layer" />
        )}
        {!entrancePlayed && animated && !reducedMotion && (
          <div className="gymlog-logo-glow-layer" />
        )}
        {tapActive && !reducedMotion && <div className="gymlog-logo-tap-shine" />}
        {tapActive && !reducedMotion && <div className="gymlog-logo-tap-glow" />}
        <DumbbellIcon size={pixelSize * 0.75} />
      </div>
    );
  }

  if (variant === 'stacked') {
    const finalSize = (BASE_SIZE - 20) * scale;
    return (
      <div
        className={`${className || ''} ${!entrancePlayed && animated && !reducedMotion ? 'gymlog-logo-entrance' : ''} ${tapActive && !reducedMotion ? 'gymlog-logo-tap-press' : ''}`}
        {...interactiveProps}
        style={{
          ...(isInteractive ? (interactiveProps.style as React.CSSProperties) : containerBaseStyle),
          width: finalSize,
          height: finalSize,
          flexDirection: 'column',
          padding: `${finalSize * 0.12}px`,
        }}
      >
        {!entrancePlayed && animated && !reducedMotion && (
          <div className="gymlog-logo-shine-layer" />
        )}
        {!entrancePlayed && animated && !reducedMotion && (
          <div className="gymlog-logo-glow-layer" />
        )}
        {tapActive && !reducedMotion && <div className="gymlog-logo-tap-shine" />}
        {tapActive && !reducedMotion && <div className="gymlog-logo-tap-glow" />}
        <div style={{ marginBottom: finalSize * 0.04 }}>
          <DumbbellIcon size={finalSize * 0.6} />
        </div>
        <span
          style={{
            ...textStyle,
            fontSize: `${finalSize * 0.18}px`,
            lineHeight: 1,
          }}
        >
          GYMLOG
        </span>
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div
        className={`${className || ''}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: `${pixelSize * 0.3}px`,
          position: 'relative',
          ...style,
        }}
        onClick={isInteractive ? handleClick : undefined}
        role={isInteractive ? role || 'button' : undefined}
        tabIndex={isInteractive ? (tabIndex ?? 0) : undefined}
        onKeyDown={isInteractive ? handleKeyDown : undefined}
        aria-label={isInteractive ? ariaLabel || 'GymLog' : undefined}
      >
        <div
          className={`${!entrancePlayed && animated && !reducedMotion ? 'gymlog-logo-entrance' : ''} ${tapActive && !reducedMotion ? 'gymlog-logo-tap-press' : ''}`}
          style={{
            ...containerBaseStyle,
            width: pixelSize,
            height: pixelSize,
            cursor: isInteractive ? 'pointer' : undefined,
          }}
        >
          {!entrancePlayed && animated && !reducedMotion && (
            <div className="gymlog-logo-shine-layer" />
          )}
          {!entrancePlayed && animated && !reducedMotion && (
            <div className="gymlog-logo-glow-layer" />
          )}
          {tapActive && !reducedMotion && <div className="gymlog-logo-tap-shine" />}
          {tapActive && !reducedMotion && <div className="gymlog-logo-tap-glow" />}
          <DumbbellIcon size={pixelSize * 0.72} />
        </div>
        <span
          style={{
            ...textStyle,
            color: 'var(--text-primary)',
            fontSize: `${pixelSize * 0.6}px`,
            lineHeight: 1,
          }}
        >
          GYM<span style={{ color: 'var(--interactive-primary)' }}>LOG</span>
        </span>
      </div>
    );
  }

  return null;
};

export { GymLogLogo };
export default GymLogLogo;

// Disco de peso visto de frente, con las barras de progresión dentro.
// Misma geometría que public/gimnasia.svg y los vectores nativos de Android.
const DumbbellIcon = ({ size: iconSize }: { size: number }) => (
  <svg
    width={iconSize}
    height={iconSize}
    viewBox="0 0 48 48"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="24" cy="24" r="17.5" fill="none" stroke="currentColor" strokeWidth="4.5" />
    <rect x="14.5" y="24" width="4" height="8" rx="2" />
    <rect x="22" y="19" width="4" height="13" rx="2" />
    <rect x="29.5" y="14" width="4" height="18" rx="2" />
  </svg>
);
