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

## Fase 1 — Esquema (opción A aprobada) — **escrita y probada, SIN APLICAR**

- [x] 1.1 `supabase/migrations/20260825125843_timed_sets.sql`: `reps` pasa a
      admitir NULL, `CHECK` reescrito, y `workout_sets_measured` nuevo para que
      una serie sin reps **y** sin duración no pueda entrar.
- [x] 1.2 `save_workout_with_sets` escribe `duration_seconds`. **La firma no
      cambia**: el dato viaja dentro del JSON de series que ya recibía, así que
      un APK sin actualizar sigue guardando igual. Descarta las filas que no
      miden nada en vez de tumbar el entreno entero contra el CHECK.
- [x] 1.3 `get_workouts_with_sets` devuelve `duration_seconds`.
- [x] **1.4bis (no estaba en el plan) — el trigger `process_new_set`.** Ver
      abajo: es lo que habría roto el guardado.
- [x] 1.4 `npm run gen:types` tras aplicar la migración. El diff real son **3
      líneas**: `reps` pasa a `number | null` en Row, Insert y Update de
      `workout_sets`. Ojo: la salida cruda del CLI no viene formateada, hay que
      pasarle `npx prettier --write` o el diff sale de mil líneas y no se lee.
- [x] 1.5 `RemoteWorkoutSetSchema` acepta `reps` nulo y `duration_seconds`, con
      4 tests nuevos. **Tenía que ir antes que la migración**: con
      `reps: z.number()`, la primera serie por tiempo se habría descartado al
      validar y el usuario vería su plancha desaparecer sin un solo error.
- [x] 1.6 Probada en un **Postgres 17 desechable** (Docker en WSL) sobre una
      reproducción del esquema vigente. Ver resultados abajo.

### Lo que no estaba en el plan y lo habría roto

`process_new_set` corre en cada INSERT de `workout_sets` y da por hecho que hay
repeticiones. Con `reps` NULL:

1. **`personal_records.reps` es NOT NULL** y el trigger intenta insertar un PR
   con `NEW.reps`. Guardar una plancha **fallaba entero**, no solo el récord.
2. `total_volume + (NEW.weight * NEW.reps)` da NULL en cuanto uno lo es: una
   sola serie por tiempo dejaba el volumen del entreno en NULL.
3. `IF NEW.reps >= 1 ...` con NULL da UNKNOWN y caía en el ELSE, guardando
   `one_rm = NEW.weight`: un «récord» inventado para una plancha lastrada.

El otro trigger vivo, `sync_workout_volume`, **no hace falta tocarlo**: usa
`SUM(weight * reps)`, y SUM ignora los NULL en vez de propagarlos. Comprobado
sobre la definición viva en producción, no sobre las migraciones — son los dos
únicos triggers activos de la tabla.

### Verificación en Postgres 17 local

Reproducción del esquema actual + migración. **El fallo se reprodujo primero**:

```
ERROR: null value in column "reps" of relation "personal_records"
       violates not-null constraint
```

Con la migración completa, 8 comprobaciones en verde:

| #   | Comprobación                               | Resultado                             |
| --- | ------------------------------------------ | ------------------------------------- |
| 1   | Serie de repeticiones igual que antes      | volumen 500, PR creado                |
| 2   | Serie por tiempo se guarda                 | sin error                             |
| 3   | El volumen **no** se va a NULL             | sigue en 500                          |
| 4   | La plancha no crea récord por repeticiones | 1 récord, no 2                        |
| 5   | La plancha no tiene 1RM inventado          | NULL                                  |
| 6   | Serie sin reps y sin duración              | rechazada por `workout_sets_measured` |
| 7   | Reps fuera de rango                        | siguen rechazadas                     |
| 8   | Idempotencia: 3 pasadas seguidas           | sin errores, datos intactos           |

### Aplicada en producción

Aplicada al proyecto `eoltmipoklizewxdpzfa` el 2026-08-25. Supabase la registró
con su propia versión, **`20260825125843`**, distinta del nombre local que tenía
el fichero; se renombró para que `supabase db push` la vea como ya aplicada.

Antes de aplicarla se guardaron las definiciones previas de las tres funciones y
la nota de vuelta atrás en el scratchpad de la sesión, y se comprobó que no había
ninguna fila con `duration_seconds`.

