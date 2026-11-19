import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://eoltmipoklizewxdpzfa.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SB_KEY) {
  console.error('❌ Falta SUPABASE_SERVICE_ROLE_KEY en tu archivo .env (necesaria para escribir saltando RLS)');
  process.exit(1);
}

const supabase = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: false }
});

const USER_ID = 'f95d5098-47ef-4825-a5ff-8540cc3524f6';
const NOW_ISO = new Date().toISOString();

const NEW_ROUTINES = [
  {
    id: 'custom-playa-2026-acumulacion',
    name: '1 · Playa Dic — Fuerza, Potencia y Sábado Plio',
    isCustom: true,
    createdAt: NOW_ISO,
    description: 'Bloque Semanas 1-4 (17 nov - 13 dic) rumbo al torneo del 26 de diciembre. Integra tus ejercicios propios y separa la fuerza pesada (Lunes) de la pliometría (Sábado) para maximizar recuperación y RFD.',
    days: {
      monday: {
        name: 'Fuerza Inferior y Blindaje Tendinoso',
        exercises: [
          {
            name: 'Sentadilla',
            sets: 4,
            reps: '3-5',
            notes: 'S1: 105-110kg · S2: 115kg · S3: 125-127,5kg · S4: 117,5kg. Cortar por pérdida de velocidad (VL 10-15%). Descanso 3 min.'
          },
          {
            name: 'Peso muerto',
            sets: 3,
            reps: '3-4',
            notes: 'S2: 120kg · S3: 130-132,5kg · S4: 122,5kg. Despegue explosivo desde suelo sin rebotar. Descanso 3 min.'
          },
          {
            name: 'Curl Nórdico',
            sets: 2,
            reps: '4-5',
            notes: 'Bajada lenta 3-4 s. Dosis mínima de mantenimiento sin generar agujetas limitantes.'
          },
          {
            name: 'Curl femoral sentado',
            sets: 3,
            reps: '6-8',
            notes: '85-95 kg. Control excéntrico de 2-3 s.'
          },
          {
            name: 'Gemelos de pie',
            sets: 4,
            reps: '6-8',
            notes: '115-125 kg. HSR: 3 s bajada y 1 s pausa abajo.'
          },
          {
            name: 'Gemelos sentado',
            sets: 3,
            reps: '8-10',
            notes: 'Carga alta controlada para el sóleo (clave con rodilla flexionada en arena).'
          },
          {
            name: 'Crunch polea',
            sets: 3,
            reps: '10',
            notes: '95-102,5 kg.'
          }
        ]
      },
      tuesday: {
        name: 'Fuerza Superior, Hombro OSTRC y Core',
        exercises: [
          {
            name: 'Rotación externa con goma',
            sets: 3,
            reps: '15',
            perSide: true,
            notes: 'Calentamiento OSTRC a 90 grados de abducción.'
          },
          {
            name: 'Face pull',
            sets: 3,
            reps: '15',
            notes: '40-45 kg. Control escapular antes de empujar.'
          },
          {
            name: 'Press banca',
            sets: 4,
            reps: '3-5',
            notes: 'S1: 72,5-77,5kg · S2: 77,5-82,5kg · S3: 87,5kg · S4: 80kg. Opción S3-S4: sustituir última serie por Mid Push Barra (2x3-5s).'
          },
          {
            name: 'Remo con barra',
            sets: 4,
            reps: '5-6',
            notes: 'S2: 87,5kg · S3: 95-97,5kg · S4: 90kg.'
          },
          {
            name: 'Pull Over',
            sets: 3,
            reps: '8-10',
            notes: '50-60 kg. Rango cómodo de hombro para transferencia al lanzamiento.'
          },
          {
            name: 'Press Pallof',
            sets: 3,
            reps: '10',
            perSide: true,
            notes: '17,5-20 kg (o Press pallof gomas 5 kg). Pausa 2 s extendido.'
          },
          {
            name: 'Tríceps en poleas V',
            sets: 3,
            reps: '8-10',
            notes: '55-60 kg (alternar semanas con Polea tras-nuca 30-35 kg).'
          },
          {
            name: 'Curl Bíceps barra+Antebrazos',
            sets: 2,
            reps: '10',
            notes: '30-33 kg. Sin llegar al fallo.'
          }
        ]
      },
      wednesday: {
        name: 'Descanso / Movilidad',
        exercises: []
      },
      thursday: {
        name: 'Potencia Balística, Unilateral y Agarre',
        exercises: [
          {
            name: 'Power Clean',
            sets: 4,
            reps: '2-3',
            notes: '55-67,5 kg. Parar 1-2 s en el suelo entre reps. Alternable en semanas pares con Power Snatch (3x2 @45-50 kg).'
          },
          {
            name: 'Hip thrust',
            sets: 3,
            reps: '5-6',
            notes: '120-137,5 kg. Subida explosiva.'
          },
          {
            name: 'Cajón step lateral',
            sets: 3,
            reps: '8',
            perSide: true,
            notes: 'Control de valgo de rodilla y glúteo medio. Alternable con Sentadilla búlgara (3x6/lado).'
          },
          {
            name: 'Press militar',
            sets: 3,
            reps: '4-6',
            notes: '52,5-60 kg. Empuje vertical estricto y veloz.'
          },
          {
            name: 'Lanzamiento balón',
            sets: 3,
            reps: '5',
            perSide: true,
            notes: 'Balón 5 kg. 5 rotacionales por lado + 5 sobre cabeza a máxima intención.'
          },
          {
            name: 'Leñador en polea',
            sets: 3,
            reps: '8',
            perSide: true,
            notes: '20-22,5 kg.'
          },
          {
            name: 'Paseo del granjero',
            sets: 3,
            reps: '24',
            notes: '35 kg por mano. 24 pasos/metros a ritmo vivo, agarre firme y contacto corto.'
          }
        ]
      },
      friday: {
        name: 'Descanso / Regeneración Pre-Plio',
        exercises: []
      },
      saturday: {
        name: 'Pliometría, Reactividad y Sprints',
        exercises: [
          {
            name: 'Mid-Thigh Pull cinturón',
            sets: 2,
            reps: '1',
            mode: 'time',
            durationSeconds: 4,
            notes: 'Opcional en S3-S4 como PAPE: tirón isométrico máximo 3-5 s y descansar 4 min antes de saltar.'
          },
          {
            name: 'Saltos skater',
            sets: 4,
            reps: '6',
            perSide: true,
            notes: 'S1: 3x6 pausa 2s · S2-S3: 4x6 + 10-15m sprint · S4: 5x6 + sprint.'
          },
          {
            name: 'Salto con gomas',
            sets: 4,
            reps: '6',
            notes: 'Goma como RESISTENCIA (anclada abajo/atrás) + 10-15m sprint tras la serie. Descanso 2-3 min.'
          },
          {
            name: 'Salto al cajón',
            sets: 4,
            reps: '5',
            notes: 'Bajar caminando (sin impacto excéntrico). S1: 3x6 · S2-S3: 4x6 · S4: 5x6. Tope 72-90 contactos totales.'
          }
        ]
      },
      sunday: {
        name: 'Descanso',
        exercises: []
      }
    }
  },
  {
    id: 'custom-playa-2026-taper',
    name: '2 · Playa Dic — Taper Torneo 26/12',
    isCustom: true,
    createdAt: NOW_ISO,
    description: 'Semanas 5 y 6 (14 - 26 dic). Recorte progresivo de volumen del 40% al 60% manteniendo cargas del 80-85% 1RM para llegar con máxima frescura al torneo del sábado 26.',
    days: {
      monday: {
        name: 'Fuerza-Velocidad (Volumen Reducido)',
        exercises: [
          {
            name: 'Sentadilla',
            sets: 2,
            reps: '3',
            notes: '117,5-125 kg (80-85%). Rápida y sin fatiga. En Sem 5 puedes hacer 3x3.'
          },
          {
            name: 'Press banca',
            sets: 2,
            reps: '3',
            notes: '82,5-87,5 kg (80-85%). Máxima intención concéntrica.'
          },
          {
            name: 'Remo con barra',
            sets: 2,
            reps: '4',
            notes: '92,5 kg.'
          },
          {
            name: 'Gemelos de pie',
            sets: 2,
            reps: '6',
            notes: 'Dinámicos controlados, sin agujetas.'
          }
        ]
      },
      tuesday: {
        name: 'Movilidad y Salud de Hombro',
        exercises: [
          {
            name: 'Rotación externa con goma',
            sets: 2,
            reps: '15',
            perSide: true,
            notes: 'Banda ligera, control escapular.'
          },
          {
            name: 'Face pull',
            sets: 2,
            reps: '15',
            notes: '35-40 kg suave.'
          },
          {
            name: 'Press pallof gomas',
            sets: 2,
            reps: '10',
            perSide: true,
            notes: 'Activación suave de core.'
          }
        ]
      },
      wednesday: {
        name: 'Activación Neural Breve (Sem 6)',
        exercises: [
          {
            name: 'Power Clean',
            sets: 3,
            reps: '2',
            notes: '60-65 kg. Descanso 3 min. Cortar en cuanto pierda chispa.'
          },
          {
            name: 'Mid Push Barra',
            sets: 2,
            reps: '1',
            mode: 'time',
            durationSeconds: 3,
            notes: 'Opcional si necesitas despertar RFD sin fatiga.'
          },
          {
            name: 'Lanzamiento balón',
            sets: 2,
            reps: '5',
            perSide: true,
            notes: 'Balón 5 kg rápido y sin fatiga.'
          }
        ]
      },
      thursday: {
        name: 'Regeneración Total (Sem 6) / Potencia Suave (Sem 5)',
        exercises: [
          {
            name: 'Cajón step lateral',
            sets: 2,
            reps: '6',
            perSide: true,
            notes: 'Solo hacer en Semana 5 (17 dic). En Semana 6 (24 dic) descanso total.'
          }
        ]
      },
      friday: {
        name: 'Descanso Total Pre-Torneo',
        exercises: []
      },
      saturday: {
        name: 'Plio Descarga (Sem 5) / TORNEO PLAYA (26/12)',
        exercises: [
          {
            name: 'Salto al cajón',
            sets: 3,
            reps: '4',
            notes: 'SOLO Sem 5 (19 dic): max 54 contactos totales con Saltos skater + sprints 10m. El 26 dic es TORNEO: calentamiento 12-15 min.'
          }
        ]
      },
      sunday: {
        name: 'Descanso',
        exercises: []
      }
    }
  },
  {
    id: 'custom-post-torneo-2026',
    name: '3 · Post-Torneo — Descarga y Readaptación',
    isCustom: true,
    createdAt: NOW_ISO,
    description: 'Bloque puente de 2 semanas (27 dic - 10 ene) tras el torneo de playa. Semana 1 regenerativa al 60-65% y Semana 2 de readaptación a pista al 72-77,5% antes de iniciar Competición.',
    days: {
      monday: {
        name: 'Readaptación Inferior',
        exercises: [
          {
            name: 'Sentadilla',
            sets: 3,
            reps: '5',
            notes: 'Sem Post (28 dic): 2x5 @90-95kg · Sem Puente (4 ene): 3x5 @105-112,5kg.'
          },
          {
            name: 'Peso muerto',
            sets: 2,
            reps: '4',
            notes: 'Solo en Sem Puente (4 ene) a 115 kg suave.'
          },
          {
            name: 'Curl Nórdico',
            sets: 2,
            reps: '4',
            notes: 'Mantenimiento excéntrico sin sobrecarga.'
          },
          {
            name: 'Gemelos de pie',
            sets: 3,
            reps: '10',
            notes: '90-100 kg controlado.'
          }
        ]
      },
      tuesday: {
        name: 'Descanso / Movilidad',
        exercises: []
      },
      wednesday: {
        name: 'Readaptación Superior y Hombro',
        exercises: [
          {
            name: 'Rotación externa con goma',
            sets: 3,
            reps: '15',
            perSide: true,
            notes: 'OSTRC preventivo.'
          },
          {
            name: 'Face pull',
            sets: 3,
            reps: '15',
            notes: '37,5-42,5 kg.'
          },
          {
            name: 'Press banca',
            sets: 3,
            reps: '5',
            notes: 'Sem Post: 2x5 @65-70kg · Sem Puente: 3x5 @77,5-80kg.'
          },
          {
            name: 'Remo con barra',
            sets: 3,
            reps: '6',
            notes: 'Sem Post: 75kg · Sem Puente: 85kg.'
          },
          {
            name: 'Press pallof gomas',
            sets: 2,
            reps: '10',
            perSide: true
          }
        ]
      },
      thursday: {
        name: 'Descanso',
        exercises: []
      },
      friday: {
        name: 'Potencia Ligera y Estabilidad',
        exercises: [
          {
            name: 'Power Clean',
            sets: 3,
            reps: '3',
            notes: '55-60 kg solo en Sem Puente (8 ene).'
          },
          {
            name: 'Cajón step lateral',
            sets: 2,
            reps: '8',
            perSide: true
          },
          {
            name: 'Pull Over',
            sets: 2,
            reps: '10',
            notes: '45-50 kg suave.'
          }
        ]
      },
      saturday: {
        name: 'Descanso / Paseo Activo',
        exercises: []
      },
      sunday: {
        name: 'Descanso',
        exercises: []
      }
    }
  },
  {
    id: 'custom-pista-competicion-2027',
    name: '4 · Pista — Competición Optimizada',
    isCustom: true,
    createdAt: NOW_ISO,
    description: 'Bloque in-season desde el 11 de enero 2027 con partido los sábados. 2 sesiones de fuerza densa (Lunes y Miércoles) + micro-sesiones preventivas de hombro, core y activación.',
    days: {
      monday: {
        name: 'Fuerza Inferior (Lejos del Partido)',
        exercises: [
          {
            name: 'Sentadilla',
            sets: 4,
            reps: '4',
            notes: '115-122,5 kg (80-85%). Cortar por velocidad (VL 10-15%).'
          },
          {
            name: 'Hip thrust',
            sets: 3,
            reps: '6',
            notes: '120-130 kg.'
          },
          {
            name: 'Curl Nórdico',
            sets: 2,
            reps: '4',
            notes: 'Dosis mínima de mantenimiento semanal.'
          },
          {
            name: 'Curl femoral sentado',
            sets: 2,
            reps: '8',
            notes: '80-85 kg.'
          },
          {
            name: 'Gemelos de pie',
            sets: 3,
            reps: '8',
            notes: '110-120 kg.'
          }
        ]
      },
      tuesday: {
        name: 'Hombro OSTRC y Core (20 min)',
        exercises: [
          {
            name: 'Rotación externa con goma',
            sets: 3,
            reps: '15',
            perSide: true
          },
          {
            name: 'Face pull',
            sets: 3,
            reps: '15',
            notes: '40-45 kg.'
          },
          {
            name: 'Press Pallof',
            sets: 3,
            reps: '10',
            perSide: true,
            notes: '17,5-20 kg.'
          },
          {
            name: 'Crunch polea',
            sets: 2,
            reps: '10',
            notes: '95-100 kg.'
          }
        ]
      },
      wednesday: {
        name: 'Fuerza Superior',
        exercises: [
          {
            name: 'Press banca',
            sets: 4,
            reps: '4',
            notes: '82,5-90 kg.'
          },
          {
            name: 'Dominadas',
            sets: 3,
            reps: '5-6',
            notes: 'Controladas y explosivas.'
          },
          {
            name: 'Remo con barra',
            sets: 3,
            reps: '6',
            notes: '87,5-92,5 kg.'
          },
          {
            name: 'Press militar',
            sets: 3,
            reps: '5',
            notes: '52,5-57,5 kg.'
          },
          {
            name: 'Pull Over',
            sets: 2,
            reps: '10',
            notes: '50-55 kg.'
          }
        ]
      },
      thursday: {
        name: 'Prevención Hombro, Cadera y Sóleo (20 min)',
        exercises: [
          {
            name: 'Rotación externa con goma',
            sets: 3,
            reps: '15',
            perSide: true
          },
          {
            name: 'Cajón step lateral',
            sets: 2,
            reps: '8',
            perSide: true
          },
          {
            name: 'Leñador en polea',
            sets: 3,
            reps: '8',
            perSide: true,
            notes: '20 kg.'
          },
          {
            name: 'Gemelos sentado',
            sets: 3,
            reps: '12',
            notes: 'Carga media controlada.'
          }
        ]
      },
      friday: {
        name: 'Activación Pre-Partido (15 min)',
        exercises: [
          {
            name: 'Power Clean',
            sets: 3,
            reps: '2',
            notes: '55-60 kg. Rápido y sin fatiga.'
          },
          {
            name: 'Salto al cajón',
            sets: 3,
            reps: '3',
            notes: 'Bajar caminando.'
          },
          {
            name: 'Lanzamiento balón',
            sets: 3,
            reps: '5',
            perSide: true,
            notes: 'Balón 5 kg explosivo.'
          }
        ]
      },
      saturday: {
        name: 'Partido de Pista',
        exercises: []
      },
      sunday: {
        name: 'Descanso',
        exercises: []
      }
    }
  },
  {
    id: 'custom-playa-verano-2027',
    name: '5 · Playa Verano — Especialista y Plio',
    isCustom: true,
    createdAt: NOW_ISO,
    description: 'Bloque de verano (desde 7 junio 2027) para torneos de fin de semana. Énfasis en sóleo/aquiles para arena, potencia rotacional y mantenimiento de fuerza.',
    days: {
      monday: {
        name: 'Fuerza Inferior y Tobillo',
        exercises: [
          {
            name: 'Sentadilla',
            sets: 4,
            reps: '4-5',
            notes: '110-117,5 kg.'
          },
          {
            name: 'Gemelos de pie',
            sets: 4,
            reps: '10',
            notes: '105-115 kg (3 s excéntrica).'
          },
          {
            name: 'Gemelos sentado',
            sets: 3,
            reps: '12',
            notes: 'Sóleo pesado.'
          },
          {
            name: 'Curl Nórdico',
            sets: 2,
            reps: '4',
            notes: 'Mantenimiento semanal.'
          },
          {
            name: 'Press Pallof',
            sets: 3,
            reps: '10',
            perSide: true,
            notes: '20 kg.'
          }
        ]
      },
      tuesday: {
        name: 'Empuje, Hombro OSTRC y Brazo',
        exercises: [
          {
            name: 'Rotación externa con goma',
            sets: 3,
            reps: '15',
            perSide: true
          },
          {
            name: 'Face pull',
            sets: 3,
            reps: '15',
            notes: '42,5 kg.'
          },
          {
            name: 'Press banca',
            sets: 4,
            reps: '5',
            notes: '80-85 kg.'
          },
          {
            name: 'Press militar',
            sets: 3,
            reps: '6',
            notes: '50-55 kg.'
          },
          {
            name: 'Tríceps en poleas V',
            sets: 2,
            reps: '10',
            notes: '55-60 kg.'
          }
        ]
      },
      wednesday: {
        name: 'Potencia Rotacional y Salto en Arena',
        exercises: [
          {
            name: 'Lanzamiento balón',
            sets: 4,
            reps: '5',
            perSide: true,
            notes: 'Balón 5 kg máxima velocidad.'
          },
          {
            name: 'Leñador en polea',
            sets: 3,
            reps: '8',
            perSide: true,
            notes: '20-22,5 kg.'
          },
          {
            name: 'Saltos skater',
            sets: 3,
            reps: '6',
            perSide: true
          },
          {
            name: 'Salto con gomas',
            sets: 3,
            reps: '6',
            notes: 'Modo resistencia.'
          }
        ]
      },
      thursday: {
        name: 'Tirón, Posterior y Agarre',
        exercises: [
          {
            name: 'Dominadas',
            sets: 3,
            reps: '6'
          },
          {
            name: 'Remo con barra',
            sets: 3,
            reps: '6-8',
            notes: '82,5-87,5 kg.'
          },
          {
            name: 'Curl femoral sentado',
            sets: 3,
            reps: '8',
            notes: '80-85 kg.'
          },
          {
            name: 'Hip thrust',
            sets: 3,
            reps: '8',
            notes: '115-125 kg.'
          },
          {
            name: 'Paseo del granjero',
            sets: 2,
            reps: '24',
            notes: '35 kg por mano.'
          }
        ]
      },
      friday: {
        name: 'Activación Pre-Torneo (15 min)',
        exercises: [
          {
            name: 'Salto al cajón',
            sets: 3,
            reps: '3'
          },
          {
            name: 'Cajón step lateral',
            sets: 2,
            reps: '6',
            perSide: true
          },
          {
            name: 'Rotación externa con goma',
            sets: 2,
            reps: '15',
            perSide: true
          }
        ]
      },
      saturday: {
        name: 'Torneo Playa',
        exercises: []
      },
      sunday: {
        name: 'Torneo Playa',
        exercises: []
      }
    }
  }
];

