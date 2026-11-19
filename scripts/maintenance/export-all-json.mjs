import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://eoltmipoklizewxdpzfa.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_KEY;

if (!SB_KEY) {
  console.error('❌ Falta SUPABASE_SERVICE_ROLE_KEY o VITE_SUPABASE_KEY en variables de entorno');
  process.exit(1);
}

const supabase = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: false }
});

const USER_ID = 'f95d5098-47ef-4825-a5ff-8540cc3524f6';

const DAY_ORDER = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
];

async function fetchAllPaginated(queryBuilder, pageSize = 1000) {
  let allData = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await queryBuilder.range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allData;
}

async function main() {
  try {
    console.log('🚀 Extrayendo TODO tu historial y perfil de GymLog a JSON limpio...\n');

    // 1. Perfil
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', USER_ID)
      .maybeSingle();

    // 2. Catálogo de ejercicios
    const exercises = await fetchAllPaginated(
      supabase
        .from('exercises')
        .select('*')
        .or(`user_id.eq.${USER_ID},is_public.eq.true`)
        .order('muscle_group', { ascending: true })
        .order('name', { ascending: true })
    );
    const exById = Object.fromEntries(exercises.map(e => [e.id, e]));

    // 3. Entrenamientos y series
    const workouts = await fetchAllPaginated(
      supabase
        .from('workouts')
        .select('*')
        .eq('user_id', USER_ID)
        .order('started_at', { ascending: false })
    );

    const workoutSets = await fetchAllPaginated(
      supabase
        .from('workout_sets')
        .select(`
          *,
          workouts!inner (
            id, user_id, name, started_at, finished_at, duration_seconds, total_volume_kg, rating, notes
          )
        `)
        .eq('workouts.user_id', USER_ID)
        .order('started_at', { referencedTable: 'workouts', ascending: false })
        .order('set_num', { ascending: true })
    );

    // 4. Marcas personales (PRs)
    const personalRecords = await fetchAllPaginated(
      supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', USER_ID)
        .order('achieved_at', { ascending: false })
    );

    // 5. Progresión automática y log
    const exerciseProgression = await fetchAllPaginated(
      supabase
        .from('exercise_progression')
        .select('*')
        .eq('user_id', USER_ID)
        .order('updated_at', { ascending: false })
    );

    const progressionLog = await fetchAllPaginated(
      supabase
        .from('progression_log')
        .select('*')
        .eq('user_id', USER_ID)
        .order('created_at', { ascending: false })
    );

    // 6. Rutinas (JSONB limpio)
    const { data: userRoutines } = await supabase
      .from('user_routines')
      .select('*')
      .eq('user_id', USER_ID);

    // 7. Medidas, objetivos, notas, cardio y coach
    const bodyMeasurements = await fetchAllPaginated(
      supabase.from('body_measurements').select('*').eq('user_id', USER_ID).order('date', { ascending: false })
    );

    const exerciseGoals = await fetchAllPaginated(
      supabase.from('exercise_goals').select('*').eq('user_id', USER_ID)
    );

    const exerciseNotes = await fetchAllPaginated(
      supabase.from('exercise_notes').select('*').eq('user_id', USER_ID).order('created_at', { ascending: false })
    );

    const cardioSessions = await fetchAllPaginated(
      supabase.from('cardio_sessions').select('*').eq('user_id', USER_ID).order('started_at', { ascending: false })
    );

    const aiCoachMemory = await fetchAllPaginated(
      supabase.from('ai_coach_memory').select('*').eq('user_id', USER_ID).order('created_at', { ascending: false })
    );

    // ============================================
    // FORMATEO LEGIBLE Y ESTRUCTURADO
    // ============================================

    // Rutinas limpias
    const rootRoutine = userRoutines?.[0]?.routine || {};
    const activeRoutineId = rootRoutine.activeRoutineId || null;
    const schedule = rootRoutine.schedule || {};

    const cleanRoutines = (rootRoutine.routines || []).map(r => ({
      id: r.id,
      name: r.name,
      isActive: r.id === activeRoutineId,
      scheduledStart: schedule[r.id] || null,
      description: r.description || '',
      days: DAY_ORDER.map(d => {
        const dayObj = r.days?.[d.key];
        if (!dayObj) return null;
        return {
          day: d.label,
          session: dayObj.name || '',
          exercises: dayObj.exercises || []
        };
      }).filter(Boolean)
    }));

    // Marcas personales enriquecidas
    const cleanPRs = personalRecords.map(pr => ({
      exercise: exById[pr.exercise_id]?.name || 'Desconocido',
      muscleGroup: exById[pr.exercise_id]?.muscle_group || '',
      weightKg: pr.weight,
      reps: pr.reps,
      estimated1RM: pr.one_rm,
      repBand: pr.rep_band,
      achievedAt: pr.achieved_at
    }));

    // Estadísticas agregadas por ejercicio
    const statsMap = {};
    workoutSets.forEach(s => {
      const ex = exById[s.exercise_id];
      const name = ex?.name || 'Desconocido';
      if (!statsMap[name]) {
        statsMap[name] = {
          exercise: name,
          muscleGroup: ex?.muscle_group || '',
          equipment: ex?.equipment || '',
          totalSets: 0,
          totalReps: 0,
          totalVolumeKg: 0,
          maxWeightKg: 0,
          max1RM: 0,
          sessionsCount: new Set(),
          lastPerformed: null
        };
      }
      const st = statsMap[name];
      st.totalSets += 1;
      st.totalReps += s.reps || 0;
      st.totalVolumeKg += (s.weight || 0) * (s.reps || 0);
      if ((s.weight || 0) > st.maxWeightKg) st.maxWeightKg = s.weight;
      if ((s.one_rm || 0) > st.max1RM) st.max1RM = s.one_rm;
      if (s.workout_id) st.sessionsCount.add(s.workout_id);
      const dt = s.workouts?.started_at;
      if (dt && (!st.lastPerformed || dt > st.lastPerformed)) st.lastPerformed = dt;
    });

    const exerciseSummary = Object.values(statsMap)
      .map(st => ({
        ...st,
        totalVolumeKg: Math.round(st.totalVolumeKg * 100) / 100,
        sessionsCount: st.sessionsCount.size
      }))
      .sort((a, b) => b.totalVolumeKg - a.totalVolumeKg);

    // Entrenos agrupados con sus series
    const setsByWorkout = {};
    workoutSets.forEach(s => {
      if (!setsByWorkout[s.workout_id]) setsByWorkout[s.workout_id] = [];
      setsByWorkout[s.workout_id].push({
        exercise: exById[s.exercise_id]?.name || 'Desconocido',
        muscleGroup: exById[s.exercise_id]?.muscle_group || '',
        setNum: s.set_num,
        weightKg: s.weight,
        reps: s.reps,
        rir: s.rir,
        rpe: s.rpe,
        estimated1RM: s.one_rm,
        isWarmup: s.is_warmup,
        isPR: s.is_pr,
        setType: s.set_type,
        notes: s.notes || ''
      });
    });

    const cleanWorkouts = workouts.map(w => ({
      id: w.id,
      name: w.name || 'Entreno',
      startedAt: w.started_at,
      durationMin: w.duration_seconds ? Math.round(w.duration_seconds / 60) : w.duration_min,
      totalVolumeKg: w.total_volume_kg ?? w.total_volume,
      totalSets: w.total_sets,
      rating: w.rating,
      notes: w.notes || '',
      sets: setsByWorkout[w.id] || []
    }));

    const fullExport = {
      exportedAt: new Date().toISOString(),
      user: {
        id: USER_ID,
        email: profile?.email || 'fvidalmateo@gmail.com',
        fullName: profile?.full_name || 'Francisco Vidal',
        goal: profile?.goal,
        daysPerWeek: profile?.days_per_week,
        weightKg: profile?.weight_kg,
        heightCm: profile?.height_cm
      },
      summary: {
        totalWorkouts: workouts.length,
        totalSets: workoutSets.length,
        totalVolumeKg: Math.round(workoutSets.reduce((acc, s) => acc + (s.weight || 0) * (s.reps || 0), 0) * 100) / 100,
        totalPRs: personalRecords.length,
        totalRoutines: cleanRoutines.length,
        activeRoutine: cleanRoutines.find(r => r.isActive)?.name || null,
        cardioSessions: cardioSessions.length,
        bodyMeasurements: bodyMeasurements.length
      },
      routines: cleanRoutines,
      personalRecords: cleanPRs,
      exerciseSummary,
      progression: exerciseProgression,
      progressionLog,
      goals: exerciseGoals.map(g => ({
        exercise: exById[g.exercise_id]?.name || 'Desconocido',
        targetOneRM: g.target_one_rm,
        updatedAt: g.updated_at
      })),
      notes: exerciseNotes.map(n => ({
        exercise: exById[n.exercise_id]?.name || 'Desconocido',
        note: n.note,
        createdAt: n.created_at
      })),
      bodyMeasurements,
      cardioSessions,
      aiCoachMemory,
      workouts: cleanWorkouts
    };

    const dateTag = new Date().toISOString().split('T')[0];
    const outPath = `C:\\Users\\franc\\proyectos\\apps\\gymlog\\GymLog_Todo_${dateTag}.json`;
    fs.writeFileSync(outPath, JSON.stringify(fullExport, null, 2), 'utf8');

    console.log(`✅ EXPORTACIÓN COMPLETA GUARDADA EN:\n   ${outPath}\n`);
    console.log('📊 RESUMEN GENERAL:');
    console.log(`   • Entrenos registrados: ${fullExport.summary.totalWorkouts}`);
    console.log(`   • Series totales:       ${fullExport.summary.totalSets}`);
    console.log(`   • Volumen acumulado:    ${fullExport.summary.totalVolumeKg.toLocaleString('es-ES')} kg`);
    console.log(`   • Marcas personales:    ${fullExport.summary.totalPRs}`);
    console.log(`   • Rutinas guardadas:    ${fullExport.summary.totalRoutines} (Activa: ${fullExport.summary.activeRoutine || 'Ninguna'})`);
    console.log(`   • Sesiones cardio:      ${fullExport.summary.cardioSessions}`);
    console.log(`   • Medidas corporales:   ${fullExport.summary.bodyMeasurements}`);

    console.log('\n🏆 TOP 10 EJERCICIOS POR VOLUMEN:');
    exerciseSummary.slice(0, 10).forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.exercise}: ${e.totalVolumeKg.toLocaleString('es-ES')} kg | Máx: ${e.maxWeightKg} kg | 1RM est: ${Math.round(e.max1RM)} kg (${e.sessionsCount} sesiones)`);
    });

    console.log('\n🥇 ÚLTIMAS 10 MARCAS PERSONALES (PRs):');
    cleanPRs.slice(0, 10).forEach(pr => {
      const fecha = pr.achievedAt ? pr.achievedAt.split('T')[0] : '';
      console.log(`   • ${pr.exercise}: ${pr.weightKg} kg x ${pr.reps} reps (1RM: ${Math.round(pr.estimated1RM || 0)} kg) — ${fecha}`);
    });
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  }
}

main();
