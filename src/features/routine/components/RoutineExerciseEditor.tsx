import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet, Input, SegmentedControl, Toggle } from '@shared/components/ui';
import type { RoutineExercise } from '@features/routine/stores/routineStore';
import {
  MAX_DURACION_SEGUNDOS,
  MIN_DURACION_SEGUNDOS,
  planModeOf,
} from '@features/routine/utils/planTarget';

interface RoutineExerciseEditorProps {
  /** Ejercicio que se está editando, o `null` para tener la hoja cerrada. */
  exercise: RoutineExercise | null;
  /**
   * El ejercicio que va justo antes en el día, si lo hay.
   *
   * Hace falta para encadenar una superserie: el grupo se forma con el
   * **anterior**, que es como se construyen en la práctica —«esto va seguido de
   * lo de arriba»— y no eligiendo compañeros de una lista.
   */
  previous?: RoutineExercise | null;
  onClose: () => void;
  onSave: (next: RoutineExercise) => void;
}

/** Series que se ofrecen por defecto si el ejercicio no traía ninguna. */
const SERIES_POR_DEFECTO = 3;
/** Duración de partida al pasar un ejercicio a tiempo. Una plancha corta. */
const DURACION_POR_DEFECTO = 45;

const MAX_SERIES = 50;

/**
 * Hoja para decidir **cómo se hace** un ejercicio del plan: en repeticiones o
 * por tiempo, y si el objetivo es por lado.
 *
 * Hasta ahora un ejercicio del plan solo se podía añadir y quitar: entraba con
 * `3 × 10-12` fijos y no había forma de tocarlo. Por eso esto es una hoja nueva
 * y no un campo más en una que ya existiera.
 *
 * El formulario va en un componente aparte y **con `key`** para que los campos
 * se siembren al montarlo, no con un efecto que copie las props al estado en
 * cada apertura: ese patrón encadena un render de más y deja la puerta abierta
 * a pisar lo que el usuario está escribiendo.
 */
export function RoutineExerciseEditor({
  exercise,
  previous,
  onClose,
  onSave,
}: RoutineExerciseEditorProps) {
  if (!exercise) return null;

  return (
    <BottomSheet open onClose={onClose} title={exercise.name}>
      <Formulario
        key={exercise.name}
        exercise={exercise}
        previous={previous ?? null}
        onClose={onClose}
        onSave={onSave}
      />
    </BottomSheet>
  );
}

function Formulario({
  exercise,
  previous,
  onClose,
  onSave,
}: {
  exercise: RoutineExercise;
  previous: RoutineExercise | null;
  onClose: () => void;
  onSave: (next: RoutineExercise) => void;
}) {
  const { t } = useTranslation();

  const [mode, setMode] = useState<'reps' | 'time'>(() => planModeOf(exercise));
  const [sets, setSets] = useState(() =>
    exercise.sets != null ? String(exercise.sets) : String(SERIES_POR_DEFECTO),
  );
  // Las reps y la duración se conservan aunque el modo activo sea el otro:
  // cambiar de modo para mirar cómo queda no puede costarte lo que ya tenías
  // escrito. Al guardar solo se escribe lo que aplica.
  const [reps, setReps] = useState(() => exercise.reps ?? '');
  const [duration, setDuration] = useState(() =>
    exercise.durationSeconds != null
      ? String(exercise.durationSeconds)
      : String(DURACION_POR_DEFECTO),
  );
  const [perSide, setPerSide] = useState(() => exercise.perSide === true);
  // Encadenado con el anterior si comparten grupo. Sin ejercicio anterior no hay
  // nada que encadenar, así que la fila ni se ofrece.
  const puedeEncadenar = previous != null;
  const [encadenado, setEncadenado] = useState(
    () => puedeEncadenar && !!exercise.supersetId && exercise.supersetId === previous?.supersetId,
  );

  const seriesNum = Number.parseInt(sets, 10);
  const seriesValidas =
    Number.isFinite(seriesNum) && seriesNum > 0 && seriesNum <= MAX_SERIES ? seriesNum : null;

  const duracionNum = Number.parseInt(duration, 10);
  const duracionValida =
    Number.isFinite(duracionNum) &&
    duracionNum >= MIN_DURACION_SEGUNDOS &&
    duracionNum <= MAX_DURACION_SEGUNDOS
      ? duracionNum
      : null;

  const puedeGuardar = mode === 'time' ? duracionValida != null : reps.trim().length > 0;

  const handleSave = () => {
    if (!puedeGuardar) return;

    // Se construye desde cero en vez de hacer spread y borrar: así un campo que
    // deja de aplicar (la duración de un ejercicio que vuelve a repeticiones)
    // no se queda dentro esperando a confundir a quien lea el JSON.
    const next: RoutineExercise = {
      name: exercise.name,
      ...(seriesValidas != null ? { sets: seriesValidas } : {}),
      ...(reps.trim() ? { reps: reps.trim() } : {}),
      ...(exercise.notes ? { notes: exercise.notes } : {}),
      ...(mode === 'time' ? { mode: 'time' as const } : {}),
      ...(perSide ? { perSide: true } : {}),
      ...(mode === 'time' && duracionValida != null ? { durationSeconds: duracionValida } : {}),
      // Al encadenar se **hereda** el id del anterior, creándolo si aún no
      // tiene: así encadenar tres seguidos los mete a los tres en el mismo
      // grupo sin ningún paso extra.
      ...(encadenado && previous
        ? { supersetId: previous.supersetId ?? `ss-${crypto.randomUUID()}` }
        : {}),
    };

    onSave(next);
    onClose();
  };

  return (
    <div className="space-y-5 pb-2">
      <div className="space-y-2">
        <span className="label-caps text-fg-subtle">{t('routine.exercise_mode')}</span>
        <SegmentedControl
          ariaLabel={t('routine.exercise_mode')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'reps', label: t('routine.mode_reps') },
            { value: 'time', label: t('routine.mode_time') },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label={t('routine.field_sets')}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_SERIES}
          value={sets}
          onChange={(e) => setSets(e.target.value)}
        />

        {mode === 'time' ? (
          <Input
            label={t('routine.field_duration')}
            type="number"
            inputMode="numeric"
            min={MIN_DURACION_SEGUNDOS}
            max={MAX_DURACION_SEGUNDOS}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        ) : (
          <Input
            label={t('routine.field_reps')}
            type="text"
            value={reps}
            placeholder={t('routine.field_reps_placeholder')}
            onChange={(e) => setReps(e.target.value)}
          />
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-base text-fg">{t('routine.per_side')}</div>
          <p className="text-xs text-fg-subtle mt-0.5">{t('routine.per_side_help')}</p>
        </div>
        <Toggle checked={perSide} onChange={setPerSide} ariaLabel={t('routine.per_side')} />
      </div>

      {puedeEncadenar && (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-base text-fg">{t('routine.superset')}</div>
            <p className="text-xs text-fg-subtle mt-0.5">
              {t('routine.superset_help', { name: previous?.name ?? '' })}
            </p>
          </div>
          <Toggle checked={encadenado} onChange={setEncadenado} ariaLabel={t('routine.superset')} />
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={!puedeGuardar}
        className="w-full min-h-12 rounded-pill text-sm font-display font-bold uppercase tracking-[0.12em] bg-accent text-accent-fg shadow-btn-accent active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100"
      >
        {t('common.save')}
      </button>
    </div>
  );
}
