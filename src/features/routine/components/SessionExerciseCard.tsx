import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useExerciseAdvice } from '@features/stats/hooks/useExerciseAdvice';
import type { ExerciseAdvice } from '@features/stats/hooks/useAutoregulation';
import { useExerciseRepRange } from '@shared/hooks/useExerciseRepRange';
import { EquipmentIcon } from '@shared/components/icons/EquipmentIcons';
import { isBodyweightLoad } from '@shared/lib/loadType';
import { weightToInput } from '@shared/lib/weight';
import type { Exercise } from '@shared/lib/types';
import type { LibraryExercise } from '@shared/api/queries';
import { useRoutineSessionStore, type SessionExercise } from '../stores/routineSessionStore';
import { WorkTimer } from '@features/workout/components/WorkTimer';
import { formatSegundos } from '@features/routine/utils/planTarget';
import { perSideCount, totalFromPerSide } from '@shared/lib/perSide';
import { muscleGroupLabel } from '@shared/lib/muscleGroupLabel';
import { equipmentLabel } from '@shared/lib/equipmentLabel';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Minus,
  Plus,
  TrendDown,
  TrendUp,
  X,
} from '@shared/components/icons';

const ACTION_ICON = {
  increase: TrendUp,
  reduce: TrendDown,
  hold: Minus,
} as const;

/** Valores de RPE que se ofrecen, los mismos que en la pantalla de entreno. */
const RPE_OPTIONS = ['6', '7', '8', '9', '10'] as const;

interface Props {
  userId: string;
  exercise: SessionExercise;
  /** Posición del ejercicio en la sesión: es lo que direccionan las acciones del store. */
  exerciseIndex: number;
  /** Ejercicio resuelto en el catálogo (propio/público) por nombre. */
  catalog?: Exercise;
  /** Ficha de la biblioteca (descripción de la forma) por nombre. */
  libraryExercise?: LibraryExercise;
  weightUnit: 'kg' | 'lb';
  /**
   * La sesión de rutina autocompleta el registro con el peso recomendado. La
   * tarjeta le reporta la recomendación de cada ejercicio (si la hay) para que
   * el botón «Completar» pueda rellenarla sin que el usuario teclee nada.
   */
  onAdvice: (exerciseName: string, advice: ExerciseAdvice | null) => void;
  /**
   * Segundos aguantados en una serie por tiempo, según el cronómetro. Solo se
   * pasa para los ejercicios en modo tiempo.
   */
  onDuration?: (exerciseName: string, seconds: number) => void;
}

/**
 * Tarjeta de un ejercicio dentro de la sesión de rutina: **el plan, no un
 * formulario.**
 *
 * Antes esta tarjeta enseñaba el peso recomendado y, al pulsar «Completar»,
 * escribía ese peso en todas las series con las repeticiones del plan. Es decir,
 * guardaba la propuesta de la app como si fuera el entrenamiento, y el motor se
 * alimentaba después de sus propios datos: todas las series salían en el techo
 * del rango, el e1RM subía solo y el estancamiento no se detectaba nunca.
 *
 * Ese bucle está cerrado, pero no borrando la edición: está en que la
 * recomendación se **lee** y la corrección se **escribe**. Por eso el plan se
 * muestra de una vez, con el peso recomendado como dato protagonista, y las
 * filasseries salen como una línea legible. Tocar una fila abre solo esa serie
 * para corregirla —marcando `weightTouched`, que es lo que impide que la
 * recomendación vuelva a pisarla— y el RPE sigue a mano porque es lo que
 * enciende la autorregulación y la descarga.
 */
