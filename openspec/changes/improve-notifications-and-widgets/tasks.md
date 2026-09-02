## 1. Base segura (sin tocar todavía lo que suena)

- [ ] 1.1 Modelo de ajustes de horarios en `settingsStore` (rutina, racha, resumen), con los valores actuales como defecto.
- [ ] 1.2 `version` + `migrate` en `notificationsStore`; los items viejos pasan a `type: 'generic'`.
- [ ] 1.3 Tests de la migración y de la programación con horas arbitrarias (incluido 00:00 y 23:59).

## 2. Unificar la programación

- [ ] 2.1 Pasar el recordatorio de rutina de `at` + `every: 'week'` a `on: { weekday, hour, minute }`.
- [ ] 2.2 Disparar la reconciliación también al actualizar la app, no solo al guardar ajustes.
- [ ] 2.3 Medir el cambio de hora con el reloj adelantado y `dumpsys alarm`. **Si se desplaza, parar y replantear.**

## 3. Historial utilizable

- [ ] 3.1 `type` y `url` en `NotificationItem`; rellenarlos en todos los emisores.
- [ ] 3.2 Pantalla: agrupar por día, filtrar por tipo, borrar uno solo, navegar al tocar.

## 4. Silencio y aviso de PR

- [ ] 4.1 Rango horario de silencio, aplicado en el punto de emisión.
- [ ] 4.2 Aviso de récord batido al cerrar un entreno.

## 5. Widget «Entreno de hoy»

- [ ] 5.1 Ampliar el contrato de `WidgetBridge` con el día de rutina y la marca de frescura.
- [ ] 5.2 `TodayWidgetProvider` + layout + `appwidget-provider` info + manifiesto.
- [ ] 5.3 `ACTION_DATE_CHANGED` para reevaluar el día sin abrir la app.
- [ ] 5.4 Estados: sin rutina, día de descanso, ya entrenado.

## 6. Degradación honesta

- [ ] 6.1 Estado real de permisos en Ajustes: si Android no va a poder mostrarlo, no decir que está activo.

## 7. Verificación

- [ ] 7.1 `npm run lint && npm run type-check && npm run test`.
- [ ] 7.2 APK en el teléfono (Android 17 beta): cerrada, tras reinicio, tras force-stop, permiso revocado.
- [ ] 7.3 Repetir en emulador con API estable.
- [ ] 7.4 Widget en todos los tamaños del lanzador, dos temas, fuente grande, nombre de rutina largo.
