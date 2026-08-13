## 1. Preferencia persistida

- [x] 1.1 `src/features/workout/lib/saveScopePreference.ts`: tipo `SaveScope`, clave `gymlog-save-scope`, `readSaveScope()` (tolerante: valor desconocido → `null`), `writeSaveScope()`, `clearSaveScope()`, siguiendo el patrón de `ExerciseLoadType.tsx:11-29`
- [x] 1.2 Función pura `resolveSaveScope({ completedCount, pendingCount, stored })` → `'all' | 'completed-only' | 'ask'`
- [x] 1.3 Tests: sin mezcla → `'all'`; mezcla sin preferencia → `'ask'`; mezcla con preferencia → esa preferencia; valor corrupto → `'ask'`

## 2. Arreglo del bucle

- [x] 2.1 `handleSave` pasa a recibir `{ scope?: SaveScope }`; con `scope` presente guarda directo sin volver a decidir
- [x] 2.2 Sustituir el guard de `WorkoutPage.tsx:371-379` por la llamada a `resolveSaveScope`
- [x] 2.3 Ramas del `ConfirmDialog`: guardar la elección con `writeSaveScope` y llamar a `handleSave({ scope })`
- [x] 2.4 Revisar que `summarySets`, `recordProgression` y el cálculo de PR usan el alcance resuelto y no el flag antiguo
- [x] 2.5 `registerBackAction('workout-save-dialog', …)` mientras el diálogo esté abierto: cerrar sin guardar ni fijar preferencia

## 3. Salida en Ajustes

- [x] 3.1 Fila «Guardado de series» en Ajustes → Preferencias con tres opciones excluyentes (Preguntar / Guardar todas / Solo completadas) sobre la misma clave
- [x] 3.2 Strings i18n (es) para el ajuste y sus opciones
- [x] 3.3 Estilo FitBody: tokens, `cursor-pointer`, touch ≥44px, contraste WCAG AA, sin emojis como iconos

## 4. Verificación

- [x] 4.1 Tests de que la primera vez pregunta y guarda la elección, y las siguientes aplican sin diálogo
- [x] 4.2 Test de regresión del bucle: elegir «guardar todas» produce un guardado y no reabre el diálogo
- [x] 4.3 `workoutStore.test.ts` sigue en verde (contrato de `onlyCompleted` intacto)
- [x] 4.4 `npm run lint && npm run type-check && npm run test` en verde
- [ ] 4.5 En el teléfono: primera vez pregunta, guarda de verdad; segunda vez guarda sin preguntar; el ajuste devuelve el diálogo
- [x] 4.6 Bug del bucle y decisión de recordar la elección documentados en `proposal.md` y `design.md` (D1). No se recrea `diary.md`: se eliminó del repo en `ffd2f1d`
