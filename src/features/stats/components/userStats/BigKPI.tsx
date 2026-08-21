import { m } from 'framer-motion';

/**
 * KPI grande del resumen global.
 *
 * Sin color por métrica a propósito: cada una traía el suyo (azul para volumen,
 * ámbar para PRs, y la racha nada menos que en `--error`, el token de fallo,
 * pintada de rojo tanto a 0 días como a 10). Ninguno codificaba nada. El color
 * se reserva para lo que tiene estado; aquí la métrica la dicen el icono y el
 * rótulo.
 */
export function BigKPI({
  value,
  label,
  icon: Icon,
  delay = 0,
}: {
  value: string | number;
  label: string;
  icon: React.ElementType;
  delay?: number;
}) {
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      className="relative overflow-hidden rounded-card p-4 flex flex-col gap-2 bg-surface border border-line shadow-card"
    >
      <div className="relative w-8 h-8 rounded-md flex items-center justify-center bg-surface-2">
        <Icon className="w-4 h-4 text-fg-muted" />
      </div>
      <div className="relative font-mono font-bold text-2xl leading-none text-fg tabular-nums">
        {value}
      </div>
      <div className="relative text-xs text-fg-subtle">{label}</div>
    </m.div>
  );
}
