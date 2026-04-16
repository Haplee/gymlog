import { supabase } from './supabase';

export const checkStreakAtRisk = async (userId: string): Promise<boolean> => {
  const { data: workouts } = await supabase
    .from('workouts')
    .select('started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });

  if (!workouts || workouts.length === 0) return false;

  // Group by date string YYYY-MM-DD
  const dates = new Set<string>();
  workouts.forEach((w) => {
    if (w.started_at) {
      const d = new Date(w.started_at);
      dates.add(d.toISOString().split('T')[0]);
    }
  });

  const sortedDates = Array.from(dates).sort((a, b) => b.localeCompare(a));

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // si ya entrenó hoy, no hay riesgo
  if (sortedDates[0] === todayStr) return false;

  // calcular racha hasta ayer
  let streak = 0;
  const currentDate = new Date(today);
  currentDate.setDate(currentDate.getDate() - 1); // empezamos desde ayer

  while (true) {
    const dateStr = currentDate.toISOString().split('T')[0];
    if (dates.has(dateStr)) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }

  // está en riesgo si la racha hasta ayer es >= 3 y no ha entrenado hoy
  if (streak >= 3) {
    return true;
  }
  return false;
};
