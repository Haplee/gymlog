import { supabase } from './supabase';
import { notify } from './notifications';

export const checkWeeklySummary = async (userId: string) => {
  const now = new Date();

  // check if today is monday and time is >= 09:00
  if (now.getDay() !== 1 || now.getHours() < 9) return;

  // get ISO week year and number to form a unique key
  // Simple approximation for the previous week string
  const lastWeekDate = new Date(now);
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  // Get ISO week number
  const d = new Date(
    Date.UTC(lastWeekDate.getFullYear(), lastWeekDate.getMonth(), lastWeekDate.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  // Año ISO (el del jueves de esa semana), coherente con weekNo en el límite de año
  const isoYear = d.getUTCFullYear();

  const key = `weekly_summary_${isoYear}_${weekNo}`;
  if (localStorage.getItem(key)) return;

  // Fetch last week's workouts
  const startOfPreviousWeek = new Date(now);
  const daysSinceMondaySummary = now.getDay() === 0 ? 6 : now.getDay() - 1;
  startOfPreviousWeek.setDate(now.getDate() - daysSinceMondaySummary - 7); // Previous Monday
  startOfPreviousWeek.setHours(0, 0, 0, 0);

  const endOfPreviousWeek = new Date(startOfPreviousWeek);
  endOfPreviousWeek.setDate(endOfPreviousWeek.getDate() + 6);
  endOfPreviousWeek.setHours(23, 59, 59, 999);

  const { data: workouts } = await supabase
    .from('workouts')
    .select('id, total_volume, started_at')
    .eq('user_id', userId)
    .gte('started_at', startOfPreviousWeek.toISOString())
    .lte('started_at', endOfPreviousWeek.toISOString());

  if (!workouts || workouts.length === 0) {
    localStorage.setItem(key, 'true');
    return;
  }

  const totalSessions = workouts.length;
  const totalVolume = workouts.reduce((acc, w) => acc + (w.total_volume || 0), 0);

  // Approximate PRs (since we don't track historical PR events easily without querying all records,
  // we could just omit it or query personal_records within that date if achieved_at exists)
  const { count: prCount } = await supabase
    .from('personal_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('achieved_at', startOfPreviousWeek.toISOString())
    .lte('achieved_at', endOfPreviousWeek.toISOString());

  notify('📊 Tu semana en GymLog', {
    body: `${totalSessions} sesiones · ${Math.round(totalVolume)} kg movidos · ${prCount || 0} récords`,
    icon: '/icons/icon-192x192.png',
    url: '/stats',
  });

  localStorage.setItem(key, 'true');
};
