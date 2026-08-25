## Why

GymLog solo sabe registrar **peso × repeticiones**. Todo lo que no encaja ahí no
tiene dónde ir:

- Una **plancha** o un **paseo del granjero** se miden en segundos, no en reps.
- Un **remo a una mano** son 8 por lado, y hoy se apunta «16» sin que nadie sepa
  si son 16 en total u 8 y 8.
- Una **superserie** se registra como dos ejercicios sueltos, con su descanso
  cada uno, cuando lo que se hizo fue encadenarlos y descansar al final.

Es el hueco que la comparativa con openGym (`docs/comparativa-opengym.md`)
identificó como la diferencia real de mecánica. No es cosmético: mientras el
único registro posible sea peso × reps, media sesión de accesorios se apunta mal
o no se apunta.

**Y es la única fase del plan que toca el esquema**, por eso va con propuesta
antes de escribir código.

## Lo que ya existe (y cambia el tamaño del trabajo)

Al investigar el esquema real, tres suposiciones del plan original resultaron
falsas. El trabajo es **menor** de lo estimado:

| Suposición del plan                         | Realidad                                                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Hay que añadir una columna para la duración | `workout_sets.duration_seconds` **ya existe** (migración `20260101`), con `CHECK >= 0`. Está **latente**: no la escribe ni la lee nadie |
| Hay que modelar lo unilateral               | `exercises.is_bilateral` **ya existe**. Solo se escribe con `true` fijo en dos sitios del importador; nadie la lee                      |
| Las rutinas necesitan migración             | `user_routines.routine` es una **columna `Json`**. Añadir campos al plan es solo TypeScript                                             |

El bloqueo real es otro y no estaba en el plan:

```sql
reps integer NOT NULL CHECK (reps > 0)
CONSTRAINT workout_sets_reps_positive CHECK (reps > 0 AND reps <= 9999)
```

**Una plancha no tiene repeticiones.** Esa restricción es la que impide registrar
una serie por tiempo, y relajarla toca **34 ficheros** que leen `.reps` asumiendo
que es un número. Cómo resolverlo es la decisión central de esta propuesta y
está en `design.md`.

## What Changes

Cuatro capacidades, cada una desplegable por separado y en este orden:

- **Modo de registro por ejercicio** — `reps` (lo de siempre) · `time` (segundos)
  · `cardio` (ya cubierto por su propia feature, aquí solo se reconoce). Vive en
  el plan de la rutina (JSON, sin migración) y en la serie registrada. La
  **ausencia del campo se lee como `reps`**, así que ni un solo dato existente
  necesita migrarse.
- **Ejercicios por tiempo** — cronómetro de trabajo, distinto del de descanso, y
  la duración guardada en la columna que ya existe. Pueden llevar peso (paseo del
  granjero, plancha lastrada).
- **Repeticiones por lado** — bandera sobre el modo, no un modo nuevo. Se registra
  **el total**; la app deriva «8 por lado» y el objetivo sube de dos en dos para
  que nunca quede impar.
- **Superseries** — agrupación en la rutina y descanso solo al final del grupo.

Fuera de alcance en esta propuesta, aunque el plan las mencionaba: el motor de
progresión para modo `time` (se hará cuando haya historial que medir) y el peso
corporal como categoría de primera, **que ya está cubierto** por `load_type` +
`workout/utils/bodyweight.ts`.

## Impact

- **Esquema:** una migración idempotente sobre `workout_sets` y una revisión de
  las dos RPC (`save_workout_with_sets`, `get_workouts_with_sets`). Detalle y
  alternativas en `design.md`.
- **Datos existentes:** cero migración de filas. Todo lo registrado hasta hoy es
  modo `reps` por ausencia del campo.
- **Código:** `routineStore` (tipos), `RoutineSession` y `SessionExerciseCard`
  (UI de registro), `WorkoutSetList`, un store nuevo para el cronómetro de
  trabajo, y los cálculos de volumen y analítica que hoy multiplican peso × reps
  sin preguntar de qué tipo es la serie.
- **Riesgo principal:** que una serie por tiempo se cuele en las medias de volumen
  y ensucie las estadísticas de fuerza. Mitigación en `design.md` §4.
- **Compatibilidad:** una versión vieja de la app leyendo una serie por tiempo
  debe verla como algo sin repeticiones, no como un cero. Es parte de por qué la
  decisión de `reps` importa.
