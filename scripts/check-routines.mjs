import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const userId = process.env.GYMLOG_USER_ID || '690a78f5-8888-4996-bc67-f21dd5b85f6f';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('user_routines')
    .select('routine')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error("❌ Error consultando Supabase:", error.message);
    return;
  }

  if (!data || !data.routine || !data.routine.routines) {
    console.log("⚠️ No se encontraron rutinas para este usuario.");
    return;
  }

  console.log(`\n📌 Rutina Activa ID: ${data.routine.activeRoutineId}\n`);
  data.routine.routines.forEach((fase, index) => {
    console.log(`[Fase ${index + 1}] ${fase.name}`);
    console.log(`  └─ Días configurados (${fase.days.length}):`);
    fase.days.forEach(d => {
      console.log(`     - Día ${d.dayOfWeek}: ${d.name} (${d.exercises.length} ejercicios)`);
    });
    console.log('');
  });
}

check();
