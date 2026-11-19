import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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

const USER_ID = 'f95d5098-47ef-4825-a5ff-8540cc3524f6'; // fvidalmateo@gmail.com

async function fetchData() {
  console.log('📥 Obteniendo catálogo de ejercicios...');
  const { data: exercises, error: exError } = await supabase
    .from('exercises')
    .select('id, name, muscle_group, muscle_detail, equipment, is_compound, is_bodyweight')
    .or(`user_id.eq.${USER_ID},is_public.eq.true`);

  if (exError) throw exError;
  console.log(`   ${exercises.length} ejercicios cargados`);

  console.log('📥 Obteniendo rutinas desde user_routines...');
  const { data: userRoutines, error: urError } = await supabase
    .from('user_routines')
    .select('*')
    .eq('user_id', USER_ID);

  if (urError) throw urError;
  console.log(`   ${userRoutines.length} registros en user_routines encontrados`);

  console.log('📥 Obteniendo plantillas desde routine_templates...');
  const { data: templates, error: tplError } = await supabase
    .from('routine_templates')
    .select('*');

  if (tplError) throw tplError;
  console.log(`   ${templates.length} plantillas encontradas`);

  return { exercises, userRoutines, templates };
}

function flattenRoutineJson(routineJson, exerciseMap, defaultRoutineName = 'Mi Rutina') {
  const rows = [];
  if (!routineJson) return rows;

  const parsed = typeof routineJson === 'string' ? JSON.parse(routineJson) : routineJson;

  const extractExercises = (routineName, dayName, dayOrder, exList) => {
    if (!Array.isArray(exList)) return;

    exList.forEach((item, idx) => {
      const exId = item.exercise_id || item.exerciseId || item.id || null;
      const catalogEx = exId ? exerciseMap[exId] : null;

      const name =
        item.name ||
        item.exercise_name ||
        item.exerciseName ||
        catalogEx?.name ||
        'Ejercicio sin nombre';

      rows.push({
        routineName,
        dayOrder,
        dayName,
        exerciseOrder: idx + 1,
        exerciseName: name,
        muscleGroup: item.muscle_group || item.muscleGroup || catalogEx?.muscle_group || '',
        equipment: item.equipment || catalogEx?.equipment || '',
        sets: item.target_sets ?? item.sets ?? item.series ?? '',
        repsMin: item.target_reps_min ?? item.reps_min ?? item.minReps ?? item.reps ?? '',
        repsMax: item.target_reps_max ?? item.reps_max ?? item.maxReps ?? item.reps ?? '',
        rir: item.target_rir ?? item.rir ?? item.rpe ?? '',
        rest: item.rest_seconds ?? item.rest ?? item.descanso ?? '',
        superset: item.superset_id ?? item.superset ?? '',
        notes: item.notes ?? item.notas ?? '',
        exerciseId: exId || ''
      });
    });
  };

  if (Array.isArray(parsed)) {
    parsed.forEach((entry, i) => {
      if (Array.isArray(entry.days)) {
        const rName = entry.name || entry.title || `Rutina ${i + 1}`;
        entry.days.forEach((day, dIdx) => {
          extractExercises(
            rName,
            day.name || day.title || day.day || `Día ${dIdx + 1}`,
            dIdx + 1,
            day.exercises || day.items || []
          );
        });
      } else {
        extractExercises(
          defaultRoutineName,
          entry.name || entry.title || entry.day || `Día ${i + 1}`,
          i + 1,
          entry.exercises || entry.items || []
        );
      }
    });
    return rows;
  }

  if (typeof parsed === 'object') {
    const rName = parsed.name || parsed.title || defaultRoutineName;

    if (Array.isArray(parsed.days)) {
      parsed.days.forEach((day, dIdx) => {
        extractExercises(
          rName,
          day.name || day.title || day.day || `Día ${dIdx + 1}`,
          dIdx + 1,
          day.exercises || day.items || []
        );
      });
      return rows;
    }

    let dIdx = 1;
    for (const [key, val] of Object.entries(parsed)) {
      if (Array.isArray(val)) {
        extractExercises(rName, key, dIdx++, val);
      } else if (val && typeof val === 'object' && Array.isArray(val.exercises)) {
        extractExercises(rName, val.name || key, dIdx++, val.exercises);
      }
    }
  }

  return rows;
}

