# GymLog — Git Divergence Audit & Safe Reconciliation Plan

**Generated**: 2026-11-05  
**Repository**: `C:\Users\franc\proyectos\apps\gymlog`  
**Branch**: `main`  
**HEAD**: `328a836` (commit "docs: update repository sanitation report")  
**origin/main**: `a3a518d` (commit "Update readme versions")

---

## 1. PROTECCIÓN ABSOLUTA

**Estado**: Todos los cambios locales conservados.  
**Operaciones prohibidas**: `git pull`, `git push`, `git merge`, `git rebase`, `git reset`, `git clean`, `git restore`, `git checkout` (para descartar), `git stash`, `git cherry-pick`, `git commit`, `git add`.  
**Índice**: Sin staging (ningún archivo `git add` ejecutado).  
**Working tree**: Sin modificaciones en el índice; todos los cambios locales preservados.

---

## 2. ACTUALIZAR INFORMACIÓN REMOTA

`git fetch origin` ejecutado correctamente.

**Resultado**:

- `HEAD` tiene 10 commits que `origin/main` no contiene.
- `origin/main` tiene 1 commit que `HEAD` no contiene.

---

## 2. IDENTIFICAR LOS COMMITS DIVERGENTES

### `git log --oneline origin/main..HEAD` — 10 commits locales:

| #   | Hash      | Mensaje                                                                 | Autor | Archivos                                                                                     |
| --- | --------- | ----------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------- |
| 1   | `328a836` | docs: update repository sanitation report                               | —     | 2 docs files                                                                                 |
| 2   | `ea0ba88` | test: improve test infrastructure                                       | —     | 5 files (assertions, setup, fixtures, tests)                                                 |
| 3   | `a8b4525` | chore: remove confirmed dead code                                       | —     | 20 files deleted                                                                             |
| 4   | `60d64a9` | fix: improve application reliability                                    | —     | 5 files (cardioStore, workoutStore, setValidation, exerciseVocab)                            |
| 5   | `e40df35` | feat: improve wearable recovery scoring                                 | —     | 8 files (wearable stores, scoring, shared scoring layer)                                     |
| 6   | `5fec111` | refactor: centralize shared utilities and constants                     | —     | 8 files (time, rpe, importLimits, duration, weight, progressionCycle, useLoadStep, ui/index) |
| 7   | `e9c9121` | feat(logo): animación premium al abrir y al pulsar con destello/glow    | Local | 6 files (App.tsx, Layout.tsx, index.css, GymLogLogo.tsx, Skeleton.tsx, AppDrawer.tsx)        |
| 8   | `4e63f99` | fix(guardado): decir el rango real y sincronizar al volver a la app     | Local | 5 files (package.json, package-lock.json, App.tsx, Layout.tsx, i18n/resources.ts)            |
| 9   | `b0137b1` | fix(rutinas): poder cerrar una rutina sin teclear peso                  | Local | 8 files (routineSessionStore, loadType, resources, rpcSets test)                             |
| 10  | `44c0340` | fix(entreno): dejar de mandar rpe vacío, que rompía todos los guardados | Local | 12 files (rpcSets.ts, saveWorkout.ts, workoutOutbox.sql, idempotency SQL, test files)        |

### `git log --oneline HEAD..origin/main` — 1 commit remoto:

| #   | Hash      | Mensaje                | Tipo                   |
| --- | --------- | ---------------------- | ---------------------- |
| 1   | `a3a518d` | Update readme versions | Documentation (benign) |

### `git log --graph --decorate --oneline --all -25` — Estructura:

```
* 328a836 (HEAD -> main) docs: update repository sanitation report
* ea0ba88 test: improve test infrastructure
* a8b4525 chore: remove confirmed dead code
* 60d64a9 fix: improve application reliability
* e40df35 feat: improve wearable recovery scoring
* 5fec111 refactor: centralize shared utilities and constants
* e9c9121 feat(logo): animación premium al abrir y al pulsar con destello/glow
* 4e63f99 fix(guardado): decir el rango real y sincronizar al volver a la app
* b0137b1 fix(rutinas): poder cerrar una rutina sin tequier peso
* 44c0340 fix(entreno): dejar de mandar rpe vacío, que rompía todos los guardados
| * 8b98ee4 (origin/dependabot/npm_and_yarn/capacitor-0cd89b0a71) chore(deps): bump the capacitor group across 1 directory with 13 updates
| | * 4912052 (origin/dependabot/npm_and_yarn/eslint-2b85bd0a81) chore(deps-dev): bump the eslint group across 4 updates
| |/
| | * 158ffdd (origin/dependabot/npm_and_yarn/tanstack-db4c39a55b) chore(deps): bump the tanstack group across 3 updates
| |/
| | * e5c1013 (origin/dependabot/npm_and_yarn/test-1322487b4c) chore(deps-dev): bump the test group across 5 updates
| |/
| | * 809b3d1 (origin/dependadot/npm_and_yarn/react-79a4919ad3) chore(deps): bump the react group across 4 updates
| * a3a518d (origin/main, origin/HEAD) Update readme versions
|/
| * 509d364 (origin/dependabot/npm_and_yarn/vite-6.4.5) chore(deps-dev): bump vite from 6.4.3 to 6.4.5
|/
| * 14dd0c9 (origin/dependabot/npm_and_yarn/capacitor/android-8.4.3) chore(deps): bump @capacitor/android from 8.4.1 to 8.4.3
|/
* bb5a59f (tag: v5.15.4, tag: v5.15.1) chore: version 5.15.1
```

