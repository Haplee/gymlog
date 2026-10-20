## Decisiones

### 1. Un solo mecanismo de programación: `on: { weekday, hour, minute }`

Hoy conviven dos. El recordatorio de rutina calcula una fecha absoluta y la repite
(`at` + `every: 'week'`); el resumen semanal declara la intención civil
(`on: { weekday: 2, hour: 9, minute: 0 }`).

Se unifica en `on` porque expresa lo que el usuario quiere decir —«todos los martes a
las nueve»— en vez de un instante concreto que hay que recalcular. Una fecha absoluta
arrastra la duda del cambio de hora; una intención civil, no.

**Consecuencia sobre lo ya programado:** cambiar las constantes en el código **no**
toca las alarmas que Android ya tiene inscritas. Seguirían sonando a la hora vieja
hasta que se cancelen por id y se reprogramen. Por eso la reconciliación tiene que
dispararse también **al actualizar la app**, no solo al guardar ajustes. Los ids
fijos de `NOTIF_IDS` son el contrato con el sistema operativo: se conservan tal cual,
y el cancel+schedule va dentro de la operación ya serializada de
`reconcileReminders`, nunca por fuera.

### 2. Cómo cerrar la duda del cambio de hora sin esperar a octubre

Zona `Europe/Madrid`, programar los avisos, adelantar el reloj del dispositivo al
24-26 de octubre de 2026 y comprobar con `adb shell dumpsys alarm` la hora efectiva
antes y después del salto. Repetir con el salto de marzo.

**Trampa conocida:** adelantar el reloj del emulador invalida el token de Supabase y
saca la app al login, y no vuelve sola. Hay que contar con ello en el guion de la
prueba —volver a entrar, o medir con las alarmas ya programadas antes de mover el
reloj— o la medición se pierde a mitad.

Si la medición confirma que `on` no se desplaza, esta decisión queda cerrada y
documentada. Si se desplaza, el trabajo se para y se replantea: no tiene sentido
ofrecer horas configurables sobre una base que se mueve sola dos veces al año.

### 3. Migración del historial: `version` + `migrate`

`gymlog-notifications` está persistido sin versión. Los items antiguos no tienen
`type` ni `url`. La migración les asigna `type: 'generic'` y `url: undefined`, que
son valores que la pantalla sabe pintar. Sin esto, un filtro nuevo escondería
historial existente en vez de mostrarlo sin categoría.

### 4. Los widgets no pueden mentir

Este es el motivo de que el alcance de widgets se recorte a uno.

El puente actual es unidireccional y perezoso: la web escribe en SharedPreferences
**solo cuando el usuario abre la app**. Un widget alimentado así no muestra el
estado actual, muestra el último estado conocido. Para la racha eso pasa
desapercibido; para «Entreno de hoy» no: al cruzar medianoche mostraría el día
anterior, y el usuario no tiene forma de saber que está viendo algo caducado.

Dos medidas, en este orden:

1. **Recalcular en el dispositivo lo que se puede recalcular.** El día de la semana
   no necesita servidor: el provider se suscribe a `ACTION_DATE_CHANGED` y reevalúa
   qué toca hoy con la rutina que ya tiene guardada.
2. **Decir la verdad sobre lo que no se puede.** Lo que dependa del servidor lleva
   una marca de frescura visible («actualizado a las 08:12»). Es preferible un dato
   con fecha a un dato falso sin ella.

`WorkManager` con sincronización en segundo plano resolvería el caso general, pero
entra en doze, cuotas y fabricantes que matan procesos: es un trabajo propio, no un
apéndice de este.

### 5. El provider base común se extrae después, no antes

Abstraer `StreakWidgetProvider` a una base común mientras solo hay un widget fija una
jerarquía inventada. Se hacen los dos widgets primero y la base sale de lo que de
verdad comparten.

## Verificación exigida antes de dar esto por terminado

Vitest no ve nada de lo que de verdad falla aquí. Hace falta, en dispositivo:

- App cerrada, tras reinicio y tras `force-stop`: que los avisos sigan programados.
- Permiso revocado **después** de programar: que la app no siga diciendo que el
  recordatorio está activo.
- Alarma exacta denegada (es lo que Android concede por defecto a una app que no es
  de alarmas ni calendario): que degrade y lo diga.
- El widget en todos los tamaños que permita el lanzador, en tema claro y oscuro,
  con fuente grande y con el nombre de rutina más largo que exista.

El teléfono en la beta de Android 17 sirve para **detectar regresiones, no para
certificar producción**: la app va con `targetSdk` 36 y por tanto en modo
compatibilidad. Todo lo anterior se repite en una API estable.