async function generateExcel({ exercises, userRoutines, templates }) {
  const exerciseMap = Object.fromEntries(exercises.map(e => [e.id, e]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GymLog';
  workbook.created = new Date();
  workbook.modified = new Date();

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

  const intStyle = { ...cellStyle, numFmt: '#,##0' };
  const dateStyle = { ...cellStyle, numFmt: 'dd/mm/yyyy hh:mm' };

  function applyHeaderStyle(worksheet) {
    worksheet.getRow(1).eachCell(cell => Object.assign(cell, headerStyle));
    worksheet.getRow(1).height = 25;
  }

  function autoWidth(worksheet, minWidth = 12, maxWidth = 50) {
    worksheet.columns.forEach(col => {
      let maxLen = minWidth;
      col.eachCell({ includeEmpty: true }, cell => {
        const val = cell.value instanceof Date
          ? 'DD/MM/YYYY HH:MM'
          : (cell.value ? String(cell.value) : '');
        maxLen = Math.max(maxLen, Math.min(val.length + 3, maxWidth));
      });
      col.width = maxLen;
    });
  }

  // ============================================
  // HOJA 1: MIS RUTINAS
  // ============================================
  const wsMyRoutines = workbook.addWorksheet('Mis Rutinas', {
    properties: { tabColor: { argb: 'FF3182CE' } }
  });

  const headers = [
    'Rutina', 'Orden Día', 'Día / Sesión', 'Orden Ej.', 'Ejercicio',
    'Grupo Muscular', 'Equipamiento', 'Series', 'Reps Min', 'Reps Max',
    'RIR / RPE', 'Descanso (seg)', 'Superserie', 'Notas', 'ID Ejercicio'
  ];
  wsMyRoutines.addRow(headers);
  applyHeaderStyle(wsMyRoutines);

  let totalParsedRows = 0;

  userRoutines.forEach(ur => {
    const rows = flattenRoutineJson(ur.routine, exerciseMap, 'Mi Rutina');
    totalParsedRows += rows.length;

    rows.forEach(r => {
      const row = wsMyRoutines.addRow([
        r.routineName,
        r.dayOrder,
        r.dayName,
        r.exerciseOrder,
        r.exerciseName,
        r.muscleGroup,
        r.equipment,
        r.sets,
        r.repsMin,
        r.repsMax,
        r.rir,
        r.rest,
        r.superset,
        r.notes,
        r.exerciseId
      ]);

      row.eachCell((cell, colNum) => {
        Object.assign(cell, cellStyle);
        if ([2, 4, 8, 9, 10, 12].includes(colNum) && typeof cell.value === 'number') {
          Object.assign(cell, intStyle);
        }
      });
    });
  });

  wsMyRoutines.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length }
  };
  wsMyRoutines.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
  autoWidth(wsMyRoutines);

  // ============================================
  // HOJA 2: JSON ORIGINAL
  // ============================================
  const wsRaw = workbook.addWorksheet('JSON Original', {
    properties: { tabColor: { argb: 'FF805AD5' } }
  });

  wsRaw.addRow(['ID Registro', 'User ID', 'Última Actualización', 'JSON Completo (routine)']);
  applyHeaderStyle(wsRaw);

  userRoutines.forEach(ur => {
    const row = wsRaw.addRow([
      ur.id,
      ur.user_id,
      ur.updated_at ? new Date(ur.updated_at) : '',
      JSON.stringify(ur.routine, null, 2)
    ]);
    row.eachCell((cell, colNum) => {
      Object.assign(cell, cellStyle);
      if (colNum === 3 && cell.value instanceof Date) Object.assign(cell, dateStyle);
    });
  });

  wsRaw.getColumn(1).width = 38;
  wsRaw.getColumn(2).width = 38;
  wsRaw.getColumn(3).width = 22;
  wsRaw.getColumn(4).width = 90;

  // ============================================
  // HOJA 3: PLANTILLAS DISPONIBLES
  // ============================================
  const wsTemplates = workbook.addWorksheet('Plantillas Rutina', {
    properties: { tabColor: { argb: 'FF38A169' } }
  });

  const tplHeaders = [
    'Plantilla', 'Descripción', 'Orden Día', 'Día / Sesión', 'Orden Ej.',
    'Ejercicio', 'Grupo Muscular', 'Series', 'Reps Min', 'Reps Max', 'Notas'
  ];
  wsTemplates.addRow(tplHeaders);
  applyHeaderStyle(wsTemplates);

  templates.forEach(tpl => {
    const rows = flattenRoutineJson(tpl.days_data, exerciseMap, tpl.name);
    rows.forEach(r => {
      const row = wsTemplates.addRow([
        tpl.name,
        tpl.description || '',
        r.dayOrder,
        r.dayName,
        r.exerciseOrder,
        r.exerciseName,
        r.muscleGroup,
        r.sets,
        r.repsMin,
        r.repsMax,
        r.notes
      ]);
      row.eachCell((cell, colNum) => {
        Object.assign(cell, cellStyle);
        if ([3, 5, 8, 9, 10].includes(colNum) && typeof cell.value === 'number') {
          Object.assign(cell, intStyle);
        }
      });
    });
  });

  wsTemplates.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: tplHeaders.length }
  };
  wsTemplates.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
  autoWidth(wsTemplates);

  // ============================================
  // GUARDAR ARCHIVO
  // ============================================
  const filename = `GymLog_Mis_Rutinas_${new Date().toISOString().split('T')[0]}.xlsx`;
  const filepath = `C:\\Users\\franc\\proyectos\\apps\\gymlog\\${filename}`;

  await workbook.xlsx.writeFile(filepath);
  console.log(`\n✅ Excel de rutinas generado: ${filepath}`);
  console.log(`   Registros user_routines: ${userRoutines.length} | Filas de ejercicios desglosadas: ${totalParsedRows} | Plantillas: ${templates.length}`);

  return filepath;
}

async function main() {
  try {
    console.log('🚀 Exportando rutinas de GymLog para fvidalmateo@gmail.com\n');
    const data = await fetchData();
    await generateExcel(data);
    console.log('\n🎉 ¡Exportación completada con éxito!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();