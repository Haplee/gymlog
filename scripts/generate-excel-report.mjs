import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://eoltmipoklizewxdpzfa.supabase.co';
// Prioriza service_role para saltar RLS en scripts locales; hace fallback a VITE_SUPABASE_KEY
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_KEY;

if (!SB_KEY) {
  console.error('❌ Falta SUPABASE_SERVICE_ROLE_KEY o VITE_SUPABASE_KEY en variables de entorno');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  Aviso: Usando VITE_SUPABASE_KEY (anon). Si tienes RLS activo, las tablas privadas devolverán 0 filas.\n');
}

const supabase = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: false }
});

const USER_ID = 'f95d5098-47ef-4825-a5ff-8540cc3524f6'; // fvidalmateo@gmail.com

/**
 * Descarga todas las filas paginando de 1000 en 1000 para evitar el límite por defecto de Supabase
 */
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

async function fetchAllData() {
  console.log('📥 Obteniendo ejercicios...');
  const exercises = await fetchAllPaginated(
    supabase
      .from('exercises')
      .select('*')
      .or(`user_id.eq.${USER_ID},is_public.eq.true`)
      .order('muscle_group', { ascending: true })
      .order('name', { ascending: true })
  );
  console.log(`   ${exercises.length} ejercicios encontrados`);

  console.log('📥 Obteniendo historial de series (paginado)...');
  const workoutSets = await fetchAllPaginated(
    supabase
      .from('workout_sets')
      .select(`
        *,
        workouts!inner (
          id,
          user_id,
          started_at,
          finished_at,
          name,
          duration_seconds,
          total_volume_kg,
          total_sets
        )
      `)
      .eq('workouts.user_id', USER_ID)
      .order('started_at', { referencedTable: 'workouts', ascending: false })
      .order('set_num', { ascending: true })
  );
  console.log(`   ${workoutSets.length} series encontradas`);

  console.log('📥 Obteniendo marcas personales...');
  const personalRecords = await fetchAllPaginated(
    supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', USER_ID)
      .order('achieved_at', { ascending: false })
  );
  console.log(`   ${personalRecords.length} marcas personales encontradas`);

  console.log('📥 Obteniendo progresión de ejercicios...');
  const exerciseProgression = await fetchAllPaginated(
    supabase
      .from('exercise_progression')
      .select('*')
      .eq('user_id', USER_ID)
      .order('updated_at', { ascending: false })
  );
  console.log(`   ${exerciseProgression.length} progresiones encontradas`);

  return { exercises, workoutSets, personalRecords, exerciseProgression };
}

function createExerciseLookup(exercises) {
  const lookup = {};
  exercises.forEach(ex => {
    lookup[ex.id] = ex;
  });
  return lookup;
}

