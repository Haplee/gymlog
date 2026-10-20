## Why

Los avisos de GymLog funcionan, pero están **congelados en horas que decidió el código, no el usuario**: rutina a las 18:30, racha a las 20:00 y resumen los lunes a las 09:00 son constantes de módulo en `src/shared/lib/notifications.ts:45-55`. Quien entrena a las siete de la mañana recibe el recordatorio once horas tarde, y no tiene dónde cambiarlo.

Alrededor de eso hay tres carencias más, todas verificadas leyendo el código:

- **El historial no lleva a ninguna parte.** `NotificationItem` guarda `{ id, title, body, at, read }` y nada más (`notificationsStore.ts:4-11`). Sin tipo y sin URL, la pantalla no puede filtrar, no puede agrupar y tocar un aviso no abre lo que ese aviso anuncia. Se marca todo leído al entrar y se acabó.
- **Hay un solo widget.** `StreakWidgetProvider` muestra racha y último entreno. Todo lo demás que el usuario querría de un vistazo —qué toca hoy, cómo va la semana— exige abrir la app.
- **Conviven dos mecanismos de programación.** El recordatorio de rutina usa `at` + `every: 'week'`; el resumen semanal usa `on: { weekday, hour, minute }`. Nadie ha medido si el primero se desplaza una hora tras el cambio de hora del 25-oct-2026. Hacer las horas configurables sin resolver esto multiplica la duda por tres.

## What Changes

- **Las tres horas pasan a ser del usuario.** Nueva sección en Ajustes → Preferencias con la hora de rutina, la de racha y el día+hora del resumen. Los valores actuales quedan como defecto, así que quien no toque nada no nota el cambio. La reprogramación pasa por `reconcileReminders`, que ya está serializada.
- **Un solo mecanismo de programación.** Se unifica en `on: { weekday, hour, minute }`, que es el que no depende de calcular una fecha absoluta y por tanto no arrastra la duda del cambio de hora. Se aprovecha que hay que tocar la programación de todos modos.
- **El historial gana `type` y `url`.** `NotificationItem` se amplía con la categoría del aviso y su destino, con migración de la clave persistida `gymlog-notifications`. Con eso la pantalla filtra por tipo, agrupa por día, permite borrar uno solo y navega al tocar.
- **Acciones en la notificación de rutina:** «Empezar» abre el entreno del día; «Posponer 1 h» reprograma esa única instancia sin tocar la recurrencia semanal.
- **Aviso nuevo de PR** al cerrar un entreno en el que se haya batido un récord.
- **Modo silencio:** un rango horario en el que no se dispara nada.
- **Un widget nuevo, no cuatro:** «Entreno de hoy» (4x2), con el día de la rutina y un botón que abre la sesión. Es el único de los cuatro propuestos que aporta algo que no da ya el atajo del lanzador.
- **Los widgets dejan de mentir.** Hoy los datos solo se refrescan cuando el usuario abre la app: al cruzar medianoche, «Entreno de hoy» mostraría el día anterior. Se resuelve con recálculo en el propio dispositivo al cambiar el día (`ACTION_DATE_CHANGED`) y, mientras el dato dependa del servidor, con una marca «actualizado a las HH:MM» visible en el widget.
- **Degradación honesta sin permisos:** si el sistema deniega alarmas exactas o `POST_NOTIFICATIONS`, se dice en Ajustes con su motivo, en vez de fallar en silencio.

## Capabilities

### New Capabilities

- `reminder-schedule-preferences`: horas de aviso elegidas por el usuario, persistidas y reconciliadas con lo que hay programado en el sistema operativo.
- `notification-history-typed`: historial con categoría y destino, filtrable, agrupado por día y navegable.
- `today-workout-widget`: widget de pantalla de inicio con el entreno del día, con frescura de dato explícita.

## Impact

- **Código:** `src/shared/lib/notifications.ts` (constantes → configuración, unificación de `schedule`), `src/shared/lib/reminderReconcile.ts`, `src/shared/stores/notificationsStore.ts` (+ migración), `src/shared/stores/settingsStore.ts`, `src/features/auth/pages/{NotificationsPage,SettingsPage}.tsx`, `src/shared/lib/widget.ts`, i18n (es).
- **Nativo:** `WidgetBridgePlugin.kt` (contrato de datos ampliado + marca de frescura), nuevo `TodayWidgetProvider.kt` con su layout y su `appwidget-provider` info, `AndroidManifest.xml`. `StreakWidgetProvider` se deja como está: el provider base común se extrae cuando existan dos widgets reales, no antes.
- **Sin cambios de esquema BD.** No se toca `database.types.ts` ni se añaden dependencias.
- **Tests:** programación de horarios con horas arbitrarias, migración del store persistido, y el cálculo de los datos que alimentan cada widget.

## Non-goals

- **Encender el push remoto.** Sigue tras `VITE_PUSH_ENABLED` y exige `google-services.json`; va en su propio trabajo.
- **Widgets de iOS.** Serían WidgetKit + Swift, otra superficie entera.
- **Subir `targetSdk` a Android 17**, aunque el dispositivo de pruebas vaya en su beta.
- Rediseñar la pantalla de ajustes más allá de la sección nueva.
- **Acciones «Empezar» / «Posponer 1 h»**: exigen ciclo de vida nativo y pruebas con el proceso muerto; van en una segunda entrega.
- **Widget de consistencia (heatmap) y atajo 1x1**: el primero es ilegible en `RemoteViews` a los tamaños que garantiza un lanzador, el segundo duplica el FAB y el atajo del lanzador.
- **Widget de volumen semanal**: necesita definir semana, unidad y datos incompletos, y un refresco fiable que hoy no existe.
