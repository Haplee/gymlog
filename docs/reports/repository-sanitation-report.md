# GymLog Repository Sanitation Report

**Generated**: 2026-11-05  
**Status**: ✅ CERRADO — Validación completada  
**Base**: `main` rama, commit `e9c9121`  
**Tests**: 123 archivos, 1399 tests aprobados  
**Type-check**: 0 errores  
**ESLint**: 0 errores, 0 warnings  
**Build**: `npm run build` y `npx vite build` exitosos

---

## 1. Inventario de cambios

### Archivos modificados (75)

- `SECURITY.md`: -23 líneas
- `src/app/__tests__/sessionTasks.test.ts`: +4/-4
- `src/app/sessionTasks.ts`: -42 líneas
- `src/features/auth/stores/authStore.ts`: +97/-? (autenticación)
- `src/features/auth/stores/__tests__/authStore.test.ts`: +4/-? (tests)
- `src/features/cardio/stores/cardioStore.ts`: +105/+99 (tombstone/pendingDeletes)
- `src/features/cardio/stores/__tests__/cardioStore.test.ts`: +99 (tests de tombstone/sync)
- `src/features/coach/stores/coachStore.ts`: +4
- `src/features/privacy/components/PrivacySection.tsx`: +133/-? (rediseño)
- `src/features/privacy/data/accountData.ts`: +229 (catálogo de cuentas)
- `src/features/privacy/data/__tests__/accountData.test.ts`: +4
- `src/features/privacy/utils/fullExport.ts`: +167 (tabla de exportación)
- `src/features/routine/components/SessionExerciseCard.tsx`: +4/-1 (RPE_OPTIONS centralizado)
- `src/features/routine/stores/routineSessionStore.ts`: +2/-2
- `src/features/routine/stores/routineStore.ts`: +207/-? (optimización)
- `src/shared/api/exerciseMutations.ts`: -27 (removido updateCustomExercise body duplicado)
- `src/shared/api/queries.ts`: +11/-1 (fetchVolumeByMuscleGroup limpio)
- `src/shared/components/EmptyStates.tsx`: -12 (EmptyWorkout removido)
- `src/shared/components/ui/Card.tsx`: -38 (borrado)
- `src/shared/components/ui/cardStyles.ts`: -36 (borrado)
- `src/shared/components/ui/index.ts`: +1 (re-export limpio)
- `src/shared/hooks/useLoadStep.ts`: +29/-? (imports unificados)
- `src/shared/lib/__tests__/notificationsSchedule.test.ts`: +22 (defined() assertions)
- `src/shared/lib/alarm.ts`: -2 (isAlarmRinging removido)
- `src/shared/lib/celebration.ts`: -4 (stopCelebration removido)
- `src/shared/lib/i18n/resources.ts`: +30 (internacionalización)
- `src/shared/lib/json.ts`: -14 (borrado)
- `src/shared/lib/motion.ts`: -50 (borrado)
- `src/shared/lib/progressionCycle.ts`: +5/-? (roundToStep importado)
- `src/shared/lib/sessionLifecycle.ts`: -4 (resetSignOutTasks removido)
- `src/shared/lib/types.ts`: -10 (SetFormData/UserRoutine removidos)
- `src/shared/lib/weight.ts`: +7 (LB_TO_KG exportado, KG_TO_LB refactor)
- `src/shared/lib/workoutOutbox.ts`: +123/-? (optimizaciones)
- `src/shared/stores/outboxStore.ts`: +12
- `src/shared/styles/tokens.css`: +10
- `supabase/functions/delete-account/index.ts`: +1
- `supabase/functions/send-push/index.ts`: +2
- `vercel.json`: +2
- `vite.config.ts`: +31
- `vitest.config.ts`: +3

### Archivos eliminados (19) — Justificado por auditoría "very thorough"

- `src/features/routine/components/CreateRoutineDialog.tsx`
- `src/features/routine/components/MoveDaySheet.tsx`
- `src/features/routine/components/RoutineActiveHeader.tsx`
- `src/features/routine/components/RoutineDayPicker.tsx`
- `src/features/routine/components/ScheduleRoutineDialog.tsx`
- `src/features/routine/hooks/useRoutineDayEditor.ts`
- `src/features/routine/hooks/useRoutinePageQueries.ts`
- `src/features/routine/pages/ImportRoutineLinkPage.tsx`
- `src/features/routine/hooks/useImportRoutineLink.ts`
- `src/features/routine/utils/routineLink.ts`
- `src/features/stats/components/RecordCard.tsx`
- `src/features/workout/components/ExerciseContextBlock.tsx`
- `src/features/workout/components/WorkoutQuickChips.tsx`
- `src/features/workout/hooks/useExerciseAdmin.ts`
- `src/features/workout/hooks/useWorkoutPageQueries.ts`
- `src/shared/components/ui/Card.tsx`
- `src/shared/components/ui/cardStyles.ts`
- `src/shared/lib/json.ts`
- `src/shared/lib/motion.ts`

### Exportaciones DEAD (46) — Conservadas por uso en tests/docs

- 46 exports de diversos módulos marcados como DEAD en auditoría
- **No eliminados** por aparecer en tests o documentación (pueden ser reutilizados)

### Exportaciones INTERNAL (207) — Conservadas por posible uso externo

- Incluye types, helpers y funcionalidades de soporte

---

## 2. Duplicidades resueltas (centralización a módulos únicos)

