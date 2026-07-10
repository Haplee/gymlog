// Motor de tips de UserStatsPage: lógica pura, sin JSX, testeable de forma aislada.
// Extraído de UserStatsPage.tsx.

const PUSH_MUSCLES = ['Pecho', 'Hombro', 'Hombros', 'Tríceps'];
const PULL_MUSCLES = ['Espalda', 'Bíceps', 'Antebrazo', 'Espalda baja'];
const LEG_MUSCLES = [
  'Pierna',
  'Cuádriceps',
  'Isquiotibiales',
  'Glúteo',
  'Glúteos',
  'Piernas',
  'Gemelos',
];

export interface Tip {
  type: 'warning' | 'success' | 'info' | 'danger';
  title: string;
  message: string;
}

type TipT = (key: string, opts?: Record<string, number | string>) => string;

const mkTip = (type: Tip['type'], title: string, message: string): Tip => ({
  type,
  title,
  message,
});

function streakTip(t: TipT, streak: number): Tip | null {
  if (streak >= 7)
    return mkTip(
      'success',
      t('tips.streak_strong_title', { count: streak }),
      t('tips.streak_strong_msg'),
    );
  if (streak >= 3)
    return mkTip(
      'success',
      t('tips.streak_good_title', { count: streak }),
      t('tips.streak_good_msg'),
    );
  return null;
}

function restTip(t: TipT, daysSinceLast: number): Tip | null {
  if (daysSinceLast > 5)
    return mkTip(
      'danger',
      t('tips.rest_long_title'),
      t('tips.rest_long_msg', { count: daysSinceLast }),
    );
  if (daysSinceLast > 3)
    return mkTip(
      'warning',
      t('tips.rest_mid_title', { count: daysSinceLast }),
      t('tips.rest_mid_msg'),
    );
  return null;
}

function frequencyTip(t: TipT, sessionCount30d: number, totalWorkouts: number): Tip | null {
  if (sessionCount30d < 8 && totalWorkouts >= 5)
    return mkTip(
      'warning',
      t('tips.freq_low_title'),
      t('tips.freq_low_msg', { count: sessionCount30d }),
    );
  return null;
}

function volumeTip(t: TipT, volumeChange: number, weeklyVolume: number): Tip | null {
  if (volumeChange < -25)
    return mkTip(
      'warning',
      t('tips.vol_down_title', { pct: Math.abs(volumeChange) }),
      t('tips.vol_down_msg'),
    );
  if (volumeChange > 30)
    return mkTip('warning', t('tips.vol_up_title', { pct: volumeChange }), t('tips.vol_up_msg'));
  if (volumeChange > 0 && weeklyVolume > 0)
    return mkTip(
      'success',
      t('tips.vol_progress_title', { pct: volumeChange }),
      t('tips.vol_progress_msg'),
    );
  return null;
}

function balanceTips(t: TipT, muscleDistribution: { name: string; value: number }[]): Tip[] {
  if (muscleDistribution.length === 0) return [];
  const out: Tip[] = [];
  const sumWhere = (groups: string[]) =>
    muscleDistribution
      .filter((m) => groups.some((p) => m.name.includes(p)))
      .reduce((s, m) => s + m.value, 0);
  const pushVol = sumWhere(PUSH_MUSCLES);
  const pullVol = sumWhere(PULL_MUSCLES);
  const legVol = sumWhere(LEG_MUSCLES);
  const totalVol = muscleDistribution.reduce((s, m) => s + m.value, 0);

  if (pushVol > 0 && pullVol > 0 && pushVol > pullVol * 1.6)
    out.push(mkTip('warning', t('tips.balance_push_title'), t('tips.balance_push_msg')));
  else if (pushVol > 0 && pullVol > 0 && pullVol > pushVol * 1.6)
    out.push(mkTip('info', t('tips.balance_pull_title'), t('tips.balance_pull_msg')));

  if (totalVol > 0 && legVol / totalVol < 0.15 && legVol > 0)
    out.push(mkTip('warning', t('tips.legs_low_title'), t('tips.legs_low_msg')));
  else if (totalVol > 0 && legVol === 0 && muscleDistribution.length >= 3)
    out.push(mkTip('danger', t('tips.legs_none_title'), t('tips.legs_none_msg')));

  return out;
}

function prTip(t: TipT, recentPRsCount: number, sessionCount30d: number): Tip | null {
  if (recentPRsCount === 0 && sessionCount30d >= 8)
    return mkTip('info', t('tips.pr_none_title'), t('tips.pr_none_msg'));
  if (recentPRsCount >= 3)
    return mkTip(
      'success',
      t('tips.pr_streak_title', { count: recentPRsCount }),
      t('tips.pr_streak_msg'),
    );
  return null;
}

function durationTip(t: TipT, avgDuration: number): Tip | null {
  if (avgDuration > 0 && avgDuration < 30)
    return mkTip(
      'info',
      t('tips.dur_short_title'),
      t('tips.dur_short_msg', { count: avgDuration }),
    );
  if (avgDuration > 120)
    return mkTip(
      'warning',
      t('tips.dur_long_title'),
      t('tips.dur_long_msg', { count: avgDuration }),
    );
  return null;
}

function diversityTip(t: TipT, uniqueExercises: number, sessionCount30d: number): Tip | null {
  if (uniqueExercises < 4 && sessionCount30d >= 4)
    return mkTip(
      'info',
      t('tips.variety_low_title'),
      t('tips.variety_low_msg', { count: uniqueExercises }),
    );
  return null;
}

export function generateTips(params: {
  sessionCount30d: number;
  currentStreak: number;
  daysSinceLast: number;
  volumeChange: number;
  weeklyVolume: number;
  muscleDistribution: { name: string; value: number }[];
  recentPRsCount: number;
  totalWorkouts: number;
  avgDuration: number;
  uniqueExercises: number;
  t: TipT;
}): Tip[] {
  const {
    sessionCount30d,
    currentStreak,
    daysSinceLast,
    volumeChange,
    weeklyVolume,
    muscleDistribution,
    recentPRsCount,
    totalWorkouts,
    avgDuration,
    uniqueExercises,
    t,
  } = params;

  // Sin datos suficientes
  if (totalWorkouts < 3) {
    return [mkTip('info', t('tips.start_title'), t('tips.start_msg'))];
  }

  const tips: Tip[] = [];
  const add = (tip: Tip | null) => {
    if (tip) tips.push(tip);
  };

  add(streakTip(t, currentStreak));
  add(restTip(t, daysSinceLast));
  add(frequencyTip(t, sessionCount30d, totalWorkouts));
  add(volumeTip(t, volumeChange, weeklyVolume));
  tips.push(...balanceTips(t, muscleDistribution));
  add(prTip(t, recentPRsCount, sessionCount30d));
  add(durationTip(t, avgDuration));
  add(diversityTip(t, uniqueExercises, sessionCount30d));

  // Sin tips de éxito — añadir algo positivo
  if (tips.filter((x) => x.type === 'success').length === 0 && totalWorkouts >= 10) {
    add(
      mkTip(
        'success',
        t('tips.consistency_title', { count: totalWorkouts }),
        t('tips.consistency_msg'),
      ),
    );
  }

  return tips.slice(0, 6);
}
