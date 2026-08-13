## Context

El motor de sugerencia vive en `src/features/stats/utils/autoregulation.ts` y se consume por dos caminos:

|               | Pantalla de inicio                                      | Sesión de rutina                                                         |
| ------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Componente    | `WorkoutPage.tsx:263` → `NextSessionCard`               | `SessionExerciseCard.tsx:72`                                             |
| Hook          | `useExerciseAdvice(userId, exerciseId, { bodyweight })` | `useExerciseAdvice(userId, catalog?.id, { repMin, repMax, bodyweight })` |
| Rango de reps | **ninguno** → `[8, 12]` por defecto                     | del objetivo de la plantilla                                             |

`useExerciseAdvice` intenta `suggestNextLoad` y cae a `suggestFromLastSession`. Con los datos reales del usuario (0 RIR, 7 RPE de 931 series) la primera **nunca** decide, así que la sugerencia siempre sale de la doble progresión, cuyo comportamiento depende por completo de `repMin`/`repMax`.

`parseRepRange` ya existe en `src/shared/lib/progressionCycle.ts:94` y `SessionExerciseCard.tsx:27` tiene una **copia literal** llamada `targetRepRange`.

## Goals / Non-Goals

**Goals:**

- Mismo ejercicio → mismo peso, mismas reps, misma acción y mismo motivo en ambas pantallas.
- Un único punto donde se resuelve el rango de reps objetivo de un ejercicio.
- Que el historial que se muestra sea coherente con el que usa el motor (misma ventana, mismos filtros).
- Que las etiquetas de pasado muestren el pasado real.

**Non-Goals:**

- Cambiar las reglas del motor (umbrales de RIR, tope del 10 %, escalón de 2,5 kg).
- Rediseñar la pantalla de entreno.
- Introducir el rango de reps como campo de BD del ejercicio.

## Decisions

### D1 — El rango de reps se resuelve desde la rutina, por nombre normalizado

Las rutinas guardan el objetivo como texto libre por ejercicio (`reps: "8-10"`, `"5"`, `"12 por lado"`) y referencian el ejercicio **por nombre**, no por id (`RoutineSession.tsx:165` ya resuelve el catálogo con `catalogByName.get(normalizeName(ex.name))`). El resolutor sigue esa misma convención:

```
resolveExerciseRepRange(exerciseName, routine, explicitTargetReps?)
  1. si hay explicitTargetReps (la rutina ya sabe cuál es) → parseRepRange(explicitTargetReps)
  2. si no → buscar en los días de la rutina activa el ejercicio con
     normalizeExerciseName(name) igual → parseRepRange(su reps)
  3. si no aparece → {} (ambos consumidores reciben undefined → siguen coincidiendo)
```

**Alternativa descartada:** añadir `target_reps` a la tabla `exercises`. Requiere migración y duplica una información que ya es de la plantilla, no del ejercicio (el mismo press banca va a 5 en un mesociclo y a 3 en otro).

**Consecuencia aceptada:** si el nombre de la rutina y el del ejercicio registrado difieren (la rutina activa tiene «Curl bíceps» y el histórico «Curl bíceps barra»), no hay objetivo y ambas pantallas caen al mismo `undefined`. Divergen del ideal, pero **coinciden entre sí**, que es el requisito.

### D2 — Una sesión es un día natural

`groupSetsBySession` agrupa hoy por `workout_id`. Se cambia a agrupar por la fecha (`YYYY-MM-DD`) del `started_at`, quedándose con el `started_at` más temprano del día como marca de la sesión. Motivos:

- GymLog guarda **un workout por ejercicio**, así que «sesiones» y «entrenos del día» nunca coincidieron.
- Elimina de raíz el efecto de los duplicados exactos y de los accesorios ligeros registrados aparte.
- `topSet` ya elige la serie más pesada del grupo, así que el peso de trabajo del día manda automáticamente.

**Impacto en `detectStall`:** `STALL_SESSIONS = 3` pasa a significar «3 días de entreno» en vez de «3 workouts», que es lo que siempre quiso decir. Se acepta como corrección, no como regresión.

### D3 — `LoadSuggestion` gana `baseReps`

Hoy la interfaz solo lleva `baseWeight`, y `NextSessionCard` rellena el hueco con `suggestion.reps`, que son las **sugeridas**. Se añade `baseReps: number` (reps de la serie tope de la última sesión) en `suggestNextLoad`, `suggestFromLastSession` y `applyReadiness`. Campo obligatorio, no opcional: quien construya una sugerencia debe saber de dónde viene.

### D4 — Ventana de historial unificada

`fetchLastExerciseSets` mira 30 workouts y `fetchExerciseSessions` 40. Con el volumen real del usuario (un workout por ejercicio, ~5 ejercicios por día) 30 workouts son ~6 días: por eso Remo con barra tiene sugerencia pero no tarjeta de última sesión. Se unifica en una constante compartida (`RECENT_WORKOUTS_WINDOW = 60`), suficiente para ~12 días de entreno.

### D5 — Limpieza de duplicados: copia primero, lista revisada, borrado después

Se consideran duplicados exactos los workouts del mismo usuario y ejercicio con **idéntico conjunto de series** (peso, reps, orden, `is_warmup`) y `started_at` a menos de 5 minutos. Procedimiento:

1. Volcar a fichero local (fuera del repo) los workouts candidatos y sus series.
2. Presentar la lista al usuario para revisión.
3. Borrar solo tras confirmación explícita, conservando el más antiguo de cada grupo.

## Risks / Trade-offs

- **Cambio de sugerencia visible.** Al agrupar por día, ejercicios como Press militar pasan de sugerir sobre 40 kg a sugerir sobre 57,5 kg. Es el comportamiento correcto, pero el usuario verá saltos respecto a lo que la app le decía ayer. Se documenta en el diario.
- **`baseReps` obligatorio** rompe cualquier construcción externa de `LoadSuggestion`. Solo se construye dentro de `autoregulation.ts`, verificado por búsqueda.
- **El borrado de duplicados es irreversible.** Mitigado con copia de seguridad previa y confirmación de la lista.

## Migration Plan

Sin migración de esquema. El cambio de agrupación afecta solo a lectura y surte efecto en el siguiente refetch (`staleTime` de 5 min o invalidación al guardar).
