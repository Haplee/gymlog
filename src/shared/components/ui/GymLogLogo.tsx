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

const DumbbellIcon = ({ size: iconSize }: { size: number }) => (
  <svg
    width={iconSize}
    height={iconSize}
    viewBox="0 0 5120 5120"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g transform="translate(0,5120) scale(1,-1)">
      <path d="M343 4149 c-77 -38 -73 5 -73 -821 0 -709 1 -734 20 -765 36 -60 53 -63 325 -63 270 0 285 3 319 60 14 25 16 101 16 773 l0 744 -23 34 c-35 52 -65 58 -317 58 -208 1 -228 -1 -267 -20z" />
      <path d="M4250 4157 c-19 -7 -44 -27 -57 -46 l-23 -34 0 -744 c0 -672 2 -748 16 -773 34 -57 49 -60 319 -60 272 0 289 3 325 63 19 31 20 56 20 765 0 827 4 784 -74 822 -39 18 -60 20 -267 19 -146 0 -236 -4 -259 -12z" />
      <path d="M2141 3857 c-44 -22 -65 -62 -69 -131 l-4 -64 38 -6 c93 -16 190 -100 214 -184 22 -81 6 -177 -41 -244 -28 -39 -102 -86 -156 -100 -24 -6 -43 -15 -43 -20 0 -6 17 -27 38 -48 61 -62 165 -65 237 -8 51 40 55 65 55 340 0 349 -14 422 -90 460 -41 21 -143 24 -179 5z" />
      <path d="M2592 3746 c-22 -11 -39 -29 -52 -58 -18 -40 -20 -68 -20 -358 0 -280 2 -319 18 -350 26 -52 74 -80 139 -80 64 0 103 18 135 62 23 33 23 34 22 343 0 284 -2 314 -20 360 -13 33 -30 55 -51 68 -44 25 -129 31 -171 13z" />
      <path d="M3025 3672 c-73 -46 -70 -31 -73 -371 -3 -306 -3 -307 20 -341 60 -90 207 -93 272 -6 20 26 20 40 17 329 -3 327 -5 343 -59 382 -39 28 -137 32 -177 7z" />
      <path d="M3450 3638 c-74 -50 -75 -55 -78 -303 -4 -254 4 -318 46 -357 39 -37 65 -48 114 -48 55 0 107 26 135 69 22 33 23 40 23 295 0 243 -1 263 -20 294 -44 72 -152 96 -220 50z" />
      <path d="M1515 3536 c-16 -8 -43 -28 -60 -45 l-30 -32 -3 -427 c-2 -277 1 -440 7 -463 28 -96 147 -234 361 -418 155 -134 180 -159 214 -222 53 -95 56 -130 56 -571 l0 -408 610 0 610 0 0 383 c0 215 5 410 11 447 16 102 57 178 148 275 141 149 151 184 151 515 l0 247 -69 5 c-54 4 -82 13 -126 37 l-56 32 -46 -41 c-103 -90 -266 -92 -364 -3 l-40 36 -27 -25 c-45 -42 -93 -61 -168 -66 -61 -4 -80 -1 -125 20 -59 27 -103 66 -126 113 -9 16 -17 31 -18 33 -1 1 -29 -10 -61 -25 -125 -58 -275 -25 -349 76 -19 25 -37 61 -41 79 -12 62 -24 31 -24 -63 0 -86 2 -95 18 -95 11 0 54 -9 97 -20 240 -61 403 -216 465 -442 25 -93 24 -155 -5 -174 -32 -21 -67 2 -77 51 -39 211 -130 345 -280 415 -70 33 -204 70 -252 70 -18 0 -42 7 -54 16 -21 14 -22 22 -22 145 0 124 -1 129 -21 129 -39 0 -59 19 -59 55 0 24 6 38 19 45 11 5 86 10 172 10 144 0 155 1 194 25 105 61 101 214 -6 274 -35 20 -52 21 -315 21 -211 -1 -286 -4 -309 -14z" />
      <path d="M1060 3331 l0 -120 118 -3 c64 -2 120 -2 125 0 4 2 7 57 7 123 l0 119 -125 0 -125 0 0 -119z" />
      <path d="M3800 3330 l0 -120 130 0 130 0 0 120 0 120 -130 0 -130 0 0 -120z" />
    </g>
  </svg>
);