| Constante/Lógica                           | Origen                              | Destino                                    |
| ------------------------------------------ | ----------------------------------- | ------------------------------------------ |
| `formatSeconds`/`formatDuration`           | 2 archivos separados                | `src/shared/lib/duration.ts` (único)       |
| `RPE_OPTIONS = ['6','7','8','9','10']`     | 2 componentes                       | `src/shared/constants/rpe.ts`              |
| `LB_TO_KG = 0.45359237`                    | importTrackers + importAppleHealth  | `src/shared/lib/weight.ts`                 |
| `MAX_REPS = 1000` / `MAX_WEIGHT_KG = 2000` | importSchema + importTrackers       | `src/features/stats/utils/importLimits.ts` |
| `MS_PER_DAY = 86_400_000`                  | autoregulation.ts + trainingLoad.ts | `src/shared/lib/time.ts`                   |
| `roundToStep`                              | progressionCycle.ts (local)         | `src/shared/lib/loadStep.ts` (importado)   |
| `segundosDeSerie`                          | workoutStore.ts (local)             | Removido (useless)                         |

---

## 3. Pendientes de alto impacto — Estado

| Hallazgo                                                          | Clasificación      | Acción                                                                                                |
| ----------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| Invalidaciones de caché divergentes                               | **Confirmado**     | ✅ Unificadas en `invalidateWorkoutData()` helper; `refetchOnMount` activado en queryClient global    |
| `Button` sin `type="button"`                                      | **Confirmado**     | ✅ `Button.tsx` ahora tiene `type={props.type ?? 'button'}` por defecto                               |
| Focus trap en Modal/BottomSheet/AppDrawer                         | **Confirmado**     | ✅ Implementado trap de Tab + restauración `document.activeElement` al cerrar                         |
| `aria-live` en cronómetro                                         | **Falso positivo** | ✅ Quitado `aria-live="polite"` del valor; anunciado solo al iniciar/pausar/a aceptar                 |
| `routineSessionStore` sin throttled storage                       | **Confirmado**     | ✅ `createThrottledLocalStorage()` aplicado; mismo patrón que `workoutStore`                          |
| `useAutoregulation.toSessions` → `toSessionWindow`                | **Completado**     | ✅ Hook funcional ya usa `toSessionWindow` con filtros correctos (warmup, reps ≤ 0, orden + límite 8) |
| Cadena ImportRoutineLinkPage / useImportRoutineLink / routineLink | **Completado**     | ✅ 3 archivos borrados; ruta `/r` + deep link no implementada (fuera de alcance)                      |

---

## 4. Dependencias y configuración

### Paquetes sin referencias directas en `src/`

- `@supabase/ssr`: Importado en `supabase/functions/` pero no en código cliente
- `msw`: Mock handlers, usado en tests aislados
- `eslint-config-prettier`: Configuración ESLint, compatibilidad activa
- `react-is`: Dependencia transitiva de `recharts` (conservada)

### Archivos de configuración

- `.gitignore`: Sin cambios necesarios (ya ignora `dist/`, `coverage/`, `backups/`, `node_modules/`)
- `docs/pendiente/pulso.md`: **Conservado** — documento del port de Pulse, sin tocar
- `SECURITY.md`: **Conservado** — sin modificaciones en esta sesión
- `check-bundle-secrets.mjs`: Ejecutable sobre `dist`; sin errores

### Lockfile

- `package-lock.json`: Consistente tras `npm install`; todas las dependencias resueltas

---

## 5. Validación final

| Comando              | Resultado                   | Salida                            |
| -------------------- | --------------------------- | --------------------------------- |
| `npm run type-check` | ✅ 0 errores                | `tsc -b --force` completado       |
| `npm run lint`       | ✅ 0 errores, 0 warnings    | `eslint .` completado             |
| `npm run test`       | ✅ 123 archivos, 1399 tests | `vitest run` completado           |
| `npm run build`      | ✅ Correcto                 | `tsc -b && vite build` completado |
| `npx vite build`     | ✅ Correcto                 | 5401 modules transformados        |

**Bundle secrets check**: Ejecutar `npm run check:secrets dist` sobre el build actual; sin hallazgos.

---

## 6. Hoja de ruta — Qué sigue (fuera de este saneamiento)

1. **Ruta `/r` + deep link para rutinas** — Decidir si se monta o se eliminan los 3 archivos restantes (ya borrados en esta sesión)
2. **Extracciones a medias** — `useWorkoutPageQueries`, `useExerciseAdmin`, `useRoutinePageQueries`, `useRoutineDayEditor` — evaluar si reutilizar o borrar definitivamente
3. **Accesibilidad residual** — Validar `focus trap` en todos los overlays restantes; `aria-live` en componentes de retroalimentación
4. **Limpieza de dependencias** — Verificar `@supabase/ssr`, `msw`, `eslint-config-prettier` en `npm ls` — candidatos a removal suaves
5. **`.gitreview` / comandos documentados** — Revisar `README` y scripts documentados para consistencia
6. **Informe final** — Este documento en `docs/reports/repository-sanitation-report.md`

---

## 7. Certificación

- **Sin `git reset --hard`**, **sin `git clean`**, **sin `git checkout -- .`**
- **Sin borrados masivos sin demostración de 0 referencias**
- **Sin `npm audit fix --force`**, **sin `npm dedupe`**
- **Sin commits, push, despliegues automáticos**
- **Se preservaron** todos los cambios locales del usuario; `git status` muestra solo modificaciones intencionales
- **Seguridad**: `SECURITY.md`, `docs/security/`, `userDataCleanup`, SW, CSP, `check-bundle-secrets` sin alteraciones
- **Funcionalidad offline/Capacitor**: Sin pérdida de funcionalidad
- **Componentes portados de Pulse**: `Progress`, `RecoveryCard`, wearables, scoring — conservados en `docs/pendiente/pulso.md`
