## 1. Fuente única del rango de reps

- [x] 1.1 `src/shared/lib/exerciseTargets.ts`: `findRoutineTargetReps(routine, exerciseName)` y `resolveExerciseRepRange(exerciseName, routine, explicitTargetReps?)`, reutilizando `parseRepRange` y `normalizeExerciseName` de `progressionCycle.ts`
- [x] 1.2 Tests puros de `exerciseTargets`: objetivo `"5"`, `"8-10"`, `"12 por lado"`, ejercicio ausente, nombre con acentos/mayúsculas distintas
- [x] 1.3 `src/shared/hooks/useExerciseRepRange.ts`: hook que lee la rutina activa de `routineStore` y devuelve `{ repMin, repMax }` memoizado
- [x] 1.4 `SessionExerciseCard.tsx`: eliminar el `targetRepRange` local (línea 27) y usar el hook con `exercise.targetReps` como valor explícito
- [x] 1.5 `WorkoutPage.tsx`: usar el hook con el nombre del ejercicio activo y pasar `repMin`/`repMax` a `useExerciseAdvice`

## 2. Una sesión es un día

- [x] 2.1 `sessionGrouping.ts`: agrupar por día natural del `started_at` en vez de por `workout_id`, conservando el `started_at` más temprano del día
- [x] 2.2 Tests: dos entrenos el mismo día se funden y la serie tope es la más pesada; días distintos siguen separados; entrenos sin fecha se descartan; se respeta `sessionLimit`
- [x] 2.3 Verificar que `detectStall` sigue coherente con el nuevo significado de sesión

## 3. Etiquetas honestas y ventana unificada

- [x] 3.1 `autoregulation.ts`: añadir `baseReps` a `LoadSuggestion` y rellenarlo en `suggestNextLoad`, `suggestFromLastSession` y `applyReadiness`
- [x] 3.2 `NextSessionCard.tsx`: usar `baseReps` en la etiqueta de sesión anterior
- [x] 3.3 `queries.ts`: constante compartida de ventana de entrenos recientes; aplicarla en `fetchLastExerciseSets` y `fetchExerciseSessions`
- [x] 3.4 `fetchLastExerciseSets`: filtrar `is_warmup` en servidor

## 4. Tests de paridad

- [x] 4.1 Test que, con una misma sesión de entrada, comprueba que el resultado con el rango resuelto es idéntico para ambos consumidores
- [x] 4.2 Test de regresión del caso real: última sesión 80 kg × 10 con objetivo `6` → misma sugerencia en ambos caminos
- [x] 4.3 Test de que sin historial utilizable no hay sugerencia
- [x] 4.4 `npm run lint && npm run type-check && npm run test` en verde

## 5. Limpieza de duplicados en el historial

- [x] 5.1 Consulta que identifica workouts duplicados exactos (mismo ejercicio, mismas series, <5 min de diferencia)
- [x] 5.2 Copia de seguridad de los candidatos a fichero local fuera del repo
- [x] 5.3 Lista presentada. Decisión: borrar solo el duplicado inequívoco (Press banca 11-ago 09:16:19, 29 s después del original). El lote del 10-ago 22:06 resultó ser una sesión de rutina guardada en 4 s que re-registra el entreno de la mañana, pero con Sentadilla Parcial 62,5×3 que no existe en ningún otro sitio: se conserva
- [x] 5.4 Borrado el workout 510185a4 (4 series). Copia de seguridad restaurable en el scratchpad de la sesión

## 6. Verificación en dispositivo

- [ ] 6.1 Comprobar en el teléfono que inicio y rutina muestran el mismo peso para el mismo ejercicio
- [ ] 6.2 Comprobar que la etiqueta de sesión anterior coincide con el historial real
- [x] 6.3 Decisión y cambio de comportamiento documentados en `design.md` (D2). `diary.md` se eliminó del repo en `ffd2f1d`, así que no se recrea: CLAUDE.md sigue mencionándolo y conviene corregirlo
