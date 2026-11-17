import type { ReactNode } from 'react';

/**
 * Fila de ajuste: etiqueta + descripción opcional a la izquierda, control a la
 * derecha.
 *
 * Vivía dentro de SettingsPage. Se movió aquí sin tocar el marcado para que la
 * sección de ajustes del entrenador pudiera vivir en la feature `coach` sin que
 * `auth` tuviera que importar de `coach` (era una dependencia circular).
 */
export function SettingRow({
  label,
  desc,
  control,
  icon,
  divider = true,
  stacked = false,
}: {
  label: string;
  desc?: string;
  control: ReactNode;
  /**
   * Icono opcional, en el mismo círculo que usa `NavRow`. Solo hace falta
   * cuando la fila convive dentro de una tarjeta con filas que sí lo llevan:
   * sin él, el texto de unas arranca pegado al borde y el de otras después
   * del círculo, y la tarjeta se lee como dos listas pegadas.
   */
  icon?: ReactNode;
  divider?: boolean;
  /** Stack label/desc above control on mobile (flex-col sm:flex-row) */
  stacked?: boolean;
}) {
  return (
    <div
      className={`flex gap-3 px-4 py-3.5 ${
        divider ? 'hairline-separator' : ''
      } ${stacked ? 'flex-col items-start sm:flex-row sm:items-center sm:justify-between' : 'flex items-center justify-between'}`}
    >
      <div className={`flex items-center gap-3 min-w-0 ${stacked ? 'w-full' : ''}`}>
        {icon && (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <div className="text-base text-fg">{label}</div>
          {desc && <div className="text-xs mt-0.5 text-fg-subtle">{desc}</div>}
        </div>
      </div>
      <div className={stacked ? 'w-full sm:w-auto' : 'flex-shrink-0'}>{control}</div>
    </div>
  );
}
