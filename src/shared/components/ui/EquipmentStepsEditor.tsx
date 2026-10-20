import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type EquipmentFamilyKey } from '@shared/stores/settingsStore';

/** Quita el cero sobrante: 2,5 se muestra «2,5» y 10 como «10». */
function formatStep(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : String(kg).replace('.', ',');
}

/**
 * Editor de los escalones reales de una familia de material.
 *
 * Sustituye a un único input de «salto mínimo»: el gimnasio no tiene un salto,
 * tiene una escalera. Las mancuernas de la sala que motivó esto van de 0,5 y
 * 2,5 hasta 30 y de 2,5 hasta 40, y las máquinas de 2,5 hasta 40 y de 5 o 10
 * hasta 100. Con un solo número, el motor avanza a un múltiplo que puede no
 * existir en la estantería; con la tabla, avanza al siguiente peldaño de verdad.
 *
 * Las fichas se ordenan y se deduplican en el store, así que aquí se escribe sin
 * miedo: lo que se pinte siempre es la tabla ya saneada.
 */
export function EquipmentStepsEditor({
  family,
  className = '',
}: {
  family: EquipmentFamilyKey;
  className?: string;
}) {
  const { t } = useTranslation();
  const steps = useSettingsStore((s) =>
    family === 'dumbbell' ? s.dumbbellStepsKg : s.machineStepsKg,
  );
  const addStep = useSettingsStore((s) => s.addEquipmentStep);
  const removeStep = useSettingsStore((s) => s.removeEquipmentStep);

  const [draft, setDraft] = useState('');
  const label = family === 'dumbbell' ? t('workout.dumbbell_steps') : t('workout.machine_steps');

  const añadir = () => {
    const peso = Number(draft.replace(',', '.'));
    if (!Number.isFinite(peso) || peso <= 0) return;
    addStep(family, peso);
    setDraft('');
  };

  return (
    <div className={className}>
      {steps.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5" role="list" aria-label={label}>
          {steps.map((peso) => (
            <button
              key={peso}
              type="button"
              role="listitem"
              onClick={() => removeStep(family, peso)}
              aria-label={t('workout.remove_step', { weight: formatStep(peso) })}
              className="group inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-line-interactive bg-surface-2 px-3 font-mono text-sm font-semibold text-fg-muted"
            >
              {formatStep(peso)} kg
              <span aria-hidden className="text-fg-subtle group-hover:text-fg">
                ×
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-2 text-sm text-fg-subtle">{t('workout.equipment_steps_empty')}</div>
      )}
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">{label}</span>
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            placeholder={t('workout.equipment_step_placeholder')}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                añadir();
              }
            }}
            className="min-h-11 w-full rounded-sm border border-line bg-surface-2 px-3 font-mono text-base text-fg tabular outline-none focus:border-accent"
          />
        </label>
        <button
          type="button"
          onClick={añadir}
          className="min-h-11 shrink-0 rounded-sm border border-line-interactive bg-surface-2 px-4 text-sm font-semibold text-fg"
        >
          {t('workout.add_step')}
        </button>
      </div>
    </div>
  );
}
