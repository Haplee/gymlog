import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// 1. CONFIGURACIÓN DE CONEXIÓN Y ESQUEMA (Ajusta según tus tablas en Supabase)
// ============================================================================
const CONFIG = {
  supabaseUrl: process.env.VITE_SUPABASE_URL || 'https://TU_PROYECTO.supabase.co',
  supabaseKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    'TU_KEY',

  // Activa o desactiva qué bloques exportar
  includeWorkoutHistory: true,
  includeRoutineTemplates: true,
  includeBodyMeasurements: true,

  // Unidades por defecto para Hevy
  defaultWeightUnit: 'kg', // 'kg' | 'lbs'
  defaultDistanceUnit: 'm', // 'km' | 'm' | 'mi.'
  defaultDuration: '60m',

  // Nombres de tablas y columnas (ajústalos si tu esquema usa otros nombres)
  tables: {
    exercises: 'exercises',
    routines: 'routines',
    routineExercises: 'routine_exercises',
    workouts: 'workouts',
    workoutSets: 'workout_sets',
    bodyMeasurements: 'body_measurements', // opcional; si no existe, el script continúa sin fallar
  },

  cols: {
    exercise: {
      id: 'id',
      name: 'name',
      hevyName: 'hevy_name', // opcional si ya guardas el nombre en inglés de Hevy
      category: 'category',
      equipment: 'equipment',
      primaryMuscle: 'primary_muscle',
    },
    routine: {
      id: 'id',
      name: 'name',
      notes: 'notes',
      orderIndex: 'order_index',
    },
    routineExercise: {
      id: 'id',
      routineId: 'routine_id',
      exerciseId: 'exercise_id',
      orderIndex: 'order_index',
      sets: 'sets',
      reps: 'reps',
      weight: 'weight',
      restSeconds: 'rest_seconds',
      supersetId: 'superset_id',
      notes: 'notes',
    },
    workout: {
      id: 'id',
      routineId: 'routine_id',
      name: 'name',
      startedAt: 'started_at',
      endedAt: 'ended_at',
      durationMinutes: 'duration_minutes',
      notes: 'notes',
      rpe: 'rpe',
    },
    workoutSet: {
      id: 'id',
      workoutId: 'workout_id',
      exerciseId: 'exercise_id',
      setOrder: 'set_order',
      setType: 'set_type', // 'normal' | 'warmup' | 'dropset' | 'failure'
      weight: 'weight',
      reps: 'reps',
      rpe: 'rpe',
      distance: 'distance',
      seconds: 'seconds',
      notes: 'notes',
    },
  },
};

// ============================================================================
// 2. MAPEO DE EJERCICIOS AL CATÁLOGO EN INGLÉS DE HEVY
// ============================================================================
// Añade aquí los nombres exactos de tu catálogo en español -> nombre oficial en Hevy
const EXERCISE_NAME_MAP = {
  'press banca': 'Bench Press (Barbell)',
  'press de banca': 'Bench Press (Barbell)',
  'press banca con barra': 'Bench Press (Barbell)',
  'press banca inclinado': 'Incline Bench Press (Barbell)',
  'press inclinado con mancuernas': 'Incline Bench Press (Dumbbell)',
  'press plano con mancuernas': 'Bench Press (Dumbbell)',
  'aperturas con mancuernas': 'Dumbbell Fly',
  'fondos en paralelas': 'Chest Dip',
  'sentadilla': 'Squat (Barbell)',
  'sentadilla trasera': 'Squat (Barbell)',
  'sentadilla frontal': 'Front Squat',
  'sentadilla búlgara': 'Bulgarian Split Squat',
  'prensa de piernas': 'Leg Press (Machine)',
  'extensión de cuádriceps': 'Leg Extension (Machine)',
  'curl femoral': 'Lying Leg Curl (Machine)',
  'curl femoral sentado': 'Seated Leg Curl (Machine)',
  'peso muerto': 'Deadlift (Barbell)',
  'peso muerto rumano': 'Romanian Deadlift (Barbell)',
  'hip thrust': 'Hip Thrust (Barbell)',
  'dominadas': 'Pull Up',
  'jalón al pecho': 'Lat Pulldown (Cable)',
  'remo con barra': 'Bent Over Row (Barbell)',
  'remo con mancuerna': 'Bent Over Row (Dumbbell)',
  'remo en polea baja': 'Seated Cable Row',
  'press militar': 'Overhead Press (Barbell)',
  'press militar con mancuernas': 'Shoulder Press (Dumbbell)',
  'elevaciones laterales': 'Lateral Raise (Dumbbell)',
  'elevaciones laterales en polea': 'Lateral Raise (Cable)',
  'pájaros': 'Rear Delt Reverse Fly (Dumbbell)',
  'curl de bíceps con barra': 'Bicep Curl (Barbell)',
  'curl inclinado con mancuernas': 'Incline Dumbbell Curl',
  'curl martillo': 'Hammer Curl (Dumbbell)',
  'extensión de tríceps en polea': 'Triceps Pushdown',
  'press francés': 'Skullcrusher (Barbell)',
  'salto al cajón': 'Box Jump',
  'salto al cajón unilateral': 'Single Leg Box Jump',
  'lanzamiento rotacional balón medicinal': 'Medicine Ball Rotational Throw',
  'plancha': 'Plank',
};

