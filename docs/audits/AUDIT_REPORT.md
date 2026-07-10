# Auditoría Completa — GymLog v4.1.0

**Fecha**: 2026-07-09
**Score global**: 72/100 🟡
**Stack**: React 19 + TS 5.7 + Vite 6 + TailwindCSS 4 + Zustand 5 + TanStack Query 5 + Supabase + Capacitor 8 + PWA

---

## 1. Resumen Ejecutivo

GymLog es un proyecto sólido con **buena higiene de código**: lint limpio (0 errores, 6 warnings), type-check perfecto, sin `any`, sin `innerHTML`, sin `TODO/FIXME`, sin secretos reales en source, y sin console.logs sueltos. La cobertura de tests es **70.7% líneas** (aceptable pero mejorable), y las páginas de Stats/Workout tienen archivos **demasiado grandes** (>800 líneas) que bajan la calidad. Hay **11 vulnerabilidades altas** en dependencias transitivas (react-router, vite, undici) que deberían corregirse pronto. Falta **CI/CD pipeline** y **automatización de releases** para un proyecto con Capacitor + PWA que se despliega en múltiples stores.

---

## 2. Top 10 Hallazgos

| #   | Archivo                                        | Severidad | Categoría    | Impacto | Esfuerzo | Descripción                                                            |
| --- | ---------------------------------------------- | --------- | ------------ | ------- | -------- | ---------------------------------------------------------------------- |
| 1   | `src/features/stats/pages/HistoryPage.tsx:1`   | 🔴        | Arquitectura | Alto    | >8h      | 1408 líneas — viola SRP, mezcla lógica/UI/data                         |
| 2   | `src/features/stats/pages/StatsPage.tsx:1`     | 🔴        | Arquitectura | Alto    | >8h      | 1009 líneas — mismo problema                                           |
| 3   | `src/features/stats/pages/UserStatsPage.tsx:1` | 🔴        | Arquitectura | Alto    | >8h      | 902 líneas — mismo problema                                            |
| 4   | `src/features/workout/pages/WorkoutPage.tsx:1` | 🔴        | Calidad      | Alto    | >4h      | 808 líneas, score 35/100 F en code quality                             |
| 5   | `react-router@7.14.0`                          | 🟠        | Seguridad    | Alto    | <1h      | 4 CVEs: CSRF, DoS, RCE via turbo-stream, open redirect                 |
| 6   | `vite@6.4.2`                                   | 🟠        | Seguridad    | Alto    | <1h      | 2 CVEs: NTLMv2 leak, fs.deny bypass (Windows)                          |
| 7   | `undici@7.x`                                   | 🟠        | Seguridad    | Alto    | <1h      | TLS bypass, header injection, DoS                                      |
| 8   | Toda la app                                    | 🟠        | CI/CD        | Alto    | >4h      | Sin GitHub Actions, sin tests automáticos en PR, sin deploy automático |
| 9   | `workoutStore.ts`                              | 🟠        | Testing      | Medio   | >2h      | Coverage 21.68% — saveWorkout no testado (RPC + offline)               |
| 10  | `src/App.tsx:1`                                | 🟡        | Arquitectura | Medio   | <1h      | 44 imports en un archivo, demasiadas responsabilidades                 |

---

## 3. Por Categoría

### 🟢 Calidad de Código — Puntos Fuertes

| Aspecto                 | Estado                                                           |
| ----------------------- | ---------------------------------------------------------------- |
| TypeScript strict       | ✅ `strict: true`, `noUnusedLocals`, `noUnusedParameters`        |
| ESLint sin `any`        | ✅ `@typescript-eslint/no-explicit-any: 'error'` — 0 violaciones |
| Sin console.log sueltos | ✅ Todos pasan por `devLog/devWarn/devError` (solo DEV)          |
| Sin TODO/FIXME/HACK     | ✅ Código limpio                                                 |
| Sin innerHTML/eval      | ✅ Sin vectores XSS obvios                                       |
| Prettier + Husky        | ✅ Pre-commit hooks con lint-staged                              |
| Conventional commits    | ✅ Commitizen + standard-version                                 |

### 🟠 Calidad de Código — Áreas de Mejora

