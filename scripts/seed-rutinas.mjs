import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const userId = process.env.GYMLOG_USER_ID || '690a78f5-8888-4996-bc67-f21dd5b85f6f';

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Faltan las variables de entorno VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CATALOGO_REQUERIDO = [
  // Lunes - Pierna
  { name: 'Sentadilla', muscle_group: 'Pierna', description: 'Sentadilla trasera con barra. Bajada controlada y subida explosiva.' },
  { name: 'Salto con carga', muscle_group: 'Potencia', description: 'Jump squat con mancuernas o barra ligera (15-25% 1RM). Salto vertical máximo con reset de 2 seg.' },
  { name: 'Hip Thrust', muscle_group: 'Glúteo', description: 'Empuje de cadera con barra apoyado en banco. Extensión explosiva y bloqueo glúteo de 1 seg arriba.' },
  { name: 'Curl femoral nórdico', muscle_group: 'Pierna', description: 'Bajada excéntrica lenta (3-4 seg) controlando la caída con isquiotibiales.' },
  { name: 'Elevación de gemelos de pie', muscle_group: 'Pierna', description: 'Extensión de tobillo con pausa de 1 seg abajo en estiramiento y subida explosiva.' },

  // Martes - Pecho y Tríceps
  { name: 'Press banca', muscle_group: 'Pecho', description: 'Press plano con barra, escápulas retraídas y empuje potente.' },
  { name: 'Lanzamiento balón medicinal pecho', muscle_group: 'Potencia', description: 'Pase de pecho explosivo contra pared con balón de 4-5 kg.' },
  { name: 'Press inclinado con mancuernas', muscle_group: 'Pecho', description: 'Banco a 30 grados, recorrido completo sin rebotar abajo.' },
  { name: 'Extensión de tríceps en polea', muscle_group: 'Tríceps', description: 'Con cuerda o agarre V, codos pegados al torso.' },
  { name: 'Extensión de tríceps tras-nuca', muscle_group: 'Tríceps', description: 'Estiramiento completo de la cabeza larga del tríceps.' },

  // Miércoles - Core y Salud de Hombro
  { name: 'Leñador en polea', muscle_group: 'Core', description: 'Woodchopper diagonal de arriba a abajo con rotación explosiva de tronco.' },
  { name: 'Rotación externa de hombro en polea', muscle_group: 'Hombro', description: 'Codo a 90 grados (a la altura del hombro para simular armado de tiro), rotación controlada.' },
  { name: 'Pallof Press', muscle_group: 'Core', description: 'Empuje frontal en polea resistiendo la rotación lateral del tronco.' },
  { name: 'Rueda abdominal', muscle_group: 'Core', description: 'Extensión de tronco manteniendo retroversión pélvica y abdomen compacto.' },
  { name: 'Paseo del granjero', muscle_group: 'Core', description: 'Caminata pesada con mancuernas o kettlebells, postura erguida y agarre firme.' },

  // Jueves - Espalda y Bíceps
  { name: 'Dominadas', muscle_group: 'Espalda', description: 'Tracción vertical desde extensión completa llevando el pecho hacia la barra.' },
  { name: 'Remo con barra', muscle_group: 'Espalda', description: 'Torso inclinado ~45 grados, tirón explosivo hacia la cadera baja.' },
  { name: 'Pull Over en polea alta', muscle_group: 'Espalda', description: 'Brazos semi-extendidos, llevando la barra/cuerda hacia los muslos activando dorsal.' },
  { name: 'Curl con barra Z', muscle_group: 'Bíceps', description: 'Flexión de codo estricta sin balanceo lumbar.' },
  { name: 'Curl martillo', muscle_group: 'Bíceps', description: 'Agarre neutro con mancuernas para braquiorradial y estabilidad de codo.' },

  // Viernes - Hombro y Potencia Superior
  { name: 'Push Press', muscle_group: 'Potencia', description: 'Ligero impulso de rodilla y cadera para acelerar la barra por encima de la cabeza.' },
  { name: 'Press militar', muscle_group: 'Hombro', description: 'Press estricto de pie con barra, glúteos y abdomen apretados.' },
  { name: 'Lanzamiento balón medicinal unilateral', muscle_group: 'Potencia', description: 'Lanzamiento explosivo a una mano simulando gesto de tiro de balonmano (4-5 kg).' },
  { name: 'Elevaciones laterales', muscle_group: 'Hombro', description: 'Elevación en el plano escapular hasta la altura del hombro.' },
  { name: 'Face Pull', muscle_group: 'Hombro', description: 'Tirón hacia la frente con rotación externa final para deltoides posterior y manguito.' },

  // Sábado - Pliometría y Agilidad (Sin Saltos Skater)
  { name: 'Drop Jumps', muscle_group: 'Pliometría', description: 'Caída desde cajón de 30-40 cm y rebote vertical inmediato minimizando tiempo de contacto.' },
  { name: 'Salto lateral a una pierna con frenada', muscle_group: 'Agilidad', description: 'Salto lateral explosivo de una pierna a otra clavando la recepción 2 segundos.' },
  { name: 'Broad Jumps', muscle_group: 'Pliometría', description: 'Salto horizontal máximo con impulso de brazos y aterrizaje estable.' },
  { name: 'Pogo Jumps', muscle_group: 'Pliometría', description: 'Saltos reactivos continuos usando solo tobillo, rodillas casi bloqueadas.' },
  { name: 'Sprints cortos 10m', muscle_group: 'Agilidad', description: 'Aceleración máxima desde salida parada en 10 metros con recuperación completa.' }
];

