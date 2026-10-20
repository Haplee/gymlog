## Why

El diálogo de confirmación al guardar no solo molesta: **«Guardar todas» no guarda nunca**.

`WorkoutPage.tsx:854-857` cierra el diálogo y vuelve a llamar a `handleSave({ onlyCompleted: false })`. El guard de las líneas 371-379 comprueba `if (!onlyCompleted)` y, como las series no han cambiado, se vuelve a cumplir y reabre el diálogo. React aplica el `setSaveDialog(null)` y el `setSaveDialog({...})` en el mismo lote, así que el diálogo ni siquiera parpadea: se queda ahí.

Verificado en el teléfono (Pixel 9a, 13-ago-2026) con una serie completada y otra sin marcar: al pulsar «Guardar todas» el diálogo permanece idéntico, y en base de datos no se creó ningún entreno. La única salida es «Solo completadas», que **descarta** las series sin marcar. El gesto de atrás tampoco cierra el diálogo: navega fuera de la pantalla y deja la sesión a medias.

Esto explica con alta probabilidad los entrenos duplicados y fragmentados del historial.

## What Changes

- **Se arregla el bucle.** `handleSave` deja de decidir por sí misma en la reentrada: el alcance del guardado (`todas` o `solo completadas`) se resuelve una vez y se pasa explícito, de modo que una llamada con alcance ya decidido nunca vuelve a abrir el diálogo.
- **Se recuerda la elección.** La primera vez que coinciden series completadas y series con datos sin marcar, se pregunta. La respuesta se guarda en `localStorage` siguiendo el mismo patrón que `ExerciseLoadType.tsx` (`readConfirmed`/`markConfirmed` sobre la clave `gymlog-loadtype-confirmed`), en versión de elección única: `'all'` o `'completed-only'`. Las veces siguientes se aplica en silencio, sin diálogo.
- **Hay salida.** En Ajustes → Preferencias aparece la preferencia de guardado con tres estados —Preguntar / Guardar todas / Solo completadas— leyendo y escribiendo esa misma clave, para poder cambiarla o volver a «Preguntar» sin reinstalar nada.
- **El gesto de atrás cierra el diálogo** en vez de navegar fuera, usando `registerBackAction` como ya hacen las hojas de valoración y de discos.

## Capabilities

### New Capabilities

- `save-scope-preference`: Resolución del alcance del guardado cuando hay series completadas y sin marcar a la vez, preguntando solo la primera vez y recordando la elección.

## Impact

- **Código:** `src/features/workout/pages/WorkoutPage.tsx` (`handleSave`, `ConfirmDialog`, back handler), `src/features/workout/lib/saveScopePreference.ts` (nuevo), `src/features/auth/pages/SettingsPage.tsx` (fila de preferencia), i18n (es).
- **Almacenamiento:** nueva clave `gymlog-save-scope` en `localStorage`. No se persiste en BD.
- **Sin cambios de esquema BD**, sin tocar `database.types.ts`, sin dependencias nuevas.
- **Tests:** `workoutStore.test.ts` sin cambios de contrato; nuevos tests de la resolución de alcance.

## Non-goals

- Cambiar qué series se guardan en cada rama (la semántica de `onlyCompleted` en `saveWorkout` se mantiene).
- Eliminar el marcado de series completadas.
- Rediseñar la barra de acciones (va en `redesign-workout-screen`).
