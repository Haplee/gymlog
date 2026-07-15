## Why

Hoy un ejercicio propio se asocia a **un único grupo muscular** (`exercises.muscle_group`, enum), lo que no refleja ejercicios multiarticulares reales (peso muerto, dominadas) y reparte mal el volumen/fatiga. Además no hay una forma de primera clase de marcar un ejercicio como **peso corporal**: aunque el enum `equipment` incluye 'Peso corporal', al registrar series se sigue exigiendo kg, que quedan a 0 y no cuentan volumen. Este cambio hace la creación de ejercicios más rica y precisa.

## What Changes

- **Modelo multi-músculo ponderado:** un ejercicio propio tiene un grupo muscular **primario** y **0+ secundarios**, cada uno con un **peso de contribución (%)**. Nueva tabla de relación `exercise_muscles(exercise_id, muscle_group, role, weight)` vía migración idempotente; los ejercicios existentes migran a primario 100% (desde su `muscle_group` actual). Se conserva `exercises.muscle_group` como primario denormalizado para compatibilidad.
- **Flag de peso corporal:** nuevo `exercises.is_bodyweight`. Al registrar series de un ejercicio de peso corporal no se exige kg; el volumen se estima con el **peso corporal del usuario vigente en la fecha de la serie** (de `body_measurements`), con opción de **añadir lastre** que se suma. Degradación con gracia si no hay peso registrado (permitir solo reps o kg manual, con aviso).
- **Analítica ponderada:** volumen por músculo, fatiga muscular y heatmap reparten el volumen de cada serie según los pesos de sus músculos, en vez de asignarlo a un solo grupo.
- **UX de creación/edición:** formulario guiado (nombre, primario, secundarios con %, equipamiento, compuesto/aislado, flag peso corporal), validación clara y accesible (chips, touch ≥44px, i18n).
- **Compatibilidad ExerciseDB:** un ejercicio del catálogo puede "guardarse como propio" prellenando estos campos (primario + secundarios desde `targetMuscles`/`secondaryMuscles`, peso corporal desde `equipment`).

## Capabilities

### New Capabilities

- `exercise-authoring`: Creación y edición de ejercicios propios con grupo primario + secundarios ponderados, flag de peso corporal, equipamiento y tipo, incluyendo el modelo de datos y su migración.
- `weighted-muscle-analytics`: Reparto ponderado del volumen de cada serie entre los músculos del ejercicio para volumen por músculo, fatiga y heatmap.
- `bodyweight-set-logging`: Registro de series de ejercicios de peso corporal usando el peso corporal del usuario vigente en la fecha, con lastre opcional y degradación sin peso registrado.

### Modified Capabilities

<!-- No hay specs previos en openspec/specs/. La creación actual (single muscle_group) y los cálculos de estadísticas se sustituyen por los nuevos capabilities; sin deltas formales. -->

## Impact

- **BD:** nueva migración idempotente en `supabase/migrations/`: tabla `exercise_muscles` (con `role` primary/secondary y `weight` 0–100), columna `exercises.is_bodyweight`, backfill de existentes a primario 100%. Revisar el trigger `autoclassify_muscle_group` y RPC `get_exercises_with_usage`.
- **Código:** formulario de creación/edición en `ExerciseSelector` (y flujo de biblioteca); `createCustomExercise` y queries relacionadas; cálculos en `src/features/stats/utils/` (fatigueAnalysis, statsData) y `useFatigueSuggestion`; registro de series en `workoutStore`/mutations para peso corporal.
- **Estadísticas históricas:** decidir en diseño si la ponderación aplica solo a series nuevas o se recalcula todo (riesgo de coste/consistencia).
- **i18n:** nuevos strings (es). Sin dependencias nuevas (Zod ya disponible para validación).
- **Tipos:** regenerar `src/types/database.types.ts` con `npm run gen:types` tras la migración.
