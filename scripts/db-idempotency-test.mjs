#!/usr/bin/env node
// Prueba de integración del contrato de idempotencia contra un PostgreSQL real.
//
// No usa el PostgreSQL del sistema ni toca ninguna base existente: crea un
// clúster temporal en el directorio de temporales, aplica las migraciones y lo
// borra al terminar. Tampoco necesita credenciales ni Docker.
//
// Uso:
//   npm run test:db
//   PG_BIN="C:\Program Files\PostgreSQL\17\bin" npm run test:db
//
// Requisitos: binarios de PostgreSQL 13+ (`initdb`, `postgres`, `pg_isready`,
// `psql`). Si no están en el PATH, se buscan en las rutas típicas; `PG_BIN`
// manda sobre la búsqueda.
//
// Qué se comprueba:
//   1. La cadena de migraciones relevante se aplica desde cero sin errores.
//   2. Los escenarios secuenciales (scripts/db/idempotency-scenarios.sql):
//      reintento, conflicto, operación nueva, importación atómica, propiedad,
//      aislamiento entre usuarios, cardio idempotente, importación JSON atómica
//      y RLS.
//   3. Concurrencia real con dos conexiones simultáneas:
//      · misma clave y misma carga  -> una sola fila, ambos reciben su id;
//      · misma clave y otra carga    -> una fila, el segundo recibe conflicto;
//      · claves distintas            -> dos filas, ninguna se bloquea;
//      · lote de importación         -> una transacción, todas las series;
//      · cardio idempotente          -> una sola sesión, mismo id o conflicto;
//      · lote JSON                   -> una sola escritura, conflicto sin restos.

import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  openSync,
  closeSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const MIGRATIONS = [
  '20260101000000_remote_schema.sql',
  '20260620120253_save_workout_notes_rating.sql',
  '20260620122010_personal_records_rep_band.sql',
  '20260711120000_cardio_sessions_started_at_unique.sql',
  '20260711130000_exercises_user_lower_name_unique.sql',
  '20260711140000_fix_handle_new_user_profiles.sql',
  '20260715103516_exercise_muscles_bodyweight.sql',
  '20260720214244_exercise_load_type.sql',
  '20260723130022_exercise_favorites.sql',
  '20260724000000_add_exercise_variety.sql',
  '20260724000001_exercises_rpc_equipment.sql',
  '20260731120000_dedupe_user_routines_policies.sql',
  '20260804120000_exercise_descriptions.sql',
  '20260804123000_exercise_descriptions_personal.sql',
  '20260805000000_persist_rir_save_workout.sql',
  '20260805120000_get_workouts_with_sets_include_rir.sql',
  '20260805130000_exercise_progression.sql',
  '20260814115041_save_workout_idempotent.sql',
  '20260825125843_timed_sets.sql',
  '20261016120000_exercises_with_usage_full_row.sql',
  '20261026120000_workout_idempotency_contract.sql',
  '20261026130000_import_integrity.sql',
];

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const EX_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const EX_PUBLIC = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

// ── utilidades ──────────────────────────────────────────────────────────────

function findPgBin() {
  const candidates = [];
  if (process.env.PG_BIN) candidates.push(process.env.PG_BIN);
  if (process.platform === 'win32') {
    for (const base of ['C:\\Program Files\\PostgreSQL', 'C:\\Program Files (x86)\\PostgreSQL']) {
      if (!existsSync(base)) continue;
      for (const version of statSafe(base)) {
        candidates.push(join(base, version, 'bin'));
      }
    }
  } else {
    candidates.push('/usr/lib/postgresql/17/bin', '/usr/lib/postgresql/16/bin');
    candidates.push('/usr/local/pgsql/bin', '/opt/homebrew/opt/postgresql@17/bin');
  }

  for (const dir of candidates) {
    const exe = (name) => join(dir, process.platform === 'win32' ? `${name}.exe` : name);
    if (['initdb', 'postgres', 'psql', 'pg_isready', 'pg_ctl'].every((n) => existsSync(exe(n)))) {
      return dir;
    }
  }

  const onPath = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['initdb'], {
    encoding: 'utf8',
  });
  if (onPath.status === 0) {
    const first = onPath.stdout.split(/\r?\n/).find(Boolean);
    if (first) return first.replace(/[\\/](initdb(\.exe)?)$/, '');
  }

  throw new Error(
    'No se encontraron los binarios de PostgreSQL. Instala PostgreSQL o define PG_BIN.',
  );
}

