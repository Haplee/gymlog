import { useState } from 'react';
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
  t: (key: string) => string;
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
  t,
}: WorkoutSetListProps) {
  const [localWeights, setLocalWeights] = useState<Record<string, string>>({});
  const [expandedNoteIdx, setExpandedNoteIdx] = useState<number | null>(null);

  if (sets.length === 0) {
    return null;
  }

  return (
    <>
      {sets.map((s, i) => {
        const isNewPR = checkIsNewPR(s.weight, s.reps);
        return (
          <m.div
            key={s.id ?? String(i)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, type: 'spring', stiffness: 320, damping: 26 }}
            className="mb-2"
          >
            <div className="flex items-center gap-1.5">
              {showWarmupSets && (
                <button
                  onClick={() => {
                    void impact(ImpactStyle.Light);
                    updateSet(i, { isWarmup: !s.isWarmup });
                  }}
                  aria-pressed={s.isWarmup}
                  aria-label={`Serie ${i + 1}: calentamiento`}
                  className={`w-9 h-12 flex-shrink-0 rounded-lg text-sm font-bold flex items-center justify-center transition-colors border ${
                    s.isWarmup
                      ? 'bg-warning border-solid border-warning text-fg-inverse'
                      : 'bg-transparent border-dashed border-fg-subtle text-fg-subtle'
                  }`}
                >
                  W
                </button>
              )}
              <div
                className={`w-7 h-12 flex-shrink-0 flex items-center justify-center text-base font-mono font-semibold tabular-nums rounded-lg ${
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
                    if (setErrors[i]) {
                      setSetErrors((prev) => {
                        const n = { ...prev };
                        delete n[i];
                        return n;
                      });
                    }
                  }}
                  className={`w-full rounded-lg text-lg font-mono tabular-nums px-2 py-3 outline-none text-center text-fg border ${
                    setErrors[i] ? 'bg-error/10 border-error' : 'bg-surface-2 border-line'
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
                  value={
                    localWeights[s.id ?? String(i)] !== undefined
                      ? localWeights[s.id ?? String(i)]
                      : (() => {
                          const n = Number(s.weight);
                          if (!s.weight || Number.isNaN(n)) return '';
                          return convert(n).toFixed(1).replace(/\.0$/, '');
                        })()
                  }
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d.,]/g, '');
                    // Evitar múltiples separadores decimales
                    const parts = raw.split(/[.,]/);
                    const cleanLocal =
                      parts[0] +
                      (parts.length > 1
                        ? (raw.includes(',') ? ',' : '.') + parts.slice(1).join('')
                        : '');

                    setLocalWeights((prev) => ({ ...prev, [s.id ?? String(i)]: cleanLocal }));

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
                    if (setErrors[i]) {
                      setSetErrors((prev) => {
                        const n = { ...prev };
                        delete n[i];
                        return n;
                      });
                    }
                  }}
                  onBlur={() => {
                    setLocalWeights((prev) => {
                      const n = { ...prev };
                      delete n[s.id ?? String(i)];
                      return n;
                    });
                  }}
                  className={`w-full rounded-lg text-lg font-mono tabular-nums px-2 py-3 outline-none text-center text-fg border ${
                    setErrors[i] ? 'bg-error/10 border-error' : 'bg-surface-2 border-line'
                  }`}
                />
                {isNewPR && (
                  <m.span
                    initial={{ scale: 0, rotate: -20 }}
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
                onClick={() => setExpandedNoteIdx(expandedNoteIdx === i ? null : i)}
                className={`w-9 h-12 flex-shrink-0 flex items-center justify-center bg-transparent border rounded-lg cursor-pointer ${
                  s.notes || s.rpe || (s.setType && s.setType !== 'normal')
                    ? 'border-accent text-accent'
                    : 'border-line text-fg-subtle'
                }`}
                title="Nota de la serie"
              >
                <StickyNote className="w-4 h-4" />
              </button>
              <button
                onClick={() => removeSet(i)}
                className="w-9 h-12 flex-shrink-0 flex items-center justify-center bg-transparent border rounded-lg cursor-pointer border-line text-fg-subtle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {expandedNoteIdx === i && (
              <div className="mt-1 space-y-2">
                <input
                  type="text"
                  placeholder="Nota de la serie..."
                  value={s.notes ?? ''}
                  onChange={(e) => updateSet(i, { notes: e.target.value.slice(0, 500) })}
                  className="w-full rounded-lg text-xs px-2 py-1.5 outline-none bg-surface border border-line text-fg"
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
                          key={value}
                          onClick={() => {
                            void impact(ImpactStyle.Light);
                            updateSet(i, { rpe: active ? '' : value });
                          }}
                          aria-pressed={active}
                          className={`min-w-11 min-h-9 px-2 rounded-lg text-sm font-medium border ${
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
                          key={value}
                          onClick={() => {
                            void impact(ImpactStyle.Light);
                            updateSet(i, { setType: value });
                          }}
                          aria-pressed={active}
                          className={`min-h-9 px-2.5 rounded-lg text-xs font-medium border ${
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
            {setErrors[i] && <div className="text-2xs mt-1 ml-8 text-error">{setErrors[i]}</div>}
          </m.div>
        );
      })}
    </>
  );
}
