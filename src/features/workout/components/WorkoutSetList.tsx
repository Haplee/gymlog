import { useState } from 'react';
import { m } from 'framer-motion';
import { Trophy, StickyNote, X } from 'lucide-react';

interface SetData {
  id?: string;
  reps: string;
  weight: string;
  isWarmup?: boolean;
  notes?: string;
}

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
            <div className="flex items-stretch gap-1">
              {showWarmupSets && (
                <button
                  onClick={() => updateSet(i, { isWarmup: !s.isWarmup })}
                  aria-pressed={s.isWarmup}
                  aria-label={`Serie ${i + 1}: calentamiento`}
                  className={`w-8 self-stretch rounded text-xs font-bold flex items-center justify-center transition-colors border ${
                    s.isWarmup
                      ? 'bg-warning border-solid border-warning text-fg-inverse'
                      : 'bg-transparent border-dashed border-fg-subtle text-fg-subtle'
                  }`}
                >
                  W
                </button>
              )}
              <div
                className={`w-6 h-8 flex items-center justify-center text-sm font-medium rounded ${
                  isNewPR ? 'bg-accent text-accent-fg' : 'bg-transparent text-fg-muted'
                }`}
              >
                {i + 1}
              </div>
              <div className="flex-1 flex flex-col">
                <label className="text-2xs block mb-1 text-fg-subtle">{t('workout.reps')}</label>
                <input
                  type="text"
                  inputMode="numeric"
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
                  className={`w-full rounded-lg text-sm px-2 py-1.5 outline-none text-center text-fg border ${
                    setErrors[i] ? 'bg-error/10 border-error' : 'bg-surface border-line'
                  }`}
                />
              </div>
              <div className="relative flex-1 flex flex-col">
                <label className="text-2xs block mb-1 text-fg-subtle">{weightUnit}</label>
                <input
                  type="text"
                  inputMode="decimal"
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
                    const raw = e.target.value.replace(',', '.').replace(/[^\d.]/g, '');
                    const parts = raw.split('.');
                    const cleanRaw =
                      parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');

                    setLocalWeights((prev) => ({ ...prev, [s.id ?? String(i)]: cleanRaw }));

                    if (cleanRaw === '' || cleanRaw === '.') {
                      updateSet(i, { weight: '' });
                    } else {
                      const display = parseFloat(cleanRaw);
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
                  className={`w-full rounded-lg text-sm px-2 py-1.5 outline-none text-center text-fg border ${
                    setErrors[i] ? 'bg-error/10 border-error' : 'bg-surface border-line'
                  }`}
                />
                {isNewPR && (
                  <span className="absolute -top-1 -right-1">
                    <Trophy className="w-3 h-3 text-accent" />
                  </span>
                )}
              </div>
              <button
                onClick={() => setExpandedNoteIdx(expandedNoteIdx === i ? null : i)}
                className={`w-6 h-8 flex items-center justify-center bg-transparent border rounded cursor-pointer ${
                  s.notes ? 'border-accent text-accent' : 'border-line text-fg-subtle'
                }`}
                title="Nota de la serie"
              >
                <StickyNote className="w-3 h-3" />
              </button>
              <button
                onClick={() => removeSet(i)}
                className="w-6 h-8 flex items-center justify-center bg-transparent border rounded cursor-pointer text-lg border-line text-fg-subtle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {expandedNoteIdx === i && (
              <input
                type="text"
                placeholder="Nota de la serie..."
                value={s.notes ?? ''}
                onChange={(e) => updateSet(i, { notes: e.target.value.slice(0, 500) })}
                className="w-full mt-1 rounded-lg text-xs px-2 py-1.5 outline-none bg-surface border border-line text-fg"
              />
            )}
            {setErrors[i] && <div className="text-2xs mt-1 ml-8 text-error">{setErrors[i]}</div>}
          </m.div>
        );
      })}
    </>
  );
}
