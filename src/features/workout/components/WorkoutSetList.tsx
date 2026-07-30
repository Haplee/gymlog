import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { Trophy, StickyNote, X } from 'lucide-react';
import { impact, ImpactStyle } from '@shared/lib/haptics';

type SetType = 'normal' | 'dropset' | 'rest_pause' | 'amrap';

interface SetData {
  id?: string;
  reps: string;
  weight: string;
  isWarmup?: boolean;
  notes?: string;
  rpe?: string;
  setType?: SetType;
}

const RPE_OPTIONS = ['6', '7', '8', '9', '10'] as const;
const SET_TYPES: SetType[] = ['normal', 'dropset', 'rest_pause', 'amrap'];
const SET_TYPE_BADGE: Record<Exclude<SetType, 'normal'>, string> = {
  dropset: 'DROP',
  rest_pause: 'R-P',
  amrap: 'AMRAP',
};

interface SetRowProps {
  set: SetData;
  index: number;
  showWarmupSets: boolean;
  /** Error de ESTA serie: pasarlo suelto evita re-render por errores ajenos. */
  error: string | undefined;
  expanded: boolean;
  onToggleNote: (index: number) => void;
  onClearError: (index: number) => void;
  updateSet: (index: number, data: Partial<SetData>) => void;
  removeSet: (index: number) => void;
  checkIsNewPR: (weight: string, reps: string) => boolean;
  weightUnit: string;
  convert: (kg: number) => number;
  convertToKg: (local: number) => number;
}

/**
 * Una serie de la sesión.
 *
 * Memoizada porque `updateSet` solo cambia la identidad del objeto de la serie
 * editada (clona el array y reemplaza un índice): sin `memo`, teclear en una
 * serie re-renderizaba también todas las demás filas.
 *
 * El texto que se está escribiendo en el campo de peso vive aquí, no en un mapa
 * del padre: mientras el usuario teclea hay que mostrar lo escrito tal cual
 * («22,» a medio escribir) en vez del valor reformateado desde kg, y al salir
 * del campo se vuelve al valor derivado.
 */
