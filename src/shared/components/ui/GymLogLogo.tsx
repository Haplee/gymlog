// Usage examples:
// <GymLogLogo />                     → stacked, default size
// <GymLogLogo variant="icon" size="sm" />
// <GymLogLogo variant="horizontal" />

import React from 'react';

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

const GymLogLogo: React.FC<GymLogLogoProps> = ({
  size = 'md',
  variant = 'stacked',
  className,
  style,
}) => {
  const pixelSize = SIZES[size] || SIZES.md;
  const scale = pixelSize / SIZES.md;

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
    ...style,
  };

  if (variant === 'icon') {
    return (
      <div
        className={className}
        style={{
          ...containerBaseStyle,
          width: pixelSize,
          height: pixelSize,
        }}
      >
        <DumbbellIcon size={pixelSize * 0.75} />
      </div>
    );
  }

  if (variant === 'stacked') {
    const finalSize = (BASE_SIZE - 20) * scale;
    return (
      <div
        className={className}
        style={{
          ...containerBaseStyle,
          width: finalSize,
          height: finalSize,
          flexDirection: 'column',
          padding: `${finalSize * 0.12}px`,
        }}
      >
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
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: `${pixelSize * 0.3}px`,
          ...style,
        }}
      >
        <div
          style={{
            ...containerBaseStyle,
            width: pixelSize,
            height: pixelSize,
          }}
        >
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