Estado posterior comprobado con una consulta a la base viva:

| Comprobación                                   | Resultado                                                  |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `reps` admite NULL                             | `YES`                                                      |
| `workout_sets_measured` existe                 | `CHECK (reps IS NOT NULL OR duration_seconds IS NOT NULL)` |
| `workout_sets_reps_check` (el viejo) eliminado | ausente de la lista de constraints                         |
| Filas con `reps` NULL                          | 0                                                          |
| Trigger blindado                               | sí                                                         |
| La RPC devuelve `duration_seconds`             | sí                                                         |

La vuelta atrás solo es limpia **mientras no haya ninguna serie por tiempo**:
después, `SET NOT NULL` fallaría hasta borrarlas. Es inherente a la opción A y
conviene tenerlo presente, no es un descuido.

### Verificación del código tras regenerar los tipos

`type-check` 0 errores · `lint` 0 errores (5 warnings previos, ajenos) · **688
tests en 64 ficheros, todos en verde**. Confirma la medida de la fase 0: la
sonda del compilador dio 26 puntos con `reps` nulable _antes_ de la migración y
**0 después**, porque los sitios que lo tocaban ya se habían pasado a
`setShape.ts`.

## Fase 2 — Modo en el plan de la rutina (sin migración)

- [x] 2.1 `RoutineExercise`: `mode?: 'reps' | 'time'`, `perSide?: boolean`,
      `durationSeconds?: number`. Todos opcionales; **ausente = `reps`**. No hay
      `'cardio'`: el cardio tiene su propia pantalla, no es un ejercicio dentro
      del plan de fuerza.
- [x] 2.2 Lectura tolerante, con una rutina serializada de la versión actual
      escrita literal en el test. Entra por `loadFromDb` y sale intacta. Se
      comprueba además que las plantillas predefinidas siguen siendo todas de
      repeticiones.
- [x] 2.3 Editor de ejercicio (`RoutineExerciseEditor`): modo, series,
      reps o segundos, y «por lado». Antes un ejercicio del plan **solo se podía
      añadir y quitar** —entraba con `3 × 10-12` fijos—, así que la hoja es nueva
      y la fila de la lista estrena botón de editar. `perSide` se propone al
      añadir desde `is_bilateral === false`, pero manda lo que diga el plan.
- [x] 2.4 `SHARE_FORMAT_VERSION` a 2, con los campos nuevos escritos solo cuando
      aplican: **un fichero de una rutina de repeticiones sale igual que antes**.
      Al leer se valida como frontera de verdad — un `mode` inventado cae en
      repeticiones, una duración fuera de rango se descarta y `perSide` solo se
      acepta si viene como `true`. Test de que un fichero v1 se importa entero.
- [x] 2.5 `formatearObjetivo` en `printRoutine.ts`: «3 × 45 s», con «por lado»
      visible porque es lo que decide si la serie son 12 repeticiones o 24. Modo
      tiempo sin duración imprime «3 × tiempo» en vez de inventar un número.

### Lo que se sacó a un módulo propio

`features/routine/utils/planTarget.ts`. Los mismos tres campos viajan en tres
formas distintas —el `RoutineExercise` del store, el `SharedExercise` de un
fichero y la fila que se imprime— y las tres tienen que decidir lo mismo. Con la
lógica repartida bastaría que una tratase el `undefined` de otra manera para que
una rutina vieja se leyera bien en un sitio y mal en otro.

`planModeOf` estrecha `modeOfPlanned` a `reps | time`: `cardio` es un modo válido
para lo que se registra, pero no para una rutina, y un fichero manipulado que lo
traiga crearía un ejercicio que ninguna pantalla sabe pintar.

### Un tropiezo que dejó mejor código

La primera versión del editor copiaba las props al estado con un `useEffect`.
`react-hooks/set-state-in-effect` lo rechazó, y con razón: encadena un render de
más y deja la puerta abierta a pisar lo que el usuario está escribiendo. La
solución fue montar el formulario con `key` y sembrar el estado en el
inicializador de `useState`.

Verificación: `type-check` 0 errores · `lint` 0 errores (los 5 warnings previos,
ajenos) · **719 tests en 65 ficheros**, 31 más que antes de la fase.

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