const SetRow = memo(function SetRow({
  set: s,
  index: i,
  showWarmupSets,
  error,
  expanded,
  onToggleNote,
  onClearError,
  updateSet,
  removeSet,
  checkIsNewPR,
  weightUnit,
  convert,
  convertToKg,
}: SetRowProps) {
  const { t } = useTranslation();
  const [localWeight, setLocalWeight] = useState<string | null>(null);
  const isNewPR = checkIsNewPR(s.weight, s.reps);

  const displayedWeight =
    localWeight ??
    (() => {
      const n = Number(s.weight);
      if (!s.weight || Number.isNaN(n)) return '';
      return convert(n).toFixed(1).replace(/\.0$/, '');
    })();

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.03, type: 'spring', stiffness: 320, damping: 26 }}
      className="mb-2"
    >
      <div className="flex items-center gap-1.5">
        {showWarmupSets && (
          <button
            type="button"
            onClick={() => {
              void impact(ImpactStyle.Light);
              updateSet(i, { isWarmup: !s.isWarmup });
            }}
            aria-pressed={s.isWarmup}
            aria-label={`Serie ${i + 1}: calentamiento`}
            className={`w-9 h-12 flex-shrink-0 rounded-card text-sm font-bold flex items-center justify-center transition-colors border ${
              s.isWarmup
                ? 'bg-warning border-solid border-warning text-fg-inverse'
                : 'bg-transparent border-dashed border-fg-subtle text-fg-subtle'
            }`}
          >
            W
          </button>
        )}
        <div
          className={`w-7 h-12 flex-shrink-0 flex items-center justify-center text-base font-mono font-semibold tabular-nums rounded-card ${
            isNewPR ? 'bg-accent text-accent-fg' : 'bg-transparent text-fg-subtle'
          }`}
        >
          {i + 1}
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <input
            type="text"
            inputMode="numeric"
            aria-label={`${t('workout.reps')} ${i + 1}`}
            pattern="[0-9]*"
            placeholder="0"
            value={s.reps}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^\d]/g, '');
              updateSet(i, { reps: cleaned });
              if (error) onClearError(i);
            }}
            className={`w-full rounded-sm text-2xl font-display font-bold tabular-nums px-2 py-3 outline-none text-center text-fg border focus:border-accent ${
              error ? 'bg-error/10 border-error' : 'bg-surface-2 border-line'
            }`}
          />
        </div>
        <div className="relative flex-1 min-w-0 flex flex-col">
          <input
            type="text"
            inputMode="decimal"
            aria-label={`${weightUnit} ${i + 1}`}
            pattern="[0-9]*[.,]?[0-9]*"
            placeholder="0"
            value={displayedWeight}
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
                updateSet(i, { weight: '' });
              } else {
                const display = parseFloat(cleanForParse);
                if (Number.isNaN(display)) {
                  updateSet(i, { weight: '' });
                } else {
                  const kgValue = convertToKg(display);
                  updateSet(i, {
                    weight: Number.isFinite(kgValue) ? kgValue.toString() : '',
                  });
                }
              }
              if (error) onClearError(i);
            }}
            onBlur={() => setLocalWeight(null)}
            className={`w-full rounded-sm text-2xl font-display font-bold tabular-nums px-2 py-3 outline-none text-center text-fg border focus:border-accent ${
              error ? 'bg-error/10 border-error' : 'bg-surface-2 border-line'
            }`}
          />
          {isNewPR && (
            <m.span
              initial={{ scale: 0.5, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 18 }}
              className="absolute -top-1 -right-1"
            >
              <Trophy className="w-3 h-3 text-accent" />
            </m.span>
          )}
        </div>
        {s.setType && s.setType !== 'normal' && (
          <span className="self-center px-1.5 py-0.5 rounded text-[0.5rem] font-bold bg-accent/15 text-accent">
            {SET_TYPE_BADGE[s.setType]}
          </span>
        )}
        <button
          type="button"
          onClick={() => onToggleNote(i)}
          className={`w-9 h-12 flex-shrink-0 flex items-center justify-center bg-transparent border rounded-card cursor-pointer ${
            s.notes || s.rpe || (s.setType && s.setType !== 'normal')
              ? 'border-accent text-accent'
              : 'border-line text-fg-subtle'
          }`}
          title="Nota de la serie"
        >
          <StickyNote className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => removeSet(i)}
          aria-label={`${t('workout.session_remove_set')} ${i + 1}`}
          className="w-9 h-12 flex-shrink-0 flex items-center justify-center bg-transparent border rounded-card cursor-pointer border-line text-fg-subtle"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {expanded && (
        <div className="mt-1 space-y-2">
          <input
            type="text"
            placeholder="Nota de la serie..."
            value={s.notes ?? ''}
            onChange={(e) => updateSet(i, { notes: e.target.value.slice(0, 500) })}
            className="w-full rounded-card text-xs px-2 py-1.5 outline-none bg-surface border border-line text-fg"
          />
          <div>
            <div className="text-2xs uppercase font-semibold mb-1 text-fg-subtle">
              {t('workout.rpe_label')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {RPE_OPTIONS.map((value) => {
                const active = s.rpe === value;
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => {
                      void impact(ImpactStyle.Light);
                      updateSet(i, { rpe: active ? '' : value });
                    }}
                    aria-pressed={active}
                    className={`min-w-11 min-h-9 px-2 rounded-card text-sm font-medium border ${
                      active
                        ? 'bg-accent border-accent text-accent-fg'
                        : 'bg-surface border-line text-fg-muted'
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-2xs uppercase font-semibold mb-1 text-fg-subtle">
              {t('workout.set_type_label')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SET_TYPES.map((value) => {
                const active = (s.setType ?? 'normal') === value;
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => {
                      void impact(ImpactStyle.Light);
                      updateSet(i, { setType: value });
                    }}
                    aria-pressed={active}
                    className={`min-h-9 px-2.5 rounded-card text-xs font-medium border ${
                      active
                        ? 'bg-accent border-accent text-accent-fg'
                        : 'bg-surface border-line text-fg-muted'
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
      {error && <div className="text-2xs mt-1 ml-8 text-error">{error}</div>}
    </m.div>
  );
});

interface WorkoutSetListProps {
  sets: SetData[];
  showWarmupSets: boolean;
  setErrors: Record<number, string>;
  setSetErrors: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  updateSet: (index: number, data: Partial<SetData>) => void;
  removeSet: (index: number) => void;
  checkIsNewPR: (weight: string, reps: string) => boolean;
  weightUnit: string;
  convert: (kg: number) => number;
  convertToKg: (local: number) => number;
}

export function WorkoutSetList({
  sets,
  showWarmupSets,
  setErrors,
  setSetErrors,
  updateSet,
  removeSet,
  checkIsNewPR,
  weightUnit,
  convert,
  convertToKg,
}: WorkoutSetListProps) {
  const [expandedNoteIdx, setExpandedNoteIdx] = useState<number | null>(null);

  // Estables para no invalidar el memo de las filas en cada render.
  const onToggleNote = useCallback(
    (index: number) => setExpandedNoteIdx((prev) => (prev === index ? null : index)),
    [],
  );

  const onClearError = useCallback(
    (index: number) =>
      setSetErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      }),
    [setSetErrors],
  );

  if (sets.length === 0) {
    return null;
  }

  return (
    <>
      {sets.map((s, i) => (
        <SetRow
          key={s.id ?? String(i)}
          set={s}
          index={i}
          showWarmupSets={showWarmupSets}
          error={setErrors[i]}
          expanded={expandedNoteIdx === i}
          onToggleNote={onToggleNote}
          onClearError={onClearError}
          updateSet={updateSet}
          removeSet={removeSet}
          checkIsNewPR={checkIsNewPR}
          weightUnit={weightUnit}
          convert={convert}
          convertToKg={convertToKg}
        />
      ))}
    </>
  );
}