| Problema               | Archivos afectados                                                                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Archivos >500 líneas   | **9 archivos**: HistoryPage (1408), StatsPage (1009), UserStatsPage (902), WorkoutPage (808), i18n.ts (864), database.types.ts (843), SettingsPage (633), routineStore (611), ExerciseSelector (525) |
| Score code quality F   | WorkoutPage (35/100), kpiCalculations.test (46/100), StatsPage (47/100), HistoryPage (48/100)                                                                                                        |
| App.tsx con 44 imports | Indicador de muchas responsabilidades sin abstraer                                                                                                                                                   |
| Warnings ESLint        | `Button.spec.tsx`: 6 non-null assertions en tests                                                                                                                                                    |

### 🟠 Seguridad y Dependencias

| Problema                      | Detalle                                          | Fix                                |
| ----------------------------- | ------------------------------------------------ | ---------------------------------- |
| react-router v7.14.0          | 4 advisories high                                | `npm audit fix` (patch disponible) |
| vite v6.4.2                   | 2 advisories high (Windows)                      | `npm audit fix`                    |
| undici v7.x                   | 7 advisories high                                | `npm audit fix`                    |
| tar, ws, fast-uri             | Transitivas medium/high                          | `npm audit fix`                    |
| **Falsos positivos**: i18n.ts | 6 "passwords" = palabras en español (contraseña) | Ignorar                            |

### 🟠 Testing y Cobertura

| Archivo                | % Stmts    | % Branch   | % Funcs    | % Lines   |
| ---------------------- | ---------- | ---------- | ---------- | --------- |
| **workoutStore.ts**    | 21.68%     | 14.92%     | 45.83%     | 22.53%    |
| **outboxStore.ts**     | 40%        | 100%       | 50%        | 25%       |
| **excelExport.ts**     | 42.22%     | 25%        | 57.89%     | 42.85%    |
| **kpiCalculations.ts** | 48.42%     | 34.61%     | 36.36%     | 51.28%    |
| Total app              | **68.46%** | **65.46%** | **69.79%** | **70.7%** |
| shared/lib (mejor)     | 90.24%     | 85.03%     | 91.89%     | 93.52%    |

**Archivos SIN tests**: CardioPage, RoutinePage (componentes + page), ExerciseSelector, RestTimer, WorkoutSetList, LastSessionCard, todas las pages de auth, todos los hooks custom, todos los stores (excepto workoutStore), todos los componentes wearables.

### 🟡 Rendimiento

| Aspecto                                      | Estado                                     |
| -------------------------------------------- | ------------------------------------------ |
| LazyMotion (framer-motion)                   | ✅ Import dinámico vía `motionFeatures.ts` |
| manualChunks (recharts, supabase, query)     | ✅ En vite.config.ts                       |
| análisis bundle via rollup-plugin-visualizer | ✅ `npm run analyze`                       |
| PWA runtime caching                          | ✅ Workbox con NetworkFirst + CacheFirst   |
| Code-splitting por rutas                     | ❓ No se observa lazy loading de rutas     |
| exceljs chunk                                | ❌ No tiene manualChunk — pesado (~500KB)  |
| Imágenes optimizadas                         | ❓ Sin verificar formatos WebP/AVIF        |
| TanStack Query persist                       | ✅ 24h maxAge en IDB                       |

### 🔴 CI/CD y DevOps

| Aspecto                     | Estado                                   |
| --------------------------- | ---------------------------------------- |
| GitHub Actions              | ❌ **Ausente** — 0 workflows             |
| Tests automáticos en PR     | ❌ No existen                            |
| Lint/type-check en CI       | ❌ No configurado                        |
| Despliegue automático       | ❌ Sin Vercel/Netlify config             |
| Dependabot/Renovate         | ❌ Ausente                               |
| Play Store/App Store deploy | ❌ Manual (`npm run apk`)                |
| Source maps Sentry          | ❓ Configurado pero sin verificar upload |

---

## 4. Deuda Técnica Cuantificada

| Módulo                                        | Horas estimadas | Prioridad |
| --------------------------------------------- | --------------- | --------- |
| Refactor HistoryPage (1408→~300 líneas)       | 8h              | Alta      |
| Refactor StatsPage (1009→~300 líneas)         | 6h              | Alta      |
| Refactor WorkoutPage (808→~400 líneas)        | 4h              | Alta      |
| Tests: coverage workoutStore (22%→80%)        | 4h              | Alta      |
| Tests: CardioPage, RoutinePage, wearables     | 6h              | Media     |
| Tests: kpiCalculations + excelExport (42→80%) | 3h              | Media     |
| npm audit fix (11 high vulns)                 | 0.5h            | Alta      |
| GitHub Actions: lint + type-check + test      | 2h              | Alta      |
| GitHub Actions: deploy Capacitor/PWA          | 4h              | Media     |
| Dependabot/Renovate setup                     | 0.5h            | Media     |
| Bundle: code-split rutas + exceljs chunk      | 2h              | Media     |
| CI: code coverage gates + SARIF upload        | 1h              | Media     |
| Fix Zustand persist warnings en tests         | 0.5h            | Baja      |