const NEW_SCHEDULE = {
  'custom-playa-2026-acumulacion': '2026-11-17',
  'custom-playa-2026-taper': '2026-12-14',
  'custom-post-torneo-2026': '2026-12-27',
  'custom-pista-competicion-2027': '2027-01-11',
  'custom-playa-verano-2027': '2027-06-07'
};

async function main() {
  try {
    console.log('📥 Leyendo registro actual de user_routines...');
    const { data: currentRow, error: fetchError } = await supabase
      .from('user_routines')
      .select('*')
      .eq('user_id', USER_ID)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!currentRow) {
      throw new Error(`No existe ningún registro en user_routines para USER_ID ${USER_ID}`);
    }

    // 1. Guardar copia de seguridad local antes de modificar nada
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `C:\\Users\\franc\\proyectos\\apps\\gymlog\\backup_user_routines_${stamp}.json`;
    fs.writeFileSync(backupPath, JSON.stringify(currentRow, null, 2), 'utf8');
    console.log(`💾 Copia de seguridad guardada en:\n   ${backupPath}\n`);

    const currentRoutineObj = typeof currentRow.routine === 'string'
      ? JSON.parse(currentRow.routine)
      : (currentRow.routine || {});

    // 2. Construir el nuevo JSON manteniendo hiddenRoutineIds y weekPlan
    const updatedRoutineObj = {
      ...currentRoutineObj,
      routines: NEW_ROUTINES,
      schedule: NEW_SCHEDULE,
      activeRoutineId: 'custom-playa-2026-acumulacion',
      activeRoutineUpdatedAt: NOW_ISO,
      scheduleUpdatedAt: NOW_ISO,
      lastBackup: NOW_ISO
    };

    console.log('🔄 Actualizando user_routines en Supabase...');
    const { data: updatedRow, error: updateError } = await supabase
      .from('user_routines')
      .update({
        routine: updatedRoutineObj,
        updated_at: NOW_ISO
      })
      .eq('user_id', USER_ID)
      .select('id, updated_at')
      .single();

    if (updateError) throw updateError;

    console.log('\n✅ ¡Rutinas reemplazadas con éxito en GymLog!');
    console.log(`   ID Registro: ${updatedRow.id}`);
    console.log(`   Actualizado: ${updatedRow.updated_at}`);
    console.log(`   Rutina activa: ${updatedRoutineObj.activeRoutineId}`);
    console.log('   Bloques cargados:');
    NEW_ROUTINES.forEach(r => {
      console.log(`   • ${r.name} (Inicio: ${NEW_SCHEDULE[r.id]})`);
    });
  } catch (error) {
    console.error('❌ Error actualizando rutinas:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
