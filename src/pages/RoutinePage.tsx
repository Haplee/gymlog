import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useRoutineStore } from '../stores/routineStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { Layout } from '../components/Layout';

const DAYS = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
] as const;

export function RoutinePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { routine, setRoutine, saveToDb, loadFromDb, getTodayExercises, getDayName } = useRoutineStore();
  const { exercises, loadExercises } = useWorkoutStore();
  const [selectedDay, setSelectedDay] = useState(getDayName());
  const [newExercise, setNewExercise] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadExercises(user.id);
    loadFromDb(user.id);
  }, [user, navigate, loadExercises, loadFromDb]);

  const todayExercises = getTodayExercises();
  const todayKey = getDayName();
  const todayLabel = DAYS.find(d => d.key === todayKey)?.label || '';

  const availableExercises = exercises.map(e => e.name).filter(
    name => !routine[selectedDay].exercises.includes(name)
  );

  const addExercise = async () => {
    if (!newExercise) return;
    const updated = {
      ...routine,
      [selectedDay]: {
        exercises: [...routine[selectedDay].exercises, newExercise]
      }
    };
    setRoutine(updated);
    if (user) await saveToDb(user.id);
    setNewExercise('');
    setShowAdd(false);
  };

  const removeExercise = async (exercise: string) => {
    const updated = {
      ...routine,
      [selectedDay]: {
        exercises: routine[selectedDay].exercises.filter(e => e !== exercise)
      }
    };
    setRoutine(updated);
    if (user) await saveToDb(user.id);
  };

  return (
    <Layout>
      <div className="text-[1.2rem] font-extrabold mb-4" style={{ color: '#c8ff00' }}>Rutina Semanal</div>

      <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4 mb-4">
        <div className="text-[1rem] font-semibold mb-3" style={{ color: '#fafafa' }}>Hoy: {todayLabel}</div>
        {todayExercises.length === 0 ? (
          <div className="text-[#606068] text-center py-4">No hay ejercicios asignados</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {todayExercises.map((ex, i) => (
              <div 
                key={i} 
                className="bg-[#1c1c22] px-3 py-2 rounded-lg text-[0.9rem]"
                style={{ color: selectedDay === todayKey ? '#c8ff00' : '#a1a1aa' }}
              >
                {ex}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {DAYS.map(day => (
          <button
            key={day.key}
            onClick={() => setSelectedDay(day.key)}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-[0.85rem] font-semibold transition-all"
            style={{
              backgroundColor: selectedDay === day.key ? '#c8ff00' : '#141418',
              color: selectedDay === day.key ? '#0a0a0c' : '#a1a1aa',
              border: `1px solid ${selectedDay === day.key ? '#c8ff00' : 'rgba(255,255,255,0.06)'}`
            }}
          >
            {day.label}
          </button>
        ))}
      </div>

      <div className="bg-[#141418] border border-[rgba(255,255,255,0.06)] rounded-2xl p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="text-[1rem] font-semibold" style={{ color: '#fafafa' }}>
            Ejercicios - {DAYS.find(d => d.key === selectedDay)?.label}
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-[#c8ff00] text-[0.85rem] font-semibold"
          >
            + Añadir
          </button>
        </div>

        {showAdd && (
          <div className="mb-4 flex gap-2">
            <select
              value={newExercise}
              onChange={(e) => setNewExercise(e.target.value)}
              className="flex-1 bg-[#1c1c22] border border-[rgba(255,255,255,0.12)] rounded-lg text-white text-[0.95rem] p-2 outline-none"
            >
              <option value="">Seleccionar ejercicio</option>
              {availableExercises.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
            <button
              onClick={addExercise}
              className="px-4 py-2 bg-[#c8ff00] text-black rounded-lg font-semibold"
            >
              +
            </button>
          </div>
        )}

        {routine[selectedDay].exercises.length === 0 ? (
          <div className="text-[#606068] text-center py-4">Sin ejercicios</div>
        ) : (
          <div className="space-y-2">
            {routine[selectedDay].exercises.map((ex, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 bg-[#1c1c22] rounded-lg"
              >
                <span className="text-[0.95rem]" style={{ color: '#fafafa' }}>{ex}</span>
                <button
                  onClick={() => removeExercise(ex)}
                  className="text-[#606068] text-lg bg-transparent border-none cursor-pointer"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
