# Diseño — modos de registro

## 1. La decisión central: qué hacer con `reps NOT NULL`

Hoy:

```sql
reps integer NOT NULL CHECK (reps > 0)
CONSTRAINT workout_sets_reps_positive CHECK (reps > 0 AND reps <= 9999)
```

Una plancha de 45 segundos no tiene repeticiones. Hay tres salidas y **no son
equivalentes**; esta es la parte de la propuesta que pide una decisión explícita.

### Opción A — `reps` pasa a admitir NULL

```sql
ALTER TABLE workout_sets ALTER COLUMN reps DROP NOT NULL;
-- y el CHECK pasa a: reps IS NULL OR (reps > 0 AND reps <= 9999)
```

- ✅ Honesto: «esta serie no tiene repeticiones» se dice con un NULL, que es lo
  que un NULL significa.
- ✅ Una versión vieja de la app no puede confundirlo con un cero.
- ❌ **34 ficheros** leen `.reps` como número, y **21 de ellos hacen aritmética**
  con él (`s.reps * s.weight`, `reduce`, medias). Un `null` que se cuele en una
  suma la convierte en `NaN` y el usuario ve «NaN kg» en sus estadísticas. Los 13
  restantes solo lo pintan y son cambios triviales.
- ❌ El tipo generado pasa a `reps: number | null` y el `type-check` señala los
  34 sitios de golpe. Eso es bueno (los enseña todos) y malo (no hay entrega
  parcial posible).

### Opción B — `reps = 1` en las series por tiempo

La serie «ocurrió una vez, durante N segundos».

- ✅ Cero cambios de esquema en `reps`. Los 34 ficheros siguen funcionando.
- ✅ Entregable por partes.
- ❌ **Miente.** Cualquier pantalla que no conozca el modo dirá «1 repetición» de
  una plancha, y el recuento de repeticiones totales de la semana sumará una por
  cada plancha. Es deuda que se paga en cada feature nueva que lea `reps`.
- ❌ El motor de autorregulación vería una serie de 1 repetición y la trataría
  como un single pesado.

### Opción C — tabla aparte para las series por tiempo

- ✅ No toca nada de lo existente.
- ❌ Dos tablas para el mismo concepto: toda consulta de historial pasa a ser un
  `UNION`, y el dedupe del importador, la exportación y la analítica se duplican.
  Es el camino que parece barato hoy y se cobra en cada feature.

### Recomendación: **Opción A**

El coste es real pero es **de una vez** y el `type-check` lo enumera entero. La
opción B no elimina ese trabajo: lo reparte en gotas por cada feature futura que
lea `reps` y tenga que acordarse de preguntar por el modo — con la diferencia de
que ahí no hay compilador que avise.

Para que A sea manejable, la migración va acompañada de un **acceso único**:

```ts
/** Repeticiones de una serie, o null si no las tiene (serie por tiempo). */
export const repsOf = (s: SetLike): number | null => s.reps ?? null;
/** Repeticiones para contar volumen: una serie sin reps no aporta volumen de fuerza. */
export const repsForVolume = (s: SetLike): number => s.reps ?? 0;
```

Los 34 sitios pasan por ahí y cada uno declara qué quiere. Sin eso, el arreglo se
convierte en 34 `?? 0` puestos a ojo, que es exactamente cómo se cuela un fallo.

> **Esta es la decisión que hay que aprobar antes de tocar la migración.**

## 2. Dónde vive el modo

En **dos sitios distintos y por motivos distintos**:

| Sitio                                             | Campo                                                | Migración                     |
| ------------------------------------------------- | ---------------------------------------------------- | ----------------------------- |
| Plan de la rutina (`user_routines.routine`, JSON) | `mode`, `perSide`, `supersetId` en `RoutineExercise` | **No** — la columna es `Json` |
| Serie registrada (`workout_sets`)                 | `duration_seconds` (ya existe)                       | Solo el `reps` de §1          |

El modo **no se guarda en la serie**. Se deriva: una serie con `duration_seconds`
y sin `reps` es por tiempo. Guardar el modo además del dato sería un segundo
sitio donde puede quedar mal, y ya se aprendió esa lección con la fecha del
entreno.

