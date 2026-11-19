import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://eoltmipoklizewxdpzfa.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_KEY;

if (!SB_KEY) {
  console.error('❌ Falta SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(SB_URL, SB_KEY, {
  auth: { persistSession: false }
});

const USER_ID = 'f95d5098-47ef-4825-a5ff-8540cc3524f6';

const { data, error } = await supabase
  .from('user_routines')
  .select('id, updated_at, routine')
  .eq('user_id', USER_ID)
  .maybeSingle();

if (error) {
  console.error('❌ Error consultando Supabase:', error.message);
  process.exit(1);
}

if (!data) {
  console.log('⚠️ No hay datos en user_routines (revisa que SUPABASE_SERVICE_ROLE_KEY esté en .env).');
  process.exit(0);
}

const r = typeof data.routine === 'string' ? JSON.parse(data.routine) : data.routine;
const routines = r?.routines || [];
const schedule = r?.schedule || {};

console.log('\n📡 ESTADO ACTUAL EN SUPABASE (user_routines)');
console.log('-------------------------------------------');
console.log('Última actualización BD :', data.updated_at);
console.log('Rutina activa ID        :', r?.activeRoutineId);
console.log('Actualización activa    :', r?.activeRoutineUpdatedAt);
console.log('Total rutinas guardadas :', routines.length);
console.log('\n📋 Listado de rutinas:');

routines.forEach((rt, i) => {
  const isAct = rt.id === r?.activeRoutineId ? ' ✅ [ACTIVA]' : '';
  const daysCount = Object.values(rt.days || {}).filter(d => (d?.exercises || []).length > 0).length;
  const exCount = Object.values(rt.days || {}).reduce((acc, d) => acc + (d?.exercises?.length || 0), 0);
  const sched = schedule[rt.id] ? ` | Inicio: ${schedule[rt.id]}` : '';
  console.log(`  ${i + 1}. ${rt.name}${isAct}`);
  console.log(`     ID: ${rt.id} | ${daysCount} días · ${exCount} ejercicios${sched}`);
});

const hasNew = routines.some(rt => rt.id === 'custom-playa-2026-acumulacion');
console.log('\nResultado:', hasNew
  ? '✅ Las rutinas nuevas YA están actualizadas en Supabase.'
  : '⚠️ Todavía tienes las rutinas antiguas. Ejecuta: node update-routines.mjs');
