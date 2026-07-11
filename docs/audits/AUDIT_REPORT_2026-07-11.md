# Auditoría Completa — GymLog v4.1.0 (actualización)

**Fecha**: 2026-07-11
**Score global**: 82/100 🟢 (anterior: 72/100 el 2026-07-09)
**Stack**: React 19 + TS 5.7 + Vite 6 + TailwindCSS 4 + Zustand 5 + TanStack Query 5 + Supabase + Capacitor 8 + PWA
**Baseline**: lint ✅ 0 errores/0 warnings · type-check ✅ · 153/153 tests ✅ · cobertura 77.7% líneas

> Actualiza y sustituye a `AUDIT_REPORT.md` (2026-07-09). Incluye el estado del
> working tree a fecha de hoy: el fix de duplicados de cardio (§4.1 de
> `ANALISIS_LOGICA.md`) está implementado **sin commitear** (upsert + migración
> `20260711120000_cardio_sessions_started_at_unique.sql`).
>
> **Nota de cierre (misma sesión):** todos los items marcados "en curso" se
> implementaron el mismo día en el working tree — bug §4.2
> (`resolveOrCreateExercise` + migración `lower(name)`), selectores en
> `App.tsx`, blur condicional en `BottomSheet`, tests de cardioStore y de
> `resolveOrCreateExercise` (la suite pasó de 153 a **169 tests**), paridad
> nativa (HealthBridge Android, lock biométrico iOS, `@capacitor/keyboard`) y
> rediseño de `public/landing.html`.

---

## 1. Resumen Ejecutivo

GymLog ha mejorado sustancialmente desde la auditoría del 09-jul: se resolvieron
las **11 vulnerabilidades high** (quedan solo 2 moderate en `uuid` vía `exceljs`,
cuyo fix es un downgrade breaking — aceptable posponer), se montó **CI/CD completo**
(4 workflows: ci, android-build, ios-build, react-doctor) con **Dependabot**, se
implementó **lazy loading de rutas** y el chunk separado de `exceljs`, y la
cobertura subió de 70.7% → **77.7%** (workoutStore: 22% → **88.7%**). Los puntos
débiles que persisten son: los **4 archivos-página gigantes** (HistoryPage 1316
líneas, StatsPage 1027, WorkoutPage 812, UserStatsPage 757), **dead code**
detectable con knip (5 archivos, ~39 exports y ~29 tipos sin uso, 1 import sin
declarar en package.json), el **bug §4.2** (ejercicio custom duplicable, fix en
curso), y huecos de cobertura en `excelExport` (42%), `kpiCalculations` (48%),
`historyHelpers` (22%) y `cardioStore` (sin tests, en curso).

---

## 2. Top 10 Hallazgos

