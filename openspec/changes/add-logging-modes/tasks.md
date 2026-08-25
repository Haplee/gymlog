> Cada fase se cierra con `npm run lint && npm run type-check && npm run test` en
> verde **antes** de commitear, en rama propia (`feat/logging-modes-fase-N`), sin
> saltar husky. Push/PR/merge solo cuando el usuario lo pida.
>
> **La fase 1 no empieza hasta que esté aprobada la opción de `design.md` §1.**

## Fase 0 — Preparar el terreno (sin migración, sin cambio visible) — **HECHA**

- [x] 0.1 `src/shared/lib/setShape.ts`: acceso único a la forma de una serie.
      **La API cambió respecto a lo planificado.** En vez de `repsForVolume(s)
    → number` (un `?? 0` disfrazado), la pieza central es un **predicado de
      tipo**: `isRepSet(s): s is T & { reps: number }` y `onlyRepSets(sets)`.
      Motivo: un cero es un dato —una serie de cero repeticiones que entra en el
      recuento y en las medias—, mientras que filtrar con narrowing obliga al
      compilador a exigir la decisión en cada sitio. También `isTimedSet`,
      `onlyTimedSets`, `repsOf`, `durationOf`, `isMeasuredSet` y `modeOfPlanned`.
- [x] 0.2 19 tests, incluido el caso «reps y duración a la vez»: **gana reps**
      (cronometrar 10 sentadillas no las convierte en una plancha, y la regla
      contraria borraría de las estadísticas cualquier serie cronometrada).
- [x] 0.3 Inventario — ver abajo. **El alcance real es mucho menor que 34
      ficheros.**
- [x] 0.4 Migrados los 26 puntos. La suite pasa **sin tocar ni un test
      existente** (684/684), que era el criterio de aceptación.

### Inventario real (0.3)

Los 34 ficheros que contienen `.reps` **no** hablan todos del mismo campo. Hay
cuatro tipos distintos y solo uno se ve afectado:

| Tipo                                            | Qué es                                | ¿Afectado? |
| ----------------------------------------------- | ------------------------------------- | ---------- |
| `workout_sets.reps` vía `WorkoutSetWithDetails` | La serie registrada                   | **Sí**     |
| `RoutineExercise.reps`                          | Rango objetivo, un **string** («6-8») | No         |
| `SetFormData.reps` / borrador de `workoutStore` | Un **string** del formulario          | No         |
| Formas propias de los importadores              | Sus tipos, con su validación          | No         |

El alcance se midió **con el compilador**, no a ojo: se puso `reps: number | null`
en `WorkoutSetWithDetails` y se ejecutó `type-check`. Resultado:

**5 ficheros, 26 puntos.** Tras la migración, la misma sonda da **0 errores**.

| Fichero                       | Puntos | Clasificación                            |
| ----------------------------- | ------ | ---------------------------------------- |
| `pages/UserStatsPage.tsx`     | 10     | volumen, 1RM, descarga, reparto muscular |
| `pages/StatsPage.tsx`         | 9      | volumen, 1RM, progresión, comparador     |
| `pages/HistoryPage.tsx`       | 3      | volumen por entreno (×3 duplicado)       |
| `utils/historyHelpers.ts`     | 2      | presentación (resumen y plantilla)       |
| `hooks/useHistoryTransfer.ts` | 2      | exportación Excel y JSON                 |

Patrón encontrado: **la nulabilidad se detiene en las interfaces locales de cada
util** (`VolumeSet`, `SetLike`, `DeloadWorkout`, `ExcelStrengthSet`), que declaran
`reps: number`. Son la costura natural, así que el filtro va en las páginas —que
es además lo que dice `design.md` §4.1— y los utils no se tocan.

De paso, los tres cálculos de volumen duplicados en `HistoryPage` pasan a usar el
`calculateSessionVolume` que ya existía.

### Decisiones que la fase 0 deja pendientes (no las cierra)

- **Historial y plantillas** (`historyHelpers`): hoy filtran las series por
  tiempo. En fase 3 hay que darles su propio resumen («45-60 s») en vez de
  esconderlas. → tarea 3.4
- **Exportación** (Excel y JSON): igual. Una copia de seguridad que pierde las
  planchas no es una copia de seguridad. → tarea 3.4
- **Reparto muscular y recuperación**: ahora reciben solo series de fuerza, así
  que una plancha no contaría como abdominales entrenados. **Es discutible**: sí
  entrena, aunque no aporte volumen. Decidir en fase 3.