function resolveHevyExerciseName(exerciseObj) {
  if (!exerciseObj) return 'Unknown Exercise';
  const explicitHevy = exerciseObj[CONFIG.cols.exercise.hevyName];
  if (explicitHevy && String(explicitHevy).trim()) {
    return String(explicitHevy).trim();
  }
  const rawName = exerciseObj[CONFIG.cols.exercise.name] || '';
  const normalized = rawName.trim().toLowerCase();
  return EXERCISE_NAME_MAP[normalized] || rawName.trim() || 'Unknown Exercise';
}

// ============================================================================
// 3. HELPERS DE FORMATO CSV Y FECHAS PARA HEVY
// ============================================================================
function escapeCsvField(value) {
  // En Hevy es preferible "" antes que null para notas o campos vacíos
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str === '') return '""';
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatHevyDateTime(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) {
    return '2026-11-01 10:00:00';
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

function formatTemplateSyntheticDate(index) {
  // Asigna una fecha/hora distinta por cada plantilla de rutina para que Hevy no las mezcle
  const base = new Date(2026, 8, 1, 10, 0, 0); // 1 Sep 2026 10:00:00 local
  base.setDate(base.getDate() + index);
  return formatHevyDateTime(base);
}

function formatWorkoutDuration(workoutRow) {
  const mins = Number(workoutRow?.[CONFIG.cols.workout.durationMinutes]);
  if (Number.isFinite(mins) && mins > 0) {
    return `${Math.round(mins)}m`;
  }
  const start = workoutRow?.[CONFIG.cols.workout.startedAt];
  const end = workoutRow?.[CONFIG.cols.workout.endedAt];
  if (start && end) {
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    if (diffMs > 0) {
      const diffMins = Math.max(1, Math.round(diffMs / 60000));
      return `${diffMins}m`;
    }
  }
  return CONFIG.defaultDuration;
}

function buildRowNotes(rawNotes, setType) {
  const parts = [];
  if (setType && String(setType).toLowerCase() !== 'normal') {
    parts.push(`[${String(setType).toUpperCase()}]`);
  }
  if (rawNotes && String(rawNotes).trim()) {
    parts.push(String(rawNotes).trim());
  }
  return parts.join(' ').trim();
}

function buildHevyCsvRow({
  date,
  workoutName,
  exerciseName,
  setOrder,
  weight,
  weightUnit,
  reps,
  rpe,
  distance,
  distanceUnit,
  seconds,
  notes,
  workoutNotes,
  workoutDuration,
}) {
  const numericWeight =
    weight !== null && weight !== undefined && weight !== '' ? Number(weight) : 0;
  const hasDistance = distance !== null && distance !== undefined && distance !== '' && Number(distance) > 0;
  const numericSeconds =
    seconds !== null && seconds !== undefined && seconds !== '' ? Number(seconds) : 0;

  return [
    escapeCsvField(date),
    escapeCsvField(workoutName),
    escapeCsvField(exerciseName),
    escapeCsvField(setOrder),
    escapeCsvField(Number.isFinite(numericWeight) ? numericWeight : 0),
    escapeCsvField(weightUnit || CONFIG.defaultWeightUnit),
    escapeCsvField(reps !== null && reps !== undefined && reps !== '' ? Number(reps) : ''),
    escapeCsvField(rpe !== null && rpe !== undefined && rpe !== '' ? Number(rpe) : ''),
    escapeCsvField(hasDistance ? Number(distance) : ''),
    escapeCsvField(hasDistance ? (distanceUnit || CONFIG.defaultDistanceUnit) : ''),
    escapeCsvField(Number.isFinite(numericSeconds) ? numericSeconds : 0),
    escapeCsvField(notes || ''),
    escapeCsvField(workoutNotes || ''),
    escapeCsvField(workoutDuration || CONFIG.defaultDuration),
  ].join(',');
}

// ============================================================================
// 4. EXTRACCIÓN COMPLETA DESDE SUPABASE
// ============================================================================
async function fetchAllData(supabase) {
  const { tables } = CONFIG;

  const [exercisesRes, routinesRes, routineExRes, workoutsRes, workoutSetsRes] =
    await Promise.all([
      supabase.from(tables.exercises).select('*'),
      supabase.from(tables.routines).select('*'),
      supabase.from(tables.routineExercises).select('*'),
      supabase.from(tables.workouts).select('*'),
      supabase.from(tables.workoutSets).select('*'),
    ]);

  for (const [label, res] of [
    ['exercises', exercisesRes],
    ['routines', routinesRes],
    ['routine_exercises', routineExRes],
    ['workouts', workoutsRes],
    ['workout_sets', workoutSetsRes],
  ]) {
    if (res.error) {
      throw new Error(`Error al consultar "${label}": ${res.error.message}`);
    }
  }

  let bodyMeasurements = [];
  if (CONFIG.includeBodyMeasurements) {
    const measRes = await supabase.from(tables.bodyMeasurements).select('*');
    if (!measRes.error && Array.isArray(measRes.data)) {
      bodyMeasurements = measRes.data;
    }
  }

  return {
    exercises: exercisesRes.data || [],
    routines: routinesRes.data || [],
    routineExercises: routineExRes.data || [],
    workouts: workoutsRes.data || [],
    workoutSets: workoutSetsRes.data || [],
    bodyMeasurements,
  };
}

// ============================================================================
// 5. CONSTRUCCIÓN DE CSV PARA HEVY + METADATOS Y RESPALDO COMPLETO
// ============================================================================
async function runFullExport() {
  const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
  console.log('Extrayendo datos completos de GymLog...');

  const data = await fetchAllData(supabase);

  const exerciseById = new Map();
  for (const ex of data.exercises) {
    exerciseById.set(ex[CONFIG.cols.exercise.id], ex);
  }

  const csvHeaders = [
    'Date',
    'Workout Name',
    'Exercise Name',
    'Set Order',
    'Weight',
    'Weight Unit',
    'Reps',
    'RPE',
    'Distance',
    'Distance Unit',
    'Seconds',
    'Notes',
    'Workout Notes',
    'Workout Duration',
  ];

  const csvRows = [csvHeaders.join(',')];
  const unmappedExercises = new Set();
  const routinesMetadata = [];

  // A) Historial real de entrenamientos y series ejecutadas
  if (CONFIG.includeWorkoutHistory) {
    const setsByWorkout = new Map();
    for (const s of data.workoutSets) {
      const wId = s[CONFIG.cols.workoutSet.workoutId];
      if (!setsByWorkout.has(wId)) setsByWorkout.set(wId, []);
      setsByWorkout.get(wId).push(s);
    }

    const sortedWorkouts = [...data.workouts].sort((a, b) => {
      const da = new Date(a[CONFIG.cols.workout.startedAt] || 0).getTime();
      const db = new Date(b[CONFIG.cols.workout.startedAt] || 0).getTime();
      return da - db;
    });

    sortedWorkouts.forEach((workout, wIdx) => {
      const wId = workout[CONFIG.cols.workout.id];
      const workoutDate = formatHevyDateTime(workout[CONFIG.cols.workout.startedAt]);
      const workoutName =
        workout[CONFIG.cols.workout.name] || `Entrenamiento ${wIdx + 1}`;
      const workoutNotes = workout[CONFIG.cols.workout.notes] || '';
      const workoutDuration = formatWorkoutDuration(workout);

      const sets = (setsByWorkout.get(wId) || []).sort(
        (a, b) =>
          (Number(a[CONFIG.cols.workoutSet.setOrder]) || 0) -
          (Number(b[CONFIG.cols.workoutSet.setOrder]) || 0)
      );

      // Agrupar series por ejercicio para asegurar Set Order correlativo (1, 2, 3...)
      const countersByExercise = new Map();

      sets.forEach((setRow, idx) => {
        const exId = setRow[CONFIG.cols.workoutSet.exerciseId];
        const exObj = exerciseById.get(exId);
        const hevyName = resolveHevyExerciseName(exObj);
        if (exObj && !EXERCISE_NAME_MAP[(exObj[CONFIG.cols.exercise.name] || '').trim().toLowerCase()]) {
          unmappedExercises.add(exObj[CONFIG.cols.exercise.name]);
        }

        const nextOrder =
          Number(setRow[CONFIG.cols.workoutSet.setOrder]) ||
          (countersByExercise.get(exId) || 0) + 1;
        countersByExercise.set(exId, nextOrder);

        const setType = setRow[CONFIG.cols.workoutSet.setType];
        const rowNotes = buildRowNotes(setRow[CONFIG.cols.workoutSet.notes], setType);

        csvRows.push(
          buildHevyCsvRow({
            date: workoutDate,
            workoutName,
            exerciseName: hevyName,
            setOrder: nextOrder || idx + 1,
            weight: setRow[CONFIG.cols.workoutSet.weight],
            weightUnit: CONFIG.defaultWeightUnit,
            reps: setRow[CONFIG.cols.workoutSet.reps],
            rpe: setRow[CONFIG.cols.workoutSet.rpe] ?? workout[CONFIG.cols.workout.rpe],
            distance: setRow[CONFIG.cols.workoutSet.distance],
            distanceUnit: CONFIG.defaultDistanceUnit,
            seconds: setRow[CONFIG.cols.workoutSet.seconds],
            notes: rowNotes,
            workoutNotes,
            workoutDuration,
          })
        );
      });
    });
  }

  // B) Plantillas de rutina (exportadas como sesiones con fechas escalonadas para guardarlas como rutina en Hevy)
  if (CONFIG.includeRoutineTemplates) {
    const itemsByRoutine = new Map();
    for (const item of data.routineExercises) {
      const rId = item[CONFIG.cols.routineExercise.routineId];
      if (!itemsByRoutine.has(rId)) itemsByRoutine.set(rId, []);
      itemsByRoutine.get(rId).push(item);
    }

    const sortedRoutines = [...data.routines].sort(
      (a, b) =>
        (Number(a[CONFIG.cols.routine.orderIndex]) || 0) -
        (Number(b[CONFIG.cols.routine.orderIndex]) || 0)
    );

    sortedRoutines.forEach((routine, rIdx) => {
      const rId = routine[CONFIG.cols.routine.id];
      const routineName = routine[CONFIG.cols.routine.name] || `Rutina ${rIdx + 1}`;
      const routineNotes = routine[CONFIG.cols.routine.notes] || '';
      const syntheticDate = formatTemplateSyntheticDate(rIdx);

      const items = (itemsByRoutine.get(rId) || []).sort(
        (a, b) =>
          (Number(a[CONFIG.cols.routineExercise.orderIndex]) || 0) -
          (Number(b[CONFIG.cols.routineExercise.orderIndex]) || 0)
      );

      const metaExercises = [];

      items.forEach((item) => {
        const exId = item[CONFIG.cols.routineExercise.exerciseId];
        const exObj = exerciseById.get(exId);
        const rawName = exObj?.[CONFIG.cols.exercise.name] || 'Ejercicio';
        const hevyName = resolveHevyExerciseName(exObj);

        if (exObj && !EXERCISE_NAME_MAP[rawName.trim().toLowerCase()]) {
          unmappedExercises.add(rawName);
        }

        const numSets = Math.max(1, Number(item[CONFIG.cols.routineExercise.sets]) || 3);
        const targetReps =
          item[CONFIG.cols.routineExercise.reps] != null
            ? Number(item[CONFIG.cols.routineExercise.reps])
            : 10;
        const targetWeight =
          item[CONFIG.cols.routineExercise.weight] != null
            ? Number(item[CONFIG.cols.routineExercise.weight])
            : 0;
        const restSeconds = item[CONFIG.cols.routineExercise.restSeconds] ?? null;
        const supersetId = item[CONFIG.cols.routineExercise.supersetId] ?? null;
        const itemNotes = item[CONFIG.cols.routineExercise.notes] || '';

        metaExercises.push({
          exercise_id: exId,
          gym_log_name: rawName,
          hevy_name: hevyName,
          sets: numSets,
          target_reps: targetReps,
          target_weight_kg: targetWeight,
          rest_seconds: restSeconds,
          superset_id: supersetId,
          notes: itemNotes,
        });

        for (let sNum = 1; sNum <= numSets; sNum++) {
          const extraNote = [
            restSeconds ? `Descanso: ${restSeconds}s` : '',
            supersetId ? `Superserie: ${supersetId}` : '',
            itemNotes,
          ]
            .filter(Boolean)
            .join(' | ');

          csvRows.push(
            buildHevyCsvRow({
              date: syntheticDate,
              workoutName: `[Rutina] ${routineName}`,
              exerciseName: hevyName,
              setOrder: sNum,
              weight: targetWeight,
              weightUnit: CONFIG.defaultWeightUnit,
              reps: targetReps,
              rpe: '',
              distance: '',
              distanceUnit: CONFIG.defaultDistanceUnit,
              seconds: 0,
              notes: extraNote,
              workoutNotes: routineNotes,
              workoutDuration: CONFIG.defaultDuration,
            })
          );
        }
      });

      routinesMetadata.push({
        routine_id: rId,
        name: routineName,
        hevy_synthetic_date: syntheticDate,
        notes: routineNotes,
        exercises: metaExercises,
      });
    });
  }

  // Guardar archivos en ./export-output
  const outDir = path.resolve(process.cwd(), 'export-output');
  fs.mkdirSync(outDir, { recursive: true });

  const csvPath = path.join(outDir, 'hevy_import.csv');
  const metaPath = path.join(outDir, 'gymlog_routines_metadata.json');
  const backupPath = path.join(outDir, 'gymlog_full_backup_and_measurements.json');

  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');
  fs.writeFileSync(metaPath, JSON.stringify(routinesMetadata, null, 2), 'utf8');
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        counts: {
          exercises: data.exercises.length,
          routines: data.routines.length,
          routine_exercises: data.routineExercises.length,
          workouts: data.workouts.length,
          workout_sets: data.workoutSets.length,
          body_measurements: data.bodyMeasurements.length,
          csv_rows: csvRows.length - 1,
        },
        routines: data.routines,
        routine_exercises: data.routineExercises,
        exercises: data.exercises,
        workouts: data.workouts,
        workout_sets: data.workoutSets,
        body_measurements: data.bodyMeasurements,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log('✅ Exportación completada:');
  console.log(`   - CSV para Hevy: ${csvPath} (${csvRows.length - 1} filas de series)`);
  console.log(`   - Metadatos de rutinas: ${metaPath}`);
  console.log(`   - Respaldo completo + mediciones: ${backupPath}`);

  if (unmappedExercises.size > 0) {
    console.log('\n⚠️ Ejercicios sin traducción explícita en EXERCISE_NAME_MAP (revísalos para que no creen duplicados en Hevy):');
    for (const name of unmappedExercises) {
      console.log(`   - ${name}`);
    }
  }
}

runFullExport().catch((err) => {
  console.error('❌ Error en la exportación:', err.message);
  process.exit(1);
});