**Total estimado**: ~41.5 horas

---

## 5. Plan de Acción Priorizado

### Quick Wins (<1h)

- [ ] `npm audit fix` — corrige 11 high (react-router, vite, undici)
- [ ] Añadir `exceljs` a `manualChunks` en vite.config.ts
- [ ] Eliminar warnings ESLint: `Button.spec.tsx` — cambiar `!` por optional chaining
- [ ] Configurar Renovate/Dependabot (archivo `renovate.json` o `.github/dependabot.yml`)

### High Impact (<1 día)

- [ ] **GitHub Actions pipeline**:
  - `npm ci → lint → type-check → test --coverage → build`
- [ ] Tests para `workoutStore.saveWorkout` (cobertura 22→80%) — mockear RPC + offline outbox
- [ ] Lazy loading por rutas con `React.lazy()` + `Suspense`
- [ ] Refactor `HistoryPage.tsx` (1408→~300 líneas): extraer componentes/hooks

### Estratégico (>1 semana)

- [ ] Refactor `StatsPage` (1009 líneas) y `UserStatsPage` (902 líneas)
- [ ] Refactor `WorkoutPage` (808 líneas, score F)
- [ ] Cobertura de tests >80% en código crítico (stores, utils, RPCs)
- [ ] Mutation testing con Stryker en `shared/lib/` (brzycki, progression, plates)
- [ ] CI/CD: deploy automático a Vercel + Capacitor App Center/Play Store
- [ ] Property-based tests (fast-check) para cálculos fitness (Brzycki, Epley, proyecciones)

---

## 6. Hotspots (Top 10 por tamaño × complejidad)

| #   | Archivo                                                | Líneas | Score QC | Churn |
| --- | ------------------------------------------------------ | ------ | -------- | ----- |
| 1   | `src/features/stats/pages/HistoryPage.tsx`             | 1408   | 48/100 F | 25    |
| 2   | `src/features/stats/pages/StatsPage.tsx`               | 1009   | 47/100 F | 28    |
| 3   | `src/features/stats/pages/UserStatsPage.tsx`           | 902    | -        | 14    |
| 4   | `src/features/workout/pages/WorkoutPage.tsx`           | 808    | 35/100 F | 33    |
| 5   | `src/shared/lib/i18n.ts`                               | 864    | -        | 18    |
| 6   | `src/types/database.types.ts`                          | 843    | -        | 11    |
| 7   | `src/features/auth/pages/SettingsPage.tsx`             | 633    | 71/100 C | 31    |
| 8   | `src/features/routine/stores/routineStore.ts`          | 573    | -        | 12    |
| 9   | `src/features/workout/components/ExerciseSelector.tsx` | 525    | -        | 10    |
| 10  | `src/App.tsx`                                          | 321    | -        | 35    |

---

## 7. Recomendaciones por Prioridad

### Inmediatas (esta semana)

1. **`npm audit fix`** — resuelve 11 vulnerabilidades altas
2. **GitHub Actions básico** — lint + type-check + test en cada PR
3. **Renovate/Dependabot** — alertas automáticas de seguridad

### Corto plazo (próximo sprint)

4. **Refactor mínimo**: extraer componentes grandes de HistoryPage/StatsPage
5. **Tests críticos**: `workoutStore.saveWorkout`, `kpiCalculations`, `excelExport`
6. **Bundle split**: `React.lazy()` rutas + `exceljs` chunk aparte

### Medio plazo (próximo mes)

7. **Refactor profundo**: HistoryPage/StatsPage/WorkoutPage
8. **Pipeline Capacitor**: build + deploy automático Android/iOS/PWA
9. **Mutation testing**: Stryker en librerías matemáticas

---

_Reporte generado con code-reviewer, senior-architect, senior-security, dependency-auditor + análisis manual._
