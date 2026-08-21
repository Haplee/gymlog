import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useRoutineStore, dayLabels } from '@features/routine/stores/routineStore';
import { useRoutineSessionStore } from '@features/routine/stores/routineSessionStore';
import { useProgressionStore } from '@features/routine/stores/progressionStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { Layout } from '@app/components/Layout';
import type {
  Routine,
  DayOfWeek,
  DayRoutine,
  RoutineExercise,
} from '@features/routine/stores/routineStore';
import { fetchExercises, fetchRecentSets } from '@shared/api/queries';
import { useWeight } from '@shared/hooks/useWeight';
import { isBodyweightLoad } from '@shared/lib/loadType';
import { normalizeExerciseName } from '@shared/lib/progressionCycle';
import { weightToInput } from '@shared/lib/weight';
import type { Exercise } from '@shared/lib/types';
import { SortableExerciseList } from '@features/routine/components/SortableExerciseList';
import { RoutineSession } from '@features/routine/components/RoutineSession';
import { Chip, SectionHeader, BottomSheet, ConfirmDialog } from '@shared/components/ui';
import { EmptyState } from '@shared/components/EmptyStates';
import { CoachSuggestionBanner } from '@features/coach/components/CoachSuggestionBanner';
import { ExerciseSelector } from '@shared/components/ExerciseSelector';

const DAYS = Object.keys(dayLabels) as DayOfWeek[];

