import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { m } from 'framer-motion';
import { impact, ImpactStyle } from '@shared/lib/haptics';
import { formatWeightInput } from '@shared/lib/weight';
import { Check, Stickynote, X } from '@shared/components/icons';
import { SegmentedControl } from '@shared/components/ui';
import { WorkTimer } from './WorkTimer';

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
  setType?: SetType;
  completed?: boolean;
}

/** `m:ss`, o `45 s` por debajo del minuto. Igual que en el plan de la rutina. */
function formatoTiempo(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

/**
 * ¿La serie mide algo? Repeticiones o segundos, uno de los dos.
 *
 * Es la misma regla que `setSchema` en la pantalla y que el
 * `CHECK workout_sets_measured` de la base de datos, aplicada ya al marcar el ✓
 * para que nunca llegue a la lista una serie que el guardado va a rechazar.
 */
function midePorAlgo(s: SetData): boolean {
  return Number(s.reps) > 0 || Number(s.durationSeconds) > 0;
}

/** Lo que se lee en la fila de una serie ya anotada. */
function resumenSerie(s: SetData, weightUnit: string, peso: string): string {
  const segundos = Number.parseInt(s.durationSeconds ?? '', 10);
  if (Number.isFinite(segundos) && segundos > 0 && !s.reps) {
    // Una plancha sin lastre no enseña «0 kg»: el cero ahí es ruido, no dato.
    const lastre = Number(s.weight) > 0 ? `${peso} ${weightUnit} · ` : '';
    return `${lastre}${formatoTiempo(segundos)}`;
  }
  return `${peso || '0'} ${weightUnit} × ${s.reps || '0'}`;
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
  /** Esta serie es la que impide guardar. Sin esto el fallo era invisible. */
  errorText?: string;
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
  errorText,
}: LoggedSetRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(i)}
      aria-label={`${label} ${i + 1}`}
      aria-invalid={errorText ? true : undefined}
      className={`w-full hairline-separator flex min-h-11 items-center gap-3 py-3 text-left transition-opacity active:opacity-60 ${
        errorText ? 'border-l-2 border-l-error pl-3' : isPR ? 'border-l-2 border-l-accent pl-3' : ''
      }`}
    >
      <span
        className={`flex items-center gap-1.5 tabular text-base ${
          errorText ? 'text-error' : isPR ? 'text-accent' : 'text-fg-subtle'
        }`}
      >
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
        className={`ml-auto tabular text-base font-medium ${
          errorText ? 'text-error' : isPR ? 'text-accent' : 'text-fg-muted'
        }`}
      >
        {errorText ? errorText : resumenSerie(s, weightUnit, displayWeight(s.weight, convert))}
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
  loggingMode,
  onLoggingModeChange,
  focusSet,
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

  // La pantalla manda abrir la serie que falla al guardar.
  const focusIndex = focusSet?.index;
  const focusNonce = focusSet?.nonce;
  useEffect(() => {
    if (focusIndex != null) onSelect(focusIndex);
    // `focusNonce` es lo que hace que dos guardados seguidos vuelvan a abrirla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

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
  // El RPE ya no cuenta aquí: se marca en su propia fila, a la vista, así que
  // encender el botón de «Nota serie» por él señalaba a un panel donde ya no
  // está.
  const hasDetails = !!(active.notes || (active.setType && active.setType !== 'normal'));

  const shownWeight = localWeight ?? displayWeight(active.weight, convert);

  /**
   * El modo que se pinta **manda el dato, no el estado de la pantalla**.
   *
   * `loggingMode` vive en el padre y vuelve a `reps` al cambiar de ejercicio o al
   * reabrir la app. Eso está bien para una serie en blanco, pero con una serie ya
   * medida en segundos hacía que la app dijera «REPS 0» encima de un dato de 48
   * segundos que seguía guardado: el dato correcto y la lectura mintiendo.
   * Se vio en la APK, donde reabrir la app a mitad de entreno es lo normal.
   *
   * Con la serie vacía manda lo que haya elegido el usuario, que es lo único que
   * hay para decidir.
   */
  const modo: 'reps' | 'time' =
    Number(active.durationSeconds) > 0 && !active.reps
      ? 'time'
      : active.reps
        ? 'reps'
        : loggingMode;

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

      <div className="mt-3">
        <SegmentedControl
          ariaLabel={t('workout.mode_time')}
          value={modo}
          onChange={(siguiente) => {
            onLoggingModeChange(siguiente);
            // Se limpia el dato del modo que se abandona: si no, la serie
            // guardaría reps y segundos a la vez y `setShape.isRepSet` la
            // contaría como serie de fuerza — una plancha entrando en el volumen.
            if (siguiente === 'time') updateSet(activeIndex, { reps: '' });
            else updateSet(activeIndex, { durationSeconds: '' });
            if (error) onClearError(activeIndex);
          }}
          options={[
            { value: 'reps', label: t('workout.mode_reps') },
            { value: 'time', label: t('workout.mode_time') },
          ]}
        />
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
          <label
            className="label-caps block text-fg-subtle"
            htmlFor={modo === 'time' ? 'active-set-duration' : 'active-set-reps'}
          >
            {modo === 'time' ? t('workout.seconds') : t('workout.reps')}
          </label>
          {modo === 'time' ? (
            <input
              id="active-set-duration"
              type="text"
              inputMode="numeric"
              aria-label={`${t('workout.seconds')} ${activeIndex + 1}`}
              pattern="[0-9]*"
              placeholder="0"
              value={active.durationSeconds ?? ''}
              onChange={(e) => {
                // Las reps se borran a la vez: una serie es de repeticiones o de
                // tiempo, y dejar las dos haría que `isRepSet` la contase como de
                // fuerza y la plancha entrase en el volumen.
                updateSet(activeIndex, {
                  durationSeconds: e.target.value.replace(/[^\d]/g, ''),
                  reps: '',
                });
                if (error) onClearError(activeIndex);
              }}
              className={inputClass}
            />
          ) : (
            <input
              id="active-set-reps"
              type="text"
              inputMode="numeric"
              aria-label={`${t('workout.reps')} ${activeIndex + 1}`}
              pattern="[0-9]*"
              placeholder="0"
              value={active.reps}
              onChange={(e) => {
                updateSet(activeIndex, {
                  reps: e.target.value.replace(/[^\d]/g, ''),
                  durationSeconds: '',
                });
                if (error) onClearError(activeIndex);
              }}
              className={inputClass}
            />
          )}
        </div>

        {onCommitSet && (
          <button
            type="button"
            onClick={() => {
              // Una serie sin repeticiones ni segundos no es una serie hecha.
              // Marcarla dejaba en la lista un «125 kg × 0» que luego frenaba
              // el guardado del entreno entero, y el aviso llegaba al final.
              if (!midePorAlgo(active)) {
                void impact(ImpactStyle.Heavy);
                setSetErrors((prev) => ({
                  ...prev,
                  [activeIndex]: 'workout.errors.needs_measure',
                }));
                return;
              }
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

      {error && <div className="mt-2 text-xs text-error">{t(error)}</div>}
      {previousHint && <div className="mt-1.5 text-xs text-fg-muted">{previousHint}</div>}

      {/* Esfuerzo percibido, a la vista y no dentro del panel de «Nota serie».
          Es la única señal que enciende la autorregulación —sin ella el motor se
          niega a decidir y todo el mundo cae al respaldo de doble progresión, y
          la descarga no llega a proponerse nunca— y estaba detrás de un botón
          que anunciaba otra cosa. Sigue siendo opcional: se toca si se quiere. */}
      {modo !== 'time' && (
        <div className="mt-3">
          <div className="label-caps mb-1.5 text-fg-subtle">
            {t('workout.rpe_label')}
            <span className="ml-1.5 normal-case tracking-normal text-fg-subtle">
              {t('workout.rpe_optional')}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('workout.rpe_label')}>
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
                  aria-label={t('workout.rpe_option', { value })}
                  className={`min-h-11 min-w-11 rounded-sm border px-2 text-sm font-medium transition-colors ${
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
          {/* Qué significa el número, en una línea: «RPE 8» no le dice nada a
              quien no viene de la sala de fuerza. */}
          <p className="mt-1.5 text-xs text-fg-subtle">{t('workout.rpe_help')}</p>
        </div>
      )}

      {modo === 'time' && (
        // El cronómetro escribe en el campo de segundos, no guarda por su
        // cuenta: el usuario sigue pudiendo corregir el número antes de
        // confirmar la serie, que es lo que pasa cuando el móvil se queda
        // debajo de la esterilla y se acepta el tiempo dos segundos tarde.
        <div className="mt-3">
          <WorkTimer
            onAccept={(seconds) => {
              updateSet(activeIndex, { durationSeconds: String(seconds), reps: '' });
              if (error) onClearError(activeIndex);
            }}
          />
        </div>
      )}

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
            className={`label-caps min-h-11 rounded-sm border px-3 transition-colors active:opacity-60 ${
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
          className={`flex min-h-11 items-center gap-1.5 rounded-sm border px-3 label-caps transition-colors active:opacity-60 ${
            hasDetails ? 'border-accent text-accent' : 'border-line text-fg-subtle'
          }`}
        >
          <Stickynote className="h-4 w-4" />
          {/* «Nota serie», no «Notas»: justo debajo está el chip de notas del
              ejercicio y dos botones iguales seguidos confundían. */}
          {t('workout.set_note')}
        </button>
        <button
          type="button"
          onClick={() => {
            void impact(ImpactStyle.Medium);
            removeSet(activeIndex);
          }}
          aria-label={`${t('workout.session_remove_set')} ${activeIndex + 1}`}
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-sm border border-line text-fg-subtle transition-opacity active:opacity-60"
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
            className="w-full glass-2 rounded-card px-2 py-2 text-xs text-fg outline-none"
          />
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
              errorText={setErrors[i] ? t(setErrors[i]) : undefined}
            />
          ),
        )}
      </m.div>
    </div>
  );
});