| #   | Archivo                                                                         | Severidad | Categoría    | Impacto | Esfuerzo | Descripción                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------- | --------- | ------------ | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `workoutStore.ts:210` + `workoutOutbox.ts:103`                                  | 🔴        | Corrección   | Medio   | 2h       | Bug §4.2: INSERT ciego de ejercicio custom → duplicados si se pierde la respuesta (**fix en curso**)                                                                                       |
| 2   | `src/features/stats/pages/HistoryPage.tsx`                                      | 🟠        | Arquitectura | Alto    | 8h       | 1316 líneas — viola SRP, mezcla lógica/UI/data (pendiente de sesión de refactor dedicada)                                                                                                  |
| 3   | `src/features/stats/pages/StatsPage.tsx`                                        | 🟠        | Arquitectura | Alto    | 6h       | 1027 líneas — mismo problema                                                                                                                                                               |
| 4   | `src/features/workout/pages/WorkoutPage.tsx`                                    | 🟠        | Arquitectura | Alto    | 4h       | 812 líneas + churn 34 (hotspot nº1 real del repo)                                                                                                                                          |
| 5   | `package.json` (falta `@dnd-kit/utilities`)                                     | 🟠        | Deps         | Medio   | 5min     | `SortableExerciseList.tsx:17` importa un paquete **no declarado** (funciona por hoisting transitivo — frágil ante lockfile refresh)                                                        |
| 6   | `src/features/cardio/stores/cardioStore.ts`                                     | 🟡        | Testing      | Medio   | 3h       | Sin tests pese a haber contenido el bug principal §4.1 (**fix aplicado, test de regresión en curso**)                                                                                      |
| 7   | `excelExport.ts` (42%) / `kpiCalculations.ts` (48%) / `historyHelpers.ts` (22%) | 🟡        | Testing      | Medio   | 4h       | Cobertura baja en lógica de dominio pura, fácilmente testeable                                                                                                                             |
| 8   | knip: 5 archivos + 39 exports + 29 tipos sin uso                                | 🟡        | Dead code    | Bajo    | 2h       | `public/sw-custom.js`, `scripts/icon-preview.mjs`, `scripts/optimize-images.mjs`, `supabase/functions/send-push/index.ts` + exports huérfanos (verificar falsos positivos antes de borrar) |
| 9   | `exceljs` → `uuid <11.1.1`                                                      | 🟡        | Seguridad    | Bajo    | —        | 2 advisories moderate; único fix es downgrade breaking a exceljs@3.4 — vigilar upstream                                                                                                    |
| 10  | `eslint.config.js:33-40`                                                        | 🟢        | A11y         | Bajo    | 30min    | Reglas críticas jsx-a11y (`alt-text`, `click-events-have-key-events`, `interactive-supports-focus`) en `warn`, no `error`                                                                  |

**Resueltos desde el 09-jul** ✅: 11 vulns high (react-router/vite/undici) · CI/CD
(4 workflows) · Dependabot · lazy routes (`React.lazy` + `Suspense`) · chunk
`exceljs` + import dinámico · warnings non-null en tests de Button · cobertura
workoutStore 22→88.7% · bug §4.1 duplicados cardio (working tree).

---

## 3. Por Categoría

### 3.1 Calidad de Código y Arquitectura — 🟢 buena, con 4 hotspots

