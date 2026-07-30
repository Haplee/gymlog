import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useRoutineStore, dayLabels } from '@features/routine/stores/routineStore';
import { Layout } from '@app/components/Layout';
import type { Routine, DayOfWeek, RoutineExercise } from '@features/routine/stores/routineStore';
import { fetchExercises } from '@shared/api/queries';
import type { Exercise } from '@shared/lib/types';
import { SortableExerciseList } from '@features/routine/components/SortableExerciseList';
import { RoutineSession } from '@features/routine/components/RoutineSession';
import { useRoutineSessionStore } from '@features/routine/stores/routineSessionStore';
import { Chip, SectionHeader, BottomSheet } from '@shared/components/ui';
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
      getDayName: s.getDayName,
    })),
  );

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises', user?.id],
    queryFn: () => fetchExercises(user?.id),
    enabled: !!user?.id,
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

  // El guardado remoto fallaba en silencio: la rutina quedaba solo en local y
  // desaparecía en la siguiente carga. Ahora se avisa al usuario.
  const persistRoutines = useCallback(async () => {
    if (!user) return;
    const ok = await useRoutineStore.getState().saveToDb(user.id);
    if (!ok) toast.error(t('routine.save_failed'));
  }, [user, t]);

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
    if (confirm(t('routine.delete_confirm'))) {
      deleteRoutine(id);
      void persistRoutines();
    }
  };

  const addExerciseToDay = (day: DayOfWeek, exerciseName: string) => {
    if (!activeRoutine) return;

    const updatedDays = { ...activeRoutine.days };
    updatedDays[day] = {
      ...updatedDays[day],
      exercises: [...updatedDays[day].exercises, { name: exerciseName, sets: 3, reps: '10-12' }],
    };

    useRoutineStore.getState().updateRoutine(activeRoutine.id, { days: updatedDays });

    void persistRoutines();
  };

  const handleExerciseSelected = (exerciseId: string) => {
    const cached = queryClient.getQueryData<Exercise[]>(['exercises', user?.id]) ?? exercises;
    const exercise = cached.find((e) => e.id === exerciseId);
    if (!exercise) return;
    addExerciseToDay(selectedDay, exercise.name);
    setShowExercisePicker(false);
  };

  const removeExerciseFromDay = (day: DayOfWeek, index: number) => {
    if (!activeRoutine) return;

    const updatedDays = { ...activeRoutine.days };
    updatedDays[day] = {
      ...updatedDays[day],
      exercises: updatedDays[day].exercises.filter((_, i) => i !== index),
    };

    useRoutineStore.getState().updateRoutine(activeRoutine.id, { days: updatedDays });

    void persistRoutines();
  };

  const reorderDay = (day: DayOfWeek, next: RoutineExercise[]) => {
    if (!activeRoutine) return;

    const updatedDays = { ...activeRoutine.days };
    updatedDays[day] = { ...updatedDays[day], exercises: next };

    useRoutineStore.getState().updateRoutine(activeRoutine.id, { days: updatedDays });

    void persistRoutines();
  };

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
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-data font-display font-bold text-fg">{activeRoutine?.name}</div>
              <div className="text-xs text-fg-subtle">{activeRoutine?.description}</div>
            </div>
            <button
              type="button"
              onClick={() => setActiveRoutine(null)}
              className="label-caps min-h-11 px-3 py-1.5 rounded-pill bg-surface-2 text-fg-muted"
            >
              {t('routine.change')}
            </button>
          </div>

          {todayRoutine && todayRoutine.exercises.length > 0 && (
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

          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
            {DAYS.map((day) => (
              <Chip
                key={day}
                variant="day"
                selected={selectedDay === day}
                onClick={() => setSelectedDay(day)}
              >
                {dayLabels[day].slice(0, 3)}
              </Chip>
            ))}
          </div>

          <div className="rounded-card p-3 bg-surface border border-line">
            <div className="dotted-separator flex justify-between items-center pb-2 mb-3">
              <div className="label-caps text-fg-subtle">{dayLabels[selectedDay]}</div>
              {activeRoutine?.isCustom && (
                <button
                  type="button"
                  onClick={() => setShowExercisePicker(true)}
                  className="min-h-11 text-xs px-2.5 py-1.5 rounded-pill bg-surface-2 text-accent"
                >
                  {t('routine.add_exercise')}
                </button>
              )}
            </div>

            {activeRoutine?.days[selectedDay].exercises.length === 0 ? (
              <div className="text-center py-6 text-xs text-fg-subtle">
                {activeRoutine?.isCustom ? t('routine.empty_custom_day') : t('routine.rest_day')}
              </div>
            ) : activeRoutine?.isCustom ? (
              <SortableExerciseList
                exercises={activeRoutine.days[selectedDay].exercises}
                onReorder={(next) => reorderDay(selectedDay, next)}
                onRemove={(i) => removeExerciseFromDay(selectedDay, i)}
              />
            ) : (
              <div>
                {activeRoutine?.days[selectedDay].exercises.map((ex, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-1 py-3.5 ${
                      i < activeRoutine.days[selectedDay].exercises.length - 1
                        ? 'dotted-separator'
                        : ''
                    }`}
                  >
                    <div className="text-base font-medium text-fg">{ex.name}</div>
                    {ex.sets && (
                      <div className="font-display font-bold text-sm tabular text-fg-muted">
                        {ex.sets} × {ex.reps}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {activeRoutine && activeRoutine.days[selectedDay].exercises.length > 0 && (
            <button
              type="button"
              onClick={() =>
                startSession(activeRoutine, selectedDay, activeRoutine.days[selectedDay])
              }
              className="w-full mt-4 min-h-12 rounded-pill text-sm font-display font-bold uppercase tracking-[0.12em] bg-accent text-accent-fg shadow-btn-accent active:scale-[0.98] transition-transform"
            >
              {t('routine.start_session')}
            </button>
          )}

          {activeRoutine?.isCustom && (
            <button
              type="button"
              onClick={() => handleDeleteRoutine(activeRoutine.id)}
              className="mt-4 min-h-11 label-caps text-error"
            >
              {t('routine.delete_routine')}
            </button>
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
        >
          <ExerciseSelector
            userId={user.id}
            onSelect={handleExerciseSelected}
            excludeIds={exercises
              .filter((e) =>
                activeRoutine.days[selectedDay].exercises.some((ex) => ex.name === e.name),
              )
              .map((e) => e.id)}
          />
        </BottomSheet>
      )}
    </Layout>
  );
}