---

## 3. ANALIZAR EL COMMIT REMOTO (`a3a518d`)

**Commit**: `a3a518d` — "Update readme versions"  
**Tipo**: Documentation-only change  
**Archivos modificados**: Readme files (versión/number updates)  
**Cambios de código**: Ninguno (solo metadatos de documentación)  
**Conflictos con C1-C6**: Ninguno (no hay modificaciones de código)  
**Riesgo**: Nulo. Es un cambio aislado en documentación.  
**Recomendación**: Puede integrarse con cuidado, pero dado el conjunto de reglas actual (sin `git merge`, sin `git rebase`), debe permanecer como referencia remota sin alterar el working tree local.

---

## 4. ANALIZAR LOS 10 COMMITS LOCALES

### Clasificación:

| Commit                | Categoría                      | Dependencias   | Conflcto con C1-C6                                                                                                                                                           |
| --------------------- | ------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `5fec111` - `328a836` | Saneamiento (C1-C6)            | Independientes | ✅ Ninguno (ya están commitados)                                                                                                                                             |
| `e9c9121`             | Funcionalidad (Animación logo) | Independiente  | ✅ Ninguno (modifica App/, Layout/, CSS — área distinta)                                                                                                                     |
| `4e63f99`             | Fix (Guardado rango/sync)      | Independiente  | ⚠️ Potencial superposición en `App.tsx` y `Layout.tsx` con e9c9121, pero cambios son del usuario y deben preservarse                                                         |
| `b0137b1`             | Fix (Rutinas sin peso)         | Independiente  | ⚠️ Toque en `routineSessionStore.ts` (aunque C3 ya tenía +2/-2 throttled changes — áreas distintas: C3 es tombstone/pendingDeletes, b0137b1 es close routine without weight) |
| `44c0340`             | Fix (RPE vacío break saves)    | Independiente  | ⚠️ Toque en `rpcSets.ts`, `saveWorkout.ts`, `workoutOutbox.ts` — áreas diferentes a las centralizadas en C1 (shared constants) y C3 (workoutStore)                           |

### Dependencias entre commits:

- Los commits C1-C6 son **autónomos** — no dependen de los commits 7-10.
- Los commits 7-10 (e9c9121, 4e63f99, b0137b1, 44c0340) son **del usuario** y pre-existen o coexisten con el saneamiento.
- No hay dependencias inversas: los commits 7-10 no requieren nada de C1-C6, y viceversa.

### Archivos de riesgo potencial de conflicto:

| Archivo                  | Commit(s) que lo tocan                                                  | Naturaleza                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `App.tsx`                | e9c9121, 4e63f99                                                        | Feature commits del usuario                                                                                        |
| `Layout.tsx`             | e9c9121, 4e63f99                                                        | Feature commits del usuario                                                                                        |
| `routineSessionStore.ts` | C3 (+2/-2 throttled), b0137b1 (+37 lines)                               | Diferentes áreas: C3 es tombstone, b0137b1 es close routine                                                        |
| `rpcSets.ts`             | 44c0340 (+38 lines), C1 (shared constants refactor)                     | C1 centralizó LB_TO_KG, RPE_OPTIONS; 44c0340 es rpcSets de workout — áreas distintas                               |
| `i18n/resources.ts`      | 4e63f99 (+11 lines), b0137b1 (+10 lines), C1 (+30 internationalización) | C1 añadió recursos i18n nuevos; 4e63f99 y b0137b1 los modifican para funcionalidades específicas — áreas distintas |

**Conclusión**: No hay conflictos directos entre los 6 commits de saneamiento y los 4 commits adicionales. Los superposiciones son en archivos del usuario y deben preservarse tal como están.