## Fase 1 — Esquema (requiere aprobación de `design.md` §1)

- [ ] 1.1 Migración idempotente `supabase/migrations/<ts>_timed_sets.sql`:
      relajar `reps` según la opción aprobada, ajustar el `CHECK`, y añadir un
      `CHECK` que impida una serie sin reps **y** sin duración (una serie tiene
      que medir algo).
- [ ] 1.2 `save_workout_with_sets`: aceptar y escribir `duration_seconds`.
      Mantener la firma compatible — el parámetro nuevo con `DEFAULT NULL`, para
      que un cliente viejo (APK sin actualizar) siga guardando.
- [ ] 1.3 `get_workouts_with_sets`: incluir `duration_seconds` en el JSON.
- [ ] 1.4 `npm run gen:types` y ajustar lo que el `type-check` señale.
- [ ] 1.5 `RemoteWorkoutSetSchema` (Zod) al día con la forma nueva.
- [ ] 1.6 Probar la migración **hacia adelante y hacia atrás** en una rama de
      Supabase antes de tocar producción.

## Fase 2 — Modo en el plan de la rutina (sin migración)

- [ ] 2.1 `RoutineExercise`: `mode?: 'reps' | 'time'`, `perSide?: boolean`,
      `durationSeconds?: number`. Todos opcionales; **ausente = `reps`**.
- [ ] 2.2 Lectura tolerante en `routineStore`: una rutina guardada sin estos
      campos se lee igual que hoy. Test con una rutina serializada de la versión
      actual.
- [ ] 2.3 Editor de rutina: elegir modo y «por lado» al añadir o editar un
      ejercicio. Por defecto `reps`; `perSide` se propone desde
      `exercises.is_bilateral` pero manda lo que diga el plan.
- [ ] 2.4 `shareRoutine.ts`: incluir los campos nuevos en el fichero compartido y
      validarlos al leer. Subir `SHARE_FORMAT_VERSION` a 2 y comprobar que un
      fichero v1 sigue importándose.
- [ ] 2.5 `printRoutine.ts`: una serie por tiempo se imprime como «3 × 45 s», no
      como «3 series · 45 reps».

## Fase 3 — Registrar por tiempo

- [ ] 3.1 `workTimerStore`: store propio (ver `design.md` §6), sobre
      `useVisibilityPausedInterval`.
- [ ] 3.2 UI de la serie por tiempo en `SessionExerciseCard` y `WorkoutSetList`:
      cronómetro en vez de campo de reps, con el peso opcional.
- [ ] 3.3 Guardado: `duration_seconds` poblado, `reps` según lo aprobado en §1.
- [ ] 3.4 Historial: pintar «45 s» donde hoy iría «10 reps». Comprobar a 390px y
      en **los dos temas**.
- [ ] 3.5 Blindar la analítica (ver `design.md` §4): volumen, 1RM,
      autorregulación y PRs. **Un test por cada una** de las cuatro reglas.
- [ ] 3.6 Resolver el punto abierto de `design.md` §4.2: `calcular1RM`
      devuelve **0** ante reps ausente, no `null`, así que una serie por tiempo
      no queda excluida sino contada como cero. Decidir entre cambiar el valor
      de retorno o filtrar en cada llamante, y dejarlo escrito aquí.

## Fase 4 — Por lado

- [ ] 4.1 `repStep(cfg)` → 2 cuando `perSide`. Enganchar en `loadAdvisor`.
- [ ] 4.2 Presentación derivada: «16 (8 por lado)». Total impar se muestra tal
      cual, con test.
- [ ] 4.3 Que el objetivo sugerido nunca caiga en impar para un ejercicio por
      lado.

## Fase 5 — Superseries

- [ ] 5.1 `supersetId?: string` en `RoutineExercise` y agrupación en el editor.
- [ ] 5.2 `RoutineSession`: recorrido en ciclo por el grupo.
- [ ] 5.3 Descanso solo al cerrar el grupo.
- [ ] 5.4 Comprobar que un grupo a medias no bloquea el guardado del entreno.

## Verificación final

- [ ] V.1 `npm run lint && npm run type-check && npm run test && npm run build`
- [ ] V.2 `npm run audit:contrast` (toca UI nueva)
- [ ] V.3 En la **APK sobre el Pixel**, no solo en el navegador: una plancha con
      cronómetro, un remo por lado y una superserie, de principio a fin.
- [ ] V.4 Comprobar que una rutina y un historial creados **antes** del cambio se
      siguen leyendo y editando igual.
