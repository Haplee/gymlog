import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@features/auth/stores/authStore';
import { useRoutineStore, dayLabels } from '@features/routine/stores/routineStore';
import { Layout } from '@app/components/Layout';
import type { Routine, DayOfWeek } from '@features/routine/stores/routineStore';
import { fetchExercises } from '@shared/api/queries';

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
    deleteRoutine,
    loadFromDb,
    checkAndBackup,
    getActiveRoutine,
    getTodayRoutine,
    getDayName,
  } = useRoutineStore();

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises', user?.id],
    queryFn: () => fetchExercises(user!.id),
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

  const handleCreateRoutine = () => {
    if (!newRoutineName.trim()) return;

    const newRoutine: Routine = {
      id: `custom-${Date.now()}`,
      name: newRoutineName,
      description: newRoutineDesc || 'Rutina personalizada',
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
    if (confirm('¿Eliminar esta rutina?')) {
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
                onClick={() => handleSelectRoutine(routine.id)}
                className="p-4 rounded-2xl cursor-pointer transition-all active:scale-[0.99]"
                style={{
                  backgroundColor: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-glass)',
                  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset',
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-base font-semibold text-fg">{routine.name}</div>
                    <div className="text-xs mt-0.5 text-fg-subtle">{routine.description}</div>
                  </div>
                  {!routine.isCustom && (
                    <span
                      className="text-[0.5625rem] px-2 py-1 rounded-pill font-bold uppercase tracking-wide"
                      style={{
                        backgroundColor: 'rgba(200,255,0,0.08)',
                        color: 'var(--interactive-primary)',
                        border: '1px solid rgba(200,255,0,0.15)',
                      }}
                    >
                      Predefinida
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="w-full mt-4 py-3 rounded-lg font-medium"
            style={{
              backgroundColor: 'var(--interactive-primary)',
              color: 'var(--interactive-primary-fg)',
            }}
          >
            + Crear rutina personalizada
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
            <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'rgba(200,255,0,0.1)' }}>
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
                  <option value="">+ Añadir</option>
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
                {activeRoutine?.isCustom
                  ? 'Añade ejercicios con el selector de arriba'
                  : 'Descanso'}
              </div>
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
                    {activeRoutine?.isCustom && (
                      <button
                        onClick={() => removeExerciseFromDay(selectedDay, i)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-lg text-fg-subtle"
                      >
                        ×
                      </button>
                    )}
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
              Eliminar rutina
            </button>
          )}
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="rounded-xl p-4 w-full max-w-sm bg-surface">
            <div className="text-lg font-bold mb-4 text-fg">Nueva Rutina</div>

            <input
              type="text"
              placeholder="Nombre"
              value={newRoutineName}
              onChange={(e) => setNewRoutineName(e.target.value)}
              className="w-full p-2 rounded-lg text-sm mb-2 bg-surface-2 border border-line-strong text-fg"
            />

            <input
              type="text"
              placeholder="Descripción (opcional)"
              value={newRoutineDesc}
              onChange={(e) => setNewRoutineDesc(e.target.value)}
              className="w-full p-2 rounded-lg text-sm mb-4 bg-surface-2 border border-line-strong text-fg"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 rounded-lg text-sm bg-surface-2 text-fg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateRoutine}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{
                  backgroundColor: 'var(--interactive-primary)',
                  color: 'var(--interactive-primary-fg)',
                }}
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
