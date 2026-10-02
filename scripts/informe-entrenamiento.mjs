// Informe de entrenamiento desde Supabase para un usuario de GymLog.
// Uso:  node scripts/informe-entrenamiento.mjs
// Credenciales: .env.local (GYMLOG_EMAIL, GYMLOG_PASSWORD) — nunca al repo.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n').filter(Boolean).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }),
);
// La clave publicable va por defecto porque no es secreta (ya viaja en el bundle
// de la app), pero se puede sobreescribir por entorno sin tocar el codigo.
const sb = createClient(
  process.env.GYMLOG_SUPABASE_URL ?? 'https://eoltmipoklizewxdpzfa.supabase.co',
  process.env.GYMLOG_SUPABASE_KEY ?? 'sb_publishable_C5dKsRG9DOpZjC5XihhsEA_P0rV4i93',
  { auth: { persistSession: false } },
);
const { data: s, error } = await sb.auth.signInWithPassword({
  email: env.GYMLOG_EMAIL, password: env.GYMLOG_PASSWORD,
});
if (error) throw error;
const uid = s.user.id;

// `workout_sets` y `exercise_muscles` NO tienen user_id: su RLS mira workouts.
// Hay que filtrar por los ids que devuelve workouts, no por user_id.
const byUid = async (t, cols) => (await sb.from(t).select(cols).eq('user_id', uid)).data ?? [];
const workoutRows = await byUid('workouts', 'id, name, started_at, duration_min, rating');
const wIds = workoutRows.map(w => w.id);

async function inChunks(table, col, ids, cols) {
  const out = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error: e } = await sb.from(table).select(cols).in(col, ids.slice(i, i + 200));
    if (e) throw new Error(`${table}: ${e.message}`);
    out.push(...(data ?? []));
  }
  return out;
}

const exCols = 'id, name, muscle_group, movement, equipment, load_type, is_bilateral, is_bodyweight, is_public';
// Mismo predicado que la RPC get_exercises_with_usage (migracion 20260724000001,
// linea 31): `user_id = uid OR user_id IS NULL`. NO filtrar por is_public: 45 de
// los 60 ejercicios del catalogo compartido lo tienen a false y desaparecerian,
// dejando 1001 de 1558 series apuntando a un id inexistente.
const { data: exData, error: exErr } = await sb.from('exercises').select(exCols)
  .or(`user_id.eq.${uid},user_id.is.null`);
  ;
if (exErr) throw new Error(`exercises: ${exErr.message}`);
const ex = exData ?? [];
const exIds = [...new Set(ex.map(e => e.id))];

const [sets, mus, cardio, prs] = await Promise.all([
  inChunks('workout_sets', 'workout_id', wIds,
    'workout_id, exercise_id, weight, reps, duration_seconds, rpe, rir, is_warmup, one_rm, is_pr, set_type'),
  inChunks('exercise_muscles', 'exercise_id', exIds, 'exercise_id, muscle_group, role, weight'),
  byUid('cardio_sessions', 'type, started_at, duration, distance, avg_hr'),
  byUid('personal_records', 'exercise_id, rep_band, weight, reps, one_rm, achieved_at'),
]);

const workouts = workoutRows;

if (!sets.length) throw new Error('workout_sets vacío: revisa el RLS o los ids');
console.error(`cargado: ${workouts.length} workouts · ${sets.length} series · ${exIds.length} ejercicios`);

