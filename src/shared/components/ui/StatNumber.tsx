import { memo } from 'react';
import type { ReactNode } from 'react';

type StatSize = 'huge' | 'headline' | 'data';

interface StatNumberProps {
  value: ReactNode;
  /** Sufijo pequeño atenuado (KG, %, d, k…) */
  suffix?: string;
  /** Sub-label en caps bajo el número */
  label?: string;
  size?: StatSize;
  className?: string;
}

const sizeClass: Record<StatSize, string> = {
  huge: 'text-display-huge',
  headline: 'text-headline',
  data: 'text-data',
};

/**
 * Número protagonista estilo Stitch: Space Grotesk, tabular,
 * con sufijo atenuado y label caps opcional.
 */
const StatNumberComponent = ({
  value,
  suffix,
  label,
  size = 'headline',
  className = '',
}: StatNumberProps) => (
  <div className={className}>
    <div className={`font-display tabular text-fg ${sizeClass[size]}`}>
      {value}
      {suffix && (
        <span className="text-data font-display text-fg-subtle ml-1 align-baseline">{suffix}</span>
      )}
    </div>
    {label && <div className="label-caps text-fg-subtle mt-1.5">{label}</div>}
  </div>
);

export const StatNumber = memo(StatNumberComponent);
