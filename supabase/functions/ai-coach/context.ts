// Construcción del contexto que se manda al proveedor.
//
// Este fichero es el control principal de privacidad. Con un proveedor gratuito
// no hay acuerdo de tratamiento de datos, así que lo que NO se envía importa
// tanto como lo que se envía:
//
//   NUNCA salen: user_id, email, nombre, avatar, fecha exacta de nacimiento,
//   geolocalización, credenciales de wearable, ni filas crudas de workout_sets.
//
// Solo agregados y derivados. La edad va en franja, no en fecha.

const WEEKS = 8;

/* -------------------------------------------------------------------------- */
/* Tipos                                                                       */
/*                                                                             */
/* supabase-js se importa desde esm.sh en Deno, así que sus tipos no llegan al */
/* ESLint del repo. Se declara aquí el trozo del builder que se usa: es poco   */
/* código y a cambio los accesos a columnas quedan comprobados de verdad.      */
/* -------------------------------------------------------------------------- */

interface Result<T> {
  data: T | null;
  error?: unknown;
}

interface Builder<T> extends PromiseLike<Result<T[]>> {
  eq(column: string, value: unknown): Builder<T>;
  gte(column: string, value: unknown): Builder<T>;
  in(column: string, values: unknown[]): Builder<T>;
  order(column: string, opts?: { ascending: boolean }): Builder<T>;
  limit(n: number): Builder<T>;
  maybeSingle(): PromiseLike<Result<T>>;
}

export interface DbClient {
  from(table: string): { select<T>(columns: string): Builder<T> };
}

interface ProfileRow {
  goal: string | null;
  days_per_week: number | null;
  equipment_available: string[] | null;
  weight_kg: number | null;
  birth_year: number | null;
  sex: string | null;
  weight_unit: string | null;
}

interface WorkoutRow {
  id: string;
  started_at: string | null;
  rating: number | null;
  total_volume_kg: number | null;
  duration_min: number | null;
}

interface SetRow {
  weight: number | null;
  reps: number | null;
  rir: number | null;
  rpe: number | null;
  is_warmup: boolean | null;
  workout_id: string;
  exercise: { name: string } | null;
}

interface DailyRow {
  date: string;
  resting_hr: number | null;
}

interface SleepRow {
  date: string;
  duration_min: number | null;
}

/** Fecha de nacimiento → franja. Nunca se manda el año exacto. */
function ageBand(birthYear: number | null): string | null {
  if (!birthYear) return null;
  const age = new Date().getFullYear() - birthYear;
  if (age < 25) return '<25';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  return '55+';
}

const mean = (xs: number[]): number | null =>
  xs.length === 0 ? null : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

/** Brzycki, igual que en el cliente. */
function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  const r = Math.min(36, Math.max(1, Math.floor(reps)));
  return r === 1 ? weight : weight / (1.0278 - 0.0278 * r);
}

export interface BuiltContext {
  context: Record<string, unknown>;
  /** Último peso por ejercicio: lo usa el post-filtro para el tope del 10%. */
  lastWeightByExercise: Record<string, number>;
}

/**
 * Lee de la BD con service_role, SIEMPRE acotado al `userId` que vino del JWT.
 * Ningún parámetro de esta función sale del cuerpo de la petición.
 */