export function SessionExerciseCard({
  userId,
  exercise,
  exerciseIndex,
  catalog,
  libraryExercise,
  weightUnit,
  onAdvice,
  onDuration,
}: Props) {
  const { t, i18n } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  // Qué serie está abierta, si alguna. Solo una a la vez: el plan se lee de un
  // vistazo y la corrección es una excepción puntual, no un modo de trabajo.
  const [serieAbierta, setSerieAbierta] = useState<number | null>(null);
  // El detalle por serie vive tras un botón. La corrección tiene que existir
  // siempre —es lo que cierra el ciclo de «la app se guarda a sí misma como si
  // fuera un entreno»— pero no necesita cinco filas abiertas en el momento de
  // entrar a la sesión.
  const [ajustando, setAjustando] = useState(false);
  const esPorTiempo = exercise.mode === 'time';
  const { updateSet, addSet, removeSet, setExerciseRpe } = useRoutineSessionStore(
    useShallow((s) => ({
      updateSet: s.updateSet,
      addSet: s.addSet,
      removeSet: s.removeSet,
      setExerciseRpe: s.setExerciseRpe,
    })),
  );
  // El RPE es del ejercicio, no de cada serie: en una sesión de rutina nadie va
  // a marcar cinco veces lo mismo, y lo que consume el motor es la media de la
  // sesión. Se lee de la primera serie porque se escribe en todas a la vez.
  const rpeActual = exercise.sets[0]?.rpe ?? '';

  /**
   * El objetivo de repeticiones, en total y con la lectura por lado detrás:
   * «24 (12 por lado)».
   *
   * El número grande es el total porque es lo que se registra; el paréntesis es
   * lo que se cuenta en la serie. Enseñar solo uno de los dos obliga a hacer la
   * cuenta mental justo en el momento de menos cabeza libre.
   */
  const objetivoReps = (() => {
    if (esPorTiempo) return null;
    const base = Number(exercise.targetReps?.trim().match(/^\d+/)?.[0]);
    if (!Number.isFinite(base)) return exercise.targetReps ?? null;
    const total = totalFromPerSide(base, exercise.perSide);
    const porLado = perSideCount(total, exercise.perSide);
    if (porLado == null) return exercise.targetReps ?? String(total);
    const num = porLado.toLocaleString(i18n.language, { maximumFractionDigits: 1 });
    return `${total} (${num} ${t('routine.target_per_side')})`;
  })();

  // El objetivo de la sesión manda sobre la búsqueda por nombre: aquí ya se
  // sabe de qué día viene el ejercicio.
  const { repMin, repMax } = useExerciseRepRange(exercise.name, exercise.targetReps);
  const equipment = catalog?.equipment ?? libraryExercise?.equipment ?? null;
  const muscleGroup = catalog?.muscle_group ?? libraryExercise?.muscle_group ?? null;
  const advice = useExerciseAdvice(userId, catalog?.id, {
    repMin,
    repMax,
    bodyweight: isBodyweightLoad(catalog?.load_type),
    // Manda el plan, no `exercises.is_bilateral`: el mismo remo se puede
    // programar a una o a dos manos, y lo que decide el objetivo es cómo lo
    // planificó quien entrena.
    perSide: exercise.perSide === true,
    muscleGroup: muscleGroup ?? undefined,
    equipment,
  });
  const description = libraryExercise?.description ?? null;
  const AdviceIcon = advice ? ACTION_ICON[advice.suggestion.action] : null;

  /**
   * Las reps que dice el plan, en una sola cifra.
   *
   * Se lee lo que el ejercicio tiene escrito, no lo que propone el motor: la
   * frase es un plan, y el plan es lo que el usuario programó. Si el motor
   * discrepara, el número que se muestra tiene que ser el suyo; el motivo del
   * advice ya explica por qué el motor opinaría otra cosa.
   */
  const repsDelPlan = (() => {
    const written = Number(exercise.sets[0]?.reps || exercise.targetReps?.match(/^\d+/)?.[0]);
    if (Number.isFinite(written) && written > 0) return String(written);
    return String(advice?.suggestion.reps ?? 0);
  })();

  /**
   * La escalera completa, de más ligero a más pesado: los calentamientos que
   * propuso el motor y, al final, el peso de trabajo.
   *
   * Van en el mismo array porque es lo que hace comparables: al dibujarse a
   * escala, el hueco entre la última de calentamiento y la de trabajo es
   * justo el salto que falta para llegar al objetivo.
   */
  const escalera = advice
    ? [
        ...advice.suggestion.warmup,
        { weight: advice.suggestion.weight, reps: Number(repsDelPlan) || advice.suggestion.reps },
      ]
    : [];

  useEffect(() => {
    // Un ejercicio por tiempo nunca reporta consejo: si lo hiciera, el peso
    // recomendado se escribiría en las series de una plancha.
    if (esPorTiempo) return;
    onAdvice(exercise.name, advice);
    return () => onAdvice(exercise.name, null);
  }, [advice, exercise.name, onAdvice, esPorTiempo]);

  return (
    <div className="rounded-card p-3 bg-surface-2 border border-line">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-base font-display font-bold text-fg truncate">{exercise.name}</div>
          {(muscleGroup || equipment) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {muscleGroup && (
                <span className="label-caps px-2 py-1 rounded-pill bg-surface-3 text-fg-muted">
                  {muscleGroupLabel(muscleGroup, t)}
                </span>
              )}
              {equipment && (
                <span className="label-caps px-2 py-1 rounded-pill bg-surface-3 text-fg-muted inline-flex items-center gap-1">
                  <EquipmentIcon equipment={equipment} className="w-3.5 h-3.5" />
                  {equipmentLabel(equipment, t)}
                </span>
              )}
            </div>
          )}
        </div>
        {exercise.targetSets && (
          <span className="flex-shrink-0 font-display text-lg font-bold px-2.5 py-1 rounded-pill bg-surface-3 text-fg-muted tabular">
            {exercise.targetSets}
            <span className="mx-1 text-fg-subtle">×</span>
            {/* En modo tiempo el objetivo son segundos. Pintar `targetReps`
                aquí diría «45 repeticiones de plancha». */}
            {esPorTiempo
              ? exercise.targetDurationSeconds != null
                ? formatSegundos(exercise.targetDurationSeconds)
                : t('workout.mode_time')
              : objetivoReps}
          </span>
        )}
      </div>

      {esPorTiempo ? (
        // Un ejercicio por tiempo no recibe consejo de carga: el motor solo mira
        // series de repeticiones. Lo que necesita aquí es el cronómetro.
        <div className="mt-3">
          <WorkTimer
            targetSeconds={exercise.targetDurationSeconds ?? null}
            onAccept={(seconds) => onDuration?.(exercise.name, seconds)}
          />
        </div>
      ) : advice ? (
        <div className="mt-3">
          <div className="label-caps text-fg-subtle">{t('routine.session_recommended_weight')}</div>
          {/* El peso es el dato protagonista de la tarjeta: es la decisión que
              hay que tomar al abrir el plan. Por eso va grande y sin marco, y lo
              que lo acompaña se apila debajo en lugar de competir en la misma
              línea. */}
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-data font-display font-bold text-fg tabular">
              {weightToInput(advice.suggestion.weight, weightUnit)} {weightUnit}
            </span>
            <span className="label-caps inline-flex items-center gap-1.5 text-fg-muted">
              {AdviceIcon && <AdviceIcon className="w-3.5 h-3.5" aria-hidden="true" />}
              {t(`coach.action.${advice.suggestion.action}`)}
            </span>
          </div>
          {/* De dónde se viene y cuán segura es la lectura. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs text-fg-muted tabular">
              {t('coach.last_label')} · {weightToInput(advice.suggestion.baseWeight, weightUnit)}{' '}
              {weightUnit} × {advice.suggestion.baseReps}
            </span>
            <span className="text-xs text-fg-subtle">
              {t(`coach.confidence_${advice.suggestion.confidence}`)}
            </span>
          </div>
          {/* El porqué de la propuesta: es la indicación que decide si el plan se
              sigue a ciegas o se corrige. */}
          <p className="mt-2.5 text-sm leading-relaxed text-fg-muted">
            {t(advice.suggestion.reasonKey)}
          </p>
          {advice.stall?.stalled && (
            <p className="mt-2 flex gap-1.5 text-xs text-fg-muted">
              <AlertTriangle
                className="w-3.5 h-3.5 flex-shrink-0 text-warning"
                aria-hidden="true"
              />
              <span>{t(`coach.stall.cause_${advice.stall.causeKey}`)}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-fg-muted">{t('routine.session_no_recommendation')}</p>
      )}

      {/* El plan. Una fila por serie obligaba a leer cinco líneas para sacar una
          idea —«son tres veces ocho»— y escondía lo único que de verdad decide la
          sesión: por dónde se entra y por dónde se sale.

          La escalera se dibuja a escala en vez de contarse. Es una progresión de
          verdad, y una progresión se lee de un vistazo: el borde derecho de las
          barras crece y termina en el color del acento. La frase de arriba ya
          dice el peso de trabajo, así que la tercera línea que había abajo
          («termina las series a 85 kg») solo repetía ese número. */}
      {!esPorTiempo && escalera.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="label-caps text-fg-subtle">{t('routine.session_plan_verb')}</div>
          <p className="mt-1 font-display text-2xl leading-tight text-fg tabular">
            {t('routine.session_plan_body', {
              sets: String(exercise.sets.length),
              reps: repsDelPlan,
              weight: weightToInput(advice?.suggestion.weight ?? 0, weightUnit),
              unit: weightUnit,
            })}
          </p>

          <ul className="mt-2.5 space-y-1.5">
            {escalera.map((paso, i) => {
              const esTrabajo = i === escalera.length - 1;
              return (
                <li key={`${paso.weight}-${paso.reps}`} className="flex items-center gap-2.5">
                  {/* La cifra en columna fija: los números se comparan en vertical
                      sin tener que cazarlos en una línea de texto. */}
                  <span
                    className={`w-[4.75rem] flex-shrink-0 text-right text-xs tabular ${
                      esTrabajo ? 'font-semibold text-fg' : 'text-fg-muted'
                    }`}
                  >
                    {weightToInput(paso.weight, weightUnit)} {weightUnit}
                    <span className="text-fg-subtle"> ×{paso.reps}</span>
                  </span>
                  {/* Pista y relleno. La pista es decorado: los números de al
                      lado ya se leen solos, así que el lector de pantalla no
                      necesita oír «barra al 38 %». */}
                  <span aria-hidden="true" className="h-2 flex-1 rounded-sm bg-surface-2">
                    <span
                      className={`block h-full rounded-sm transition-[width] duration-300 motion-reduce:transition-none ${
                        esTrabajo ? 'bg-accent' : 'bg-fg-subtle/45'
                      }`}
                      style={{
                        // El mínimo evita que un peldaño muy ligero se vuelva
                        // invisible en un peso bajísimo.
                        width: `${Math.max(4, (paso.weight / escalera[escalera.length - 1].weight) * 100)}%`,
                      }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-2 text-xs leading-relaxed text-fg-subtle">
            {escalera.length > 1
              ? t('routine.session_warmup_caption')
              : t('routine.session_no_warmup')}
          </p>
        </div>
      )}

      {/* El ajuste fino vive detrás de un botón. No desaparece: es lo que impide
          que la app guarde su propia recomendación como si fuera el
          entrenamiento. Solo deja de ocupar la pantalla cuando nadie lo pide. */}
      {!esPorTiempo && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setAjustando((v) => !v)}
            aria-expanded={ajustando}
            className="label-caps flex min-h-11 items-center gap-1.5 text-fg-muted active:opacity-60"
          >
            {t('routine.session_adjust_sets')}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${ajustando ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {ajustando && (
            <>
              <ul className="border-t border-line">
                {exercise.sets.map((serie, i) => {
                  const abierta = serieAbierta === i;
                  return (
                    <li key={serie.id} className="border-b border-line last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setSerieAbierta(abierta ? null : i)}
                        aria-expanded={abierta}
                        className="flex min-h-11 w-full items-center gap-3 py-1 text-left"
                      >
                        <span className="label-caps w-4 flex-shrink-0 text-fg-subtle tabular">
                          {i + 1}
                        </span>
                        <span className="flex-1 text-sm text-fg tabular">
                          {/* Un guion, no la unidad: la fila «1 kg × 3» se lee como
                              «un kilo por tres», que es justo lo contrario de lo
                              que significa. El guion dice «aquí va el peso» y no
                          inventa un número. */}
                          {serie.weight || <span className="text-fg-subtle">—</span>}
                          {serie.reps ? ` × ${serie.reps}` : ''}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 flex-shrink-0 text-fg-subtle transition-transform ${
                            abierta ? 'rotate-180' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </button>

                      {abierta && (
                        <div className="flex items-center gap-2 pb-2.5">
                          <label className="min-w-0 flex-1">
                            <span className="sr-only">
                              {t('routine.session_reps_of_set', { n: i + 1 })}
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              placeholder={t('workout.reps')}
                              value={serie.reps}
                              onChange={(e) =>
                                updateSet(exerciseIndex, i, {
                                  reps: e.target.value.replace(/[^\d]/g, ''),
                                })
                              }
                              className="w-full min-h-11 rounded-sm border border-line bg-surface px-2 text-center text-base text-fg tabular outline-none focus:border-accent"
                            />
                          </label>
                          <span className="text-fg-subtle" aria-hidden="true">
                            ×
                          </span>
                          <label className="min-w-0 flex-1">
                            <span className="sr-only">
                              {t('routine.session_weight_of_set', { n: i + 1 })}
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder={weightUnit}
                              value={serie.weight}
                              onChange={(e) =>
                                updateSet(exerciseIndex, i, {
                                  weight: e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'),
                                  // A partir de aquí la fila es del usuario: la
                                  // recomendación ya no la vuelve a pisar.
                                  weightTouched: true,
                                })
                              }
                              className="w-full min-h-11 rounded-sm border border-line bg-surface px-2 text-center text-base text-fg tabular outline-none focus:border-accent"
                            />
                          </label>
                          {exercise.sets.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                removeSet(exerciseIndex, i);
                                setSerieAbierta(null);
                              }}
                              aria-label={t('routine.session_remove_set', { n: i + 1 })}
                              className="flex h-11 w-9 flex-shrink-0 items-center justify-center rounded-sm text-fg-subtle active:opacity-60"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                onClick={() => addSet(exerciseIndex)}
                className="label-caps mt-2 flex min-h-11 items-center gap-1.5 text-fg-muted active:opacity-60"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {t('routine.session_add_set')}
              </button>
            </>
          )}

          {/* RPE del ejercicio. Es la señal que enciende la autorregulación: sin
              ella el motor cae al respaldo de doble progresión y la descarga no
              se propone nunca, suba lo que suba el volumen. Por eso vive aquí,
              a la vista, y no escondido detrás de «Ajustar series»: eso no es una
              corrección de la app, es una respuesta del usuario. */}
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="label-caps text-fg-subtle">{t('workout.rpe_label')}</span>
              <span className="text-xs text-fg-subtle">{t('workout.rpe_optional')}</span>
            </div>
            <div className="mt-1.5 flex gap-1" role="group" aria-label={t('workout.rpe_label')}>
              {RPE_OPTIONS.map((value) => {
                const on = rpeActual === value;
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setExerciseRpe(exerciseIndex, on ? '' : value)}
                    aria-pressed={on}
                    aria-label={t('workout.rpe_option', { value })}
                    className={`min-h-11 min-w-11 flex-1 rounded-sm border text-sm font-medium tabular transition-colors ${
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
        </div>
      )}

      {description && (
        <div className="mt-3 border-t border-line pt-1">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            aria-expanded={showForm}
            className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
          >
            <span className="label-caps inline-flex items-center gap-1.5 text-fg-muted">
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              {t('routine.session_how_to')}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-fg-subtle transition-transform ${showForm ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
          {showForm && <p className="pb-2 text-sm leading-relaxed text-fg-muted">{description}</p>}
        </div>
      )}
    </div>
  );
}
