# Prompt de Auditoría Completa — GymLog v4.1.0

> Copia y pega este prompt en Claude/ChatGPT/Cursor junto con el contexto del repo (o ejecútalo con `code-reviewer`, `senior-architect`, `tech-debt-tracker`, `senior-security` skills).

---

## Contexto del Proyecto

**Stack**: React 19 + TypeScript 5.7 + Vite 6 + TailwindCSS 4 + Zustand 5 + TanStack Query 5 + Supabase (PostgREST + RPCs + Auth + Realtime) + Capacitor 8 (iOS/Android/PWA) + Vitest + React Testing Library + ESLint flat config + Standard Version + Husky + Commitizen

**Arquitectura**: Feature-based (`src/features/{auth,routine,workout,stats,cardio,wearables}/`) + shared (`src/shared/{lib,stores,components,hooks,constants,styles,api}`) + app shell (`src/app/`)

**Tamaño**: ~132 archivos `.ts/.tsx` en `src/`, ~15 test files, 0 GitHub Actions (CI local only)

**Features clave**:

- Offline-first: IndexedDB outbox (`workoutOutbox.ts`) + sync on reconnect
- Routinas predefinidas + custom, PPL/FullBody/Hipertrofia/Fuerza/Principiante
- Stats avanzadas: KPIs, proyección volumen, fatiga, comparación periodos, export Excel
- Wearables: HealthKit/Google Fit sync via Capacitor + background notifications
- Auth: Email/password + Google OAuth (web + native deep link)
- PWA: Service Worker (Workbox) + auto-update + install prompts
- i18n: ES/EN con `i18next`

---

## Prompt de Auditoría