async function generateExcel(data) {
  const { exercises, workoutSets, personalRecords, exerciseProgression } = data;
  const exerciseLookup = createExerciseLookup(exercises);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GymLog';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Estilos comunes
  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  };

  const cellStyle = {
    alignment: { vertical: 'middle', wrapText: true },
    border: {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    }
  };

  const numberStyle = { ...cellStyle, numFmt: '#,##0.00' };
  const intStyle = { ...cellStyle, numFmt: '#,##0' };
  const dateStyle = { ...cellStyle, numFmt: 'dd/mm/yyyy hh:mm' };

  function applyHeaderStyle(worksheet) {
    worksheet.getRow(1).eachCell((cell) => {
      Object.assign(cell, headerStyle);
    });
    worksheet.getRow(1).height = 25;
  }

  function autoWidth(worksheet, minWidth = 12, maxWidth = 45) {
    worksheet.columns.forEach(col => {
      let maxLen = minWidth;
      col.eachCell({ includeEmpty: true }, (cell) => {
        const val = cell.value instanceof Date
          ? 'DD/MM/YYYY HH:MM'
          : (cell.value ? String(cell.value) : '');
        maxLen = Math.max(maxLen, Math.min(val.length + 3, maxWidth));
      });
      col.width = maxLen;
    });
  }

  // ============================================
  // HOJA 1: EJERCICIOS (Catálogo completo)
  // ============================================
  const wsExercises = workbook.addWorksheet('Ejercicios', {
    properties: { tabColor: { argb: 'FF3182CE' } }
  });

  const exHeaders = [
    'ID', 'Nombre', 'Grupo Muscular', 'Detalle Muscular', 'Equipamiento',
    'Movimiento', 'Bilateral', 'Público', 'Usuario Creador', 'Fecha Creación',
    'Es Compuesto', 'Es Peso Corporal', 'Tipo Carga', 'Descripción', 'URL Media'
  ];
  wsExercises.addRow(exHeaders);
  applyHeaderStyle(wsExercises);

  exercises.forEach((ex) => {
    const isUserCreated = ex.user_id === USER_ID;
    const row = wsExercises.addRow([
      ex.id,
      ex.name,
      ex.muscle_group,
      ex.muscle_detail || '',
      ex.equipment || '',
      ex.movement || '',
      ex.is_bilateral ? 'Sí' : 'No',
      ex.is_public ? 'Sí (Predefinido)' : 'No (Propio)',
      isUserCreated ? 'Tú (fvidalmateo@gmail.com)' : (ex.user_id ? 'Otro usuario' : 'Sistema'),
      ex.created_at ? new Date(ex.created_at) : '',
      ex.is_compound ? 'Sí' : 'No',
      ex.is_bodyweight ? 'Sí' : 'No',
      ex.load_type || '',
      ex.description || '',
      ex.media_url || ''
    ]);
    row.eachCell((cell, colNum) => {
      Object.assign(cell, cellStyle);
      if (colNum === 10 && cell.value instanceof Date) Object.assign(cell, dateStyle);
    });
    if (isUserCreated) {
      row.getCell(8).font = { bold: true, color: { argb: 'FF2F855A' } };
    }
  });

  wsExercises.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: exHeaders.length }
  };
  wsExercises.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
  autoWidth(wsExercises);

  // ============================================
  // HOJA 2: HISTORIAL DE SERIES (Detallado)
  // ============================================
  const wsHistory = workbook.addWorksheet('Historial Series', {
    properties: { tabColor: { argb: 'FFD69E2E' } }
  });

  const histHeaders = [
    'Fecha Entreno', 'Nombre Entreno', 'Duración (min)', 'Volumen Total (kg)',
    'Ejercicio', 'Grupo Muscular', 'Equipamiento', 'Serie', 'Peso (kg)',
    'Repeticiones', 'RIR', 'RPE', '1RM Estimado', 'Tipo Serie', 'Calentamiento',
    'Notas', 'PR', 'ID Serie', 'ID Entreno', 'ID Ejercicio'
  ];
  wsHistory.addRow(histHeaders);
  applyHeaderStyle(wsHistory);

  workoutSets.forEach(ws => {
    const workout = ws.workouts;
    const exercise = exerciseLookup[ws.exercise_id];
    if (!workout || !exercise) return;

    const row = wsHistory.addRow([
      workout.started_at ? new Date(workout.started_at) : '',
      workout.name || 'Sin nombre',
      workout.duration_seconds ? Math.round(workout.duration_seconds / 60) : '',
      workout.total_volume_kg ? parseFloat(workout.total_volume_kg) : 0,
      exercise.name,
      exercise.muscle_group,
      exercise.equipment || '',
      ws.set_num,
      ws.weight,
      ws.reps,
      ws.rir ?? '',
      ws.rpe ?? '',
      ws.one_rm ? parseFloat(ws.one_rm) : '',
      ws.set_type || 'normal',
      ws.is_warmup ? 'Sí' : 'No',
      ws.notes || '',
      ws.is_pr ? '⭐ SÍ' : 'No',
      ws.id,
      workout.id,
      ws.exercise_id
    ]);
    row.eachCell((cell, colNum) => {
      Object.assign(cell, cellStyle);
      if ([4, 9, 13].includes(colNum)) Object.assign(cell, numberStyle);
      if ([3, 8, 10].includes(colNum)) Object.assign(cell, intStyle);
      if (colNum === 1 && cell.value instanceof Date) Object.assign(cell, dateStyle);
    });
    if (ws.is_pr) {
      row.getCell(17).font = { bold: true, color: { argb: 'FFC53030' } };
    }
  });

  wsHistory.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: histHeaders.length }
  };
  wsHistory.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
  autoWidth(wsHistory);

  // ============================================
  // HOJA 3: MARCAS PERSONALES (PRs)
  // ============================================
  const wsPRs = workbook.addWorksheet('Marcas Personales', {
    properties: { tabColor: { argb: 'FFC53030' } }
  });

  const prHeaders = [
    'Fecha Logro', 'Ejercicio', 'Grupo Muscular', 'Peso (kg)', 'Repeticiones',
    '1RM Estimado', 'Banda Repeticiones', 'ID Serie Origen', 'ID Marca'
  ];
  wsPRs.addRow(prHeaders);
  applyHeaderStyle(wsPRs);

  personalRecords.forEach(pr => {
    const exercise = exerciseLookup[pr.exercise_id];
    const row = wsPRs.addRow([
      pr.achieved_at ? new Date(pr.achieved_at) : '',
      exercise?.name || 'Desconocido',
      exercise?.muscle_group || '',
      pr.weight,
      pr.reps,
      pr.one_rm ? parseFloat(pr.one_rm) : '',
      pr.rep_band,
      pr.workout_set_id || '',
      pr.id
    ]);
    row.eachCell((cell, colNum) => {
      Object.assign(cell, cellStyle);
      if ([4, 6].includes(colNum)) Object.assign(cell, numberStyle);
      if ([5].includes(colNum)) Object.assign(cell, intStyle);
      if (colNum === 1 && cell.value instanceof Date) Object.assign(cell, dateStyle);
    });
  });

  wsPRs.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: prHeaders.length }
  };
  wsPRs.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
  autoWidth(wsPRs);

  // ============================================
  // HOJA 4: PROGRESIÓN DE EJERCICIOS
  // ============================================
  const wsProgression = workbook.addWorksheet('Progresión', {
    properties: { tabColor: { argb: 'FF38A169' } }
  });

  const progHeaders = [
    'Ejercicio', 'Peso Actual (kg)', 'Repeticiones Actuales', 'Incremento (kg)',
    'Es Peso Corporal', 'Rango Rep Min', 'Rango Rep Max', 'Sesiones',
    'Próxima Descarga (semana)', 'En Semana Descarga', 'Creado', 'Actualizado'
  ];
  wsProgression.addRow(progHeaders);
  applyHeaderStyle(wsProgression);

  exerciseProgression.forEach(ep => {
    const row = wsProgression.addRow([
      ep.exercise_name,
      ep.current_weight ? parseFloat(ep.current_weight) : 0,
      ep.current_reps ?? '',
      ep.increment_kg ? parseFloat(ep.increment_kg) : 0,
      ep.bodyweight ? 'Sí' : 'No',
      ep.rep_min ?? '',
      ep.rep_max ?? '',
      ep.session_count,
      ep.next_deload_week,
      ep.is_deload_week ? 'Sí' : 'No',
      ep.created_at ? new Date(ep.created_at) : '',
      ep.updated_at ? new Date(ep.updated_at) : ''
    ]);
    row.eachCell((cell, colNum) => {
      Object.assign(cell, cellStyle);
      if ([2, 4].includes(colNum)) Object.assign(cell, numberStyle);
      if ([3, 8, 9].includes(colNum)) Object.assign(cell, intStyle);
      if ([11, 12].includes(colNum) && cell.value instanceof Date) Object.assign(cell, dateStyle);
    });
    if (ep.is_deload_week) {
      row.getCell(10).font = { bold: true, color: { argb: 'FFDD6B20' } };
    }
  });

  wsProgression.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: progHeaders.length }
  };
  wsProgression.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
  autoWidth(wsProgression);

  // ============================================
  // HOJA 5: RESUMEN POR EJERCICIO (Estadísticas)
  // ============================================
  const wsSummary = workbook.addWorksheet('Resumen por Ejercicio', {
    properties: { tabColor: { argb: 'FF805AD5' } }
  });

  const exerciseStats = {};
  workoutSets.forEach(ws => {
    const exercise = exerciseLookup[ws.exercise_id];
    if (!exercise) return;

    const key = ws.exercise_id;
    if (!exerciseStats[key]) {
      exerciseStats[key] = {
        exercise,
        totalSets: 0,
        totalReps: 0,
        totalVolume: 0,
        maxWeight: 0,
        maxReps: 0,
        maxOneRM: 0,
        firstDate: null,
        lastDate: null,
        workouts: new Set(),
        prCount: 0
      };
    }
    const stat = exerciseStats[key];
    stat.totalSets++;
    stat.totalReps += ws.reps || 0;
    stat.totalVolume += (ws.weight || 0) * (ws.reps || 0);
    if (ws.weight > stat.maxWeight) stat.maxWeight = ws.weight;
    if (ws.reps > stat.maxReps) stat.maxReps = ws.reps;
    if (ws.one_rm && parseFloat(ws.one_rm) > stat.maxOneRM) stat.maxOneRM = parseFloat(ws.one_rm);
    const workout = ws.workouts;
    if (workout?.started_at) {
      const d = new Date(workout.started_at);
      if (!stat.firstDate || d < stat.firstDate) stat.firstDate = d;
      if (!stat.lastDate || d > stat.lastDate) stat.lastDate = d;
      stat.workouts.add(workout.id);
    }
    if (ws.is_pr) stat.prCount++;
  });

  // Contar PRs reales por ejercicio desde personal_records
  const prCountByExercise = {};
  personalRecords.forEach(pr => {
    prCountByExercise[pr.exercise_id] = (prCountByExercise[pr.exercise_id] || 0) + 1;
  });
  Object.keys(prCountByExercise).forEach(key => {
    if (exerciseStats[key]) {
      exerciseStats[key].prCount = Math.max(exerciseStats[key].prCount, prCountByExercise[key]);
    }
  });

  const sumHeaders = [
    'Ejercicio', 'Grupo Muscular', 'Equipamiento', 'Tipo', 'Entrenos',
    'Total Series', 'Total Repeticiones', 'Volumen Total (kg)',
    'Peso Máx (kg)', 'Repeticiones Máx', '1RM Máx Estimado',
    'Primera Vez', 'Última Vez', 'Marcas Personales', 'Progresión Activa'
  ];
  wsSummary.addRow(sumHeaders);
  applyHeaderStyle(wsSummary);

  const sortedStats = Object.values(exerciseStats).sort((a, b) => {
    const mg = a.exercise.muscle_group.localeCompare(b.exercise.muscle_group);
    return mg !== 0 ? mg : a.exercise.name.localeCompare(b.exercise.name);
  });

  sortedStats.forEach(stat => {
    const ex = stat.exercise;
    const isUserCreated = ex.user_id === USER_ID;
    const hasProgression = exerciseProgression.some(ep =>
      ep.exercise_name.toLowerCase() === ex.name.toLowerCase()
    );

    const row = wsSummary.addRow([
      ex.name,
      ex.muscle_group,
      ex.equipment || '',
      isUserCreated ? 'Propio' : (ex.is_public ? 'Predefinido' : 'Otro usuario'),
      stat.workouts.size,
      stat.totalSets,
      stat.totalReps,
      Math.round(stat.totalVolume * 100) / 100,
      stat.maxWeight,
      stat.maxReps,
      Math.round(stat.maxOneRM * 100) / 100,
      stat.firstDate ? stat.firstDate.toLocaleDateString('es-ES') : '',
      stat.lastDate ? stat.lastDate.toLocaleDateString('es-ES') : '',
      stat.prCount,
      hasProgression ? '✅ Sí' : '❌ No'
    ]);
    row.eachCell((cell, colNum) => {
      Object.assign(cell, cellStyle);
      if ([8, 9, 11].includes(colNum)) Object.assign(cell, numberStyle);
      if ([5, 6, 7, 10, 14].includes(colNum)) Object.assign(cell, intStyle);
    });
    if (isUserCreated) {
      row.getCell(4).font = { bold: true, color: { argb: 'FF2F855A' } };
    }
    if (hasProgression) {
      row.getCell(15).font = { bold: true, color: { argb: 'FF2F855A' } };
    }
  });

  wsSummary.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sumHeaders.length }
  };
  wsSummary.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
  autoWidth(wsSummary);

  // ============================================
  // HOJA 6: RESUMEN GENERAL (Dashboard)
  // ============================================
  const wsDashboard = workbook.addWorksheet('Dashboard', {
    properties: { tabColor: { argb: 'FF2B6CB0' } }
  });

  const totalWorkouts = new Set(workoutSets.map(ws => ws.workout_id).filter(Boolean)).size;
  const totalSets = workoutSets.length;
  const totalReps = workoutSets.reduce((sum, ws) => sum + (ws.reps || 0), 0);
  const totalVolume = workoutSets.reduce((sum, ws) => sum + (ws.weight || 0) * (ws.reps || 0), 0);
  const userExercises = exercises.filter(e => e.user_id === USER_ID).length;
  const publicExercises = exercises.filter(e => e.is_public && e.user_id !== USER_ID).length;
  const exercisesWithHistory = Object.keys(exerciseStats).length;
  const exercisesWithProgression = exerciseProgression.length;
  const totalPRs = personalRecords.length;

  const firstWorkoutDate = workoutSets
    .map(ws => ws.workouts?.started_at)
    .filter(Boolean)
    .map(d => new Date(d))
    .sort((a, b) => a - b)[0];

  const lastWorkoutDate = workoutSets
    .map(ws => ws.workouts?.started_at)
    .filter(Boolean)
    .map(d => new Date(d))
    .sort((a, b) => b - a)[0];

  const dashboardData = [
    ['GYMLOG - INFORME COMPLETO DE ENTRENAMIENTO', ''],
    ['Usuario', 'fvidalmateo@gmail.com'],
    ['ID Usuario', USER_ID],
    ['Fecha del informe', new Date().toLocaleString('es-ES')],
    ['', ''],
    ['📊 RESUMEN GENERAL', ''],
    ['Total Entrenos Registrados', totalWorkouts],
    ['Total Series Realizadas', totalSets],
    ['Total Repeticiones', totalReps],
    ['Volumen Total (kg)', Math.round(totalVolume * 100) / 100],
    ['Marcas Personales (PRs)', totalPRs],
    ['', ''],
    ['📚 CATÁLOGO DE EJERCICIOS', ''],
    ['Ejercicios Propios Creados', userExercises],
    ['Ejercicios Predefinidos (Públicos)', publicExercises],
    ['Total Ejercicios Disponibles', exercises.length],
    ['Ejercicios con Historial', exercisesWithHistory],
    ['Ejercicios con Progresión Activa', exercisesWithProgression],
    ['', ''],
    ['📅 RANGO DE FECHAS', ''],
    ['Primer Entreno Registrado', firstWorkoutDate ? firstWorkoutDate.toLocaleDateString('es-ES') : 'N/A'],
    ['Último Entreno Registrado', lastWorkoutDate ? lastWorkoutDate.toLocaleDateString('es-ES') : 'N/A'],
    ['', ''],
    ['🏆 TOP 5 EJERCICIOS POR VOLUMEN', ''],
  ];

  dashboardData.forEach(([label, value]) => {
    const row = wsDashboard.addRow([label, value]);
    if (label.startsWith('GYMLOG') || label.endsWith(':')) {
      row.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1A202C' } };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF8FF' } };
    } else if (label.startsWith('📊') || label.startsWith('📚') || label.startsWith('📅') || label.startsWith('🏆')) {
      row.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF2B6CB0' } };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF8FF' } };
    } else {
      row.getCell(1).font = { bold: true };
      row.getCell(2).alignment = { horizontal: 'right' };
    }
  });

  const topByVolume = [...sortedStats]
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, 5);

  topByVolume.forEach((stat, i) => {
    const row = wsDashboard.addRow([
      `${i + 1}. ${stat.exercise.name} (${stat.exercise.muscle_group})`,
      `${Math.round(stat.totalVolume * 100) / 100} kg (${stat.totalSets} series, ${stat.workouts.size} entrenos)`
    ]);
    row.getCell(1).font = { bold: i === 0 };
  });

  wsDashboard.getColumn(1).width = 50;
  wsDashboard.getColumn(2).width = 45;

  // ============================================
  // GUARDAR ARCHIVO
  // ============================================
  const filename = `GymLog_Informe_Completo_${new Date().toISOString().split('T')[0]}.xlsx`;
  const filepath = `C:\\Users\\franc\\proyectos\\apps\\gymlog\\${filename}`;

  await workbook.xlsx.writeFile(filepath);
  console.log(`\n✅ Informe Excel generado: ${filepath}`);
  console.log(`   Hojas: Ejercicios, Historial Series, Marcas Personales, Progresión, Resumen por Ejercicio, Dashboard`);
  console.log(`   Ejercicios: ${exercises.length} | Series: ${workoutSets.length} | PRs: ${personalRecords.length} | Progresiones: ${exerciseProgression.length}`);

  return filepath;
}

async function main() {
  try {
    console.log('🚀 Generando informe completo GymLog para fvidalmateo@gmail.com\n');
    const data = await fetchAllData();
    await generateExcel(data);
    console.log('\n🎉 ¡Informe completado con éxito!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();