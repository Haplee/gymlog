import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { m } from 'framer-motion';
import { tapSet, completeSet, startTimer } from '@shared/lib/haptics';
import { formatWeightInput } from '@shared/lib/weight';
import { Check, ChevronDown, Dumbbell, IconDumbbell } from '@shared/components/icons';
import { InputNumber } from '@shared/components/ui/InputNumber';
import { RPE_OPTIONS, RIR_OPTIONS } from '@shared/constants/rpe';
import { fetchLastExerciseSets } from '@shared/api/queries';

type SetType = 'normal' | 'dropset' | 'rest_pause' | 'amrap';

interface SetData {
  id?: string;
  reps: string;
  weight: string;
  /** Segundos aguantados. Vacío en una serie de repeticiones. */
  durationSeconds?: string;
  isWarmup?: boolean;
  notes?: string;
  rpe?: string;
  rir?: string;
  setType?: SetType;
  completed?: boolean;
  /** Modalidad de carga del ejercicio activo (para etiquetado correcto). */
  loadType?: string;
  /** La abrió la app al cerrar la serie anterior; necesita el ✓ para contar. */
  autofilled?: boolean;
}

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

/** `m:ss`, o `45 s` por debajo del minuto. */
function formatoTiempo(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

/** Icono de grupo muscular según loadType. */
const muscleIcon = (loadType: string | undefined) => {
  if (loadType === 'bodyweight' || loadType === 'bodyweight_loaded')
    return <Dumbbell className="h-4 w-4" />;
  return <IconDumbbell className="h-4 w-4" />;
};

interface SetRowProps {
  set: SetData;
  index: number;
  isActive: boolean;
  /** Contexto compartido para la fila */
  ctx: {
    checkIsNewPR: (weight: string, reps: string) => boolean;
    convert: (kg: number) => number;
    convertToKg: (local: number) => number;
    weightUnit: string;
    t: (key: string) => string;
    setErrors: Record<number, string>;
    onClearError: (index: number) => void;
    updateSet: (index: number, data: Partial<SetData>) => void;
    removeSet: (index: number) => void;
    onCommitSet: (() => void) | undefined;
    showWarmupSets: boolean;
    onSelect: (index: number | null) => void;
    setSetErrors: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    lastSet?: {
      reps: number;
      weight: number;
      set_num: number;
      workout_started_at: string | null;
    } | null;
  };
}

/**
 * Fila de serie individual — editable si `isActive`, solo lectura si no.
 * Altura fija 48dp (min-h-[48px]) para touch targets y densidad.
 */
const SetRow = memo(function SetRow({ set: s, index: i, isActive, ctx }: SetRowProps) {
  const isPR = ctx.checkIsNewPR(s.weight, s.reps);
  const rowError = ctx.setErrors[i];
  const modo: 'reps' | 'time' = Number(s.durationSeconds) > 0 && !s.reps ? 'time' : 'reps';

  const weightDisplay = displayWeight(s.weight, ctx.convert);
  const repsDisplay = s.reps || (modo === 'time' ? formatoTiempo(Number(s.durationSeconds)) : '');

  const handleWeightChange = (val: string) => {
    const cleanForParse = val.replace(',', '.');
    if (cleanForParse === '' || cleanForParse === '.') {
      ctx.updateSet(i, { weight: '' });
    } else {
      const display = parseFloat(cleanForParse);
      if (Number.isNaN(display)) {
        ctx.updateSet(i, { weight: '' });
      } else {
        const kgValue = ctx.convertToKg(display);
        ctx.updateSet(i, { weight: Number.isFinite(kgValue) ? kgValue.toString() : '' });
      }
    }
    if (rowError) ctx.onClearError(i);
  };

  const handleRepsChange = (val: string) => {
    ctx.updateSet(i, { reps: val, durationSeconds: '' });
    if (rowError) ctx.onClearError(i);
  };

  const handleDurationChange = (val: string) => {
    ctx.updateSet(i, { durationSeconds: val, reps: '' });
    if (rowError) ctx.onClearError(i);
  };

  const handleRPEChange = (val: string) => {
    ctx.updateSet(i, { rpe: s.rpe === val ? '' : val });
  };

  const handleRIRChange = (val: string) => {
    ctx.updateSet(i, { rir: s.rir === val ? '' : val });
  };

  const handleComplete = () => {
    if (!ctx.onCommitSet) return;
    const mideAlgo = Number(s.reps) > 0 || Number(s.durationSeconds) > 0;
    if (!mideAlgo) {
      void startTimer();
      ctx.setSetErrors((prev) => ({ ...prev, [i]: 'workout.errors.needs_measure' }));
      return;
    }
    void completeSet();
    ctx.updateSet(i, { completed: true });
    ctx.onSelect(null); // close details
    ctx.onCommitSet();
  };

  const isWarmup = s.isWarmup && ctx.showWarmupSets;
  const warmupBadge = isWarmup ? (
    <span className="label-caps rounded-sm bg-warning/15 px-2 py-0.5 text-warning border border-warning/30">
      {ctx.t('workout.warmup')}
    </span>
  ) : null;

  const setTypeBadge =
    s.setType && s.setType !== 'normal' ? (
      <span className="label-caps rounded-sm bg-accent/15 px-2 py-0.5 text-accent border border-accent/30">
        {SET_TYPE_BADGE[s.setType]}
      </span>
    ) : null;

  const prBadge = isPR ? (
    <span className="label-caps rounded-sm bg-accent px-2 py-0.5 text-accent-fg">PR</span>
  ) : null;

  // Estilo base para filas de calentamiento: opacidad reducida + fondo distinto
  const warmupRowClass = isWarmup
    ? 'opacity-60 bg-warning/5 border-warning/20'
    : 'bg-surface border border-line';

  // Fila en modo edición (activa)
  if (isActive) {
    return (
      <div
        key={s.id ?? `active-${i}`}
        className={`flex items-center gap-2 min-h-[48px] px-3 py-2 rounded-lg transition-colors ${
          rowError ? 'bg-error/5 border border-error/20' : warmupRowClass
        }`}
      >
        <span className="w-6 text-center text-fg-subtle tabular-nums font-mono text-sm">
          {i + 1}
        </span>

        {/* PESO */}
        <InputNumber
          label={`${ctx.weightUnit} ${i + 1}`}
          value={s.weight}
          onChange={handleWeightChange}
          step={0.5}
          min={0}
          max={500}
          decimals={1}
          disabled={s.completed}
          error={!!rowError}
          className="w-20"
        />

        {/* REPS / TIEMPO */}
        {modo === 'time' ? (
          <InputNumber
            label={`${ctx.t('workout.seconds')} ${i + 1}`}
            value={s.durationSeconds ?? ''}
            onChange={handleDurationChange}
            step={5}
            min={0}
            max={3600}
            decimals={0}
            disabled={s.completed}
            error={!!rowError}
            className="w-20"
          />
        ) : (
          <InputNumber
            label={`${ctx.t('workout.reps')} ${i + 1}`}
            value={s.reps}
            onChange={handleRepsChange}
            step={1}
            min={0}
            max={999}
            decimals={0}
            disabled={s.completed}
            error={!!rowError}
            className="w-16"
          />
        )}

        {/* RPE / RIR — solo en modo reps */}
        {modo !== 'time' && (
          <div
            className="flex items-center gap-1 ml-1"
            role="group"
            aria-label={`${ctx.t('workout.rpe_label')} / ${ctx.t('workout.rir_label')}`}
          >
            {/* RPE chips */}
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label={ctx.t('workout.rpe_label')}
            >
              {RPE_OPTIONS.map((val) => (
                <button
                  key={`rpe-${val}`}
                  type="button"
                  onClick={() => handleRPEChange(val)}
                  aria-pressed={s.rpe === val}
                  aria-label={`${ctx.t('workout.rpe_option')} ${val}`}
                  className={`min-h-[44px] min-w-[44px] rounded-md px-2 text-sm font-medium transition-colors ${
                    s.rpe === val
                      ? 'bg-accent text-accent-fg border border-accent'
                      : 'bg-surface-2 text-fg-muted border border-line-interactive'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>

            {/* Separador visual */}
            <span className="text-fg-subtle px-1" aria-hidden="true">
              |
            </span>

            {/* RIR chips */}
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label={ctx.t('workout.rir_label')}
            >
              {RIR_OPTIONS.map((val) => (
                <button
                  key={`rir-${val}`}
                  type="button"
                  onClick={() => handleRIRChange(val)}
                  aria-pressed={s.rir === val}
                  aria-label={`${ctx.t('workout.rir_option')} ${val}`}
                  className={`min-h-[44px] min-w-[44px] rounded-md px-2 text-sm font-medium transition-colors ${
                    s.rir === val
                      ? 'bg-warning text-fg-inverse border border-warning'
                      : 'bg-surface-2 text-fg-muted border border-line-interactive'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* BADGES (warmup, setType, PR) */}
        <div className="flex items-center gap-1.5 ml-auto">
          {warmupBadge}
          {setTypeBadge}
          {prBadge}
        </div>

        {/* BOTÓN ✓ COMPLETAR */}
        <button
          type="button"
          onClick={handleComplete}
          disabled={s.completed}
          aria-label={s.completed ? ctx.t('workout.set_completed') : ctx.t('workout.complete_set')}
          className={[
            'flex min-h-[48px] min-w-[48px] items-center justify-center rounded-md',
            'transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
            s.completed ? 'bg-success text-fg-inverse cursor-default' : 'bg-accent text-accent-fg',
          ].join(' ')}
        >
          <Check className="h-5 w-5" strokeWidth={3} />
        </button>
      </div>
    );
  }

  // Fila en modo solo lectura (loggeada)
  const warmupRowClassRO = isWarmup
    ? 'opacity-60 bg-warning/5 border-warning/20'
    : 'bg-surface border border-line';

  return (
    <button
      key={s.id ?? String(i)}
      type="button"
      onClick={() => ctx.onSelect(i)}
      aria-label={`${ctx.t('workout.edit_set')} ${i + 1}`}
      aria-invalid={rowError ? true : undefined}
      className={`w-full flex items-center gap-2 min-h-[48px] px-3 py-2 rounded-lg transition-opacity active:opacity-60 ${
        rowError
          ? 'bg-error/5 border-l-2 border-l-error'
          : isPR
            ? 'border-l-2 border-l-accent'
            : warmupRowClassRO
      }`}
    >
      <span className="w-6 text-center text-fg-subtle tabular-nums font-mono text-sm">
        {i + 1}
        {s.completed && <Check className="h-3.5 w-3.5 text-success ml-1" strokeWidth={3} />}
      </span>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Peso display */}
        <span className="w-20 text-right tabular-nums font-mono text-base text-fg">
          {weightDisplay || '—'}
        </span>

        {/* Reps / Tiempo display */}
        <span className="w-16 text-right tabular-nums font-mono text-base text-fg">
          {repsDisplay || '—'}
        </span>

        {/* RPE / RIR display */}
        {modo !== 'time' && (
          <>
            <span className="w-24 text-center text-sm font-medium text-fg-subtle">
              {s.rpe ? `RPE ${s.rpe}` : '—'}
            </span>
            <span className="w-20 text-center text-sm font-medium text-fg-subtle">
              {s.rir !== undefined && s.rir !== '' ? `RIR ${s.rir}` : '—'}
            </span>
          </>
        )}

        {/* Previous session inline — "Last: 80×8" */}
        {modo !== 'time' && ctx.lastSet && (
          <span className="w-28 text-right text-xs text-fg-subtle/70 font-mono">
            {ctx.t('workout.previous_set_short')}:{' '}
            {displayWeight(String(ctx.lastSet.weight), ctx.convert)}×{ctx.lastSet.reps}
          </span>
        )}

        {/* Badges */}
        <div className="flex items-center gap-1.5 ml-auto">
          {warmupBadge}
          {setTypeBadge}
          {prBadge}
        </div>
      </div>
    </button>
  );
});

SetRow.displayName = 'SetRow';

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
  /**
   * Cómo se registra el ejercicio activo y cómo cambiarlo.
   *
   * Vive en el padre y no aquí porque es del **ejercicio**, no de la lista: al
   * cambiar de ejercicio tiene que volver a repeticiones, y un estado local aquí
   * dejaría el cronómetro puesto sobre un press banca.
   */
  loggingMode: 'reps' | 'time';
  onLoggingModeChange: (mode: 'reps' | 'time') => void;
  /**
   * Serie que la pantalla pide abrir (la primera que falla al guardar). El
   * `nonce` distingue dos peticiones seguidas sobre la misma serie.
   */
  focusSet?: { index: number; nonce: number } | null;
  /** Modalidad de carga del ejercicio activo (para etiquetado y lógica de lastre). */
  loadType?: string;
  /** Usuario actual para query de sesión anterior. */
  userId: string;
  /** Ejercicio activo para query de sesión anterior. */
  exerciseId: string;
}

/**
 * Bloque de series — filas inline compactas a 48dp.
 *
 * Cada fila: Peso · Reps · RPE · ✓ (y badges warmup/setType).
 * La serie activa es editable; las loggeadas son de solo lectura pero misma estructura visual.
 * Memoizado: cada tecla llama a `updateSet`, el padre re-renderiza y solo la fila activa cambia.
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
  loggingMode,
  onLoggingModeChange,
  focusSet,
  loadType,
  userId,
  exerciseId,
}: WorkoutSetListProps) {
  const { t } = useTranslation();
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Query de la última sesión de este ejercicio (para mostrar "Last: 80×8" inline)
  const { data: lastExerciseSets = [] } = useQuery({
    queryKey: ['lastExerciseSets', userId, exerciseId],
    queryFn: () => fetchLastExerciseSets(userId, exerciseId),
    staleTime: 1000 * 60 * 5,
    enabled: !!userId && !!exerciseId,
  });
  const lastSet = lastExerciseSets[0];

  const onSelect = useCallback((index: number | null) => {
    setPickedIndex(index);
    setShowDetails(false);
  }, []);

  const focusIndex = focusSet?.index;
  const focusNonce = focusSet?.nonce;
  useEffect(() => {
    if (focusIndex != null) onSelect(focusIndex);
  }, [focusIndex, focusNonce, onSelect]);

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
  const hasDetails = !!(active.notes || (active.setType && active.setType !== 'normal'));

  // Recordatorio efímero del valor de la serie anterior: solo aparece cuando la
  // fila activa está vacía (recién abierta o tras borrar lo heredado).
  const prev = activeIndex > 0 ? sets[activeIndex - 1] : null;
  const previousHint =
    prev && prev.reps && prev.weight && !active.reps && !active.weight
      ? `${t('workout.previous_set')}: ${displayWeight(prev.weight, convert)} ${weightUnit} × ${prev.reps}`
      : null;

  // Contexto compartido para las filas
  const rowCtx = {
    checkIsNewPR,
    convert,
    convertToKg,
    weightUnit,
    t,
    setErrors,
    onClearError,
    updateSet,
    removeSet,
    onCommitSet,
    showWarmupSets,
    onSelect,
    setSetErrors,
    lastSet,
  };

  return (
    <div className="space-y-3">
      {/* HEADER EJERCICIO — compacto con icono músculo */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 min-w-0">
          {muscleIcon(loadType)}
          {exerciseName && (
            <span className="text-lg font-display font-semibold tracking-tight text-fg truncate">
              {exerciseName}
            </span>
          )}
        </div>

        {/* Selector modo reps/time — compacto */}
        <div className="flex-shrink-0">
          <select
            value={loggingMode}
            onChange={(e) => {
              const next = e.target.value as 'reps' | 'time';
              onLoggingModeChange(next);
              // Limpiar dato del modo que se abandona
              if (next === 'time') updateSet(activeIndex, { reps: '' });
              else updateSet(activeIndex, { durationSeconds: '' });
              if (error) onClearError(activeIndex);
            }}
            className="label-caps px-2 py-1.5 rounded-md bg-surface-2 border border-line-interactive text-fg-subtle text-xs appearance-none cursor-pointer focus:outline-none focus:border-accent"
          >
            <option value="reps">{t('workout.mode_reps')}</option>
            <option value="time">{t('workout.mode_time')}</option>
          </select>
        </div>
      </div>

      {/* FILAS DE SERIES */}
      <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
        {sets.map((s, i) => (
          <SetRow
            key={s.id ?? String(i)}
            set={s}
            index={i}
            isActive={i === activeIndex}
            ctx={rowCtx}
          />
        ))}
      </m.div>

      {/* Previous hint */}
      {previousHint && <div className="text-xs text-fg-subtle px-1">{previousHint}</div>}

      {/* Error de la fila activa */}
      {error && <div className="text-xs text-error px-1">{t(error)}</div>}

      {/* Detalles plegables (nota, tipo de serie, borrar) — solo para la activa */}
      {pickedIndex !== null && (
        <m.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3 space-y-3 overflow-hidden"
        >
          {/* Nota de serie */}
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            className={`flex min-h-11 w-full items-center gap-1.5 rounded-md border px-3 label-caps transition-colors active:opacity-60 ${
              hasDetails ? 'border-accent text-accent' : 'border-line text-fg-subtle'
            }`}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
            {t('workout.set_note')}
            <ChevronDown
              className={`ml-auto h-3.5 w-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`}
            />
          </button>
          {showDetails && (
            <div className="space-y-3 pl-10">
              <input
                type="text"
                placeholder={t('workout.set_note_placeholder')}
                value={active.notes ?? ''}
                onChange={(e) => updateSet(activeIndex, { notes: e.target.value.slice(0, 500) })}
                className="w-full glass-2 rounded-md px-3 py-2 text-sm text-fg outline-none border border-line-interactive focus:border-accent"
              />
              {/* Tipo de serie */}
              <div>
                <div className="label-caps mb-1.5 text-fg-subtle">
                  {t('workout.set_type_label')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SET_TYPES.map((val) => {
                    const on = (active.setType ?? 'normal') === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          void tapSet();
                          updateSet(activeIndex, { setType: val });
                        }}
                        aria-pressed={on}
                        className={`min-h-10 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                          on
                            ? 'border-accent bg-accent text-accent-fg'
                            : 'border-line bg-surface text-fg-muted'
                        }`}
                      >
                        {t(`workout.set_type_${val}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Borrar serie activa */}
          <button
            type="button"
            onClick={() => {
              void completeSet();
              removeSet(activeIndex);
              setPickedIndex(null);
            }}
            aria-label={`${t('workout.session_remove_set')} ${activeIndex + 1}`}
            className="w-full min-h-11 rounded-md border border-error/30 text-error transition-colors active:bg-error/10 label-caps"
          >
            {t('workout.session_remove_set')}
          </button>
        </m.div>
      )}
    </div>
  );
});