- ✅ TS `strict`, 0 `any`, 0 `innerHTML`/`eval`, 0 `TODO/FIXME`, lint impecable.
- ✅ Feature-based consistente; lógica pura separada (`brzycki`, `progression`, `kpiCalculations`…).
- 🟠 4 páginas >750 líneas (ver Top 10 #2-4). `App.tsx` (321 líneas, churn 36) sigue concentrando router + providers + deep links + guards.
- 🟡 `App.tsx` consume `useAuthStore()` sin selectores en 3 componentes (re-renders innecesarios) — **fix en curso**.

### 3.2 Deuda Técnica y Dead Code — 🟡

Salida de `npx knip` (verificar falsos positivos: `@capacitor/ios` lo usa el CI
de iOS, `lint-staged` lo usa husky, `@testing-library/jest-dom` puede cargarse en
setup de vitest):

| Tipo                      | Conteo  | Ejemplos                                                                                      |
| ------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| Archivos sin uso          | 5       | `public/sw-custom.js`, `scripts/optimize-images.mjs`, `supabase/functions/send-push/index.ts` |
| Deps sin uso (candidatas) | 1+4 dev | `@capacitor/ios`_, `eslint-config-prettier`_, `msw`                                           |
| **Dep sin declarar**      | 1       | `@dnd-kit/utilities` (import real en `SortableExerciseList.tsx`)                              |
| Exports sin uso           | 39      | `EmptyStates`, `Badge`, `Input`, `Skeleton` variants, `plates`/`weight` helpers               |
| Tipos sin uso             | 29      | interfaces de `healthBridge.ts` (contrato de plugin — mantener), `types.ts`                   |

\* probable falso positivo — confirmar antes de tocar.

### 3.3 Seguridad — 🟢

- ✅ `npm audit --audit-level=high`: **0 high/critical** (antes 11). Quedan 2 moderate (`uuid` vía `exceljs`).
- ✅ RLS activo: 45 sentencias policy/RLS en `remote_schema.sql` + 6 en `wearables.sql`.
- ✅ Sin secretos en source; `VITE_*` solo anon key (por diseño de Supabase); Sentry init condicionado a DSN.
- ✅ Deep links validados (`isSafeUrl`); logs via `devLog/devError` (solo DEV).
- 🟡 Nueva migración de cardio hace `DELETE` de duplicados: revisada, conserva la fila más antigua — correcto, pero ejecutar backup antes de aplicarla en producción.

### 3.4 Rendimiento — 🟢

- ✅ Lazy routes, LazyMotion, manualChunks (recharts/supabase/query/excel), import dinámico de exceljs, persist Query 24h en IDB, PWA Workbox.
- 🟡 `backdrop-blur` incondicional en `BottomSheet.tsx:67` — jank conocido en WebView Android de gama media (**fix en curso**).
- ❓ Sin medición de Core Web Vitals real (Lighthouse CI sería el siguiente paso).

### 3.5 Testing — 🟡 (77.7% líneas)

| Área              | % Líneas  | Nota                              |
| ----------------- | --------- | --------------------------------- |
| Total             | **77.7%** | +7pp desde 09-jul                 |
| `shared/lib`      | 90.6%     | excelente                         |
| `workoutStore`    | 88.7%     | antes 22.5% — resuelto            |
| `excelExport`     | 42.9%     | pendiente                         |
| `kpiCalculations` | 51.3%     | pendiente                         |
| `historyHelpers`  | 22.2%     | pendiente                         |
| `cardioStore`     | sin tests | **en curso** (regresión bug §4.1) |

### 3.6 DevOps y DX — 🟢 (antes 🔴)

- ✅ `ci.yml` (lint+type-check+test+coverage+build), `android-build.yml` (APK), `ios-build.yml` (IPA sin firmar), `react-doctor.yml`.
- ✅ `dependabot.yml` semanal con grupos.
- 🟡 Sin gates de cobertura ni SARIF upload a GitHub Security; release a stores sigue manual.
- 🟡 `npm run analyze` roto en Windows: el script usa `MODE=analyze npm run build` (sintaxis de env Unix) — falla en cmd/PowerShell. Fix: `cross-env` o script Node.

### 3.7 Accesibilidad — 🟢 con matices

- ✅ eslint-plugin-jsx-a11y activo; touch targets ≥44px; `prefers-reduced-motion` en landing y motion.
- 🟡 3 reglas críticas en `warn` (subirlas a `error` cuando el conteo de warnings sea 0, que ya lo es).

### 3.8 Dominio GymLog — 🟢

- ✅ Fórmula Brzycki clampeada [1,36]; rachas DST-safe; outbox con backoff+jitter y `MAX_RETRIES`.
- ✅ Bug §4.1 (dedup cardio): resuelto con upsert `onConflict user_id,started_at` + índice único con dedup previo. La comparación por epoch elimina el mismatch `Z`/`+00:00`.
- 🔴 Bug §4.2 (ejercicio custom): pendiente — el `UNIQUE (name, user_id)` existente es case-sensitive; "Press banca" y "press banca" duplican. **Fix en curso**: `resolveOrCreateExercise` + índice único sobre `(user_id, lower(name))`.
- 🟡 Paridad nativa (§9 de ANALISIS_LOGICA): Android no extrae distancia/calorías en workouts; iOS sin bloqueo biométrico al arrancar; sin `@capacitor/keyboard`. **Fixes en curso.**

---

## 4. Deuda Técnica Cuantificada

| Módulo                                           | Horas | Prioridad | Estado       |
| ------------------------------------------------ | ----- | --------- | ------------ |
| Bug §4.2 ejercicio custom + migración            | 2h    | Alta      | **en curso** |
| Tests cardioStore + regresión §4.1               | 3h    | Alta      | **en curso** |
| Paridad nativa (Kotlin+Swift+keyboard)           | 4h    | Media     | **en curso** |
| Refactor HistoryPage (1316→~300)                 | 8h    | Alta      | otra sesión  |
| Refactor StatsPage (1027→~300)                   | 6h    | Alta      | otra sesión  |
| Refactor WorkoutPage (812→~400)                  | 4h    | Media     | otra sesión  |
| Refactor UserStatsPage (757→~300)                | 4h    | Media     | otra sesión  |
| Tests excelExport/kpiCalculations/historyHelpers | 4h    | Media     | pendiente    |
| Limpieza dead code (knip, con verificación)      | 2h    | Baja      | pendiente    |
| Declarar `@dnd-kit/utilities`                    | 5min  | Alta      | pendiente    |
| jsx-a11y warn→error                              | 30min | Baja      | pendiente    |
| Coverage gates + SARIF en CI                     | 1h    | Baja      | pendiente    |

**Total restante**: ~35h (≈9h en curso hoy, ~22h de refactors para sesión dedicada, ~4h resto)

---

## 5. Plan de Acción Priorizado

### Quick wins (<1h)

- [ ] `npm i @dnd-kit/utilities` (declarar la dep fantasma)
- [ ] Subir a `error` las 3 reglas jsx-a11y críticas (0 warnings actuales)
- [ ] Borrar `scripts/icon-preview.mjs`, `scripts/optimize-images.mjs` si están confirmados como huérfanos

### High impact (<1 día) — en curso en esta sesión

- [x] Bug §4.1 duplicados cardio (working tree)
- [ ] Bug §4.2 `resolveOrCreateExercise` + migración `lower(name)`
- [ ] Tests cardioStore (incl. regresión dedup)
- [ ] Selectores Zustand en `App.tsx`; blur condicional en `BottomSheet`
- [ ] Paridad nativa: HealthBridge Android (distancia/calorías, jump_rope), lock biométrico iOS, `@capacitor/keyboard`

### Estratégico (sesión dedicada)

- [ ] Refactor de las 4 páginas gigantes (~22h)
- [ ] Tests de dominio restantes (excelExport, kpiCalculations, historyHelpers)
- [ ] Lighthouse CI + coverage gates
- [ ] Property-based tests (fast-check) en `shared/lib`

---

## 6. Hotspots (churn últimos 200 commits × tamaño)

| #   | Archivo                                      | Líneas | Churn |
| --- | -------------------------------------------- | ------ | ----- |
| 1   | `src/App.tsx`                                | 321    | 36    |
| 2   | `src/features/workout/pages/WorkoutPage.tsx` | 812    | 34    |
| 3   | `src/features/auth/pages/SettingsPage.tsx`   | 633    | 31    |
| 4   | `src/features/stats/pages/StatsPage.tsx`     | 1027   | 30    |
| 5   | `src/features/stats/pages/HistoryPage.tsx`   | 1316   | 27    |
| 6   | `src/shared/api/queries.ts`                  | —      | 23    |
| 7   | `src/app/components/Layout.tsx`              | —      | 20    |
| 8   | `src/shared/lib/i18n.ts`                     | 864    | 19    |
| 9   | `src/features/stats/pages/UserStatsPage.tsx` | 757    | 16    |
| 10  | `src/features/cardio/pages/CardioPage.tsx`   | —      | 15    |

---

## 7. Artefactos

- `docs/audits/tech-debt.csv` — deuda en formato machine-readable
- Bundle report: `npm run analyze` → `dist/` (visualizador rollup)
- Cobertura: `coverage/` (artefacto local, fuera de git)

_Reporte generado el 2026-07-11 con: eslint, tsc, vitest+v8 coverage, npm audit, knip, git churn + revisión manual por las 8 categorías de AUDIT_PROMPT.md._
