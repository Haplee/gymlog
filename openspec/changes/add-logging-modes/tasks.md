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

- [x] 3.1 `workTimerStore` con 10 tests. Cuenta **hacia arriba** y sin alarma:
      en una plancha lo que importa es cuánto se aguantó, y un aviso a los 45 s
      invita a soltar justo cuando quedaba algo. Al rehidratar **descarta el
      tramo en vuelo**: el de descanso sí puede recuperar reloj de pared, este
      no —la app pudo estar cerrada horas y nadie sostiene una plancha desde
      ayer—, así que sumar ese hueco sería un récord inventado.
- [x] 3.2 `WorkTimer` compartido, montado en `SessionExerciseCard` (sesión de
      rutina) y en `WorkoutSetList` (entreno libre, con selector de modo). En
      modo tiempo el campo de reps se sustituye por el de segundos, **y escribir
      en uno borra el otro**: dejar los dos haría que `isRepSet` contase la
      plancha como serie de fuerza.
- [x] 3.3 Guardado con `reps: null` (nunca `0`) y `duration_seconds`, en los dos
      caminos —entreno libre y sesión de rutina— y en el outbox. Una plancha sin
      lastre pesa 0 y es válida; exigirle peso positivo dejaba fuera el caso
      normal. 5 tests sobre la carga real que sale hacia la RPC.
- [x] 3.4 Historial: `groupSetsByExercise` mantiene los dos montones separados y
      resume «2×45-60 s». Aquí estaba el aviso que la fase 0 dejó escrito en el
      código apuntando a esta tarea. Un ejercicio con las dos formas las muestra
      aparte: metidas en el mismo rango darían «8-45», que no es ni 8 segundos ni
      45 repeticiones.
- [x] 3.5 Las cuatro reglas de `design.md` §4, con un test cada una, en
      `stats/utils/__tests__/timedSetsGuards.test.ts`.
- [x] 3.6 **Decisión: se filtra en el llamante; `calcular1RM` sigue devolviendo
      un número.** Ver abajo.

### Lo que se encontró al blindar la analítica

**El daño no era un NaN.** El plan daba por hecho que `peso × reps` con `reps`
nula reventaría el volumen. En JavaScript `20 * null` es **0**, no NaN: la suma
sobrevive intacta y no se rompe nada a la vista. Lo que se rompe es todo lo que
divide entre el número de series, porque la plancha entra como una serie que hizo
cero trabajo. Es exactamente lo que `setShape.ts` explicaba al negarse a usar
`?? 0`, y el test lo deja escrito con el número: 1000/2 = 500 en vez de 1000.

**La regla 4 va al revés que las otras tres.** La recuperación muscular **sí**
cuenta las series por tiempo. No es una métrica de volumen sino de recencia
—cuántos días hace que se tocó ese músculo— y una plancha trabaja el core igual
que un crunch. Al comprobarlo apareció un hueco real de la fase 0:
`StatsPage` y `UserStatsPage` le pasaban `strengthSets`, ya filtrado, mientras
que el aviso de «hoy toca X» (`useFatigueSuggestion`) usaba las series sin
filtrar. Las dos pantallas habrían dicho cosas distintas sobre el mismo músculo.
Corregido: ahora las dos leen sin filtrar. Cierra también el punto abierto que
había en este documento sobre si la recuperación debía contar las series por
tiempo.

### 3.6 — la decisión sobre `calcular1RM`

**Se filtra en el llamante. `calcular1RM` no cambia de firma.**

No es la opción cómoda, es la que dicen los datos: se revisaron los 8 sitios que
la llaman y **todos están ya protegidos**. `StatsPage` y `UserStatsPage` pasan
por `onlyRepSets` desde la fase 0; `autoregulation.isWorkingSet` exige
`Number.isFinite(reps) && reps > 0`, y `Number.isFinite(null)` es `false`;
`WorkoutPage` descarta con `r <= 0` antes de llamar. Cambiar el retorno a `null`
obligaría a 34 sitios a tratar un caso que no puede llegarles, y volvería
opcional (`?? 0`, `!`) justo la decisión que la fase 0 hizo obligatoria.

Queda un test que fija el comportamiento —`calcular1RM(20, null)` es `0`— para
que si algún día alguien lo cambia, sea a propósito.

## Fase 4 — Por lado