export async function buildContext(supabase: DbClient, userId: string): Promise<BuiltContext> {
  const since = new Date(Date.now() - WEEKS * 7 * 86_400_000).toISOString();

  const [{ data: profile }, { data: workouts }, { data: daily }, { data: sleep }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select<ProfileRow>(
          'goal, days_per_week, equipment_available, weight_kg, birth_year, sex, weight_unit',
        )
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('workouts')
        .select<WorkoutRow>('id, started_at, rating, total_volume_kg, duration_min')
        .eq('user_id', userId)
        .gte('started_at', since)
        .order('started_at', { ascending: false })
        .limit(120),
      supabase
        .from('wearable_daily')
        .select<DailyRow>('date, resting_hr')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(30),
      supabase
        .from('wearable_sleep')
        .select<SleepRow>('date, duration_min')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(7),
    ]);

  const workoutIds = (workouts ?? []).map((w) => w.id);
  const { data: sets } = workoutIds.length
    ? await supabase
        .from('workout_sets')
        .select<SetRow>('weight, reps, rir, rpe, is_warmup, workout_id, exercise:exercises(name)')
        .in('workout_id', workoutIds)
    : { data: [] as SetRow[] };

  // --- Agregado por ejercicio -------------------------------------------
  const byExercise = new Map<string, SetRow[]>();
  for (const s of sets ?? []) {
    if (s.is_warmup || !s.weight || !s.reps) continue;
    const name = s.exercise?.name;
    if (!name) continue;
    const bucket = byExercise.get(name);
    if (bucket) bucket.push(s);
    else byExercise.set(name, [s]);
  }

  const workoutDate = new Map<string, string>();
  for (const w of workouts ?? []) {
    if (w.started_at) workoutDate.set(w.id, w.started_at);
  }

  const lastWeightByExercise: Record<string, number> = {};
  const ejercicios = [...byExercise.entries()]
    .map(([name, rows]) => {
      const sorted = [...rows].sort(
        (a, b) =>
          new Date(workoutDate.get(b.workout_id) ?? 0).getTime() -
          new Date(workoutDate.get(a.workout_id) ?? 0).getTime(),
      );
      const best = Math.max(...rows.map((r) => e1rm(r.weight, r.reps)));
      const rirs = rows
        .map((r) =>
          typeof r.rir === 'number' ? r.rir : typeof r.rpe === 'number' ? 10 - r.rpe : null,
        )
        .filter((v): v is number => v !== null);

      lastWeightByExercise[name] = sorted[0]?.weight ?? 0;

      return {
        nombre: name,
        series_totales: rows.length,
        sesiones: new Set(rows.map((r) => r.workout_id)).size,
        mejor_e1rm: Math.round(best * 10) / 10,
        ultimo_peso_kg: sorted[0]?.weight ?? null,
        rir_medio: mean(rirs),
      };
    })
    .sort((a, b) => b.series_totales - a.series_totales)
    .slice(0, 8);

  // --- Wearable ----------------------------------------------------------
  const sleepMins = (sleep ?? [])
    .map((s) => s.duration_min)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const recentRhr = (daily ?? [])
    .slice(0, 7)
    .map((d) => d.resting_hr)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const baseRhr = (daily ?? [])
    .slice(7)
    .map((d) => d.resting_hr)
    .filter((v): v is number => typeof v === 'number' && v > 0);

  const recuperacion =
    sleepMins.length >= 3 || recentRhr.length >= 3
      ? {
          sueno_medio_min: sleepMins.length >= 3 ? mean(sleepMins) : null,
          fc_reposo_media: recentRhr.length >= 3 ? mean(recentRhr) : null,
          fc_reposo_linea_base: baseRhr.length >= 3 ? mean(baseRhr) : null,
        }
      : null;

  const ratings = (workouts ?? [])
    .map((w) => w.rating)
    .filter((v): v is number => typeof v === 'number');

  return {
    lastWeightByExercise,
    context: {
      perfil: {
        objetivo: profile?.goal ?? null,
        dias_por_semana: profile?.days_per_week ?? null,
        material: profile?.equipment_available ?? [],
        franja_edad: ageBand(profile?.birth_year ?? null),
        sexo: profile?.sex ?? null,
        // Redondeado: el peso exacto no aporta nada al consejo.
        peso_kg: profile?.weight_kg ? Math.round(profile.weight_kg) : null,
        unidades: profile?.weight_unit ?? 'kg',
      },
      adherencia: {
        sesiones_8_semanas: (workouts ?? []).length,
        duracion_media_min: mean(
          (workouts ?? [])
            .map((w) => w.duration_min)
            .filter((v): v is number => typeof v === 'number' && v > 0),
        ),
        valoracion_media: mean(ratings),
      },
      volumen_total_kg: Math.round(
        (workouts ?? []).reduce((sum, w) => sum + (w.total_volume_kg ?? 0), 0),
      ),
      ejercicios,
      recuperacion,
    },
  };
}