const EX = Object.fromEntries(ex.map(e => [e.id, e]));
const nm = id => EX[id]?.name ?? `(sin catálogo ${String(id).slice(0, 8)})`;
// exercise_id de workout_sets que ya no existe en `exercises`: datos huérfanos.
const dangling = [...new Set(sets.map(x => x.exercise_id).filter(id => !EX[id]))];
if (dangling.length) console.error(`AVISO: ${dangling.length} exercise_id sin catálogo, ${sets.filter(x => dangling.includes(x.exercise_id)).length} series huérfanas`);
const W = Object.fromEntries(workouts.map(w => [w.id, w]));
const MUS = {};
for (const m of mus) (MUS[m.exercise_id] ??= []).push(m);
const d = s => new Date(s).toISOString().slice(0, 10);
const weekOf = s => { const t = new Date(d(s) + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };

const hard = sets.filter(x => !x.is_warmup && W[x.workout_id]);
const CUT = '2026-09-07';
const recent = hard.filter(x => d(W[x.workout_id].started_at) >= CUT);
const repSets = hard.filter(x => x.reps != null && x.reps > 0);
const bwSets = repSets.filter(x => !x.weight);
const totalVol = repSets.reduce((s, x) => s + (x.weight || 0) * (x.reps || 0), 0);
// El bodyweight se REGISTRA como kilos (peso corporal en weight), asi que `!weight`
// solo captura lo que quedo sin rellenar. Hay que separar los dos casos.
const bwExSets = repSets.filter(x => x.weight && EX[x.exercise_id]?.load_type === 'bodyweight');
const timedSets = hard.filter(x => x.duration_seconds > 0);
const plyo = repSets.filter(x => EX[x.exercise_id]?.movement === 'Pliometría');
const uni = repSets.filter(x => EX[x.exercise_id]?.is_bilateral === false);
const vol = a => a.reduce((s, x) => s + x.weight * x.reps, 0);
const R = n => Math.round(n).toLocaleString('es-ES');
const out = [];
const p = s => out.push(s);
const bar = t => p(`\n${'='.repeat(78)}\n${t}\n${'='.repeat(78)}`);

p(`GymLog · informe de entrenamiento`);
p(`Generado ${d(new Date())} · usuario ${uid}`);
p(`Ventana: ${d(workouts.at(-1).started_at)} → ${d(workouts[0].started_at)}`);
p(`${workouts.length} bloques · ${sets.length} series · ${timedSets.length} por tiempo`);
p(`Volumen total: ${R(totalVol)} kg  (Σ weight×reps de ${repSets.length} series con reps)`);

bar('1 · REPARTO POR PATRÓN DE MOVIMIENTO (movement)');
p('El campo movement es lataxonomía de la app. Pliometría = salto/aterrizaje.');
p('patrón'.padEnd(14) + 'series'.padStart(7) + 'ult4sem'.padStart(9) + 'vol kg'.padStart(11) + 'e1RM max'.padStart(10) + '  última');
const byMov = {};
for (const x of repSets) (byMov[EX[x.exercise_id]?.movement ?? '?'] ??= []).push(x);
for (const [m, a] of Object.entries(byMov).sort((x, y) => vol(y[1]) - vol(x[1]))) {
  const r = recent.filter(x => EX[x.exercise_id]?.movement === m);
  const last = a.map(x => d(W[x.workout_id].started_at)).sort().at(-1);
  p(m.padEnd(14) + String(a.length).padStart(7) + String(r.length).padStart(9)
    + R(vol(a)).padStart(11) + String(Math.max(0, ...a.map(x => x.one_rm ?? 0))).padStart(10) + '  ' + last);
}

bar('2 · REPARTO POR GRUPO MUSCULAR (ponderado con exercise_muscles)');
const g = {};
for (const x of repSets) {
  const list = MUS[x.exercise_id]?.length
    ? MUS[x.exercise_id]
    : [{ muscle_group: EX[x.exercise_id]?.muscle_group, weight: 100 }];
  for (const m of list) {
    g[m.muscle_group] ??= { v: 0 };
    g[m.muscle_group].v += (x.weight * x.reps * m.weight) / 100;
  }
}
for (const [k, v] of Object.entries(g).sort((a, b) => b[1].v - a[1].v))
  p(k.padEnd(16) + R(v.v).padStart(11) + ' kg' + '  (' + (100 * v.v / vol(repSets)).toFixed(1) + '%)');

bar('3 · TRABAJO CON PESO CORPORAL (bodyweight registrado en kg)');
p('ejercicio'.padEnd(34) + 'load'.padEnd(19) + 'series'.padStart(8) + 'reps'.padStart(9) + '  última');
const byBw = {};
for (const x of bwExSets) (byBw[x.exercise_id] ??= []).push(x);
for (const [id, a] of Object.entries(byBw).sort((x, y) => y[1].length - x[1].length))
  p(nm(id).slice(0, 33).padEnd(34) + (EX[id].load_type ?? '').slice(0, 18).padEnd(19)
    + String(a.length).padStart(8) + R(a.reduce((s, x) => s + x.reps, 0)).padStart(9)
    + '  ' + a.map(x => d(W[x.workout_id].started_at)).sort().at(-1));
p(`\nNota: el peso corporal se registra como kilos (weight = peso corporal), asi que`);
p(`      el volumen kg ya lo incluye. Solo falta lo que quedo sin rellenar.`);
p(`\nEjercicios de bodyweight registrados en kg: ${bwExSets.length} series · ${R(bwExSets.reduce((s, x) => s + x.reps, 0))} reps`);
p(`Series con weight vacio: ${bwSets.length}`);

bar('4 · PLIOMETRÍA');
p(plyo.length ? '' : '*** NINGUNA serie de pliometría registrada en todo el historial ***');
const byPlyo = {};
for (const x of plyo) (byPlyo[x.exercise_id] ??= []).push(x);
for (const [id, a] of Object.entries(byPlyo))
  p(nm(id).padEnd(34) + String(a.length).padStart(8) + R(a.reduce((s, x) => s + x.reps, 0)).padStart(9)
    + '  última ' + a.map(x => d(W[x.workout_id].started_at)).sort().at(-1));
const plyoLast = plyo.length ? plyo.map(x => d(W[x.workout_id].started_at)).sort().at(-1) : '---';
p(`\nTotal pliometría: ${plyo.length} series · ${plyoLast}`);

bar('5 · SERIES POR TIEMPO / ISOMÉTRICOS');
p(timedSets.length ? '' : '*** NINGUNA serie por tiempo ***');
const byT = {};
for (const x of timedSets) (byT[x.exercise_id] ??= []).push(x);
for (const [id, a] of Object.entries(byT).sort((x, y) => y[1].length - x[1].length))
  p(nm(id).slice(0, 33).padEnd(34) + String(a.length).padStart(8)
    + R(a.reduce((s, x) => s + x.duration_seconds, 0) / 60).padStart(9) + ' min'
    + '  última ' + a.map(x => d(W[x.workout_id].started_at)).sort().at(-1));

bar('6 · TRABAJO UNILATERAL (is_bilateral = false)');
p(uni.length ? '' : '*** NINGÚN ejercicio marcado unilateral ***');
const byU = {};
for (const x of uni) (byU[x.exercise_id] ??= []).push(x);
for (const [id, a] of Object.entries(byU))
  p(nm(id).slice(0, 33).padEnd(34) + String(a.length).padStart(8)
    + R(vol(a)).padStart(11) + ' kg  última ' + a.map(x => d(W[x.workout_id].started_at)).sort().at(-1));

bar('7 · CARDIO');
const byCW = {};
for (const c of cardio) { const w = weekOf(c.started_at); ((byCW[w] ??= {})[c.type] ??= { n: 0, s: 0, km: 0, hr: [] }); const b = byCW[w][c.type]; b.n++; b.s += c.duration; b.km += +c.distance || 0; if (c.avg_hr) b.hr.push(c.avg_hr); }
p('semana'.padEnd(13) + 'tipo'.padEnd(14) + 'ses'.padStart(5) + 'min'.padStart(7) + 'km'.padStart(8) + 'HR'.padStart(6));
for (const w of Object.keys(byCW).sort()) for (const [t, b] of Object.entries(byCW[w]))
  p(w.padEnd(13) + t.padEnd(14) + String(b.n).padStart(5) + R(b.s / 60).padStart(7)
    + b.km.toFixed(1).padStart(8) + (b.hr.length ? String(Math.round(b.hr.reduce((a, c) => a + c) / b.hr.length)).padStart(6) : ''.padStart(6)));
const tot = cardio.reduce((s, c) => s + c.duration, 0);
p(`\nTotal cardio: ${cardio.length} sesiones · ${R(tot / 3600)} h · media ${R(cardio.reduce((s, c) => s + c.duration, 0) / cardio.length / 60)} min`);
p('Por tipo: ' + Object.entries(Object.groupBy(cardio, c => c.type)).map(([t, a]) => `${t} ${a.length}`).join(' · '));

bar('8 · TOP 35 EJERCICIOS POR VOLUMEN TOTAL');
p('ejercicio'.padEnd(34) + 'mv'.padEnd(12) + 'grupo'.padEnd(10) + 'series'.padStart(7) + 'ult4s'.padStart(7) + 'vol kg'.padStart(11) + 'e1RM'.padStart(8) + '  última');
const byEx = {};
for (const x of repSets) (byEx[x.exercise_id] ??= []).push(x);
[...Object.entries(byEx)].sort((x, y) => vol(y[1]) - vol(x[1])).slice(0, 35).forEach(([id, a]) => {
  const e = EX[id] ?? {};
  const r = recent.filter(x => x.exercise_id === id);
  p((e.name ?? id).slice(0, 33).padEnd(34) + (e.movement ?? '').slice(0, 11).padEnd(12)
    + (e.muscle_group ?? '').slice(0, 9).padEnd(10) + String(a.length).padStart(7) + String(r.length).padStart(7)
    + R(vol(a)).padStart(11) + String(Math.max(0, ...a.map(x => x.one_rm ?? 0))).padStart(8)
    + '  ' + a.map(x => d(W[x.workout_id].started_at)).sort().at(-1));
});

bar('9 · RPE — cobertura real');
const rpeAll = hard.filter(x => x.rpe != null);
p(`Series con RPE: ${rpeAll.length} de ${hard.length} (${(100 * rpeAll.length / hard.length).toFixed(0)}%)`);
const rpeW = {};
for (const x of rpeAll) (rpeW[weekOf(W[x.workout_id].started_at)] ??= []).push(x.rpe);
for (const w of Object.keys(rpeW).sort())
  p(`${w}  n=${String(rpeW[w].length).padStart(4)}  medio=${(rpeW[w].reduce((a, b) => a + b) / rpeW[w].length).toFixed(1)}`);
p(`\nSesiones con rating (1-5): ${workouts.filter(w => w.rating != null).length} de ${workouts.length}`);

bar('10 · CATÁLOGO DISPONIBLE (para saber qué puedes añadir)');
p('Nombre'.padEnd(36) + 'mv'.padEnd(12) + 'grupo'.padEnd(10) + 'load'.padEnd(20) + 'veces');
for (const e of ex.sort((a, b) => (MUS[a.id] ? 0 : 1) - (MUS[b.id] ? 0 : 1) || a.name.localeCompare(b.name)))
  p(e.name.slice(0, 35).padEnd(36) + (e.movement ?? '').slice(0, 11).padEnd(12)
    + (e.muscle_group ?? '').slice(0, 9).padEnd(10) + (e.load_type ?? '').slice(0, 19).padEnd(20)
    + (byEx[e.id]?.length ?? 0));

writeFileSync('/tmp/opencode/informe.txt', out.join('\n'));
console.log(out.join('\n'));
console.log(`\n--- ${repSets.length} series con reps · ${bwSets.length} sin carga · ${plyo.length} plio · ${timedSets.length} por tiempo ---`);
