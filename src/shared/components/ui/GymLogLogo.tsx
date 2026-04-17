// Usage examples:
// <GymLogLogo />                     → stacked, default size
// <GymLogLogo variant="icon" size="sm" />
// <GymLogLogo variant="horizontal" />

import React from 'react';

/** v2.6.5 - Cache Bashing Final */

export interface GymLogLogoProps {
  /**
   * Pixel sizes for icon mode: xs=24, sm=32, md=48, lg=64, xl=96.
   * In stacked/horizontal, this acts as a scale factor.
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /**
   * 'icon': Only the lime square.
   * 'stacked': Lime square with text inside (app icon style).
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

const GymLogLogo: React.FC<GymLogLogoProps> = ({
  size = 'md',
  variant = 'stacked',
  className,
  style,
}) => {
  const pixelSize = SIZES[size] || SIZES.md;
  const scale = pixelSize / SIZES.md;

  // Font Import
  const fontStyle = `
    @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@800&display=swap');
    .gymlog-text {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 800;
      text-transform: none;
      font-style: normal;
    }
  `;

  const containerBaseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c8ff00',
    borderRadius: '24%',
    overflow: 'hidden',
    userSelect: 'none',
    boxSizing: 'border-box',
    boxShadow: '0 4px 12px rgba(200,255,0,0.25)',
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
    const finalSize = (BASE_SIZE - 20) * scale; // Reduced base size to fix "too large" issue
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
        <style>{fontStyle}</style>
        <div style={{ marginBottom: finalSize * 0.04 }}>
          <DumbbellIcon size={finalSize * 0.6} />
        </div>
        <span
          className="gymlog-text"
          style={{
            color: '#000',
            fontSize: `${finalSize * 0.2}px`,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          GymLog
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
        <style>{fontStyle}</style>
        <div
          style={{
            ...containerBaseStyle,
            width: pixelSize,
            height: pixelSize,
            borderRadius: '22%',
          }}
        >
          <DumbbellIcon size={pixelSize * 0.72} />
        </div>
        <span
          className="gymlog-text"
          style={{
            color: '#ffffff', // White for premium contrast on dark backgrounds
            fontSize: `${pixelSize * 0.65}px`,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          Gym<span style={{ color: '#c8ff00' }}>Log</span>
        </span>
      </div>
    );
  }

  return null;
};

export { GymLogLogo };
export default GymLogLogo;
