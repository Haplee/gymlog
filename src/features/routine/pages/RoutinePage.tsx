import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useRoutineStore, dayLabels } from '@features/routine/stores/routineStore';
import { Layout } from '@app/components/Layout';
import type { Routine, DayOfWeek, RoutineExercise } from '@features/routine/stores/routineStore';
import { fetchExercises } from '@shared/api/queries';
import { SortableExerciseList } from '@features/routine/components/SortableExerciseList';

const DAYS = Object.keys(dayLabels) as DayOfWeek[];

export function RoutinePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    routines,
    activeRoutineId,
    setActiveRoutine,
    addRoutine,
    cloneRoutine,
    deleteRoutine,
    loadFromDb,
    checkAndBackup,
    getActiveRoutine,
    getTodayRoutine,
    getDayName,
  } = useRoutineStore();

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises', user?.id],
    queryFn: () => fetchExercises(user?.id),
    enabled: !!user?.id,
  });

  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getDayName());
  const [showCreate, setShowCreate] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineDesc, setNewRoutineDesc] = useState('');

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

  const handleSelectRoutine = (routineId: string) => {
    setActiveRoutine(routineId);
    if (user) {
      useRoutineStore.getState().saveToDb(user.id);
    }
  };

  const handleUseAsTemplate = (e: React.MouseEvent, routineId: string) => {
    e.stopPropagation();
    const newId = cloneRoutine(routineId);
    if (!newId) return;
    setActiveRoutine(newId);
    if (user) {
      useRoutineStore.getState().saveToDb(user.id);
    }
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

    if (user) {
      useRoutineStore.getState().saveToDb(user.id);
    }
  };

  const handleDeleteRoutine = (id: string) => {
    if (confirm(t('routine.delete_confirm'))) {
      deleteRoutine(id);
      if (user) {
        useRoutineStore.getState().saveToDb(user.id);
      }
    }
  };

  const exerciseNames = exercises.map((e) => e.name);

  const addExerciseToDay = (day: DayOfWeek, exerciseName: string) => {
    if (!activeRoutine) return;

    const updatedDays = { ...activeRoutine.days };
    updatedDays[day] = {
      ...updatedDays[day],
      exercises: [...updatedDays[day].exercises, { name: exerciseName, sets: 3, reps: '10-12' }],
    };

    useRoutineStore.getState().updateRoutine(activeRoutine.id, { days: updatedDays });

    if (user) {
      useRoutineStore.getState().saveToDb(user.id);
    }
  };

  const removeExerciseFromDay = (day: DayOfWeek, index: number) => {
    if (!activeRoutine) return;

    const updatedDays = { ...activeRoutine.days };
    updatedDays[day].exercises = updatedDays[day].exercises.filter((_, i) => i !== index);

    useRoutineStore.getState().updateRoutine(activeRoutine.id, { days: updatedDays });

    if (user) {
      useRoutineStore.getState().saveToDb(user.id);
    }
  };

  const reorderDay = (day: DayOfWeek, next: RoutineExercise[]) => {
    if (!activeRoutine) return;

    const updatedDays = { ...activeRoutine.days };
    updatedDays[day] = { ...updatedDays[day], exercises: next };

    useRoutineStore.getState().updateRoutine(activeRoutine.id, { days: updatedDays });

    if (user) {
      useRoutineStore.getState().saveToDb(user.id);
    }
  };

  return (
    <Layout>
      <div className="text-lg font-bold mb-4 text-accent">{t('routine.title')}</div>

      {!activeRoutineId ? (
        <>
          <div className="text-sm mb-3 text-fg-muted">{t('routine.select')}</div>

          <div className="space-y-2">
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
                className="p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.99] bg-surface-2 border border-line-glass shadow-card"
              >
                <div className="flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-fg">{routine.name}</div>
                    <div className="text-xs mt-0.5 text-fg-subtle">{routine.description}</div>
                  </div>
                  {!routine.isCustom && (
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="text-2xs px-2 py-1 rounded-pill font-bold uppercase tracking-wide bg-accent/10 text-accent border border-line-accent">
                        {t('routine.predefined')}
                      </span>
                      <button
                        onClick={(e) => handleUseAsTemplate(e, routine.id)}
                        className="min-h-11 text-xs px-3 py-1.5 rounded-lg font-medium bg-surface text-accent border border-line-glass active:scale-[0.98]"
                      >
                        {t('routine.use_template')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="w-full mt-4 py-3 rounded-lg font-semibold bg-accent text-accent-fg shadow-btn-accent active:scale-[0.98]"
          >
            {t('routine.create_custom')}
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-lg font-bold text-fg">{activeRoutine?.name}</div>
              <div className="text-xs text-fg-subtle">{activeRoutine?.description}</div>
            </div>
            <button
              onClick={() => setActiveRoutine(null)}
              className="text-sm px-3 py-1 rounded bg-surface-2 text-fg-muted"
            >
              {t('routine.change')}
            </button>
          </div>

          {todayRoutine && todayRoutine.exercises.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-accent/10 border border-line-accent">
              <div className="text-xs font-medium mb-2 text-accent">
                {t('routine.today')} - {todayRoutine.name}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {todayRoutine.exercises.map((ex, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded bg-surface-2 text-fg">
                    {ex.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-1 mb-3 overflow-x-auto">
            {DAYS.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg font-medium transition-all"
                style={{
                  backgroundColor:
                    selectedDay === day ? 'var(--interactive-primary)' : 'var(--bg-surface)',
                  color:
                    selectedDay === day ? 'var(--interactive-primary-fg)' : 'var(--text-secondary)',
                }}
              >
                {dayLabels[day].slice(0, 3)}
              </button>
            ))}
          </div>

          <div className="rounded-lg p-3 bg-surface">
            <div className="flex justify-between items-center mb-3">
              <div className="text-sm font-medium text-fg">{dayLabels[selectedDay]}</div>
              {activeRoutine?.isCustom && (
                <select
                  value=""
                  onChange={(e) => e.target.value && addExerciseToDay(selectedDay, e.target.value)}
                  className="text-xs p-1 rounded"
                  style={{
                    backgroundColor: 'var(--bg-surface-2)',
                    color: 'var(--interactive-primary)',
                    border: 'none',
                  }}
                >
                  <option value="">{t('routine.add_exercise')}</option>
                  {exerciseNames
                    .filter(
                      (name) =>
                        !activeRoutine.days[selectedDay].exercises.some((e) => e.name === name),
                    )
                    .map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>
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
              <div className="space-y-1.5">
                {activeRoutine?.days[selectedDay].exercises.map((ex, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-3 rounded-xl bg-surface-2 border border-line-glass"
                  >
                    <div>
                      <div className="text-base font-medium text-fg">{ex.name}</div>
                      {ex.sets && (
                        <div className="text-xs mt-0.5 text-fg-subtle">
                          {ex.sets} series × {ex.reps}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {activeRoutine?.isCustom && (
            <button
              onClick={() => handleDeleteRoutine(activeRoutine.id)}
              className="mt-4 text-sm text-error"
            >
              {t('routine.delete_routine')}
            </button>
          )}
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="rounded-xl p-4 w-full max-w-sm bg-surface">
            <div className="text-lg font-bold mb-4 text-fg">{t('routine.new_routine')}</div>

            <input
              type="text"
              placeholder={t('routine.name_placeholder')}
              value={newRoutineName}
              onChange={(e) => setNewRoutineName(e.target.value)}
              className="w-full p-2 rounded-lg text-sm mb-2 bg-surface-2 border border-line-strong text-fg"
            />

            <input
              type="text"
              placeholder={t('routine.desc_placeholder')}
              value={newRoutineDesc}
              onChange={(e) => setNewRoutineDesc(e.target.value)}
              className="w-full p-2 rounded-lg text-sm mb-4 bg-surface-2 border border-line-strong text-fg"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 rounded-lg text-sm bg-surface-2 text-fg-muted"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreateRoutine}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{
                  backgroundColor: 'var(--interactive-primary)',
                  color: 'var(--interactive-primary-fg)',
                }}
              >
                {t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