La **ausencia** de `mode` en un plan se lee como `reps`. Ninguna rutina existente
necesita tocarse.

## 3. Repeticiones por lado

No es un modo: es una **bandera sobre el modo**, porque «por lado» es igualmente
cierto de una serie de reps y de una plancha (isométrico a una pierna).

- Se registra **el total**. Una cifra que a veces significa un lado y a veces los
  dos es justo lo que hace ilegible el historial a los seis meses.
- La app deriva la lectura: 16 → «8 por lado». Un total impar se muestra tal cual
  («8,5 por lado»): significa que los lados no fueron iguales, y eso es
  información, no un error de redondeo.
- El paso del objetivo pasa a **2**: 16 → 18 → 20. Un objetivo impar pondría una
  repetición en un lado y no en el otro.

`exercises.is_bilateral` ya existe pero **no sirve tal cual**: es una propiedad
del ejercicio en el catálogo, y aquí hace falta que sea del **ejercicio dentro de
la rutina** (el mismo remo se puede programar a una o a dos manos). Se usa como
**valor por defecto** al añadir el ejercicio al plan, y el plan manda.

## 4. El riesgo: contaminar las estadísticas de fuerza

Es el riesgo principal de todo este cambio. Una serie por tiempo que se cuele en
un cálculo de volumen da un número sin sentido, y peor: **creíble**.

Reglas, en el código y en los tests:

1. **El volumen de fuerza ignora las series sin repeticiones.** `peso × reps` con
   `reps = null` no es cero: es «no aplica».
2. **El 1RM estimado NO se protege solo, aunque lo parezca.** `calcular1RM`
   devuelve **0**, no `null`, ante reps ausente o no finito. Un cero no revienta
   una suma —por eso no hay fallo hoy— pero tampoco se excluye: entra en las
   comparaciones como un valor más y aparece como «0 kg» en cualquier sitio que
   lo pinte sin filtrar. La tarea aquí es **decidir explícitamente** si
   `calcular1RM` pasa a devolver `null` (y entonces vuelve el trabajo de los 34
   sitios, en su versión pequeña) o si el filtrado se hace en cada llamante. Es
   un punto abierto, no un problema resuelto.
3. **El motor de autorregulación** (`autoregulation.ts`, `loadAdvisor.ts`) solo
   mira series de modo `reps`. Una plancha no puede disparar una descarga de
   press banca.
4. **Los PRs por tiempo son su propia categoría**: el récord de una plancha es la
   duración, no el 1RM.

## 5. Superseries

Grupo en el plan (`supersetId` compartido por los ejercicios encadenados), no en
la serie registrada. Lo que cambia al registrar:

- Los ejercicios del grupo se presentan juntos y se recorren en ciclo: serie 1 de
  A, serie 1 de B, descanso; serie 2 de A, serie 2 de B, descanso.
- El temporizador de descanso **se lanza al cerrar el grupo**, no tras cada
  ejercicio.

No hay cambio de esquema: en el historial siguen siendo series de dos ejercicios
del mismo entreno. Si más adelante hace falta reconstruir el emparejado desde el
log, entonces se añadirá la columna — no antes.

## 6. El cronómetro de trabajo

Store propio, **separado de `restTimerStore`**. Comparten forma pero no estado:
el de descanso corre entre series y el de trabajo durante la serie, y en una
superserie por tiempo pueden solaparse. Un store compartido con un flag «ahora
soy el otro» es la vía rápida a que una plancha se salde con el aviso de descanso
sonando a mitad.

Se reutiliza `useVisibilityPausedInterval`, que ya resuelve la parte difícil (el
WebView de Android no siempre dispara `visibilitychange`).

## 7. Qué NO se hace aquí

- **Progresión automática en modo `time`.** Sin historial de series por tiempo no
  hay nada que medir. Se hará cuando lo haya.
- **Peso corporal como categoría de primera.** Ya está: `load_type` con sus tres
  valores y `workout/utils/bodyweight.ts`. El plan original lo listaba por error.
- **Distancia.** Cardio ya tiene su feature con su propio store; meter distancia
  en `workout_sets` sería duplicarla.
