import { useState, type ReactNode } from 'react';
import { m, useMotionValue, useTransform } from 'framer-motion';
import { Trash2 } from 'lucide-react';

/**
 * Envuelve una fila para permitir deslizarla a la izquierda y borrar.
 * `dragDirectionLock` evita que el gesto horizontal robe el scroll vertical.
 * Mantiene cualquier botón interno (el drag tiene umbral).
 */
export function SwipeToDelete({
  children,
  onDelete,
  className = '',
}: {
  children: ReactNode;
  onDelete: () => void;
  className?: string;
}) {
  const x = useMotionValue(0);
  const [armed, setArmed] = useState(false);
  // El icono de papelera aparece según cuánto se ha deslizado.
  const iconOpacity = useTransform(x, [-96, -40, 0], [1, 0.6, 0]);

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      <div
        className={`absolute inset-y-0 right-0 flex items-center justify-end pr-5 transition-colors ${
          armed ? 'bg-error' : 'bg-error/70'
        }`}
        style={{ left: 0 }}
        aria-hidden="true"
      >
        <m.span style={{ opacity: iconOpacity }} className="text-white">
          <Trash2 className="w-5 h-5" />
        </m.span>
      </div>
      <m.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -96, right: 0 }}
        dragElastic={0.08}
        style={{ x }}
        onDrag={(_, info) => setArmed(info.offset.x < -72)}
        onDragEnd={(_, info) => {
          if (info.offset.x < -72) onDelete();
          setArmed(false);
        }}
        className="relative bg-base"
      >
        {children}
      </m.div>
    </div>
  );
}