const DIAS_ESTRUCTURA = [
  {
    dayOfWeek: 1,
    name: 'Lunes · Pierna (Fuerza y Potencia)',
    exercises: [
      { name: 'Sentadilla', note_potencia: '4x3 @ 80-82%. Subida máxima velocidad.', note_fuerza: '4x4 @ 85-88%. Control total.', note_base: '4x6 @ 75-80%.' },
      { name: 'Salto con carga', note_potencia: '4x4 con mancuernas 10-14 kg. Salto máximo.', note_fuerza: '3x4 carga ligera. Explosivo.', note_base: '3x5 carga ligera.' },
      { name: 'Hip Thrust', note_potencia: '3x5 @ 75%. Extensión explosiva de cadera.', note_fuerza: '4x6 @ 82%. Pausa 1 seg arriba.', note_base: '3x8 @ 75%.' },
      { name: 'Curl femoral nórdico', note_potencia: '3x4 excéntrico lento (3-4 seg).', note_fuerza: '3x5 excéntrico controlado.', note_base: '3x6 excéntrico.' },
      { name: 'Elevación de gemelos de pie', note_potencia: '3x8 pausa abajo + despegue rápido.', note_fuerza: '4x10 pesado.', note_base: '3x12.' }
    ]
  },
  {
    dayOfWeek: 2,
    name: 'Martes · Pecho, Tríceps y Lanzamiento',
    exercises: [
      { name: 'Press banca', note_potencia: '4x3 @ 80% con pausa de 1 seg en pecho.', note_fuerza: '4x4 @ 85-88%.', note_base: '4x6-8 @ 75-80%.' },
      { name: 'Lanzamiento balón medicinal pecho', note_potencia: '4x5 balón 5 kg a máxima velocidad.', note_fuerza: '3x5 balón 5 kg explosivo.', note_base: '3x6 balón 4-5 kg.' },
      { name: 'Press inclinado con mancuernas', note_potencia: '3x6 recorrido limpio.', note_fuerza: '3x6-8 pesado.', note_base: '3x8-10.' },
      { name: 'Extensión de tríceps en polea', note_potencia: '3x8 explosivo en extensión.', note_fuerza: '3x8-10.', note_base: '3x10-12.' },
      { name: 'Extensión de tríceps tras-nuca', note_potencia: '2x10.', note_fuerza: '3x10.', note_base: '3x12.' }
    ]
  },
  {
    dayOfWeek: 3,
    name: 'Miércoles · Core y Salud de Hombro',
    exercises: [
      { name: 'Leñador en polea', note_potencia: '3x6 por lado, rotación rápida.', note_fuerza: '3x8 por lado pesado.', note_base: '3x10 por lado.' },
      { name: 'Rotación externa de hombro en polea', note_potencia: '3x12 por brazo a 90° abducción.', note_fuerza: '3x12 por brazo.', note_base: '3x15 por brazo.' },
      { name: 'Pallof Press', note_potencia: '3x8 por lado con pausa de 2 seg.', note_fuerza: '3x10 por lado.', note_base: '3x10 por lado.' },
      { name: 'Rueda abdominal', note_potencia: '3x8.', note_fuerza: '3x10.', note_base: '3x10.' },
      { name: 'Paseo del granjero', note_potencia: '3x25m pesado.', note_fuerza: '4x30m muy pesado.', note_base: '3x30m.' }
    ]
  },
  {
    dayOfWeek: 4,
    name: 'Jueves · Espalda y Bíceps',
    exercises: [
      { name: 'Dominadas', note_potencia: '4x4-5 tirón explosivo pecho a barra.', note_fuerza: '4x5 lastradas.', note_base: '4x6-8.' },
      { name: 'Remo con barra', note_potencia: '4x5 estilo Pendlay desde el suelo.', note_fuerza: '4x6 pesado.', note_base: '4x8.' },
      { name: 'Pull Over en polea alta', note_potencia: '3x8 enfoque extensión torácica.', note_fuerza: '3x10.', note_base: '3x12.' },
      { name: 'Curl con barra Z', note_potencia: '3x8.', note_fuerza: '3x8 pesado.', note_base: '3x10.' },
      { name: 'Curl martillo', note_potencia: '3x8.', note_fuerza: '3x8-10.', note_base: '3x10-12.' }
    ]
  },
  {
    dayOfWeek: 5,
    name: 'Viernes · Hombro y Cadena de Tiro',
    exercises: [
      { name: 'Push Press', note_potencia: '4x3 @ 75-80% aceleración máxima.', note_fuerza: '4x4 @ 82%.', note_base: '3x5 @ 75%.' },
      { name: 'Press militar', note_potencia: '3x5 estricto.', note_fuerza: '4x5 pesado.', note_base: '3x8.' },
      { name: 'Lanzamiento balón medicinal unilateral', note_potencia: '4x4 por brazo gesto de tiro.', note_fuerza: '3x4 por brazo.', note_base: '3x5 por brazo.' },
      { name: 'Elevaciones laterales', note_potencia: '3x10.', note_fuerza: '3x12.', note_base: '4x12-15.' },
      { name: 'Face Pull', note_potencia: '3x12.', note_fuerza: '3x12.', note_base: '3x15.' }
    ]
  },
  {
    dayOfWeek: 6,
    name: 'Sábado · Pliometría y Agilidad',
    exercises: [
      { name: 'Drop Jumps', note_potencia: '4x4 cajón 35cm, contacto mínimo.', note_fuerza: '3x4 cajón 30cm.', note_base: '3x4 cajón 30cm.' },
      { name: 'Salto lateral a una pierna con frenada', note_potencia: '4x4 por pierna, clavar recepción.', note_fuerza: '3x4 por pierna.', note_base: '3x5 por pierna.' },
      { name: 'Broad Jumps', note_potencia: '4x3 salto horizontal máximo.', note_fuerza: '3x3.', note_base: '3x4.' },
      { name: 'Pogo Jumps', note_potencia: '3x12 reactivos.', note_fuerza: '3x10.', note_base: '3x12.' },
      { name: 'Sprints cortos 10m', note_potencia: '5x10m descanso 90 seg.', note_fuerza: '4x10m.', note_base: '4x10m.' }
    ]
  }
];