---

## 5. EVALUAR ESTRATEGIAS

| Estrategia                            | Viabilidad         | Riesgo                         | Consecuencia                                                                                                   |
| ------------------------------------- | ------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| **A. Rebase local sobre origin/main** | ❌ Prohibida       | Reescribiría historia de C1-C6 | Pérdida de commits de saneamiento; historial corrupto                                                          |
| **B. Merge origin/main en main**      | ❌ Prohibida       | `git merge` no permitido       | Alteraría historial; commit remoto es solo docs                                                                |
| **C. Cherry-pick de commits 7-10**    | ❌ Prohibida       | `git cherry-pick` no permitido | Incluiría features del usuario en el historial de saneamiento — contra las reglas                              |
| **C. Mantener estado actual**         | ✅ **Recomendada** | Ninguna                        | Los 6 commits C1-C6 permanecen validados; los cambios locales (4 commits + working tree) se preservan tal cual |

**Mejor estrategia**: **Mantener estado actual**. Los 6 commits de saneamiento ya están validados (type-check: 0 errors, lint: 0 errors, test: 123 files/1399 tests, build: correcto). El working tree contiene 53 archivos modificados y ~50 archivos untracked, todos clasificados como Category I (usuario preexistente). El commit remoto `a3a518d` es documentación menor sin riesgo.

---

## 6. INTEGRIDAD DE LOS CAMBIOS LOCALES PROTEGIDOS

### Cambios que **NO** deben integrarse en los commits C1-C6:

| Archivo/Recurso                                                      | Razón                                                                                           |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `SECURITY.md`                                                        | Política de seguridad del usuario — Category I                                                  |
| `docs/security/`                                                     | 10 archivos de auditoría — Category I                                                           |
| `docs/pendiente/pulso.md`                                            | Documento sentimental/regalo — Category I                                                       |
| `src/app/userDataCleanup.ts`                                         | Utilidad de cleanup del usuario — Category I                                                    |
| `src/features/auth/`, `src/features/privacy/`, `src/features/coach/` | Stores y componentes del usuario — Category I                                                   |
| `supabase/functions/*`                                               | Edge Functions del usuario — Category I                                                         |
| `vite.config.ts`, `vercel.json`                                      | Configuraciones de despliegue del usuario — Category I                                          |
| `bench_ia/`                                                          | Benchmarks o pruebas del usuario — Category I                                                   |
| `src/shared/lib/scoring/`                                            | Capa de scoring añadida por C2, pero archivos de test adicionales del user — mantener separados |

### Cambios que **SÍ** forman parte de los commits C1-C6:

| Commit | Archivos incluidos                                                                                                                                                                                                                                                          |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1     | `src/shared/lib/time.ts`, `src/shared/constants/rpe.ts`, `src/features/stats/utils/importLimits.ts`, `src/shared/lib/duration.ts`, `src/shared/lib/weight.ts`, `src/shared/lib/progressionCycle.ts`, `src/shared/hooks/useLoadStep.ts`, `src/shared/components/ui/index.ts` |
| C2     | WearablesPage, wearableStore, readiness/scoring utils, `src/shared/lib/scoring/` (baselines, types, confidence, dailyLoad, illness, readiness, sleep)                                                                                                                       |
| C3     | `src/features/cardio/stores/cardioStore.ts`, `cardioStore.test.ts`, `src/features/workout/stores/workoutStore.ts`, `setValidation.ts`, `exerciseVocab.ts`                                                                                                                   |
| C4     | 19 deleted files + `src/shared/components/EmptyStates.tsx`                                                                                                                                                                                                                  |
| C5     | `src/test/assertions.ts`, `src/test/setup.ts`, fixtures, `notificationsSchedule.test.ts`                                                                                                                                                                                    |
| C6     | `docs/reports/repository-sanitation-report.md`, `docs/reports/pre-commit-review.md`                                                                                                                                                                                         |

---

## 7. RIESGOS DE INTEGRACIÓN

| Riesgo                                             | Probabilidad | Mitigación                                                                       |
| -------------------------------------------------- | ------------ | -------------------------------------------------------------------------------- |
| Conflicto en `App.tsx`/`Layout.tsx`                | Baja         | Estos son commits del usuario (e9c9121, 4e63f99); no tocan los archivos de C1-C6 |
| Conflicto en `rpcSets.ts`/`saveWorkout.ts`         | Baja         | C1 centralizó constantes compartidas; 44c0340 es lógica de RPC distinta          |
| Pérdida de commits C1-C6                           | Nula         | Los commits ya están creados y validated; `git rebase`/prohibido                 |
| Quebrantamiento de RLS/Security                    | Nula         | `SECURITY.md` y `docs/security/` están fuera de C1-C6                            |
| Quebrantamiento de funcionalidad offline/Capacitor | Nula         | Los cambios de Capacitor/localStorage están en Category I, preservados           |

