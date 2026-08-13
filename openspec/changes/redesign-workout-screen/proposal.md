## Why

La pantalla de entreno es la que se mira durante toda la sesión, con el móvil en la mano y entre series, y hoy está saturada. `WorkoutPage.tsx` monta **18 bloques distintos**: banner del entrenador, recordatorio de peso semanal, banner de sesión recuperada, cronómetro con volumen y series, cabecera del día de rutina, selector de ejercicio, tarjeta de última sesión, tarjeta de sugerencia, selector de modalidad de carga, lista de series, chips de calculadora de discos y 1RM estimado, récords por banda de reps, barra de acciones, temporizador de descanso, tarjeta del entrenador, tarjeta de salud del wearable, calculadora de discos y diálogos.

El síntoma concreto, medido en el teléfono con **Remo con barra**: conviven en pantalla **cinco cifras de peso** para el mismo ejercicio —«ÚLTIMA · 80 KG × 11», «RECOMENDADO · 80 KG × 11», «1RM ESTIMADO 92,9 KG», «PR RECIENTE 80,0 KG × 10» y la fila `8R·80KG 12R·80KG 15+R·60KG`— sin jerarquía que diga cuál importa ahora. Quien entrena solo necesita saber qué peso poner en la barra y anotar la serie que acaba de hacer.

## What Changes

- **Jerarquía en tres niveles.** Nivel 1, lo que se usa entre series: ejercicio, campo de kg y reps, marcar serie, series ya hechas, peso sugerido, siguiente acción. Nivel 2, a un toque: calculadora de discos, 1RM estimado, récords, historial de última sesión, notas. Nivel 3, fuera de la sesión: salud del wearable, entrenador, recordatorio de peso semanal, que pasan a mostrarse solo en reposo o directamente a su pantalla.
- **Una sola cifra de peso destacada.** El peso sugerido es el único número grande. El resto del contexto numérico se agrupa bajo un desplegable de referencia, sin desaparecer.
- **Modo sesión.** Con una serie ya registrada, la pantalla se concentra: se pliegan los bloques que solo tienen sentido antes de empezar (cabecera del día, banners, tarjetas de reposo).
- **La modalidad de carga deja de ocupar sitio permanente.** Ya es un bloque plegable tras la primera vez (`ExerciseLoadType`), pero sigue fijo en el flujo principal; pasa al nivel 2 salvo la primera vez que se usa un ejercicio.
- **Densidad y toque.** Se mantiene mobile-first: objetivos táctiles ≥44 px, prueba a ~390 px, respeto de `safe-area` y de `--header-height`/`--bottom-nav-height`, y verificación en tema claro y oscuro.

## Capabilities

### New Capabilities

- `workout-screen-hierarchy`: Organización de la pantalla de entreno en niveles de prioridad, con un único dato de carga destacado y el contexto secundario accesible sin ocupar el flujo principal.

## Impact

- **Código:** `src/features/workout/pages/WorkoutPage.tsx` y sus componentes (`WorkoutSessionStats`, `RoutineDayHeader`, `ExercisePicker`, `LastSessionCard`, `ExerciseLoadType`, `WorkoutSetList`, `WorkoutActionBar`), `src/features/stats/components/NextSessionCard.tsx`.
- **Diseño:** sigue el sistema FitBody. Tokens de `src/shared/styles/tokens.css`, sin hex en componentes, escala tipográfica con nombre, tres niveles de elevación. Requiere revisar `DESIGN.md` si existe y sincronizarlo en el mismo cambio.
- **Sin cambios de esquema BD**, sin tocar `database.types.ts`, sin dependencias nuevas.
- **Riesgo:** es el cambio de mayor superficie de los tres. Depende de `fix-weight-suggestion-consistency` (que corrige qué números se muestran) y de `improve-save-confirmation` (que corrige la barra de guardado).

## Non-goals

- Cambiar el motor de sugerencia ni sus reglas.
- Rediseñar otras pantallas (rutinas, estadísticas, historial).
- Quitar funcionalidad: nada se elimina, se reordena por prioridad.