export function RoutinePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const routines = useRoutineStore((s) => s.routines);
  const activeRoutineId = useRoutineStore((s) => s.activeRoutineId);
  const {
    setActiveRoutine,
    addRoutine,
    cloneRoutine,
    deleteRoutine,
    loadFromDb,
    checkAndBackup,
    getActiveRoutine,
    getTodayRoutine,
    getDayName,
    getSourceDay,
    getRoutineDay,
    moveRoutineDay,
    resetWeekPlan,
  } = useRoutineStore(
    useShallow((s) => ({
      setActiveRoutine: s.setActiveRoutine,
      addRoutine: s.addRoutine,
      cloneRoutine: s.cloneRoutine,
      deleteRoutine: s.deleteRoutine,
      loadFromDb: s.loadFromDb,
      checkAndBackup: s.checkAndBackup,
      getActiveRoutine: s.getActiveRoutine,
      getTodayRoutine: s.getTodayRoutine,
      getSourceDay: s.getSourceDay,
      getRoutineDay: s.getRoutineDay,
      moveRoutineDay: s.moveRoutineDay,
      resetWeekPlan: s.resetWeekPlan,
      getDayName: s.getDayName,
    })),
  );

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises', user?.id],
    queryFn: () => fetchExercises(user?.id),
    enabled: !!user?.id,
  });

  const { unit: weightUnit } = useWeight();
  const autoFillWeights = useSettingsStore((s) => s.autoFillWeights);
  // Series recientes (con el nombre del ejercicio) para el auto-relleno: con
  // solo recorrerlas en orden se saca el último peso usado de cada ejercicio.
  const { data: recentSets = [] } = useQuery({
    queryKey: ['recentSets', user?.id],
    queryFn: () => fetchRecentSets(user?.id ?? ''),
    enabled: !!user?.id && autoFillWeights,
    staleTime: 1000 * 60 * 5,
  });

  const startSession = useRoutineSessionStore((s) => s.start);
  const sessionStartedAt = useRoutineSessionStore((s) => s.startedAt);
  const sessionExerciseCount = useRoutineSessionStore((s) => s.exercises.length);
  const sessionActive = sessionStartedAt !== null && sessionExerciseCount > 0;

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getDayName());
  const [showCreate, setShowCreate] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineDesc, setNewRoutineDesc] = useState('');
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);
  /** Id de la rutina pendiente de confirmar su borrado; null = nada que borrar. */
  const [routineToDelete, setRoutineToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadFromDb(user.id);
    checkAndBackup(user.id);
  }, [user, navigate, loadFromDb, checkAndBackup]);

  const activeRoutine = getActiveRoutine();
  const todayRoutine = getTodayRoutine();

  // Suscribirse al plan (y no solo leerlo con el getter) es lo que hace que la
  // pantalla se repinte al mover un dia.
  const weekPlan = useRoutineStore((s) => s.weekPlan);
  const planMap = useRoutineStore.getState().getWeekPlan()?.map ?? null;
  void weekPlan;

  /**
   * Dia de la rutina cuyo contenido se ve en el dia seleccionado. Con la semana
   * reorganizada no coinciden: el viernes puede estar enseñando el lunes, y
   * editar ahi tiene que escribir en el lunes de la rutina, no crear una copia.
   * `null` = este dia quedo libre al mover su entreno a otro sitio.
   */
  const sourceDay = getSourceDay(selectedDay);
  const dayRoutine = getRoutineDay(selectedDay);
  const dayExercises = dayRoutine?.exercises ?? [];
  const movedFrom = sourceDay !== null && sourceDay !== selectedDay ? sourceDay : null;

  // El guardado remoto fallaba en silencio: la rutina quedaba solo en local y
  // desaparecía en la siguiente carga. Ahora se avisa al usuario.
  const persistRoutines = useCallback(async () => {
    if (!user) return;
    const ok = await useRoutineStore.getState().saveToDb(user.id);
    if (!ok) toast.error(t('routine.save_failed'));
  }, [user, t]);

  /**
   * Mover el entreno del dia visible a otro dia de esta semana. La rutina no se
   * toca: lo que cambia es el plan de la semana, que caduca solo el lunes.
   */
  const handleMoveDay = (to: DayOfWeek) => {
    moveRoutineDay(selectedDay, to);
    setShowMovePicker(false);
    setSelectedDay(to);
    void persistRoutines();
    toast.success(t('routine.move_done', { day: dayLabels[to] }));
  };

  const handleRestoreWeek = () => {
    resetWeekPlan();
    void persistRoutines();
    toast.success(t('routine.week_restored'));
  };

  const handleSelectRoutine = (routineId: string) => {
    setActiveRoutine(routineId);
    void persistRoutines();
  };

  const handleUseAsTemplate = (e: React.MouseEvent, routineId: string) => {
    e.stopPropagation();
    const newId = cloneRoutine(routineId);
    if (!newId) return;
    setActiveRoutine(newId);
    void persistRoutines();
    toast.success(t('routine.cloned'));
  };

  const handleCreateRoutine = () => {
    if (!newRoutineName.trim()) return;

    const newRoutine: Routine = {
      id: `custom-${Date.now()}`,
      name: newRoutineName,
      description: newRoutineDesc || t('routine.custom_default_desc'),
      isCustom: true,
      createdAt: new Date().toISOString(),
      days: {
        monday: { name: 'Lunes', exercises: [] },
        tuesday: { name: 'Martes', exercises: [] },
        wednesday: { name: 'Miércoles', exercises: [] },
        thursday: { name: 'Jueves', exercises: [] },
        friday: { name: 'Viernes', exercises: [] },
        saturday: { name: 'Sábado', exercises: [] },
        sunday: { name: 'Domingo', exercises: [] },
      },
    };

    addRoutine(newRoutine);
    setActiveRoutine(newRoutine.id);
    setNewRoutineName('');
    setNewRoutineDesc('');
    setShowCreate(false);

    void persistRoutines();
  };

  const handleDeleteRoutine = (id: string) => {
    deleteRoutine(id);
    setRoutineToDelete(null);
    void persistRoutines();
  };

  // Las plantillas no se pueden guardar en la nube tal cual: editar una la
  // convierte automáticamente en rutina propia para que el cambio no se pierda
  // al reiniciar la app.
  const ensureEditableRoutine = useCallback((): string | null => {
    const store = useRoutineStore.getState();
    const routine = store.getActiveRoutine();
    if (!routine) return null;
    if (routine.isCustom) return routine.id;

    const newId = store.cloneRoutine(routine.id);
    if (!newId) return null;
    store.setActiveRoutine(newId);
    toast.success(t('routine.cloned'));
    void persistRoutines();
    return newId;
  }, [t, persistRoutines]);

  const addExerciseToDay = (day: DayOfWeek, exerciseName: string) => {
    const editableId = ensureEditableRoutine();
    if (!editableId) return;

    const routine = useRoutineStore.getState().routines.find((r) => r.id === editableId);
    if (!routine) return;

    const updatedDays = { ...routine.days };
    updatedDays[day] = {
      ...updatedDays[day],
      exercises: [...updatedDays[day].exercises, { name: exerciseName, sets: 3, reps: '10-12' }],
    };

    useRoutineStore.getState().updateRoutine(editableId, { days: updatedDays });

    void persistRoutines();
  };

  const handleExerciseSelected = (exerciseId: string) => {
    const cached = queryClient.getQueryData<Exercise[]>(['exercises', user?.id]) ?? exercises;
    const exercise = cached.find((e) => e.id === exerciseId);
    if (!exercise) return;
    addExerciseToDay(sourceDay ?? selectedDay, exercise.name);
    setShowExercisePicker(false);
  };

  const removeExerciseFromDay = (day: DayOfWeek, index: number) => {
    const editableId = ensureEditableRoutine();
    if (!editableId) return;

    const routine = useRoutineStore.getState().routines.find((r) => r.id === editableId);
    if (!routine) return;

    const updatedDays = { ...routine.days };
    updatedDays[day] = {
      ...updatedDays[day],
      exercises: updatedDays[day].exercises.filter((_, i) => i !== index),
    };

    useRoutineStore.getState().updateRoutine(editableId, { days: updatedDays });

    void persistRoutines();
  };

  const reorderDay = (day: DayOfWeek, next: RoutineExercise[]) => {
    const editableId = ensureEditableRoutine();
    if (!editableId) return;

    const routine = useRoutineStore.getState().routines.find((r) => r.id === editableId);
    if (!routine) return;

    const updatedDays = { ...routine.days };
    updatedDays[day] = { ...updatedDays[day], exercises: next };

    useRoutineStore.getState().updateRoutine(editableId, { days: updatedDays });

    void persistRoutines();
  };

  // Auto-relleno: precarga en cada ejercicio el peso que sugiere el ciclo de
  // progresión (carga de trabajo actual, con la reducción de descarga si toca).
  // Sin ciclo todavía, usa el último peso registrado de la última sesión. En
  // peso corporal no se rellena carga: solo las reps, que ya van de la plantilla.
  const buildPrefills = useCallback(
    (routine: Routine, day: DayOfWeek): Record<string, string> => {
      const prefills: Record<string, string> = {};
      if (!autoFillWeights || !user) return prefills;

      const lastByExercise = new Map<string, number>();
      for (const s of recentSets) {
        const name = s.exercise?.name;
        if (!name || s.is_warmup || !Number.isFinite(s.weight) || s.weight <= 0) continue;
        const key = normalizeExerciseName(name);
        if (!lastByExercise.has(key)) lastByExercise.set(key, s.weight);
      }

      const catalogByName = new Map(exercises.map((e) => [normalizeExerciseName(e.name), e]));

      for (const ex of routine.days[day].exercises) {
        const key = normalizeExerciseName(ex.name);
        const isBodyweight = isBodyweightLoad(catalogByName.get(key)?.load_type);
        if (isBodyweight) continue;
        const weight = useProgressionStore
          .getState()
          .prefillWeightFor(ex.name, lastByExercise.get(key) ?? null);
        if (weight === null || weight <= 0) continue;
        prefills[key] = weightToInput(weight, weightUnit);
      }
      return prefills;
    },
    [autoFillWeights, user, recentSets, exercises, weightUnit],
  );

  const handleStartSession = useCallback(
    (routine: Routine, day: DayOfWeek, dayRoutine: DayRoutine) => {
      const prefills = buildPrefills(routine, day);
      startSession(routine, day, dayRoutine, prefills);
    },
    [buildPrefills, startSession],
  );

  return (
    <Layout>
      {/* Solo aparece si se ha llegado aquí desde «Aplicar» en el entrenador. */}
      <CoachSuggestionBanner />

      {sessionActive && user ? (
        <RoutineSession userId={user.id} exercises={exercises} />
      ) : !activeRoutineId ? (
        <>
          <SectionHeader title={t('routine.select')} />

          <div className="space-y-3">
            {routines.map((routine) => (
              <div
                key={routine.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectRoutine(routine.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectRoutine(routine.id);
                  }
                }}
                className="p-4 rounded-card cursor-pointer transition-all active:scale-[0.99] bg-surface border border-line"
              >
                {!routine.isCustom && (
                  <span className="label-caps inline-block px-1.5 py-0.5 mb-2 rounded-pill bg-surface-3 text-fg-muted">
                    {t('routine.predefined')}
                  </span>
                )}
                <div className="flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <div className="text-data font-display font-bold text-fg">{routine.name}</div>
                    <div className="text-xs mt-1 text-fg-subtle">{routine.description}</div>
                  </div>
                  {!routine.isCustom && (
                    <button
                      type="button"
                      onClick={(e) => handleUseAsTemplate(e, routine.id)}
                      className="flex-shrink-0 min-h-11 label-caps px-3 py-1.5 rounded-pill bg-surface-2 text-accent active:scale-[0.98] transition-transform"
                    >
                      {t('routine.use_template')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="w-full mt-5 min-h-12 rounded-pill text-sm font-display font-bold uppercase tracking-[0.12em] bg-accent text-accent-fg shadow-btn-accent active:scale-[0.98] transition-transform"
          >
            {t('routine.create_custom')}
          </button>
        </>
      ) : (
        <>
          {/* `items-start` y no `items-center`: con una descripción de cuatro
              líneas, "Cambiar" quedaba flotando a media altura del párrafo en
              vez de emparejado con el nombre de la rutina, que es a lo que se
              refiere. `min-w-0` para que un nombre largo trunque en vez de
              empujar al botón fuera. */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="text-data font-display font-bold text-fg">{activeRoutine?.name}</div>
              <div className="text-xs text-fg-subtle">{activeRoutine?.description}</div>
            </div>
            <button
              type="button"
              onClick={() => setActiveRoutine(null)}
              className="label-caps min-h-11 flex-shrink-0 px-3 py-1.5 rounded-pill bg-surface-2 text-fg-muted"
            >
              {t('routine.change')}
            </button>
          </div>

          {/* Solo cuando se está mirando otro día. Con el día de hoy seleccionado
              —que es como abre la pantalla— esta tarjeta repetía exactamente la
              lista de ejercicios que hay dos bloques más abajo, con un tinte de
              acento encima para llamar la atención sobre algo ya visible. Su
              trabajo es recordarte qué toca hoy cuando te has ido a hojear el
              jueves; hoy mismo no tiene nada que contar. */}
          {todayRoutine && todayRoutine.exercises.length > 0 && selectedDay !== getDayName() && (
            <div className="mb-4 p-3 rounded-md bg-accent/10 border border-line-accent">
              <div className="label-caps mb-2 text-accent">
                {t('routine.today')} — {todayRoutine.name}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {todayRoutine.exercises.map((ex) => (
                  <span
                    key={ex.name}
                    className="text-xs px-2 py-1 rounded-pill bg-surface-2 text-fg"
                  >
                    {ex.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {planMap && (
            <div className="mb-3 p-3 rounded-md bg-surface-2 border border-line flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="label-caps text-fg">{t('routine.week_reorganized')}</div>
                <div className="text-xs mt-0.5 text-fg-subtle">
                  {t('routine.week_reorganized_desc')}
                </div>
              </div>
              <button
                type="button"
                onClick={handleRestoreWeek}
                className="flex-shrink-0 min-h-11 label-caps px-3 py-1.5 rounded-pill bg-surface-3 text-accent active:scale-[0.98] transition-transform"
              >
                {t('routine.week_restore')}
              </button>
            </div>
          )}

          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
            {DAYS.map((day) => {
              // Un punto marca los dias que esta semana no llevan lo suyo: sin
              // el, la barra L-D se ve igual con la semana movida y sin mover.
              const shifted = planMap != null && planMap[day] !== day;
              return (
                <Chip
                  key={day}
                  variant="day"
                  selected={selectedDay === day}
                  onClick={() => setSelectedDay(day)}
                  className="relative"
                >
                  {dayLabels[day].slice(0, 3)}
                  {shifted && (
                    <span
                      aria-hidden
                      className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-pill ${
                        selectedDay === day ? 'bg-accent-fg' : 'bg-accent'
                      }`}
                    />
                  )}
                </Chip>
              );
            })}
          </div>

          <div className="rounded-card p-3 bg-surface border border-line">
            <div className="hairline-separator flex justify-between items-center gap-2 pb-2 mb-3">
              <div className="min-w-0">
                <div className="label-caps text-fg-subtle">{dayLabels[selectedDay]}</div>
                {movedFrom && (
                  <div className="text-xs mt-0.5 text-accent">
                    {t('routine.moved_from', { day: dayLabels[movedFrom] })}
                  </div>
                )}
              </div>
              {dayExercises.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowMovePicker(true)}
                  className="flex-shrink-0 min-h-11 text-xs px-2.5 py-1.5 rounded-pill bg-surface-2 text-fg-muted"
                >
                  {t('routine.move_day')}
                </button>
              )}
              {/* Con el día vacío la acción ya la ofrece el estado vacío, en
                  grande y en el centro: repetirla aquí solo añade ruido. */}
              {activeRoutine && dayExercises.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowExercisePicker(true)}
                  className="min-h-11 text-xs px-2.5 py-1.5 rounded-pill bg-surface-2 text-fg-muted"
                >
                  {t('routine.add_exercise')}
                </button>
              )}
            </div>

            {sourceDay === null ? (
              <EmptyState
                type="routine"
                title={t('routine.day_freed')}
                description={t('routine.day_freed_desc')}
                action={{ label: t('routine.week_restore'), onClick: handleRestoreWeek }}
              />
            ) : dayExercises.length === 0 ? (
              // Antes era una línea de texto de 12 px en medio de una pantalla
              // medio vacía, y en las rutinas propias remataba mandando al
              // usuario a «el selector de arriba»: describía la acción en vez de
              // ofrecerla. Ahora el vacío se explica y trae su botón.
              activeRoutine?.isCustom ? (
                <EmptyState
                  type="workout"
                  title={t('routine.empty_custom_day')}
                  description={t('routine.empty_custom_day_desc')}
                  action={{
                    label: t('routine.add_exercise_full'),
                    onClick: () => setShowExercisePicker(true),
                  }}
                />
              ) : (
                <EmptyState
                  type="routine"
                  title={t('routine.rest_day')}
                  description={t('routine.rest_day_desc')}
                />
              )
            ) : activeRoutine ? (
              <SortableExerciseList
                exercises={dayExercises}
                onReorder={(next) => sourceDay && reorderDay(sourceDay, next)}
                onRemove={(i) => sourceDay && removeExerciseFromDay(sourceDay, i)}
              />
            ) : null}
          </div>

          {activeRoutine && dayRoutine && dayExercises.length > 0 && (
            <button
              type="button"
              onClick={() => handleStartSession(activeRoutine, selectedDay, dayRoutine)}
              className="w-full mt-4 min-h-12 rounded-pill text-sm font-display font-bold uppercase tracking-[0.12em] bg-accent text-accent-fg shadow-btn-accent active:scale-[0.98] transition-transform"
            >
              {t('routine.start_session')}
            </button>
          )}

          {/* Zona de peligro. Antes era un botón rojo suelto a 4 px del final del
              contenido, flotando en medio del vacío de la pantalla: parecía el
              siguiente paso, no el último recurso. Separado por una línea y con
              aire, se lee como pie de página. */}
          {activeRoutine?.isCustom && (
            <>
              <div className="hairline-separator mt-10" />
              <button
                type="button"
                onClick={() => setRoutineToDelete(activeRoutine.id)}
                className="mt-3 min-h-11 label-caps text-error"
              >
                {t('routine.delete_routine')}
              </button>
            </>
          )}
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="rounded-card p-4 w-full max-w-sm bg-surface border border-line">
            <div className="text-data font-display font-bold mb-4 text-fg">
              {t('routine.new_routine')}
            </div>

            <input
              type="text"
              placeholder={t('routine.name_placeholder')}
              value={newRoutineName}
              onChange={(e) => setNewRoutineName(e.target.value)}
              className="w-full p-2.5 rounded-sm text-sm mb-2 bg-surface-2 border border-line-strong text-fg placeholder:text-fg-subtle focus:border-accent outline-none"
            />

            <input
              type="text"
              placeholder={t('routine.desc_placeholder')}
              value={newRoutineDesc}
              onChange={(e) => setNewRoutineDesc(e.target.value)}
              className="w-full p-2.5 rounded-sm text-sm mb-4 bg-surface-2 border border-line-strong text-fg placeholder:text-fg-subtle focus:border-accent outline-none"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 min-h-11 rounded-pill text-sm bg-surface-2 text-fg-muted"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleCreateRoutine}
                className="flex-1 min-h-11 rounded-sm text-sm font-display font-bold uppercase tracking-[0.08em] bg-accent text-accent-fg"
              >
                {t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {user && activeRoutine && (
        <BottomSheet
          open={showExercisePicker}
          onClose={() => setShowExercisePicker(false)}
          title={t('routine.add_exercise')}
          maxHeightVh={95}
        >
          <ExerciseSelector
            userId={user.id}
            onSelect={handleExerciseSelected}
            defaultOpen
            excludeIds={exercises
              .filter((e) => dayExercises.some((ex) => ex.name === e.name))
              .map((e) => e.id)}
          />
        </BottomSheet>
      )}

      {activeRoutine && (
        <BottomSheet
          open={showMovePicker}
          onClose={() => setShowMovePicker(false)}
          title={t('routine.move_title', { name: dayRoutine?.name ?? '' })}
        >
          <div className="flex flex-col gap-2 pb-2">
            <p className="text-xs text-fg-subtle">{t('routine.move_help')}</p>
            {DAYS.filter((day) => day !== selectedDay).map((day) => {
              const target = getRoutineDay(day);
              const busy = (target?.exercises.length ?? 0) > 0;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleMoveDay(day)}
                  className="w-full min-h-12 px-3 py-2 rounded-md flex items-center justify-between gap-3 text-left bg-surface-2 border border-line active:scale-[0.99] transition-transform"
                >
                  <span className="text-sm font-medium text-fg">{dayLabels[day]}</span>
                  <span className="text-xs truncate text-fg-subtle">
                    {busy ? target?.name : t('routine.move_free')}
                  </span>
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}

      {/* El borrado usaba `confirm()` del navegador: en el WebView de Android eso
          abre un diálogo del sistema con la URL de la app en la cabecera, en el
          idioma del dispositivo y sin relación con el tema. */}
      <ConfirmDialog
        open={routineToDelete !== null}
        title={t('routine.delete_confirm')}
        description={t('routine.delete_confirm_desc')}
        confirmLabel={t('routine.delete_routine')}
        variant="danger"
        onConfirm={() => routineToDelete && handleDeleteRoutine(routineToDelete)}
        onCancel={() => setRoutineToDelete(null)}
      />
    </Layout>
  );
}
