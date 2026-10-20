## Why

El mismo ejercicio muestra **dos pesos sugeridos distintos** según la pantalla. Verificado en el teléfono (Pixel 9a, 13-ago-2026) con **Remo con barra**: la pantalla de inicio recomienda **80 kg × 11** («mantén la carga») y la sesión de rutina recomienda **82,5 kg** («sube la carga»), con los mismos datos y el mismo motor.

La causa raíz son tres defectos encadenados:

1. **Input distinto en cada consumidor.** `WorkoutPage.tsx:263` llama a `useExerciseAdvice` **sin** `repMin`/`repMax`; `SessionExerciseCard.tsx:71` sí los pasa (`targetRepRange(exercise.targetReps)`). Sin ellos, `suggestProgression` cae a su rango por defecto `[8, 12]` (`progression.ts:36-37`), que no tiene relación con el objetivo real del ejercicio (`6` en la rutina activa).

2. **El rango de reps es el único parámetro que decide.** De 931 series registradas, **0 tienen RIR y solo 7 tienen RPE**. `suggestNextLoad` se niega a decidir sin esfuerzo en la última sesión, así que devuelve `null` **siempre** y toda sugerencia real sale del fallback `suggestFromLastSession` (doble progresión). El rango de reps no es un ajuste fino: es _el_ input.

3. **«Sesión» = workout, y hay varios workouts por día y ejercicio.** El 11-ago se registraron _Press militar_ 57,5 kg × 6 (07:15, trabajo) y 40 kg × 10 (08:40, ligero). El motor toma el último workout —40 kg— e ignora las 57,5 kg de esa misma mañana. De ahí las sugerencias que parecen aleatorias.

Además, la tarjeta de sugerencia **miente al mostrar el pasado**: `NextSessionCard.tsx:74` pinta la etiqueta «ÚLTIMA» combinando `suggestion.baseWeight` con `suggestion.reps` (las reps _sugeridas_), por lo que muestra «ÚLTIMA · 80 KG × 11» cuando la última sesión real fue 80 kg × 10.

## What Changes

- **Fuente única de verdad del rango de reps.** Nuevo resolutor compartido que obtiene el objetivo de reps de un ejercicio (`parseRepRange` sobre el objetivo de la plantilla de rutina, por nombre normalizado) y un hook que lo expone. Ambos consumidores —inicio y rutina— lo usan; se elimina el duplicado local `targetRepRange` de `SessionExerciseCard`. Sin objetivo en ninguna rutina, ambos reciben `undefined` y siguen coincidiendo.
- **Una sesión es un día, no un workout.** `groupSetsBySession` agrupa por día natural del `started_at`, de modo que la serie más pesada del día manda y los entrenos fragmentados o duplicados dejan de mover la sugerencia.
- **La etiqueta «última» dice la verdad.** `LoadSuggestion` gana `baseReps` (reps de la serie tope de la última sesión) y `NextSessionCard` la usa en la etiqueta de pasado, en lugar de reutilizar las reps sugeridas.
- **Ventana de consulta unificada.** `fetchLastExerciseSets` y `fetchExerciseSessions` miran la misma cantidad de entrenos recientes (hoy 30 vs 40), para que no haya sugerencia sin su histórico correspondiente.
- **Calentamientos fuera del histórico mostrado.** `fetchLastExerciseSets` filtra `is_warmup` en servidor, igual que ya hace `fetchExerciseSessions`.
- **Limpieza de duplicados exactos** en el historial del usuario (mismo ejercicio, mismas series, segundos de diferencia), con copia de seguridad previa y lista revisada antes de borrar.

## Capabilities

### New Capabilities

- `load-suggestion-consistency`: La sugerencia de carga de un ejercicio es idéntica en todas las pantallas que la muestran, resolviendo el rango de reps objetivo desde una única fuente y agrupando el historial por día.

## Impact

- **Código:** `src/shared/lib/exerciseTargets.ts` (nuevo), `src/shared/hooks/useExerciseRepRange.ts` (nuevo), `src/shared/api/sessionGrouping.ts`, `src/shared/api/queries.ts` (`fetchLastExerciseSets`, `fetchExerciseSessions`), `src/features/stats/utils/autoregulation.ts` (`baseReps`), `src/features/stats/components/NextSessionCard.tsx`, `src/features/workout/pages/WorkoutPage.tsx`, `src/features/routine/components/SessionExerciseCard.tsx`.
- **Datos:** borrado de workouts duplicados exactos del usuario. Irreversible: exige copia de seguridad y confirmación de la lista.
- **Sin cambios de esquema BD**, sin tocar `database.types.ts`, sin dependencias nuevas.
- **Tests:** amplía `autoregulation.test.ts` y los de agrupación; nuevo test de paridad entre ambos consumidores.

## Non-goals

- Rediseñar la jerarquía visual de la pantalla de entreno (va en `redesign-workout-screen`).
- Arreglar el diálogo de confirmación de guardado (va en `improve-save-confirmation`).
- Reactivar la autorregulación por esfuerzo pidiendo RIR/RPE al usuario.
