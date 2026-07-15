## 1. Migración de base de datos

- [x] 1.1 Migración idempotente en `supabase/migrations/`: tabla `exercise_muscles(exercise_id, muscle_group, role, weight)` con `role in ('primary','secondary')`, `weight` 0–100, un solo primary por ejercicio, índices por `exercise_id` y `muscle_group`
- [x] 1.2 Añadir `exercises.is_bodyweight boolean not null default false`
- [x] 1.3 Backfill: por cada ejercicio, insertar primary con su `muscle_group` y weight 100 (aplicado en prod: 88/88 con primario)
- [x] 1.4 RPC `get_exercises_with_usage` actualizado para exponer `is_bodyweight`
- [x] 1.5 Tipos regenerados en `src/types/database.types.ts`

## 2. Capa de datos

- [x] 2.1 `fetchExerciseMuscles(exerciseId)` lee músculos ponderados
- [x] 2.2 `syncExerciseMuscles` + `createCustomExercise`/`updateCustomExercise` (upsert transaccional de músculos)
- [x] 2.3 Tipos compartidos y flag `is_bodyweight`

## 3. Analítica ponderada

- [x] 3.1 Utilidad `distributeVolume` (reparto normalizado peso/Σpesos)
- [x] 3.2 Wire en `statsData.ts` (distribución) y `fatigueAnalysis.ts` (recuperación) con `fetchExerciseMusclesMap`/`useExerciseMusclesMap`; cableado en StatsPage, UserStatsPage y useFatigueSuggestion. Reparto ponderado con fallback single-muscle
- [x] 3.3 Tests de `distributeVolume` (split 60/40, single-muscle, normalización, determinismo, vacío, pesos 0)

## 4. Registro de series con peso corporal

- [x] 4.1 Helper `bodyWeightAtDate` = última medición ≤ fecha (peso vigente por fecha)
- [x] 4.2 Integrado en el registro de series: en modo bodyweight no se exige kg y el peso guardado = peso corporal vigente + lastre (store `saveWorkout`)
- [x] 4.3 El campo kg actúa como lastre en ejercicios bodyweight, con pista in-app
- [x] 4.4 Degradación sin peso registrado: pista + guardar solo con reps
- [x] 4.5 Tests del cálculo de volumen bodyweight (con peso, con lastre, sin peso)
- [x] 4.6 Recordatorio semanal de peso: `WeeklyWeightPrompt` (in-app, ~1/semana, upsert en `body_measurements`, dismissable por semana)

## 5. Formulario de creación/edición

- [x] 5.1 Esquema Zod: nombre requerido, primario, secundarios weight 0–100, flags (`is_compound`, `is_bodyweight`)
- [x] 5.2 UI: primario + secundarios ponderados (chips con % y −/+), toggle peso corporal (touch ≥44px)
- [x] 5.3 Validación e i18n; edición inline de grupo muscular sincroniza el primario ponderado
- [x] 5.4 Strings i18n nuevos (es + en)

## 6. Integración con ExerciseDB

- [x] 6.1 "Guardar como propio" desde el detalle del catálogo (botón + mutación)
- [x] 6.2 Mapear parte del cuerpo ExerciseDB → enum local (`muscleGroupFromBodyPart`) + `is_bodyweight` desde equipo

## 7. Verificación y calidad

- [ ] 7.1 Probar en dispositivo a ~390px — PENDIENTE (rebuild + install para verlo)
- [x] 7.2 Estados/degradación cubiertos en helpers y prompt
- [x] 7.3 Sin regresión: ejercicios existentes → primario 100%; stats sin cambios
- [x] 7.4 `lint && type-check && test` en verde (202 tests)
