import { useTranslation } from 'react-i18next';
import { COMMON_PLATES_KG } from '@shared/lib/plates';
import { useSettingsStore } from '@shared/stores/settingsStore';

/**
 * Rejilla de discos del gimnasio. Escribe directo en `settingsStore`, que es la
 * única fuente de verdad: da igual si se edita desde Ajustes o desde la
 * calculadora, los dos sitios ven lo mismo.
 */
export function PlatesPicker({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const availablePlates = useSettingsStore((s) => s.availablePlatesKg);
  const setAvailablePlates = useSettingsStore((s) => s.setAvailablePlatesKg);

  const alternarDisco = (peso: number) => {
    const activo = availablePlates.includes(peso);
    setAvailablePlates(
      activo ? availablePlates.filter((p) => p !== peso) : [...availablePlates, peso],
    );
  };

  return (
    <div
      className={`flex flex-wrap gap-1.5 ${className}`}
      role="group"
      aria-label={t('workout.plates_available')}
    >
      {COMMON_PLATES_KG.map((peso) => {
        const activo = availablePlates.includes(peso);
        return (
          <button
            key={peso}
            type="button"
            onClick={() => alternarDisco(peso)}
            aria-pressed={activo}
            className={`min-h-11 min-w-14 rounded-pill border px-3 font-mono text-sm font-semibold ${
              activo
                ? 'bg-accent border-accent text-accent-fg'
                : 'bg-surface-2 border-line-interactive text-fg-muted'
            }`}
          >
            {peso}
          </button>
        );
      })}
    </div>
  );
}
