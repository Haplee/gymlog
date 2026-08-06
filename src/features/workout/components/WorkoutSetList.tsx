import { memo, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { Check, StickyNote, X } from 'lucide-react';
import { impact, ImpactStyle } from '@shared/lib/haptics';
import { formatWeightInput } from '@shared/lib/weight';

type SetType = 'normal' | 'dropset' | 'rest_pause' | 'amrap';

interface SetData {
  id?: string;
  reps: string;
  weight: string;
  isWarmup?: boolean;
  notes?: string;
  rpe?: string;
  setType?: SetType;
  completed?: boolean;
}

const RPE_OPTIONS = ['6', '7', '8', '9', '10'] as const;
const SET_TYPES: SetType[] = ['normal', 'dropset', 'rest_pause', 'amrap'];
const SET_TYPE_BADGE: Record<Exclude<SetType, 'normal'>, string> = {
  dropset: 'DROP',
  rest_pause: 'R-P',
  amrap: 'AMRAP',
};

/** Peso en la unidad del usuario, sin el «.0» sobrante. */
const displayWeight = (weight: string, convert: (kg: number) => number) => {
  const n = Number(weight);
  if (!weight || Number.isNaN(n)) return '';
  return formatWeightInput(convert(n));
};

interface LoggedSetRowProps {
  set: SetData;
  index: number;
  isPR: boolean;
  onSelect: (index: number) => void;
  weightUnit: string;
  convert: (kg: number) => number;
  label: string;
  warmupLabel: string;
}

/**
 * Serie ya anotada: fila de una línea, de solo lectura, que se pulsa para
 * volver a editarla en el campo grande. Memoizada porque editar la serie activa
 * no cambia ninguna de estas.
 */
const LoggedSetRow = memo(function LoggedSetRow({
  set: s,
  index: i,
  isPR,
  onSelect,
  weightUnit,
  convert,
  label,
  warmupLabel,
}: LoggedSetRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(i)}
      aria-label={`${label} ${i + 1}`}
      className={`w-full hairline-separator flex min-h-11 items-center gap-3 py-3 text-left transition-opacity active:opacity-60 ${
        isPR ? 'border-l-2 border-l-accent pl-3' : ''
      }`}
    >
      <span className={`flex items-center gap-1.5 tabular text-base ${isPR ? 'text-accent' : 'text-fg-subtle'}`}>
        {i + 1}
        {s.completed && <Check className="h-3.5 w-3.5 text-success" strokeWidth={3} />}
      </span>

      {s.isWarmup && (
        <span className="label-caps rounded-sm bg-surface-2 px-2 py-1 text-fg-muted">
          {warmupLabel}
        </span>
      )}
      {isPR && <span className="label-caps rounded-sm bg-accent px-2 py-1 text-accent-fg">PR</span>}
      {s.setType && s.setType !== 'normal' && (
        <span className="label-caps rounded-sm bg-accent/15 px-2 py-1 text-accent">
          {SET_TYPE_BADGE[s.setType]}
        </span>
      )}

      <span
        className={`ml-auto tabular text-base font-medium ${isPR ? 'text-accent' : 'text-fg-muted'}`}
      >
        {displayWeight(s.weight, convert) || '0'} {weightUnit} × {s.reps || '0'}
      </span>
    </button>
  );
});

interface WorkoutSetListProps {
  sets: SetData[];
  /** Encabezado del bloque; la maqueta lo pone junto a «SERIE n». */
  exerciseName?: string;
  showWarmupSets: boolean;
  setErrors: Record<number, string>;
  setSetErrors: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  updateSet: (index: number, data: Partial<SetData>) => void;
  removeSet: (index: number) => void;
  /** Cierra la serie actual y abre la siguiente (el botón de confirmar). */
  onCommitSet?: () => void;
  checkIsNewPR: (weight: string, reps: string) => boolean;
  weightUnit: string;
  convert: (kg: number) => number;
  convertToKg: (local: number) => number;
}

/**
 * Bloque de series de la referencia visual (`public/screens/workout.png`).
 *
 * Un solo editor grande —KG y REPS a tamaño de titular, con subrayado y botón
 * de confirmar en el acento— y debajo las series ya anotadas como filas de una
 * línea. No se pierde nada respecto a la rejilla anterior: cualquier fila se
 * pulsa para volver a editarla arriba, y RPE, tipo de serie, nota y borrado
 * siguen ahí, plegados tras el botón de nota.
 *
 * Memoizado: cada tecla en KG/REPS llama a `updateSet`, el padre re-renderiza y
 * la fila activa es la única que debe cambiar. Con `memo`, los re-renders del
 * padre por causas ajenas (query de consejo, timer, foco) no reconstruyen el
 * editor ni el bucle de filas; cada `LoggedSetRow` ya está memoizada de suyo.
 */