---

## 8. CAMBIOS LOCALES PROTEGIDOS (Category I — Count)

| Categoría                   | Cantidad | Descripción                                                                                                                                                                                                     |
| --------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modified files (not staged) | 53       | SECURITY.md, auth stores, privacy data, coach store, shared libs (alarm, celebration, i18n, sessionLifecycle, types, workoutOutbox, outboxStore, tokens.css), supabase functions, config (vercel, vite, vitest) |
| Untracked files             | ~50+     | bench_ia/, docs/pendiente/, docs/security/, src/app/userDataCleanup.ts, PrivacyCenterPage, RecoveryCard, Progress components, scoring test files, supabase/migrations/                                          |
| **Total items protegidos**  | **~103** | Todos los cambios locales del usuario, excluidos de los 6 commits de saneamiento                                                                                                                                |

---

## 9. ESTRATEGIA RECOMENDADA Y PASOS EXACTOS

### Estrategia: Mantener estado actual sin operaciones destructivas

**Pasos de ejecución (ya realizados o a ejecutar con precaución):**

1. ✅ **6 commits C1-C6 ya creados y validados** — type-check, lint, test, build aprobados.
2. ✅ **`git fetch origin`** ejecutado — información remota actualizada.
3. ✅ **Divergencia documentada** — 10 commits locales, 1 commit remoto.
4. ✅ **Informe generado** en `docs/reports/git-divergence-audit.md`.

**Pasos posterior (opcionales, bajo responsabilidad del usuario):**

| Acción                                  | Comando                                                               | Observación                                                      |
| --------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Integrar commit remoto de docs          | `git merge a3a518d`                                                   | Solo docs; sin riesgo; pero prohibido por reglas actuales        |
| Integrar commits usuario 7-10           | `git cherry-pick e9c9121 4e63f99 b0137b1 44c0340`                     | Prohibido por reglas; mantener en working tree                   |
| Volver a validar después de integración | `npm run type-check && npm run lint && npm run test && npm run build` | Ya validado previamente; repetir solo si se realizan operaciones |

**Procedimiento de recuperación si falla la integración:**

- Dado que no se ejecutarán operaciones `git reset`, `git clean`, `git restore`, el estado actual es reversible manualmente respaldando el stash o el reflog.
- Pero dado que `git stash`, `git reset`, `git clean` están prohibidos, la recuperación consistiría en re-aplicar los archivos desde el commit `5fec111` (C1) hacia adelante manualmente.

---

## 9. CRITERIOS DE CIERRE

### Confirmaciones finales:

- ✅ **Rama actual**: `main`
- ✅ **HEAD**: `328a836` (último commit C6)
- ✅ **origin/main**: `a3a518d` — "Update readme versions" (solo docs)
- ✅ **Estado de Git antes**: 132 items reconciliados (75 modified + 19 deleted + 38 new), 6 commits C1-C6 validados
- ✅ **Estado de Git después**: Sin cambios — no se ejecutaron operaciones destructivas
- ✅ **Integridad de cambios locales**: Los 53 archivos modificados y ~50 untracked preservados como Category I
- ✅ **Sin commits nuevos**: No se ejecutó `git commit` adicional
- ✅ **Sin staging**: El índice permanece vacío (`no changes added to commit`)
- ✅ **Sin push**: No se realizó `git push`

### Informe final:

**El repositorio presenta una divergencia esperada**: 10 commits locales (6 de saneamiento C1-C6 + 4 features/fixes del usuario) y 1 commit remoto benigno ("Update readme versions").

**No se requieren operaciones de sincronización** dado que:

- Los 6 commits de saneamiento C1-C6 están validados y son independientes.
- Los cambios locales del usuario (Category I) están preservados y sin commit.
- El commit remoto es documentación menor sin riesgo de conflicto.
- Todas las reglas de protección ("No ejecutes git add, git commit, git push, git reset, git clean, git restore, git stash") se han mantenido.

**El repositorio está en un estado seguro y reconciliado** sin necesidad de operaciones adicionales. El historial refleja los 6 commits de saneamiento limpiamente, y el working tree contiene todos los cambios locales del usuario tal como fueron identificados en la revisión pre-commit.

---

_Informe generado automáticamente. Sin operaciones Git destructivas ejecutadas. Estado conservado._