- [x] 4.1 `shared/lib/perSide.ts` con `repStep`, `nextRepTarget`,
      `totalFromPerSide` y `perSideCount`, 13 tests. Enganchado por toda la
      cadena: `suggestProgression` → `suggestNextLoad` /
      `suggestFromLastSession` → `buildLoadAdvice` → `useExerciseAdvice` →
      `SessionExerciseCard`. **Manda el plan, no `exercises.is_bilateral`**: el
      mismo remo se puede programar a una o a dos manos.
- [x] 4.2 «24 (12 por lado)» en la tarjeta de la sesión. El número grande es el
      total porque es lo que se registra; el paréntesis es lo que se cuenta en la
      serie. Un total impar sale con decimal —15 son 7,5 por lado— y con el
      separador del idioma, no con un punto fijo.
- [x] 4.3 Cubierto por un test que recorre **todos** los puntos de partida del
      rango, incluidos los impares, y por los dos caminos del motor: el de
      autorregulación con RIR y el de doble progresión sin él, que es el que
      recorre la mayoría de usuarios.

### Dónde se cruzan las dos convenciones

El plan se escribe **por lado** —«3 × 12 por lado» es lo que se teclea y lo que
se imprime— y lo que se guarda es el **total**. La conversión ocurre en un solo
sitio con nombre propio, `objetivoDeReps` en `routineSessionStore`, y no escrita
en línea: es exactamente el punto donde las dos convenciones se tocan, y donde
un futuro cambio va a mirar primero.

`nextRepTarget` redondea **hacia arriba** al múltiplo del paso en vez de sumar 2.
Así un objetivo que ya venía impar —de una versión anterior, o de un ejercicio
que pasó a ser por lado después— se corrige en la primera subida en vez de
arrastrar el impar para siempre.

## Fase 5 — Superseries

- [x] 5.1 `supersetId?: string` en `RoutineExercise`, con
      `groupPlanExercises` para partir el día en tramos. En el editor se
      encadena **con el anterior** —«esto va seguido de lo de arriba»—, que es
      como se construyen en la práctica, y no eligiendo compañeros de una lista.
      Encadenar tres seguidos los mete a los tres en el mismo grupo sin pasos
      extra, porque el id se hereda.
- [x] 5.2 La sesión pinta el grupo dentro de un marco con su etiqueta, y la
      lista del editor marca las filas encadenadas. `supersetOrder` deja escrito
      y probado el orden de ejecución (A1, B1, A2, B2), incluido el caso de un
      ejercicio con menos series que el resto: **sale del ciclo en vez de
      bloquear la vuelta**, porque 3×A + 2×B es una superserie normal.
- [x] 5.3 **No hay nada que cambiar, y conviene que quede escrito por qué.** La
      sesión de rutina no arranca ningún temporizador de descanso: el único
      arranque automático vive en `WorkoutPage.handleAddSet`, en el entreno
      libre, donde no hay plan y por tanto no hay superserie. No hay descanso
      por ejercicio que suprimir. El día que la sesión de rutina gane su
      temporizador, `groupPlanExercises` ya deja marcado dónde acaba el grupo.
- [x] 5.4 Tres tests sobre el caso real: se hace el press de la superserie, no
      da tiempo a las aperturas y sí a las extensiones. Se guarda lo hecho, con
      una llamada por ejercicio; un guardado «todo o nada» por grupo perdería el
      entreno por la mitad que falta.

### Solo se agrupan ejercicios consecutivos

Dos ejercicios con el mismo `supersetId` separados por un tercero **no** forman
superserie: forman dos grupos de uno. Así, mover una fila rompe el encadenado en
vez de dejar una superserie que salta por encima de otro ejercicio — que es justo
lo contrario de lo que el usuario acaba de decir al mover la fila.

El id viaja también en el fichero compartido, y al importarlo **no se regenera**:
lo que importa es que dos ejercicios del fichero compartan el mismo, y renombrarlo
al leer rompería exactamente eso.

## Verificación final

- [x] V.1 `type-check` 0 errores · `lint` 0 errores (los 5 warnings de
      `notificationsSchedule.test.ts`, previos y ajenos) · **776 tests en 68
      ficheros** · `build` con PWA en verde (118 entradas precacheadas).
- [x] V.2 `audit:contrast` — 104 comprobaciones, 24 acentos × 2 temas, todo en
      verde. Peor caso de texto 4,790:1 en oscuro y 4,824:1 en claro.