export const WorkoutSetList = memo(function WorkoutSetList({
  sets,
  exerciseName,
  showWarmupSets,
  setErrors,
  setSetErrors,
  updateSet,
  removeSet,
  onCommitSet,
  checkIsNewPR,
  weightUnit,
  convert,
  convertToKg,
}: WorkoutSetListProps) {
  const { t } = useTranslation();
  // `null` significa «la última serie», que es lo que hay que abrir al entrar y
  // también después de confirmar una: guardar el índice fijo dejaría el editor
  // anclado a una serie vieja en cuanto se añade otra.
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [localWeight, setLocalWeight] = useState<string | null>(null);
  // Tras confirmar una serie, la siguiente hereda el peso/reps y el foco vuelve
  // al campo de peso para ajustar sin un toque extra (patrón de Hevy/Strong).
  const weightRef = useRef<HTMLInputElement>(null);

  const onSelect = useCallback((index: number) => {
    setPickedIndex(index);
    setLocalWeight(null);
    setShowDetails(false);
  }, []);

  const onClearError = useCallback(
    (index: number) =>
      setSetErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      }),
    [setSetErrors],
  );

  if (sets.length === 0) return null;

  const activeIndex =
    pickedIndex !== null && pickedIndex < sets.length ? pickedIndex : sets.length - 1;
  const active = sets[activeIndex];
  const error = setErrors[activeIndex];
  const hasDetails = !!(
    active.notes ||
    active.rpe ||
    (active.setType && active.setType !== 'normal')
  );

  const shownWeight = localWeight ?? displayWeight(active.weight, convert);

  // Recordatorio efímero del valor de la serie anterior: solo aparece cuando la
  // fila activa está vacía (recién abierta o tras borrar lo heredado).
  const prev = activeIndex > 0 ? sets[activeIndex - 1] : null;
  const previousHint =
    prev && prev.reps && prev.weight && !active.reps && !active.weight
      ? `${t('workout.previous_set')}: ${displayWeight(prev.weight, convert)} ${weightUnit} × ${
          prev.reps
        }`
      : null;

  const inputClass = `w-full bg-transparent border-b pb-1 text-display font-display tabular text-fg outline-none transition-colors focus:border-accent ${
    error ? 'border-error' : 'border-line'
  }`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        {exerciseName && (
          <span className="text-2xl font-display font-bold tracking-tight text-fg truncate">
            {exerciseName}
          </span>
        )}
        <span className="label-caps flex-shrink-0 text-fg-subtle">
          {t('workout.set_n', { n: activeIndex + 1 })}
        </span>
      </div>

      {/* Editor grande: KG, REPS y confirmar. */}
      <div className="mt-4 flex items-end gap-4">
        <div className="flex-1 min-w-0">
          <label className="label-caps block text-fg-subtle" htmlFor="active-set-weight">
            {weightUnit}
          </label>
          <input
            id="active-set-weight"
            ref={weightRef}
            type="text"
            inputMode="decimal"
            aria-label={`${weightUnit} ${activeIndex + 1}`}
            pattern="[0-9]*[.,]?[0-9]*"
            placeholder="0"
            value={shownWeight}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d.,]/g, '');
              // Evitar múltiples separadores decimales
              const parts = raw.split(/[.,]/);
              const cleanLocal =
                parts[0] +
                (parts.length > 1 ? (raw.includes(',') ? ',' : '.') + parts.slice(1).join('') : '');

              setLocalWeight(cleanLocal);

              const cleanForParse = cleanLocal.replace(',', '.');
              if (cleanForParse === '' || cleanForParse === '.') {
                updateSet(activeIndex, { weight: '' });
              } else {
                const display = parseFloat(cleanForParse);
                if (Number.isNaN(display)) {
                  updateSet(activeIndex, { weight: '' });
                } else {
                  const kgValue = convertToKg(display);
                  updateSet(activeIndex, {
                    weight: Number.isFinite(kgValue) ? kgValue.toString() : '',
                  });
                }
              }
              if (error) onClearError(activeIndex);
            }}
            onBlur={() => setLocalWeight(null)}
            className={inputClass}
          />
        </div>

        <div className="flex-1 min-w-0">
          <label className="label-caps block text-fg-subtle" htmlFor="active-set-reps">
            {t('workout.reps')}
          </label>
          <input
            id="active-set-reps"
            type="text"
            inputMode="numeric"
            aria-label={`${t('workout.reps')} ${activeIndex + 1}`}
            pattern="[0-9]*"
            placeholder="0"
            value={active.reps}
            onChange={(e) => {
              updateSet(activeIndex, { reps: e.target.value.replace(/[^\d]/g, '') });
              if (error) onClearError(activeIndex);
            }}
            className={inputClass}
          />
        </div>

        {onCommitSet && (
          <button
            type="button"
            onClick={() => {
              void impact(ImpactStyle.Medium);
              // El ✓ significa «serie hecha»: se marca como completada y, si
              // aplica, arranca el descanso (lo decide onCommitSet).
              updateSet(activeIndex, { completed: true });
              setPickedIndex(null);
              setLocalWeight(null);
              onCommitSet();
              // La serie nueva se monta con el valor heredado; devolver el foco
              // al peso permite corregirlo sin salir del flujo.
              requestAnimationFrame(() => weightRef.current?.focus());
            }}
            aria-label={t('workout.complete_set')}
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md bg-accent text-accent-fg transition-transform active:scale-95"
          >
            <Check className="h-7 w-7" strokeWidth={3} />
          </button>
        )}
      </div>

      {error && <div className="mt-2 text-xs text-error">{error}</div>}
      {previousHint && <div className="mt-1.5 text-xs text-fg-muted">{previousHint}</div>}

      {/* Controles de la serie activa que la maqueta no dibuja pero existen:
          calentamiento, nota/RPE/tipo y borrar. */}
      <div className="mt-3 flex items-center gap-2">
        {showWarmupSets && (
          <button
            type="button"
            onClick={() => {
              void impact(ImpactStyle.Light);
              updateSet(activeIndex, { isWarmup: !active.isWarmup });
            }}
            aria-pressed={active.isWarmup}
            aria-label={`${t('workout.set_n', { n: activeIndex + 1 })}: ${t('workout.warmup')}`}
            className={`label-caps min-h-11 rounded-sm border px-3 transition-colors ${
              active.isWarmup
                ? 'border-warning bg-warning text-fg-inverse'
                : 'border-dashed border-line-strong text-fg-subtle'
            }`}
          >
            {t('workout.warmup')}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          className={`flex min-h-11 items-center gap-1.5 rounded-sm border px-3 label-caps transition-colors ${
            hasDetails ? 'border-accent text-accent' : 'border-line text-fg-subtle'
          }`}
        >
          <StickyNote className="h-4 w-4" />
          {/* «Nota serie», no «Notas»: justo debajo está el chip de notas del
              ejercicio y dos botones iguales seguidos confundían. */}
          {t('workout.set_note')}
        </button>
        <button
          type="button"
          onClick={() => removeSet(activeIndex)}
          aria-label={`${t('workout.session_remove_set')} ${activeIndex + 1}`}
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-sm border border-line text-fg-subtle"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {showDetails && (
        <div className="mt-3 space-y-3">
          <input
            type="text"
            placeholder={t('workout.set_note_placeholder')}
            value={active.notes ?? ''}
            onChange={(e) => updateSet(activeIndex, { notes: e.target.value.slice(0, 500) })}
            className="w-full rounded-card border border-line bg-surface px-2 py-2 text-xs text-fg outline-none"
          />
          <div>
            <div className="label-caps mb-1.5 text-fg-subtle">{t('workout.rpe_label')}</div>
            <div className="flex flex-wrap gap-1.5">
              {RPE_OPTIONS.map((value) => {
                const on = active.rpe === value;
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => {
                      void impact(ImpactStyle.Light);
                      updateSet(activeIndex, { rpe: on ? '' : value });
                    }}
                    aria-pressed={on}
                    className={`min-h-11 min-w-11 rounded-sm border px-2 text-sm font-medium ${
                      on
                        ? 'border-accent bg-accent text-accent-fg'
                        : 'border-line bg-surface text-fg-muted'
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="label-caps mb-1.5 text-fg-subtle">{t('workout.set_type_label')}</div>
            <div className="flex flex-wrap gap-1.5">
              {SET_TYPES.map((value) => {
                const on = (active.setType ?? 'normal') === value;
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => {
                      void impact(ImpactStyle.Light);
                      updateSet(activeIndex, { setType: value });
                    }}
                    aria-pressed={on}
                    className={`min-h-11 rounded-sm border px-2.5 text-xs font-medium ${
                      on
                        ? 'border-accent bg-accent text-accent-fg'
                        : 'border-line bg-surface text-fg-muted'
                    }`}
                  >
                    {t(`workout.set_type_${value}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Series ya anotadas. */}
      <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5">
        {sets.map((s, i) =>
          i === activeIndex ? null : (
            <LoggedSetRow
              key={s.id ?? String(i)}
              set={s}
              index={i}
              isPR={checkIsNewPR(s.weight, s.reps)}
              onSelect={onSelect}
              weightUnit={weightUnit}
              convert={convert}
              label={t('workout.edit_set')}
              warmupLabel={t('workout.warmup')}
            />
          ),
        )}
      </m.div>
    </div>
  );
});