```
Realiza una **auditoría exhaustiva multi-dimensional** de ESTE repositorio (GymLog v4.1.0).
Analiza TODOS los archivos en `src/`, `supabase/`, configs raíz, y tests.

---

### 1. CALIDAD DE CÓDIGO Y ARQUITECTURA
- **SOLID/DRY/KISS/YAGNI**: God components, feature envy, anemic domain, over-abstraction
- **Complejidad**: Ciclomática >10, funciones >50 líneas, nesting >4, archivos >300 líneas
- **Acoplamiento**: Circular deps (check `tsconfig.paths` + imports), barrel files que rompen tree-shaking
- **Cohesión**: Stores de Zustand con lógica de negocio + persistencia + sync + UI state mezclados
- **Patrones**: Consistencia en hooks (`useX` vs `useXStore`), stores, API layer, error boundaries
- **TypeScript**: `any` explícitos, `non-null-assertion` abuse, types inferidos vs declarados, `strict: true` efectivo
- **Arquitectura por capas**: Separación real UI / Domain / Data / Infra? ¿Leaky abstractions?

### 2. DEUDA TÉCNICA Y CÓDIGO MUERTO/INEFICIENTE
- **Dead code**: Exports no usados, imports no referenciados, componentes huérfanos, hooks sin consumir, tipos huérfanos
- **Duplicación**: Code clones Type 1-3 (>6 líneas), lógica repetida en stores/hooks/utils (ej. validaciones, formateo fechas, cálculos Brzycki/Epley)
- **Zombie code**: `TODO`/`FIXME`/`HACK` >90 días sin owner, feature flags muertas, configs legacy
- **Over-engineering**: Abstracciones prematuras, indirection innecesaria, factory patterns donde basta función
- **Bundle bloat**: Chunks grandes sin code-splitting, imports de librerías enteras (ej. `recharts` completo), `lucide-react` icons no tree-shaken
- **Tech debt score**: Cuantifica horas estimadas de remediación por módulo (hotspots: churn × complexity × issues)

### 3. SEGURIDAD Y VULNERABILIDADES
- **SAST**: SQLi (RPCs Supabase), XSS (dangerouslySetInnerHTML, `innerHTML`), path traversal, command injection, prototype pollution, unsafe deserialization
- **Secrets**: Keys en código/historia/env files, `VITE_*` expuestos al bundle, Supabase anon key rotation
- **Deps**: CVEs ≥7 (npm audit / Snyk / OSS Index), paquetes abandonados (>2 años), typosquatting
- **AuthZ/AuthN**: RLS policies en Supabase (ver `supabase/migrations/`), IDOR en RPCs, JWT alg confusion, session fixation, broken access control
- **Client-side**: CSP headers, HSTS, cookies Secure/SameSite, CORS wildcards, debug logs en prod (`devLog`/`devError` en build)
- **Capacitor/Native**: Deep link validation (`isSafeUrl`), intent filters, biometric storage, keystore/keychain usage
- **PWA/SW**: `workbox` config, cache poisoning, navigation preload, offline fallback security

### 4. RENDIMIENTO Y ESCALABILIDAD
- **React**: Re-renders innecesarios (missing `React.memo`, `useMemo`, `useCallback`, selector stability en Zustand), context splitting, lazy loading routes/components
- **TanStack Query**: Stale times, cache keys, `select` para derivar data, `queryKey` factories, prefetching, hydration, persistence size (IndexedDB quota)
- **Supabase/DB**: N+1 en RPCs, missing indexes (ver migraciones), full table scans, `select('*')`, transacciones largas, connection pooling
- **Bundle**: `npm run analyze` — chunks >250KB gzipped, duplicate modules, unused exports, `recharts`/`framer-motion`/`exceljs` lazy?
- **Runtime**: Memory leaks (event listeners, subscriptions, intervals), main thread blocking (cálculos KPI/proyección en UI thread), Web Workers para `exceljs`/proyecciones
- **Core Web Vitals**: LCP/CLS/INP targets, font loading (`preload`), image optimization (WebP/AVIF, `loading=lazy`), critical CSS
- **Mobile/Capacitor**: WKWebView/UIWebView, JSI bridge overhead, Hermes, startup time, background sync reliability

### 5. TESTING Y CONFIABILIDAD
- **Cobertura**: `npm run test:coverage` — líneas/ramas/funciones <80% en código crítico (stores, utils matemáticos, sync logic)
- **Pirámide invertida**: Muchos E2E/integración, pocos unitarios puros; tests acoplados a implementación
- **Flakiness**: Timers, async, random data, network mocks inestables (MSW handlers)
- **Edge cases**: Offline→online sync conflicts, concurrent mutations, RLS bypass, timezone/DST, leap years, empty states, max limits
- **Mutation testing**: Stryker score en libs puras (`brzycki.ts`, `progression.ts`, `plates.ts`, `weight.ts`)
- **Contract tests**: Supabase RPC signatures vs TypeScript types (`database.types.ts` generado vs real)

### 6. DEVOPS Y DX
- **CI/CD**: **Ausente** — GitHub Actions/GitLab CI para lint, type-check, test, build, analyze, deploy preview (Vercel/Netlify/Capacitor)
- **Release**: `standard-version` + changelog convencional, pero sin automated release (GitHub Releases, Play Store, TestFlight, App Store)
- **Dependency mgmt**: Renovate/Dependabot ausente, lockfile drift, peer dep conflicts (`@capacitor/*` vs `vite` vs `react`)
- **Quality gates**: Pre-commit (husky + lint-staged) OK, pero sin pre-push, sin PR checks, sin SARIF upload a GitHub Security
- **Observabilidad**: Sentry (`@sentry/react`) configurado pero ¿source maps subidos? ¿breadcrumbs? ¿performance monitoring?
- **Analytics**: `@vercel/analytics` — ¿eventos custom? ¿privacy compliant (GDPR/CCPA)?
- **Docs**: README, ADRs, arquitectura, onboarding, runbooks — ¿actualizadas?

### 7. ACCESIBILIDAD (WCAG 2.2 AA)
- **ESLint `jsx-a11y`**: Solo `warn` en reglas críticas (`alt-text`, `click-events-have-key-events`, `interactive-supports-focus`)
- **Semántica**: `button` vs `div onClick`, headings hierarchy, landmarks, ARIA labels en componentes custom (`BottomSheet`, `Modal`, `SortableExerciseList`)
- **Contraste**: Tailwind 4 tokens (`--bg-surface`, `--text-primary`) — verificar ratios 4.5:1 / 3:1
- **Focus management**: Trap en modals/sheets, visible focus rings, skip links, restoration al cerrar
- **Screen readers**: Live regions para toasts (`sonner`), estados de carga, anuncios de cambios dinámicos
- **Reduced motion**: `prefers-reduced-motion` en `framer-motion`/`framer-motion` lazy features
- **Touch targets**: ≥48×48dp en móvil, espaciado entre interactivos

### 8. ESPECÍFICO GYMLOG — DOMINIO
- **Cálculos fitness**: Brzycki/Epley/Lander, proyección volumen, fatiga, KPIs — ¿validados contra literatura? ¿property-based tests?
- **Sync offline**: `workoutOutbox.ts` + `outboxStore.ts` — idempotency keys, conflict resolution (last-write-wins vs merge), deduplicación, ordering guarantees
- **RPCs Supabase**: `save_workout_with_sets` — transaccionalidad, validación server-side, RLS, race conditions en `exercise` custom creation
- **Wearables**: `healthBridge.ts` + `healthAggregator.ts` — permisos, batch sync, rate limiting, background task reliability (iOS BGAppRefresh / Android WorkManager)
- **Notificaciones nativas**: `notifications.ts` — ID collision risk, channel importance, `allowWhileIdle`, exact alarms (Android 14+), iOS provisional auth
- **i18n**: `i18next` + `date-fns` locales — pluralización, relativos, formato pesos (kg/lb), RTL readiness
- **PWA installability**: `manifest.json` (VitePWA), icons maskable, shortcuts, splash screens, `beforeinstallprompt` handling

---

### FORMATO DE SALIDA REQUERIDO

#### 1. RESUMEN EJECUTIVO (1 párrafo + score global 0-100)
#### 2. TOP 10 HALLAZGOS CRÍTICOS (tabla: archivo:línea | severidad 🔴🟠🟡🟢 | categoría | impacto | esfuerzo fix | referencia)
#### 3. POR CATEGORÍA (tablas separadas con conteos por severidad)
#### 4. DEUDA TÉCNICA CUANTIFICADA (horas estimadas por módulo/hotspot)
#### 5. PLAN DE ACCIÓN PRIORIZADO
   - **Quick wins** (<1h): lint fixes, dead code removal, `any` → types, `warn` → `error` a11y
   - **High impact** (<1 día): bundle splitting, missing indexes, test coverage gaps, CI pipeline
   - **Estratégico** (>1 semana): arquitectura stores, offline sync robustness, mutation testing, release automation
#### 6. HOTSPOTS (top 20 archivos por churn × complexity × issues) — usa `git log --oneline -100 --name-only` + complexity
#### 7. ARTEFACTOS MACHINE-READABLE
   - `audit-results.sarif` (GitHub Code Scanning)
   - `audit-results.json` (schema: {files, issues, summary, metrics})
   - `tech-debt.csv` (file,line,category,severity,effort_hours,description)

---

### CONTEXTO ADICIONAL PARA EL AUDITOR

- **Pain points actuales**: (rellena tú) _______________
- **Objetivo inmediato**: (ej. "preparar release 5.0", "reducir crashes en Play Store", "mejorar LCP <2.5s") _______________
- **Equipo**: (nº devs, seniority, on-call) _______________
- **Exclusiones**: `android/`, `ios/`, `node_modules/`, `dist/`, `coverage/`, `*.generated.ts`, `database.types.ts` (auto-generado)
- **Herramientas ya en repo**: `npm run lint`, `npm run type-check`, `npm run test:coverage`, `npm run analyze`, `npm run doctor`
```

---

## Cómo ejecutar la auditoría localmente (sin LLM)

```bash
# 1. Lint + type-check (baseline)
npm run lint && npm run type-check

# 2. Tests + cobertura
npm run test:coverage

# 3. Bundle analysis
npm run analyze  # abre dist/bundle-report.html

# 4. Dependencias vulnerables
npm audit --audit-level=high
npx audit-ci --config audit-ci.json  # si configuras

# 5. Dead code (ts-prune / knip)
npx knip  # detecta exports/imports/deps no usados

# 6. Complejidad
npx complexity-report --format=json src/ > complexity.json

# 7. Churn (git)
git log --oneline --name-only -200 -- src/ | grep "\.tsx\?$" | sort | uniq -c | sort -rn > churn.txt

# 8. SARIF export (para GitHub Security tab)
npm run lint -- --format=sarif --output-file=eslint.sarif

# 9. Supabase diff (schema drift)
supabase db diff --schema public > schema-drift.sql
```

---

## Skills recomendados para automatizar partes

| Skill                  | Qué hace                                           | Comando        |
| ---------------------- | -------------------------------------------------- | -------------- |
| `code-reviewer`        | Revisa PRs/diffs por complejidad, SOLID, seguridad | `/code-review` |
| `tech-debt-tracker`    | Escanea codebase, cuantifica deuda, hotspots       | `/tech-debt`   |
| `senior-architect`     | Evalúa arquitectura, acoplamiento, boundaries      | `/arch-review` |
| `senior-security`      | SAST, secrets, deps, OWASP Top 10                  | `/sec-audit`   |
| `a11y-audit`           | WCAG 2.2 AA, axe-core, color contrast              | `/a11y`        |
| `performance-profiler` | Flamegraphs, bundle, CWV, memory leaks             | `/perf-audit`  |
| `dependency-auditor`   | CVEs, license, supply chain, freshness             | `/dep-audit`   |

Úsalos en combinación: `spawn` → paraleliza → `merge` mejor resultado.
