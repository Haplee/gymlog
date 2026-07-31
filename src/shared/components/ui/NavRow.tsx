import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * Fila de una lista que lleva a otra pantalla: icono en círculo de acento,
 * etiqueta con descripción opcional y chevron.
 *
 * Existe porque el mismo marcado estaba copiado en varias listas de Ajustes y
 * había divergido: unas filas llevaban icono y otras no, así que dentro de la
 * misma tarjeta el texto arrancaba a dos alturas distintas. Al ser un
 * componente, la sangría del texto es la misma en todas por construcción.
 *
 * Comparte padding (`px-4 py-3.5`) con `SettingRow` a propósito: los dos tipos
 * de fila conviven dentro de la misma tarjeta y tienen que leerse como una
 * lista, no como dos.
 */
export function NavRow({
  icon,
  label,
  desc,
  onClick,
  divider = false,
}: {
  icon: ReactNode;
  label: string;
  desc?: string;
  onClick: () => void;
  divider?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left active:bg-hover ${
        divider ? 'dotted-separator' : ''
      }`}
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-base text-fg">{label}</span>
          {desc && <span className="block text-xs mt-0.5 text-fg-subtle">{desc}</span>}
        </span>
      </span>
      <ChevronRight className="w-4 h-4 flex-shrink-0 text-fg-subtle" />
    </button>
  );
}