function statSafe(dir) {
  try {
    return readdirSync(dir).sort((a, b) => Number(b) - Number(a) || b.localeCompare(a));
  } catch {
    return [];
  }
}

function binaries(binDir) {
  const exe = (name) => join(binDir, process.platform === 'win32' ? `${name}.exe` : name);
  return {
    initdb: exe('initdb'),
    postgres: exe('postgres'),
    psql: exe('psql'),
    pgIsReady: exe('pg_isready'),
    pgCtl: exe('pg_ctl'),
  };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function run(command, args, { env = {}, allowFailure = false, timeout = 120_000 } = {}) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout,
    env: { ...process.env, PGCONNECT_TIMEOUT: '5', PGCLIENTENCODING: 'UTF8', ...env },
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${command} ${args.join(' ')} falló (${result.status}):\n${output}`);
  }
  return { status: result.status, output, stdout: result.stdout ?? '' };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function psql(bin, port, database, sql, options = {}) {
  return run(
    bin.psql,
    [
      '-w',
      '-h',
      '127.0.0.1',
      '-p',
      String(port),
      '-U',
      'postgres',
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
      '-tA',
      ...(options.file ? ['-f', options.file] : ['-c', sql]),
      ...(options.singleTransaction ? ['-1'] : []),
    ],
    options,
  );
}

function uuidFrom(output) {
  return output.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

// ── arranque del clúster temporal ───────────────────────────────────────────

async function startCluster(bin) {
  const dir = mkdtempSync(join(tmpdir(), 'gymlog-pg-'));
  const dataDir = join(dir, 'data');
  const logPath = join(dir, 'postgres.log');
  const port = await freePort();

  console.log(`→ initdb (${dataDir})`);
  run(bin.initdb, ['-D', dataDir, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--locale=C']);

  const logFd = openSync(logPath, 'a');
  console.log(`→ postgres en 127.0.0.1:${port}`);
  const server = spawn(
    bin.postgres,
    ['-D', dataDir, '-p', String(port), '-c', 'listen_addresses=127.0.0.1'],
    { stdio: ['ignore', logFd, logFd], windowsHide: true },
  );
  closeSync(logFd);

  let exited = false;
  server.on('exit', () => {
    exited = true;
  });

  for (let i = 0; i < 120; i++) {
    if (exited) break;
    const ready = run(bin.pgIsReady, ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres'], {
      allowFailure: true,
    });
    if (ready.status === 0) {
      return { dir, dataDir, logPath, port, server, bin };
    }
    await wait(250);
  }

  const log = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '(sin log)';
  throw new Error(`PostgreSQL no arrancó en 30s:\n${log}`);
}

function stopCluster(cluster) {
  if (!cluster) return;
  try {
    run(cluster.bin.pgCtl, ['-D', cluster.dataDir, '-m', 'immediate', '-w', 'stop'], {
      allowFailure: true,
      timeout: 20_000,
    });
  } finally {
    try {
      cluster.server.kill();
    } catch {
      // Ya estaba parado.
    }
  }
}

// ── escenarios ──────────────────────────────────────────────────────────────

function applySchema(cluster) {
  run(cluster.bin.psql, [
    '-w',
    '-h',
    '127.0.0.1',
    '-p',
    String(cluster.port),
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-q',
    '-c',
    'CREATE DATABASE gymlog_test',
  ]);

  console.log('→ bootstrap de auth/roles');
  psql(cluster.bin, cluster.port, 'gymlog_test', null, {
    file: join(REPO_ROOT, 'scripts/db/idempotency-bootstrap.sql'),
    singleTransaction: true,
  });

  for (const migration of MIGRATIONS) {
    const file = join(REPO_ROOT, 'supabase/migrations', migration);
    if (!existsSync(file)) throw new Error(`Falta la migración ${migration}`);
    console.log(`  · ${migration}`);
    psql(cluster.bin, cluster.port, 'gymlog_test', null, {
      file,
      singleTransaction: true,
    });
  }
}

function runSequentialScenarios(cluster) {
  console.log('→ escenarios secuenciales');
  const result = psql(cluster.bin, cluster.port, 'gymlog_test', null, {
    file: join(REPO_ROOT, 'scripts/db/idempotency-scenarios.sql'),
  });
  for (const line of result.output.split(/\r?\n/)) {
    if (line.includes('NOTICE:  OK ')) console.log(`  ✓ ${line.split('OK ')[1]}`);
  }
  const notices = result.output.match(/OK [a-z_]+/g) ?? [];
  assert(notices.length >= 19, `se esperaban 19 escenarios y llegaron ${notices.length}`);
}

function saveCall({ key, weight, exerciseId = EX_A, sets = null, startedAt, finishedAt = null }) {
  const payload = sets ?? [
    { set_num: 1, reps: 5, weight },
    { set_num: 2, reps: 5, weight: weight + 5 },
  ];
  return `SELECT public.save_workout_with_sets(
    '${USER_A}'::uuid,
    ${exerciseId ? `'${exerciseId}'::uuid` : 'NULL::uuid'},
    '${startedAt}'::timestamptz,
    ${finishedAt ? `'${finishedAt}'::timestamptz` : 'NULL::timestamptz'},
    '${JSON.stringify(payload)}'::jsonb,
    NULL, NULL,
    '${key}'::uuid
  );`;
}

function cardioCall({
  key,
  startedAt,
  type = 'running',
  duration = 1800,
  distance = 5,
  calories = 300,
  notes = null,
}) {
  return `SELECT public.save_cardio_session(
    '${USER_A}'::uuid,
    '${key}'::uuid,
    '${type}',
    '${startedAt}'::timestamptz,
    ${duration},
    ${distance === null ? 'NULL' : distance}::numeric,
    ${calories === null ? 'NULL' : calories}::integer,
    ${notes === null ? 'NULL' : `'${notes}'`}
  );`;
}

function jsonImportCall(importId, workouts) {
  return `SELECT public.import_history_workouts(
    '${USER_A}'::uuid,
    '${importId}'::uuid,
    '${JSON.stringify(workouts)}'::jsonb
  );`;
}

function sessionScript(saveSql, { hold = false } = {}) {
  return [
    'BEGIN;',
    `SET LOCAL request.jwt.claim.sub = '${USER_A}';`,
    saveSql,
    ...(hold ? ['SELECT pg_sleep(0.8);'] : []),
    'COMMIT;',
  ].join('\n');
}

async function concurrentPair(cluster, firstSql, secondSql, { gapMs = 350 } = {}) {
  const args = (sql) => [
    '-w',
    '-h',
    '127.0.0.1',
    '-p',
    String(cluster.port),
    '-U',
    'postgres',
    '-d',
    'gymlog_test',
    '-tA',
    '--no-psqlrc',
    '-c',
    sql,
  ];
  const first = new Promise((resolve) => {
    const child = spawn(cluster.bin.psql, args(firstSql), {
      cwd: REPO_ROOT,
      env: { ...process.env, PGCONNECT_TIMEOUT: '10' },
      windowsHide: true,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (status) => resolve({ status, out, err }));
  });

  await wait(gapMs);

  const second = new Promise((resolve) => {
    const child = spawn(cluster.bin.psql, args(secondSql), {
      cwd: REPO_ROOT,
      env: { ...process.env, PGCONNECT_TIMEOUT: '10' },
      windowsHide: true,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('close', (status) => resolve({ status, out, err }));
  });

  return Promise.all([first, second]);
}

async function runConcurrencyScenarios(cluster) {
  console.log('→ concurrencia real (dos conexiones simultáneas)');
  const port = cluster.port;
  const bin = cluster.bin;
  const keyRetry = 'f0000000-0000-4000-8000-000000000001';
  const keyConflict = 'f0000000-0000-4000-8000-000000000002';
  const keyIndependent1 = 'f0000000-0000-4000-8000-000000000003';
  const keyIndependent2 = 'f0000000-0000-4000-8000-000000000004';
  const keyImport = 'f0000000-0000-4000-8000-000000000005';

  // 1. Misma clave, misma carga: la segunda espera a la primera y no duplica.
  const [a1, b1] = await concurrentPair(
    cluster,
    sessionScript(saveCall({ key: keyRetry, weight: 60, startedAt: '2026-10-10T10:00:00Z' }), {
      hold: true,
    }),
    sessionScript(saveCall({ key: keyRetry, weight: 60, startedAt: '2026-10-10T10:00:00Z' })),
  );
  assert(a1.status === 0, `primera sesión falló: ${a1.err}`);
  assert(b1.status === 0, `reintento concurrente falló: ${b1.err}`);
  const id1 = uuidFrom(a1.out);
  const id2 = uuidFrom(b1.out);
  assert(id1 && id1 === id2, 'ambas sesiones deben recibir el mismo id');
  const retryCounts = psql(
    bin,
    port,
    'gymlog_test',
    `SELECT (SELECT count(*) FROM public.workouts WHERE client_id = '${keyRetry}'),
            (SELECT count(*) FROM public.workout_sets s
               JOIN public.workouts w ON w.id = s.workout_id
              WHERE w.client_id = '${keyRetry}');`,
  ).stdout.trim();
  assert(retryCounts === '1|2', `se esperaba 1 entreno y 2 series, llegó ${retryCounts}`);
  console.log('  ✓ misma_clave_misma_carga_concurrente');

  // 2. Misma clave, otra carga: una escribe, la otra recibe conflicto.
  const [a2, b2] = await concurrentPair(
    cluster,
    sessionScript(saveCall({ key: keyConflict, weight: 70, startedAt: '2026-10-11T10:00:00Z' }), {
      hold: true,
    }),
    sessionScript(saveCall({ key: keyConflict, weight: 700, startedAt: '2026-10-11T10:00:00Z' })),
  );
  assert(a2.status === 0, `primera sesión falló: ${a2.err}`);
  assert(b2.status !== 0, 'el contenido distinto debía fallar');
  assert(
    `${b2.err}${b2.out}`.includes('idempotency_conflict'),
    `se esperaba idempotency_conflict, llegó: ${b2.err}`,
  );
  const conflictCounts = psql(
    bin,
    port,
    'gymlog_test',
    `SELECT count(*), min(s.weight)
       FROM public.workout_sets s
       JOIN public.workouts w ON w.id = s.workout_id
      WHERE w.client_id = '${keyConflict}';`,
  ).stdout.trim();
  assert(conflictCounts === '2|70', `el conflicto tocó datos: ${conflictCounts}`);
  console.log('  ✓ misma_clave_otra_carga_concurrente');

  // 3. Claves distintas: no se bloquean entre sí.
  const [a3, b3] = await concurrentPair(
    cluster,
    sessionScript(
      saveCall({ key: keyIndependent1, weight: 30, startedAt: '2026-10-12T10:00:00Z' }),
      { hold: true },
    ),
    sessionScript(
      saveCall({ key: keyIndependent2, weight: 40, startedAt: '2026-10-12T12:00:00Z' }),
    ),
  );
  assert(a3.status === 0 && b3.status === 0, `alguna sesión falló: ${a3.err} ${b3.err}`);
  assert(uuidFrom(a3.out) !== uuidFrom(b3.out), 'claves distintas deben dar entrenos distintos');
  const independentCounts = psql(
    bin,
    port,
    'gymlog_test',
    `SELECT count(*) FROM public.workouts
      WHERE client_id IN ('${keyIndependent1}', '${keyIndependent2}');`,
  ).stdout.trim();
  assert(independentCounts === '2', `se esperaban 2 entrenos, llegó ${independentCounts}`);
  console.log('  ✓ claves_distintas_concurrentes');

  // 4. Importación multiejercicio: todo el día en una transacción.
  const importSets = [
    { exercise_id: EX_A, set_num: 1, reps: 10, weight: 80 },
    { exercise_id: EX_A, set_num: 2, reps: 8, weight: 80 },
    { exercise_id: EX_PUBLIC, set_num: 1, reps: 6, weight: 0 },
  ];
  const importCall = saveCall({
    key: keyImport,
    weight: 0,
    exerciseId: null,
    sets: importSets,
    startedAt: '2026-10-13',
  });
  const [a4, b4] = await concurrentPair(
    cluster,
    sessionScript(importCall, { hold: true }),
    sessionScript(importCall),
  );
  assert(a4.status === 0 && b4.status === 0, `importación falló: ${a4.err} ${b4.err}`);
  const importCounts = psql(
    bin,
    port,
    'gymlog_test',
    `SELECT count(DISTINCT s.id), count(DISTINCT s.exercise_id)
       FROM public.workout_sets s
       JOIN public.workouts w ON w.id = s.workout_id
      WHERE w.client_id = '${keyImport}';`,
  ).stdout.trim();
  assert(importCounts === '3|2', `lote incompleto o duplicado: ${importCounts}`);
  console.log('  ✓ importacion_multiejercicio_concurrente');

  // 5. Huella canónica: '80' y '80.0' son la misma carga, no un conflicto.
  const keyNormalized = 'f0000000-0000-4000-8000-000000000006';
  psql(
    bin,
    port,
    'gymlog_test',
    `SELECT public.save_workout_with_sets(
       '${USER_A}', '${EX_A}', '2026-10-14T10:00:00Z', NULL,
       '[{"set_num":1,"reps":5,"weight":80},{"set_num":2,"reps":5,"weight":85}]'::jsonb,
       NULL, NULL, '${keyNormalized}');`,
  );
  const normalized = psql(
    bin,
    port,
    'gymlog_test',
    `SELECT public.save_workout_with_sets(
       '${USER_A}', '${EX_A}', '2026-10-14T10:00:00Z', NULL,
       '[{"set_num":1,"reps":5,"weight":80.0},{"set_num":2,"reps":5,"weight":85.00}]'::jsonb,
       NULL, NULL, '${keyNormalized}');`,
    { allowFailure: true },
  );
  assert(normalized.status === 0, `la huella no normalizó los números: ${normalized.output}`);
  console.log('  ✓ huella_normaliza_numeros');

  // 6. Cardio: misma clave y misma carga concurrentes -> una sola sesión.
  const cardioRetry = 'f1000000-0000-4000-8000-000000000001';
  const [a6, b6] = await concurrentPair(
    cluster,
    sessionScript(cardioCall({ key: cardioRetry, startedAt: '2026-10-25T10:00:00Z' }), {
      hold: true,
    }),
    sessionScript(cardioCall({ key: cardioRetry, startedAt: '2026-10-25T10:00:00Z' })),
  );
  assert(a6.status === 0 && b6.status === 0, `cardio concurrente falló: ${a6.err} ${b6.err}`);
  assert(uuidFrom(a6.out) === uuidFrom(b6.out), 'el reintento de cardio debe recibir el mismo id');
  const cardioRetryCounts = psql(
    bin,
    port,
    'gymlog_test',
    `SELECT count(*) FROM public.cardio_sessions WHERE client_id = '${cardioRetry}';`,
  ).stdout.trim();
  assert(cardioRetryCounts === '1', `se esperaba 1 sesión de cardio, llegó ${cardioRetryCounts}`);
  console.log('  ✓ cardio_misma_clave_concurrente');

  // 7. Cardio: otra clave, mismo instante y misma carga -> dedupe de contenido.
  const cardioContentA = 'f1000000-0000-4000-8000-000000000002';
  const cardioContentB = 'f1000000-0000-4000-8000-000000000003';
  const [a7, b7] = await concurrentPair(
    cluster,
    sessionScript(cardioCall({ key: cardioContentA, startedAt: '2026-10-26T10:00:00Z' }), {
      hold: true,
    }),
    sessionScript(cardioCall({ key: cardioContentB, startedAt: '2026-10-26T10:00:00Z' })),
  );
  assert(a7.status === 0 && b7.status === 0, `dedupe de cardio falló: ${a7.err} ${b7.err}`);
  assert(uuidFrom(a7.out) === uuidFrom(b7.out), 'el dedupe debe devolver la sesión existente');
  const cardioContentCounts = psql(
    bin,
    port,
    'gymlog_test',
    `SELECT count(*) FROM public.cardio_sessions
      WHERE started_at = '2026-10-26T10:00:00Z'::timestamptz;`,
  ).stdout.trim();
  assert(cardioContentCounts === '1', `el dedupe duplicó cardio: ${cardioContentCounts}`);
  console.log('  ✓ cardio_dedupe_contenido_concurrente');

  // 8. Cardio: misma clave y otra carga -> una escribe, la otra conflicto.
  const cardioConflict = 'f1000000-0000-4000-8000-000000000004';
  const [a8, b8] = await concurrentPair(
    cluster,
    sessionScript(
      cardioCall({ key: cardioConflict, startedAt: '2026-10-27T10:00:00Z', duration: 1800 }),
      { hold: true },
    ),
    sessionScript(
      cardioCall({ key: cardioConflict, startedAt: '2026-10-27T10:00:00Z', duration: 2400 }),
    ),
  );
  assert(a8.status === 0, `primera sesión de cardio falló: ${a8.err}`);
  assert(b8.status !== 0, 'el cardio con otra carga debía fallar');
  assert(
    `${b8.err}${b8.out}`.includes('idempotency_conflict'),
    `se esperaba idempotency_conflict, llegó: ${b8.err}`,
  );
  const cardioConflictCounts = psql(
    bin,
    port,
    'gymlog_test',
    `SELECT count(*), min(duration) FROM public.cardio_sessions
      WHERE client_id = '${cardioConflict}';`,
  ).stdout.trim();
  assert(cardioConflictCounts === '1|1800', `el conflicto tocó el cardio: ${cardioConflictCounts}`);
  console.log('  ✓ cardio_conflicto_concurrente');

  // 9. JSON: mismo lote y misma identidad concurrentes -> una sola escritura.
  const importRetry = 'f2000000-0000-4000-8000-000000000001';
  const importRetryPayload = [
    {
      started_at: '2026-11-10T10:00:00Z',
      exercise_id: EX_A,
      sets: [
        { set_num: 1, reps: 5, weight: 80 },
        { set_num: 2, reps: 5, weight: 85 },
      ],
    },
    {
      started_at: '2026-11-10T10:00:00Z',
      exercise_id: EX_PUBLIC,
      sets: [{ set_num: 1, reps: 8, weight: 0 }],
    },
    {
      started_at: '2026-11-11T10:00:00Z',
      exercise_id: EX_A,
      sets: [{ set_num: 1, reps: 5, weight: 90 }],
    },
  ];
  const [a9, b9] = await concurrentPair(
    cluster,
    sessionScript(jsonImportCall(importRetry, importRetryPayload), { hold: true }),
    sessionScript(jsonImportCall(importRetry, importRetryPayload)),
  );
  assert(a9.status === 0 && b9.status === 0, `lote JSON concurrente falló: ${a9.err} ${b9.err}`);
  const countLines = (output) =>
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^\d+$/.test(line));
  assert(
    countLines(a9.out).includes('3') && countLines(b9.out).includes('3'),
    `ambas sesiones deben contar 3 elementos: ${a9.out} / ${b9.out}`,
  );
  const importRetryCounts = psql(
    bin,
    port,
    'gymlog_test',
    `SELECT (SELECT count(*) FROM public.workouts
              WHERE started_at::date IN ('2026-11-10', '2026-11-11')),
            (SELECT count(*) FROM public.workout_sets s
               JOIN public.workouts w ON w.id = s.workout_id
              WHERE w.started_at::date IN ('2026-11-10', '2026-11-11'));`,
  ).stdout.trim();
  assert(importRetryCounts === '3|4', `el lote concurrente duplicó: ${importRetryCounts}`);
  console.log('  ✓ json_misma_importacion_concurrente');

  // 10. JSON: misma identidad y otra carga -> conflicto sin restos parciales.
  const importConflict = 'f2000000-0000-4000-8000-000000000002';
  const importConflictBase = [
    {
      started_at: '2026-11-20T10:00:00Z',
      exercise_id: EX_A,
      sets: [
        { set_num: 1, reps: 5, weight: 80 },
        { set_num: 2, reps: 5, weight: 85 },
      ],
    },
    {
      started_at: '2026-11-20T10:00:00Z',
      exercise_id: EX_PUBLIC,
      sets: [{ set_num: 1, reps: 8, weight: 0 }],
    },
    {
      started_at: '2026-11-21T10:00:00Z',
      exercise_id: EX_A,
      sets: [{ set_num: 1, reps: 5, weight: 90 }],
    },
  ];
  const importConflictPayload = [
    {
      started_at: '2026-11-22T10:00:00Z',
      exercise_id: EX_A,
      sets: [{ set_num: 1, reps: 5, weight: 80 }],
    },
    {
      started_at: '2026-11-20T10:00:00Z',
      exercise_id: EX_PUBLIC,
      sets: [{ set_num: 1, reps: 99, weight: 99 }],
    },
  ];
  const [a10, b10] = await concurrentPair(
    cluster,
    sessionScript(jsonImportCall(importConflict, importConflictBase), { hold: true }),
    sessionScript(jsonImportCall(importConflict, importConflictPayload)),
  );
  assert(a10.status === 0, `lote JSON base falló: ${a10.err}`);
  assert(b10.status !== 0, 'el lote JSON con otra carga debía fallar');
  assert(
    `${b10.err}${b10.out}`.includes('idempotency_conflict'),
    `se esperaba idempotency_conflict, llegó: ${b10.err}`,
  );
  const importConflictCounts = psql(
    bin,
    port,
    'gymlog_test',
    `SELECT (SELECT count(*) FROM public.workouts
              WHERE started_at::date = '2026-11-22'),
            (SELECT count(*) FROM public.workouts
              WHERE started_at::date IN ('2026-11-20', '2026-11-21'));`,
  ).stdout.trim();
  assert(
    importConflictCounts === '0|3',
    `el conflicto JSON dejó restos o tocó el lote original: ${importConflictCounts}`,
  );
  console.log('  ✓ json_conflicto_sin_restos_concurrente');
}

// ── main ────────────────────────────────────────────────────────────────────

let cluster = null;
try {
  const bin = binaries(findPgBin());
  console.log(`PostgreSQL: ${bin.initdb}`);
  cluster = await startCluster(bin);
  applySchema(cluster);
  runSequentialScenarios(cluster);
  await runConcurrencyScenarios(cluster);
  console.log('\nTodo OK.');
} catch (err) {
  console.error(`\nFALLO: ${err instanceof Error ? err.message : String(err)}`);
  if (cluster) {
    try {
      const log = readFileSync(cluster.logPath, 'utf8');
      const tail = log.trim().split(/\r?\n/).slice(-30).join('\n');
      if (tail) console.error(`\n--- postgres.log (últimas líneas) ---\n${tail}`);
    } catch {
      // Sin log disponible.
    }
    console.error(`\nEl clúster temporal se conserva en ${cluster.dir} para inspección.`);
    cluster = { ...cluster, keep: true };
  }
  process.exitCode = 1;
} finally {
  if (cluster && !cluster.keep) {
    stopCluster(cluster);
    try {
      rmSync(cluster.dir, { recursive: true, force: true });
    } catch {
      // Windows a veces mantiene el log abierto un instante; no es un fallo.
    }
  }
}