- [x] V.3 Recorrido entero en la **APK sobre el emulador** (`emulator-5554`,
      `com.franvi.gymlog.fitbody`). **Encontró cuatro fallos que ni los 776 tests
      ni Playwright habían visto**, y ese es exactamente el motivo de que esta
      comprobación estuviera en la lista. Ver abajo.

### Lo que solo se vio en la APK

**1. El cronómetro sí sobrevive al segundo plano.** Arrancado, 5 s, `HOME`
durante 12 s, vuelta: marcó **0:21**, ni un segundo perdido. Es la propiedad que
no se puede comprobar en el navegador y la razón de derivar el tiempo de marcas
absolutas en vez de un contador.

**2. El modo lo tenía que mandar el dato, no la pantalla.** `loggingMode` vive en
el padre y vuelve a `reps` al reabrir la app. Con una serie de 48 s ya guardada,
la pantalla mostraba «REPS 0» encima de un dato correcto: la lectura mentía. Se
deriva ahora de la propia serie, y cambiar de modo limpia el campo del otro para
que nunca se contradigan. 5 tests.

**3. La validación de la pantalla se había quedado atrás.** `WorkoutPage` tenía
su propio `setSchema` exigiendo `reps > 0`, y descartaba la fila como «en blanco»
antes de validarla. Guardar una plancha respondía «añade al menos una serie
válida» sobre una serie que estaba bien. El store ya lo admitía; la pantalla no.

**4. Y el esquema del store exigía peso.** Con `weight: min(1)`, una plancha sin
lastre —que no lleva peso escrito— se descartaba. No afloja nada quitarlo: una
serie de repeticiones sin peso sigue cayendo en la regla `weight === 0`.

**5. La superserie se creaba a medias.** El editor solo devuelve la fila que se
edita, así que el `supersetId` se escribía en una sola de las dos. Como
`groupPlanExercises` exige que coincidan, el grupo no se pintaba en ningún sitio.
Ahora el id se propaga también a la fila de arriba.

Con los cinco arreglos: la plancha se guarda y llega a la base de datos con
`reps NULL`, `duration_seconds 48`, `total_volume 0` (**no NULL**: el trigger
blindado hizo su trabajo) y **sin inventar ningún récord**. El historial la pinta
«1×48 s · 78.5 kg» y los entrenos anteriores se leen igual que siempre. La
etiqueta SUPERSERIE aparece en la fila encadenada.

**6. Y el scroll del buscador tenía otra causa, la de verdad.** El primer arreglo
—acotar el alto— era necesario pero no suficiente: el desplegable hacía
`preventDefault()` en `touchstart`, que es la forma canónica de **desactivar** el
desplazamiento táctil. El dedo no movía la lista por bien que cupiera. Estaba
puesto para que tocar la lista no le robara el foco al buscador, pero eso ya lo
cubría el retardo de 200 ms del blur en `useExerciseSearch`: sobraba.

Y el alto tampoco estaba bien calculado: `env(safe-area-inset-bottom)` no se puede
leer desde `getComputedStyle`, así que se descontaban los 52 px de la barra pero no
los ~48 de la franja de gestos, y la última fila quedaba tapada. Ahora JS aporta
solo la posición del buscador —lo único que CSS no sabe— y el `max-height` lo
resuelve la hoja de estilos con `100dvh` y `env()`.

Comprobado en la APK: la lista se desplaza con el dedo y se llega hasta «crear
ejercicio propio», entero y por encima de la barra.

- [x] V.4 Comprobado **contra la base de datos real**, no solo con fixtures: las
      6 rutinas guardadas son todas anteriores al cambio —ninguna trae `mode`,
      `perSide` ni `supersetId`— y las 1447 series son todas de repeticiones,
      con 0 filas sin `reps`, 0 entrenos con `total_volume` en NULL y 0 récords
      sin repeticiones. Es exactamente el caso que cubren los tests de
      compatibilidad de `routineStore` y `shareRoutine`.

### La suite e2e

54 pruebas de Playwright en verde, en los dos dispositivos del config. Con el
timeout por defecto salían **8 fallos en el proyecto iPhone 13**, todos
`page.goto` agotando los 30 s en rutas que este cambio no toca (`/login` entre
ellas) y todos pasando en Chromium. Con `--timeout=90000` pasan las 54: es WebKit
tardando en arrancar en este equipo, no una regresión. Queda anotado porque el
patrón —fallos solo en un proyecto, siempre en la navegación, nunca en una
aserción— es fácil de confundir con un fallo real.