const FASES = [
  { name: 'Invierno · Potencia y Playa (Pico 26 Dic)', type: 'note_potencia', active: true },
  { name: 'Otoño · Fuerza Máxima (Weider)', type: 'note_fuerza', active: false },
  { name: 'Semana de Descarga (65-70% / 2 Series)', type: 'note_descarga', active: false },
  { name: 'Primavera · Base y Mantenimiento', type: 'note_base', active: false },
  { name: 'Verano · Mantenimiento Competitivo', type: 'note_base', active: false }
];

async function run() {
  console.log("🔍 Sincronizando catálogo de ejercicios...");
  const { data: existingExercises, error: fetchErr } = await supabase
    .from('exercises')
    .select('id, name');
  if (fetchErr) throw fetchErr;

  const exerciseMap = new Map();
  existingExercises.forEach((ex) => {
    exerciseMap.set(ex.name.trim().toLowerCase(), { id: ex.id, name: ex.name });
  });

  for (const item of CATALOGO_REQUERIDO) {
    const key = item.name.toLowerCase();
    if (!exerciseMap.has(key)) {
      const { data: created, error: createErr } = await supabase
        .from('exercises')
        .insert({
          user_id: userId,
          name: item.name,
          muscle_group: item.muscle_group,
          description: item.description,
          is_public: false
        })
        .select('id, name')
        .single();

      if (createErr) {
        console.error(`❌ Error creando ${item.name}:`, createErr.message);
      } else {
        exerciseMap.set(key, { id: created.id, name: created.name });
        console.log(`✅ Ejercicio creado: ${created.name}`);
      }
    }
  }

  console.log("🔄 Actualizando user_routines en Supabase...");
  const { data: userRow, error: urErr } = await supabase
    .from('user_routines')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (urErr) throw urErr;

  let activeRoutineId = null;
  const nuevasRutinas = FASES.map((fase) => {
    const routineId = crypto.randomUUID();
    if (fase.active) activeRoutineId = routineId;

    const days = DIAS_ESTRUCTURA.map((dia) => ({
      id: crypto.randomUUID(),
      dayOfWeek: dia.dayOfWeek,
      name: dia.name,
      exercises: dia.exercises
        .filter((ex) => !(fase.type === 'note_descarga' && ex.name === 'Drop Jumps'))
        .map((ex) => {
          const found = exerciseMap.get(ex.name.toLowerCase());
          return {
            id: crypto.randomUUID(),
            exerciseId: found?.id || null,
            name: found?.name || ex.name,
            sets: fase.type === 'note_descarga' ? 2 : 4,
            reps: fase.type === 'note_potencia' ? '3-5' : '6-8',
            notes: fase.type === 'note_descarga'
              ? 'DESCARGA: 2 series al 65-70%. Cero fallo muscular.'
              : ex[fase.type]
          };
        })
    }));

    return {
      id: routineId,
      name: fase.name,
      createdAt: new Date().toISOString(),
      days
    };
  });

  const updatedRoutineJson = {
    routines: nuevasRutinas,
    activeRoutineId,
    lastBackup: new Date().toISOString()
  };

  if (userRow) {
    const { error: upErr } = await supabase
      .from('user_routines')
      .update({ routine: updatedRoutineJson, updated_at: new Date().toISOString() })
      .eq('id', userRow.id);
    if (upErr) throw upErr;
  } else {
    const { error: inErr } = await supabase
      .from('user_routines')
      .insert({ user_id: userId, routine: updatedRoutineJson });
    if (inErr) throw inErr;
  }

  console.log('🎉 ¡Catálogo y rutinas Weider sincronizados con éxito en Supabase!');
}

run().catch((err) => {
  console.error("❌ Error ejecutando seed:", err);
  process.exit(1);
});
