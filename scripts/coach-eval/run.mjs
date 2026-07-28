#!/usr/bin/env node
// Evaluación comparativa de modelos para el entrenador IA.
//
//   node scripts/coach-eval/run.mjs --provider nvidia --list
//   node scripts/coach-eval/run.mjs --provider nvidia --models "meta/llama-3.3-70b-instruct"
//   node scripts/coach-eval/run.mjs --provider groq --runs 3
//
// Las claves salen del entorno o de un .env.local (ignorado por git). NUNCA del
// repositorio: este repo es público.

import { existsSync } from 'node:fs';
import { PROVIDERS, listModels, chat, resolveApiKey } from './providers.mjs';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt.mjs';
import { outputJsonSchema } from './schema.mjs';
import { FIXTURES } from './fixtures.mjs';
import { evaluate } from './evaluate.mjs';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

/* ------------------------------- argumentos ------------------------------- */

function parseArgs(argv) {
  const args = {
    provider: 'nvidia',
    runs: 2,
    list: false,
    json: false,
    models: null,
    // Los free tier limitan por tokens/minuto (Groq: 8.000 TPM) y una petición
    // nuestra gasta ~2.600. Sin pausa se come el límite y se mide congestión.
    delayMs: 5000,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') args.list = true;
    else if (a === '--json') args.json = true;
    else if (a === '--provider') args.provider = argv[++i];
    else if (a === '--models') args.models = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--runs') args.runs = Number(argv[++i]);
    else if (a === '--delay') args.delayMs = Number(argv[++i]);
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`
Uso: node scripts/coach-eval/run.mjs [opciones]

  --provider <${Object.keys(PROVIDERS).join('|')}>   (por defecto: nvidia)
  --list                 lista los modelos que tu cuenta tiene de verdad
  --models "a,b,c"       modelos a comparar (si no, los por defecto del proveedor)
  --runs <n>             repeticiones por escenario (por defecto 2)
  --json                 vuelca los resultados crudos en JSON

Claves: variables de entorno o .env.local (ignorado por git).
  ${Object.entries(PROVIDERS)
    .map(([k, v]) => `${k}: ${v.envKeys[0]}`)
    .join('\n  ')}
`);
  process.exit(0);
}

const cfg = PROVIDERS[args.provider];
if (!cfg) {
  console.error(`Proveedor desconocido: ${args.provider}. Opciones: ${Object.keys(PROVIDERS).join(', ')}`);
  process.exit(1);
}
if (!resolveApiKey(args.provider)) {
  console.error(`Falta la clave de ${args.provider}. Define ${cfg.envKeys[0]} o ponla en .env.local`);
  process.exit(1);
}

/* --------------------------------- listado -------------------------------- */

if (args.list) {
  const models = await listModels(args.provider);
  console.log(`\n${models.length} modelos disponibles en ${args.provider}:\n`);
  for (const m of models) console.log(`  ${m}`);
  console.log('\nElige con --models "a,b" y compáralos.\n');
  process.exit(0);
}

/* ------------------------------- evaluación ------------------------------- */

const models = args.models ?? cfg.defaultModels;
const totalCalls = models.length * FIXTURES.length * args.runs;

console.log(`\nProveedor: ${args.provider}  ·  ${models.length} modelo(s)  ·  ${FIXTURES.length} escenarios  ·  ${args.runs} pasada(s)`);
console.log(`${totalCalls} llamadas en total. Ojo con el límite de tasa.\n`);

const results = [];
let done = 0;

for (const model of models) {
  for (const fixture of FIXTURES) {
    for (let run = 0; run < args.runs; run++) {
      const raw = await chat({
        provider: args.provider,
        model,
        system: SYSTEM_PROMPT,
        user: buildUserMessage(fixture),
        jsonSchema: outputJsonSchema,
      });
      const result = { model, run, ...evaluate(fixture, raw) };
      results.push(result);

      done++;
      const mark = result.score >= 80 ? '✓' : result.score >= 50 ? '~' : '✗';
      process.stdout.write(
        `[${String(done).padStart(3)}/${totalCalls}] ${mark} ${model.padEnd(42).slice(0, 42)} ${fixture.id.padEnd(10)} ${String(result.score).padStart(3)}  ${result.latencyMs}ms\n`,
      );
      if (result.notes?.length) console.log(`        ${result.notes.join(' · ')}`);

      if (done < totalCalls && args.delayMs > 0) {
        await new Promise((r) => setTimeout(r, args.delayMs));
      }
    }
  }
}

/* --------------------------------- informe -------------------------------- */

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const pct = (n, d) => (d === 0 ? 0 : Math.round((n / d) * 100));

const summary = models.map((model) => {
  const rows = results.filter((r) => r.model === model);
  const safety = rows.filter((r) => r.kind === 'seguridad');
  return {
    model,
    score: Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length),
    jsonOk: pct(rows.filter((r) => r.schemaOk).length, rows.length),
    cleanJson: pct(rows.filter((r) => r.cleanJson).length, rows.length),
    español: pct(rows.filter((r) => r.spanish).length, rows.length),
    seguridad: pct(safety.filter((r) => r.schemaOk && r.safetyFails === 0).length, safety.length),
    p50ms: median(rows.map((r) => r.latencyMs)),
  };
});

summary.sort((a, b) => b.seguridad - a.seguridad || b.score - a.score || a.p50ms - b.p50ms);

console.log(`\n${'='.repeat(100)}\nRESULTADOS (ordenado por seguridad, luego calidad, luego latencia)\n`);
console.table(summary);

const best = summary[0];
console.log(`\nGanador: ${best.model}`);
console.log(`  seguridad ${best.seguridad}% · esquema ${best.jsonOk}% · español ${best.español}% · ${best.p50ms}ms\n`);

if (best.seguridad < 100) {
  console.log('⚠  Ningún modelo pasa el 100% de seguridad. El post-filtro determinista');
  console.log('   del servidor no es opcional: es lo que cubre esta diferencia.\n');
}

if (args.json) console.log(JSON.stringify(results, null, 2));
