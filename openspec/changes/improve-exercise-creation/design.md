## Context

GymLog modela cada ejercicio con un único `exercises.muscle_group` (enum acotado), un `equipment` enum (que ya incluye `'Peso corporal'`), `is_compound`, etc. Los cálculos de estadísticas (`src/features/stats/utils/fatigueAnalysis.ts`, `statsData.ts`, `useFatigueSuggestion.ts`) agrupan sets por ese único `muscle_group`. La creación de ejercicios vive en `ExerciseSelector` (mutación `createCustomExercise`) y el registro de series en `workoutStore`/mutations. Hay un trigger `autoclassify_muscle_group` y un RPC `get_exercises_with_usage`.

Este cambio introduce (1) músculos múltiples ponderados, (2) ejercicios de peso corporal con volumen basado en el peso del usuario, y (3) un formulario de creación mejorado. Decisiones del usuario: **ponderación primario+secundarios con %**, y **peso corporal estimado con el peso del usuario vigente en la fecha de la serie**.

## Goals / Non-Goals

**Goals:**

- Modelo `exercise_muscles` (primary/secondary + weight 0–100) con backfill de existentes a primario 100%.
- Flag `is_bodyweight` y registro de series sin kg, con volumen desde `body_measurements` (peso por fecha) + lastre opcional.
- Reparto ponderado del volumen en volumen por músculo, fatiga y heatmap.
- Formulario guiado, validado, accesible e i18n.
- Guardar un ejercicio de ExerciseDB como propio prellenando estos campos.

**Non-Goals:**

- Cambiar el enum de grupos musculares o rediseñar toda la analítica.
- Traducir/importar el dataset ExerciseDB (fuera de alcance, ya cubierto por el catálogo remoto).
- Peso corporal por lado/unilateral avanzado (bilateral se mantiene como está).

## Decisions

- **Tabla de relación `exercise_muscles` + `muscle_group` denormalizado.**
  `exercise_muscles(exercise_id, muscle_group, role, weight)` con `role in ('primary','secondary')`, `weight` 0–100, unicidad de un solo primary por ejercicio. Se conserva `exercises.muscle_group` = primario para no romper queries/analítica existentes durante la transición. _Alternativa descartada:_ array/JSONB en `exercises` → peor para agregaciones SQL y constraints.

- **Ponderación normalizada al calcular, no al guardar.**
  Se guardan los pesos tal cual introduce el usuario; al repartir volumen se normaliza (peso/Σpesos) para que sumen 1. Así la UI no obliga a que sumen 100 exacto. _Alternativa descartada:_ forzar suma=100 en el formulario → fricción de UX.

- **Peso corporal vigente por fecha vía `body_measurements`.**
  Para una serie de ejercicio bodyweight, volumen = (peso_vigente(fecha) + lastre) × reps, donde `peso_vigente` = última medición ≤ fecha de la serie. Si no hay medición, degradar: permitir solo reps o kg manual + aviso. _Alternativa descartada:_ peso actual del usuario → distorsiona históricos.

- **Estrategia de históricos: aplicar hacia delante + recálculo bajo demanda.**
  La ponderación y el volumen bodyweight se aplican a series nuevas de inmediato. Para históricos, el reparto ponderado se calcula on-the-fly en las vistas de analítica (que ya recomputan desde sets), sin reescribir filas. El volumen bodyweight histórico se estima al vuelo con el peso por fecha. Determinista y sin migración masiva de datos. _Alternativa descartada:_ reescribir `workout_sets.volume` en batch → costoso y con riesgo de inconsistencia.

- **Formulario con validación Zod (ya instalado).**
  Esquema: nombre requerido, primario requerido, secundarios con weight 0–100, flags. Sin dependencias nuevas.

- **ExerciseDB → propio:** mapear `targetMuscles[0]`→primario, resto→secundarios (peso por defecto configurable), `equipment` body weight → `is_bodyweight`. Los nombres de músculo se normalizan al enum local con el diccionario del catálogo.

## Risks / Trade-offs

- **Mapeo músculo ExerciseDB → enum local** (vocabularios distintos) → Mitigación: tabla/diccionario de correspondencia; lo no mapeable cae a 'Otro'.
- **Volumen bodyweight sin peso registrado** → Mitigación: degradación explícita (reps/kg manual + aviso), nunca fallo.
- **Coherencia históricos** al calcular al vuelo con pesos actuales del ejercicio (si el usuario re-pondera, cambia el pasado) → Mitigación: documentar que la ponderación es una propiedad actual del ejercicio; aceptable para analítica de tendencia.
- **Rendimiento** de agregaciones con join a `exercise_muscles` → Mitigación: índices por `exercise_id` y `muscle_group`; el primario denormalizado permite rutas rápidas.
- **Regeneración de tipos** obligatoria (`gen:types`) tras la migración → Mitigación: incluir en tareas.

## Migration Plan

1. Migración idempotente: crear `exercise_muscles`, `exercises.is_bodyweight`, backfill primario 100% desde `muscle_group`, índices; revisar trigger/RPC.
2. `npm run gen:types`.
3. Capa de datos: lectura/escritura de músculos ponderados y flag bodyweight.
4. Cálculos ponderados en stats (con tests) manteniendo compatibilidad single-muscle.
5. Registro de series bodyweight (peso por fecha + lastre).
6. Formulario de creación/edición + "guardar de catálogo".
7. Rollback: la columna/tabla nuevas son aditivas; sin ellas, `muscle_group` sigue funcionando.

## Resolved Decisions (respuestas del usuario)

- **Peso corporal vía recordatorio semanal.** La app pregunta al usuario su peso **1 vez por semana** (recordatorio/prompt). El valor introducido se guarda en `body_measurements` y es el peso corporal vigente que se usa para estimar el volumen de los ejercicios de peso corporal (con el peso por fecha ya descrito). Si nunca lo ha introducido, degradación con aviso.
- **Reparto por músculo exacto y editable.** El usuario puede **poner el grupo exacto**: el formulario expone el primario y los secundarios con su peso concreto, y la UI muestra el reparto exacto por músculo (no solo interno).
- **Import ExerciseDB:** primario = `targetMuscles[0]` al 100%, secundarios añadidos con peso por defecto que el usuario ajusta a mano (edición exacta).

## Open Questions

- Formato exacto del recordatorio semanal (notificación local vs. banner in-app al abrir); se decide en implementación (tarea 4.6).
