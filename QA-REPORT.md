# QA-REPORT — GymLog (Android, emulador)

> **ESTADO: los 12 hallazgos están corregidos y publicados en la v5.0.0** (2026-07-16).
> `lint` + `type-check` + `test` (208 tests, 27 ficheros) en verde. Los arreglos de QA-01,
> QA-04, QA-06, QA-07, QA-08, QA-09 y QA-10 se han **verificado en el emulador** con un APK
> recompilado, y la v5.0.0 firmada se ha instalado y arrancado en un Pixel 9a real.
> Ver "Estado de los arreglos" al final.

**Fecha:** 2026-07-16 (actualizado tras la 2ª pasada)
**Build:** `app-debug.apk` compilado desde el working tree (incluye cambios **sin commitear** de notificaciones)
**Dispositivo:** emulador `emulator-5554`, `sdk_gphone64_x86_64`, Android 16 (targetSdk 36), 1080x2424, densidad 420 (factor 2.625 → 44dp = 115,5px)
**Cuenta:** `vonafo7343@besteya.com` (usuario nuevo, estado vacío)
**Método:** conducción manual vía MobAI CLI + adb, como usuario común. Evidencia en capturas y en `dumpsys`.

---

## Resumen ejecutivo

| Severidad | Nº  |
| --------- | --- |
| Crítico   | 0   |
| Alto      | 1   |
| Medio     | 5   |
| Bajo      | 6   |

**Veredicto: releasable con reservas.** No se encontró ninguna pérdida de datos ni crash. El flujo troncal
(login → registrar ejercicio → series → persistencia en historial) funciona, el **outbox offline funciona
end-to-end**, y el temporizador de cardio sobrevive al segundo plano.

La 2ª pasada (notificaciones, `/stats`, `/user-stats`, offline, rotación, botón atrás) añadió **5 hallazgos
nuevos**, cuatro de ellos Medio. Los dos más relevantes por impacto en la confianza del usuario:

- **QA-07**: la sección "Recuperación" dice que un músculo entrenado **hoy** está **"Recuperado"** (en verde,
  con la barra de recuperación a 0%). Es un consejo de entrenamiento invertido, en una app de entrenamiento.
- **QA-10**: el toggle **"Recordatorios de entreno" no está conectado a nada**. Apagarlo no cancela ningún
  recordatorio.

---

## Hallazgos

### QA-01 · Alto · UI/UX · La status bar es ilegible cuando el sistema está en modo claro

**Pantalla:** todas (global).

**Pasos de reproducción:**

1. Poner el sistema Android en modo claro (`adb shell cmd uimode night no`) — es el estado por defecto.
2. Abrir GymLog, con cualquier tema de la app (OSCURO o CLARO).
3. Mirar la barra de estado.

**Esperado:** reloj, wifi y batería legibles, y fondo coherente con el tema de la app.
**Real:** el fondo de la barra se pinta claro y los iconos siguen forzados a **blanco** → reloj, wifi y
batería prácticamente invisibles. Ocurre **con la app en oscuro y también con la app en claro**.

**Causa raíz — CORREGIDA al arreglarlo.** Mi diagnóstico inicial (abajo, tachado) era **incorrecto en el
mecanismo**, aunque acertaba en el culpable final (`DayNight`). El mecanismo real, leyendo el código de los
plugins:

1. `SystemBars.java` de `@capacitor/android` decide si el WebView va edge-to-edge:
   ```java
   shouldPassthroughInsets = getWebViewMajorVersion() >= 140 && hasViewportCover;
   // si es false, en Android 15+:
   v.setPadding(systemBarsInsets.left, systemBarsInsets.top, ...);  // ← empuja el WebView a y=142
   ```
   `index.html` **sí** tiene `viewport-fit=cover`, pero **el WebView del emulador es la versión 133** (<140),
   así que Capacitor mete padding y el WebView arranca en `y=142`. Esa franja no la pinta la web.
2. Esa franja la pinta el `decorView`, y `SystemBars.setStyle()` lo hace explícitamente con el
   `windowBackground` del tema nativo:
   ```java
   decorView.setBackgroundColor(getThemeColor(context, android.R.attr.windowBackground));
   ```
   Con `Theme.AppCompat.DayNight`, ese `windowBackground` es **blanco** cuando el sistema está en claro.
3. Encima, `@capacitor/status-bar` fuerza los iconos a blancos. Blanco sobre blanco.
4. `settingsStore.applyTheme()` **sí** llama a `StatusBar.setBackgroundColor()`, pero en Android 16 es un
   **no-op**: `StatusBar.java` → `shouldSetStatusBarColor()` devuelve `false` sin condiciones para
   `deviceApi > VANILLA_ICE_CREAM`. Ni siquiera el opt-out de edge-to-edge lo salva.

~~`overlaysWebView: true` no se está aplicando~~ → no era eso: el inset lo mete el `SystemBars` de Capacitor,
no el plugin de StatusBar.

**Nota de alcance:** al depender de la versión del WebView (<140), es probable que en un móvil real con
WebView moderno el bug **no se reproduzca**. No he podido comprobarlo en un dispositivo físico.

**Matriz de evidencia:**

| Sistema | Tema app | Barra  | Iconos  | Resultado                                | Captura                      |
| ------- | -------- | ------ | ------- | ---------------------------------------- | ---------------------------- |
| Claro   | Oscuro   | Clara  | Blancos | **Ilegible**                             | `01-login.jpeg`              |
| Claro   | Claro    | Clara  | Blancos | **Ilegible**                             | `10-app-light-sys-light.png` |
| Oscuro  | Oscuro   | Oscura | Blancos | OK                                       | `04-login-dark-ok.jpeg`      |
| Oscuro  | Claro    | Oscura | Blancos | Legible, pero desentona con la app clara | `09-theme-claro.jpeg`        |

**Corregido así (verificado en el emulador):**

- `styles.xml`: `AppTheme.NoActionBar` deja de heredar de `DayNight` → `Theme.AppCompat.NoActionBar`, con
  `android:windowBackground` explícito (`@color/appBackground` = `#0A0A0B`) y `statusBarColor` transparente.
  El fondo deja de seguir al sistema.
- `capacitor.config.ts`: `SystemBars: { insetsHandling: 'disable' }` → Capacitor deja de meter padding y el
  WebView va de verdad edge-to-edge, así que **la franja la pinta la propia web** y sigue al tema de la app.
  Es seguro porque `MainActivity.kt` ya hace `setDecorFitsSystemWindows(false)` y publica `--inset-*` con los
  px reales de las barras (la app no depende de `env(safe-area-inset-*)`, que es justo lo que está roto en
  WebView <140).
- `capacitor.config.ts`: se quita `StatusBar.backgroundColor` (no-op en Android 16, inducía a error).

**Verificado:** con el sistema en **claro** y la app en **oscuro** (el combo roto), la barra sale oscura y el
reloj blanco, legible. El WebView ahora llega a `y=0`. Ver `fix-qa01-a.png`.

---

### QA-07 · Medio · Lógica/UX · "Recuperación" está invertida: un músculo entrenado hoy sale como "Recuperado"

**Pantallas:** `/stats` (tarjeta "Recuperación") y `/user-stats` (sección "Estado de recuperación").

**Pasos de reproducción:**

1. Registrar un entreno de Pecho hoy.
2. Abrir `/stats` → tarjeta "Recuperación".

**Esperado:** un músculo entrenado hace unas horas debería aparecer como fatigado / no recuperado.
**Real:** aparece **"Pecho ✓ Recuperado"** en verde, junto a **"Hoy"** y con la barra de recuperación
**completamente vacía (0%)**. Las dos mitades de la misma fila se contradicen. En `/user-stats` el mismo
músculo sale como **"hace 0d · Descansado"**, también en verde.

**Causa raíz:** el modelo interno mide **recencia de entrenamiento**, no recuperación, pero la capa de
presentación lo traduce a vocabulario de recuperación **invertido**.

- `src/features/stats/utils/fatigueAnalysis.ts:53` → `daysSince <= 2` ⇒ `status = 'fresh'`.
- `src/features/stats/components/FatigueAnalysis.tsx:20-26` → `'fresh'` se pinta con etiqueta
  **`'Recuperado'`**, `CheckCircle2` y `var(--success)`.
- `src/features/stats/pages/UserStatsPage.tsx:660-662` → `'fresh'` se pinta con
  `t('userStats.recovery_rested')` (**"Descansado"**) y `var(--success)`.

Que el modelo es de _recencia_ y no de recuperación se ve en el propio código:
`getSuggestedMuscleGroup()` (`fatigueAnalysis.ts:63-69`) devuelve los `needs-attention` como sugerencia de
**qué entrenar hoy**, y el bloque de sugerencia los rotula _"Grupo muscular recuperado"_
(`FatigueAnalysis.tsx:184`). Es decir, `needs-attention` = recuperado, mientras que la fila de arriba dice que
`fresh` = "Recuperado". Ambas cosas no pueden ser ciertas.

Además, en la misma fila, la barra usa `getRecoveryPercentage = daysSinceLast / 7 * 100`
(`FatigueAnalysis.tsx:51-55`), que **sí** es el modelo fisiológico correcto (0 días ⇒ 0% recuperado). Por eso
la barra y la etiqueta se contradicen visualmente.

**Por qué los tests no lo pillan:** `fatigueAnalysis.test.ts` solo comprueba los nombres internos de estado
(`fresh` para hace 1 día, `needs-attention` para hace 6). Nunca toca el mapeo a etiquetas, que es donde está
el fallo. Los tests pasan con el bug presente.

**Corrección sugerida:** decidir qué comunica el panel. Si es recuperación, invertir el mapeo
(`needs-attention` → "Recuperado", `fresh` → "En recuperación"/"Fatigado") y renombrar los estados para que
digan lo que significan (`recently-trained` / `ready`). Si es recencia, renombrar el panel y las etiquetas y
quitar la barra de "recovery %".

**Evidencia:** `stats3.png` (fila "Pecho · ✓ Recuperado · Hoy" con la barra a 0%), `us2.png`
("Pecho · hace 0d · Descansado").

---

### QA-08 · Medio · Datos/UI · "Volumen total" muestra `1t` en una pantalla y `0.6t` en otra (mismo dato)

**Pantallas:** `/user-stats` (KPI "Volumen total") vs `/stats` (KPI "Volumen total").

**Pasos de reproducción:**

1. Con un único entreno de 600 kg de volumen (10 reps × 60 kg), abrir `/stats` → "Volumen total" = **0.6t**.
2. Abrir `/user-stats` → "Volumen total" = **1t**.

**Real:** el mismo dato, con dos valores distintos. Peor: la contradicción está **dentro de la misma
pantalla** — en `/user-stats` el KPI de cabecera dice **1t** mientras que, más abajo, "Distribución por grupo
muscular" dice **Pecho 0.6t (100%)** y "Top ejercicios por volumen" dice **Press banca 0.6t**.

**Causa raíz** — redondeo inconsistente:

```js
// src/features/stats/pages/UserStatsPage.tsx:439   → 600/1000 = 0.6 → "1t"
value={`${(totalVolumeAllTime / 1000).toFixed(0)}t`}

// src/features/stats/pages/StatsPage.tsx:462       → 600/1000 = 0.6 → "0.6t"
value={`${(allTimeVolume / 1000).toFixed(1)}t`}
```

`toFixed(0)` es el caso raro: **todos** los demás volúmenes de ambos ficheros usan `toFixed(1)`
(`StatsPage.tsx:434,748`, `UserStatsPage.tsx:597,625`). Parece un typo, no una decisión.

**Impacto:** afecta a cualquier usuario por debajo de ~1,5t de volumen total, es decir, justo a los usuarios
nuevos que abren "Mis Estadísticas" para ver su progreso. Por debajo de 500 kg el KPI muestra **"0t"** — le
dice al usuario que no ha levantado nada.

**Corrección sugerida:** cambiar `toFixed(0)` → `toFixed(1)` en `UserStatsPage.tsx:439`. Idealmente extraer un
`formatVolume()` compartido para que esto no pueda volver a divergir.

**Evidencia:** `us1.png` (KPI "1t"), `us2.png` (misma página: "0.6t" dos veces), `stats1.png` (`/stats`: "0.6t").

---

### QA-09 · Medio · Notificaciones · La notificación del temporizador de descanso llega ~19s tarde

**Pantalla:** `/` (WorkoutPage) → DESCANSO, con la app en segundo plano.

**Pasos de reproducción (medidos con reloj del dispositivo):**

1. `10:53:59` — pulsar el preset **60s** y mandar la app a background **en el mismo comando** (sin hueco).
2. La alarma se programa correctamente para `10:55:00.920` (60s + 1,5s de gracia). Verificado en `dumpsys alarm`.
3. `10:55:04` — la hora objetivo **ya ha pasado** y la alarma **sigue pendiente, sin entregar**.
4. `10:55:20` — llega la notificación.

**Esperado:** la notificación llega al terminar el descanso (±1-2s).
**Real:** llegó **~19 segundos tarde**. Para una serie de 60s eso es un 32% de desviación: el usuario ya ha
empezado la siguiente serie, o cree que el aviso no va a llegar.

**Causa raíz:** la alarma se programa como **inexacta**. En `dumpsys alarm`, la alarma de GymLog sale con
`window=+46s28ms` y `maxWhenElapsed=+1m39s386ms`, y **sin** `exactAllowReason` — mientras que otras alarmas
del sistema en el mismo volcado salen con `window=0 exactAllowReason=policy_permission`.

- `src/shared/lib/notifications.ts:244` solo pasa `allowWhileIdle: true`:
  ```js
  schedule: { at: new Date(endAtMs + TIMER_FOREGROUND_GRACE_MS), allowWhileIdle: true },
  ```
  `allowWhileIdle` permite disparar en Doze, pero **no** hace la alarma exacta.
- `AndroidManifest.xml` declara `SCHEDULE_EXACT_ALARM`, pero con `targetSdk=36` Android **ya no lo concede
  automáticamente**: `adb shell cmd appops get com.franvi.gymlog SCHEDULE_EXACT_ALARM` → `Default mode: default`
  (no concedido).
- La app **nunca** pide el permiso: `checkExactNotificationSetting` / `changeExactNotificationSetting` (la API
  de Capacitor para esto) **no aparecen en ningún sitio del código**.

**Nota:** el comentario de `notifications.ts:220` afirma _"Alarma **exacta** programada al endTime"_. No lo es.

**Corrección sugerida:** llamar a `checkExactNotificationSetting()` y, si no está concedido, ofrecer
`changeExactNotificationSetting()` (abre los ajustes de "Alarmas y recordatorios") la primera vez que se usa
el temporizador. Alternativa: `USE_EXACT_ALARM` (se autoconcede, pero Google Play exige justificar que la app
es de alarmas/temporizadores — defendible aquí). Y corregir el comentario.

**Lo que sí funciona en este flujo (verificado):**

- La notificación de background **llega**, con copy correcto: _"Descanso terminado / Siguiente serie.
  ¡A por ella! 💪"_.
- El cambio **sin commitear** `smallIcon: 'ic_stat_notify'` **funciona**: el icono se renderiza como glifo
  monocromo limpio en el círculo verde del acento, no como el cuadrado blanco que daba `smallIcon: 'icon'`.
- Al volver a foreground reaparece el banner in-app "¡Descanso terminado!" con DETENER.
- **DETENER retira también la notificación del sistema** (`dismissAlarm` → `cancelTimerNotification`, 0
  registros tras pulsarlo).
- Si el descanso termina con la app en **foreground**, no sale notificación del sistema: es **intencionado**
  (`restTimerStore.complete()` cancela la notificación y suena la alarma in-app).

**Evidencia:** `shade.png`.

---

### QA-10 · Medio · Notificaciones · El toggle "Recordatorios de entreno" no está conectado a nada

**Pantalla:** `/settings` → Entrenamiento → "Recordatorios de entreno".

**Real:** el toggle se pinta y guarda su estado, pero **ningún código de programación de alarmas lo lee**.
Apagarlo **no cancela** los recordatorios de rutina: seguirán sonando.

**Causa raíz:** `trainingReminders` existe en **exactamente dos ficheros** — el store que lo define y la fila
que lo pinta:

```
src/shared/stores/settingsStore.ts:16,46,68   ← define, default `true`, setter
src/features/auth/pages/SettingsPage.tsx:91,528 ← lee para pintar el Toggle
```

`reminderReconcile.ts` (`reconcileReminders` / `getReminderDays`) y `notifications.ts`
(`syncRoutineReminders`, `scheduleStreakReminder`) **no importan `settingsStore` ni consultan
`trainingReminders` en ningún punto**. El único gate real es el permiso del SO (`canNotifyAsync`) y el toggle
global de "Notificaciones".

**Impacto:** un usuario que quiera silenciar solo los recordatorios de rutina —sin renunciar al resto de
notificaciones— no puede: el control existe, parece funcionar, y no hace nada. Es la peor variante del fallo,
porque no hay forma de descubrirlo salvo esperar a que llegue el aviso.

**Corrección sugerida:** que `reconcileReminders()` consulte `useSettingsStore.getState().trainingReminders` y
pase `[]` a `syncRoutineReminders` cuando esté desactivado; y llamar a `reconcileReminders()` desde
`setTrainingReminders` para que el cambio se aplique al instante.

---

### QA-02 · Medio · Validación/UX · El peso corporal inválido se rechaza en silencio

**Pantalla:** `/` (WorkoutPage) — tarjeta "¿Cuánto pesas esta semana?".

**Pasos de reproducción:**

1. Con la tarjeta visible, escribir `-50` en el campo kg.
2. Pulsar "Guardar".

**Esperado:** un mensaje de error explicando que el peso debe ser positivo (o que el campo no acepte el signo).
**Real:** no ocurre **absolutamente nada**. La tarjeta no se cierra, el valor sigue ahí y no aparece ningún
error. El usuario no tiene forma de saber por qué no se guarda.

**Demostrado por contraste:** con `75` la tarjeta guarda y desaparece; con `-50` el botón no hace nada.

**Causa raíz** — `src/features/workout/components/WeeklyWeightPrompt.tsx:59-63`:

```js
const submit = () => {
  const kg = parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(kg) || kg <= 0 || kg >= 500) return; // ← salida muda, sin estado de error
  saveMutation.mutate(kg);
};
```

El guard hace `return` sin fijar ningún estado de error ni feedback. Afecta igual a `0`, a valores `>= 500`
y a texto no numérico.

**Corrección sugerida:** añadir un estado de error y renderizarlo bajo el input, o añadir `min`/`max` al
`<input type="number">` y reflejar el mensaje de validación.

---

### QA-11 · Bajo · UI/UX · En horizontal la app queda inutilizable (contenido tapado por la barra inferior)

**Pantalla:** todas. Reproducido en `/history` y `/`.

**Pasos de reproducción:**

1. `adb shell settings put system user_rotation 1` (o girar el dispositivo).

**Real:** la app **no está bloqueada en vertical**, pero el layout no se adapta: la cabecera conserva su altura
de vertical (~230px de 1080) y la barra de navegación inferior (~210px) se **superpone al contenido**. Queda
una franja util de ~60px y la primera tarjeta de la lista aparece cortada por debajo de la barra.

**Contexto:** `AndroidManifest.xml` declara
`android:configChanges="orientation|screenSize|..."`, así que la actividad no se recrea — el WebView
simplemente se reflowa a un viewport que el CSS no contempla. `CLAUDE.md` dice "mobile-first, probar a ~390px
de ancho", así que horizontal nunca fue un objetivo; el problema es que **se permite** entrar en un estado roto
en vez de bloquearlo.

**Corrección sugerida:** lo más barato es bloquear a `portrait` (`android:screenOrientation="portrait"` en
`MainActivity`, o `ScreenOrientation` de Capacitor). Si se quiere soportar horizontal, la cabecera y
`--bottom-nav-height` necesitan variantes para viewports bajos.

**Evidencia:** `rot1.png`, `rot2.png`.

---

### QA-12 · Bajo · Notificaciones/UX · El toggle "Notificaciones" aparece ON sin que el permiso esté concedido

**Pantalla:** `/settings` → Notificaciones; usuario recién registrado.

**Real:** el toggle de "Notificaciones" se muestra **activado** en un usuario nuevo, mientras
`dumpsys package` reporta `POST_NOTIFICATIONS: granted=false`. La UI afirma que las notificaciones están
activas cuando el SO no permite que llegue ninguna. Además, el onboarding **nunca pide el permiso**: el usuario
solo lo concede si entra a Ajustes y toca el toggle.

**Causa raíz:** `src/shared/stores/settingsStore.ts:45` → `notificationsEnabled: true` como valor por defecto,
sin contrastar con el permiso real del SO al arrancar.

**Corrección aplicada:** nuevo `hasOsNotificationPermission()` en `notifications.ts` (permiso del SO puro, sin
mirar la preferencia), y `SettingsPage.fetchConfig` ahora hace
`setNotificationsEnabled(!!data.notifications_enabled && osGranted)`.

**Corrección a mi propio informe:** dije que _"el onboarding nunca pide el permiso"_. **Es impreciso.**
`app/components/PermissionRequests.tsx` **sí** lo pide en el primer arranque, pero está gateado por
`localStorage['gymlog_permissions_seen']`, que es **por dispositivo, no por usuario**: mi segunda cuenta de
prueba nunca lo vio porque la primera ya había consumido la llave. Verificado al limpiar los datos de la app:
el diálogo "¡Bienvenido! → Notificaciones → Activar" reapareció y concedió el permiso correctamente.

**Verificado que sí funciona:** al conceder el permiso desde el toggle, la reconciliación programa las alarmas
correctamente (ver "Lo que sí funciona bien").

---

### QA-03 · Bajo · Documentación · `CLAUDE.md` afirma que no existe modo claro, pero existe y funciona

**Archivo:** `.claude/CLAUDE.md`, sección "Sistema de diseño".

Dice literalmente: _"Tema oscuro único (sistema Stitch) … No hay modo claro; no añadas uno sin que lo pida
el usuario."_

**Real:** Ajustes → Preferencias → **Tema** ofrece OSCURO / CLARO, y el tema claro está **completamente
implementado y pulido** (ver `09-theme-claro.jpeg` y `10-app-light-sys-light.png`).

**Por qué importa:** no es un fallo de la app, es un fallo del documento que instruye a los agentes de IA.
Tal como está, me indica —y le indicará a cualquier agente futuro— que el modo claro no existe, con riesgo
de que se rompa o se elimine sin darse cuenta al tocar tokens o estilos.

---

### QA-04 · Bajo · UI/UX · La app Android ofrece "DESCARGAR APK" dentro de sí misma

**Pantalla:** `/login`, pie.

El pie del login muestra "DESCARGAR APK" también en la app nativa: se ofrece descargar el APK que el usuario
**ya está ejecutando**. Solo tiene sentido en la landing web.

**Causa raíz** — `src/features/auth/pages/AuthPage.tsx:395-401`: el `<a>` se renderiza sin ninguna guarda de
plataforma. El propio código ya sabe detectar nativo (`authStore.ts:106`, `Capacitor.isNativePlatform()`),
así que basta con envolverlo.

---

### QA-05 · Bajo · Accesibilidad · Touch targets por debajo de 44dp en el login

`CLAUDE.md` exige ≥44px (=115,5px físicos a densidad 420). Medidos desde el árbol de vistas:

| Elemento                   | Alto real           | En dp         | Estado                |
| -------------------------- | ------------------- | ------------- | --------------------- |
| "¿Sin cuenta? Crea una"    | 89px                | **33,9dp**    | Incumple con claridad |
| Toggle "EN"                | 113px (ancho 108px) | 43,0 × 41,1dp | Al límite, incumple   |
| Toggle "ES"                | 113px (ancho 102px) | 43,0 × 38,9dp | Al límite, incumple   |
| Botón "Mostrar contraseña" | 113px               | 43,0dp        | Al límite, incumple   |

El peor caso es el enlace de registro: un 23% por debajo del mínimo, y es el punto de entrada de todo
usuario nuevo.

---

### QA-06 · Bajo · UI/UX · Dos avisos compitiendo en el primer arranque, y el modal no parece modal

**Pantalla:** `/` tras el primer login (`05-after-login.jpeg`).

Al entrar por primera vez aparecen **a la vez** la tarjeta "¿Cuánto pesas esta semana?" y el diálogo
"¡Bienvenido a GymLog v2!", uno encima del otro, más la pantalla de entreno de fondo.

Además el backdrop del diálogo es **totalmente transparente**: no atenúa el fondo, así que el diálogo no se
lee como modal y se ve —y parece pulsable— el botón "+ Serie" detrás.

**Nota importante:** probé si la interacción de fondo estaba realmente desbloqueada y **no lo está** — el tap
sobre "+ Serie" (fuera de los límites del diálogo) no hizo nada. El focus trap **funciona correctamente**.
El problema es solo visual: falta el oscurecido que comunique que el fondo está bloqueado.

---

## Verificado y descartado (no son fallos)

Se investigaron y quedaron descartados con evidencia, para que no se pierda tiempo en ellos:

- **Badge verde persistente en CARDIO** → **no es un badge fantasma**. Había una sesión de cardio realmente
  activa (en pausa, "CORRER · EN PAUSA 01:29") que yo no había descartado. Al terminarla y darle a "Descartar",
  el badge desapareció al instante y la sesión (correctamente) **no** se guardó en el historial.
  `Layout.tsx:85` (`badge: cardioActive`) y `cardioStore.discardSession()` funcionan bien.
- **Alarma de racha con `repeatInterval` de ~33-36h en vez de 24h** → es cómo Android representa internamente
  la ventana de una alarma repetitiva inexacta, no un error de la app. El `origWhen` es correcto
  (`2026-07-17 20:00`).
- **1RM "mal calculado"** → falsa alarma mía: asumí Epley y la app usa **Brzycki**
  (`@shared/lib/brzycki`). Todos los valores son consistentes bajo Brzycki: 100kg×10 → 133.4
  (100×36/27=133.33 ✓), 100kg×8 → 124.2 (100×36/29=124.14 ✓), 60kg×10 → 80.0 ✓.
- **Calculadora 1RM con peso negativo** → correcto: acepta `-50` en el campo pero muestra `—` en vez de un
  número absurdo.
- **Login "fallido"** con credenciales correctas → artefacto de mi automatización (`--clear` de MobAI
  concatenó contraseñas y el árbol de accesibilidad devolvía valores desfasados). El login funciona.
- **Focus trap del modal de bienvenida** → funciona; la interacción de fondo sí está bloqueada.
- **La biblioteca de ejercicios no deja seleccionar** → intencionado. `ExerciseLibraryPage.tsx:167` solo hace
  `setExpandedId`; es una pantalla de consulta, no un selector. El picker real es el campo de búsqueda.
- **Contenido tapado por la barra inferior en /routines** → hay padding de sobra al hacer scroll al fondo.
- **Temporizador de cardio congelándose en segundo plano** → **pasa la prueba**. Marcaba 00:05, estuvo 50s
  en background y volvió mostrando 01:09, coherente con el tiempo real.
- **Notificación del temporizador que "no llegaba"** → mi primer test fue **inválido** y casi lo reporto como
  fallo grave: había mandado la app a background _después_ de que la alarma disparase, así que el descanso
  terminó en foreground, donde `complete()` cancela la notificación **a propósito**. Repetido de forma atómica,
  la notificación sí llega (aunque tarde → QA-09).
- **Regresión por los cambios sin commitear en `capacitor.config.ts`** → el diff solo cambia
  `smallIcon: 'icon'` → `'ic_stat_notify'`, y ese cambio **funciona**. No tiene relación con QA-01.
- **Pantalla de "Sign in with Google" del sistema apareciendo sola** → ruido del emulador
  (`MinuteMaidActivity`), ajeno a GymLog.

---

## Lo que sí funciona bien

- **Outbox / offline end-to-end** (verificado en modo avión): aparece el aviso "Sin conexión — los cambios se
  guardarán al reconectar"; el autocompletado de ejercicios sigue funcionando (catálogo local); al guardar
  aparece "1 entreno pendiente de sincronizar"; al reactivar la red **ambos avisos desaparecen solos** y el
  entreno ("Sentadilla: 8×100") **aparece en HISTORIAL correctamente sincronizado**. Sin intervención manual.
- **Reconciliación de recordatorios** (el código sin commitear): tras conceder el permiso, programó la alarma
  de racha para `2026-07-17 20:00` — **saltando hoy correctamente** porque ya se había entrenado
  (`trainedToday=true`) — y el resumen semanal para `2026-07-20 09:00` (el lunes siguiente). No programó
  recordatorios de rutina, que es lo correcto al no haber rutina activa. `getReminderDays()` → `[]`.
- **Canales de notificación**: `reminders` (importancia 4) y `timer` (importancia 5) existen y están bien
  configurados (verificado en `dumpsys notification`).
- Notificación de descanso en background con copy e icono correctos; DETENER limpia también la del sistema.
- Botón atrás de Android: desde `/user-stats` vuelve a `/history` correctamente.
- Validación del login: campos vacíos → "Completa los campos"; credenciales malas → "Email o contraseña
  incorrectos" (sin revelar cuál falla, buena práctica de seguridad).
- Flujo troncal end-to-end: "Press banca" → 10 reps × 60 kg → Guardar → aparece en HISTORIAL. Persiste.
- Cálculo de volumen en vivo correcto (10 × 60 = 600kg), y KPIs de `/stats` coherentes.
- Buenos estados vacíos: "Necesitas al menos 2 sesiones de Press banca" en la gráfica de progresión.
- Sugerencia de ejercicios complementarios al añadir uno ("PIERNA — SUGERIDO" tras elegir Sentadilla).
- Onboarding de dos pasos (objetivo + días/semana) sin errores.
- Tema claro completo y bien acabado.

---

## Cobertura

**Probado:** `/login` (validación, i18n, touch targets), onboarding, `/` WorkoutPage (peso corporal,
biblioteca, autocompletado, alta de serie, guardado, 1RM en vivo), `/routines`, `/cardio` (inicio, cronómetro,
background 50s, pausa, terminar, descartar), `/settings` (tema, notificaciones, permisos), `/history`,
`/stats` (KPIs, progresión, recuperación, calculadora 1RM, límites negativos), `/user-stats` (resumen,
logros, comparación de periodos, distribución muscular, top ejercicios, recuperación).
**Notificaciones**: permisos, canales, reconciliación, alarmas programadas (`dumpsys alarm`), notificación
del temporizador en background con medida de latencia real, icono `ic_stat_notify`.
**Offline**: modo avión, guardado offline, outbox, resincronización automática.
**Rotación** y **botón atrás**. Modo claro/oscuro del sistema × tema de la app (4 combinaciones).

**NO probado** — pendiente para una 3ª pasada:

| Área                                                              | Motivo                                                                     |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Editar/borrar entreno, swipe-to-delete                            | Sin probar                                                                 |
| Crear/editar/borrar rutina personalizada                          | Sin probar                                                                 |
| Ejercicio multi-músculo (reparto ponderado)                       | Sin probar; es la feature nueva de v4.5.0                                  |
| Doble tap rápido en Guardar                                       | Sin probar (riesgo de entreno duplicado)                                   |
| Inputs límite en reps/kg                                          | Solo se probó el peso corporal y la calculadora 1RM                        |
| Recordatorio de rutina real (18:30) y resumen semanal (lun 09:00) | Programados y verificados en `dumpsys`, pero no se esperó a que dispararan |
| OAuth de Google                                                   | Sin probar (requiere cuenta real)                                          |
| Wearables / Health Connect                                        | Sin probar                                                                 |
| Importar/exportar Excel                                           | Sin probar                                                                 |

**Limitaciones del método:** MobAI entró en `RATE_LIMIT_EXCEEDED` a mitad de sesión y hubo que continuar con
adb puro; `uiautomator dump` falla mientras el bridge de MobAI está activo. El `--clear` de MobAI no vacía
los inputs de React de forma fiable — usar `KEYCODE_MOVE_END` + `KEYCODE_DEL` repetido. Al abrirse el teclado
la página se re-scrollea, así que hay que recalcular coordenadas entre taps.

---

## Estado de los arreglos (2026-07-16)

Todos aplicados. `npm run lint` + `type-check` + `test` (208/208) en verde. **Nada commiteado.**

| #     | Arreglo                                                                                                 | Ficheros                                                                                                           | Verificado                                                     |
| ----- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| QA-01 | Tema nativo sin `DayNight` + `windowBackground` fijo + `SystemBars.insetsHandling: 'disable'`           | `styles.xml`, `colors.xml`, `capacitor.config.ts`, `MainActivity.kt` (comentario)                                  | **Emulador**: barra oscura + reloj blanco con sistema en claro |
| QA-02 | Estado de error + `aria-invalid`/`role="alert"` en vez de `return` mudo                                 | `WeeklyWeightPrompt.tsx`, `resources.ts`                                                                           | Código + tests                                                 |
| QA-03 | `CLAUDE.md`: el modo claro existe y hay que probar los dos temas                                        | `.claude/CLAUDE.md`                                                                                                | —                                                              |
| QA-04 | Enlace APK envuelto en `!Capacitor.isNativePlatform()`                                                  | `AuthPage.tsx`                                                                                                     | **Emulador**: el pie ya solo muestra EN/ES                     |
| QA-05 | Targets a `min-h-[44px]` (`min-h-11` = 2.75rem = **41.25px** con `:root` a 15px)                        | `AuthPage.tsx`                                                                                                     | Código                                                         |
| QA-06 | `bg-black/60` en el overlay del `Modal` (afecta a todos los modales)                                    | `ui/Modal.tsx`                                                                                                     | **Emulador**: el fondo se ve atenuado                          |
| QA-07 | Estados renombrados a `recovering`/`partial`/`recovered` + mapeo invertido corregido en las 2 pantallas | `fatigueAnalysis.ts`, `FatigueAnalysis.tsx`, `UserStatsPage.tsx`, `useFatigueSuggestion.ts`, `resources.ts`, tests | **Emulador**: "Pierna/Pecho · ⊗ En recuperación · Hoy" (rojo)  |
| QA-08 | `toFixed(0)` → `toFixed(1)`                                                                             | `UserStatsPage.tsx:439`                                                                                            | **Emulador**: "Volumen total 1.4t" (1400 kg)                   |
| QA-09 | `canScheduleExactAlarms()` / `requestExactAlarms()` + fila "Alarmas exactas" en Ajustes                 | `notifications.ts`, `SettingsPage.tsx`, `resources.ts`                                                             | **Emulador**: ver abajo                                        |
| QA-10 | `reconcileReminders()` consulta `trainingReminders`; el toggle reconcilia al instante; copy honesto     | `reminderReconcile.ts`, `SettingsPage.tsx`, `resources.ts`                                                         | **Emulador**: copy nuevo visible                               |
| QA-11 | `android:screenOrientation="portrait"`                                                                  | `AndroidManifest.xml`                                                                                              | —                                                              |
| QA-12 | Toggle derivado del permiso real del SO                                                                 | `notifications.ts`, `SettingsPage.tsx`                                                                             | **Emulador**: prompt de permisos OK                            |

### QA-09: medida antes/después

|             | Objetivo       | Entregada   | Retraso    | `dumpsys alarm`                           |
| ----------- | -------------- | ----------- | ---------- | ----------------------------------------- |
| **Antes**   | `10:55:00.920` | ~`10:55:20` | **~19 s**  | `window=+46s28ms`, sin `exactAllowReason` |
| **Después** | `11:58:44.903` | `11:58:45`  | **~0,1 s** | `window=0 exactAllowReason=permission`    |

El permiso pasa el plugin de `setAndAllowWhileIdle` (inexacta) a `setExactAndAllowWhileIdle` (exacta), que es
justo la rama de `LocalNotificationManager.setExactIfPossible`.

### Cosas que encontré al arreglar y conviene que sepas

- **`min-h-11` no son 44px.** `:root` está a **15px**, así que `min-h-11` = 2.75rem = **41.25px**, un 6% por
  debajo del mínimo que exige `CLAUDE.md`. Solo he tocado los 4 elementos del login que reporté; **el resto de
  la app usa `min-h-11` por convención y está igual de corto**. Arreglarlo en serio es o subir `:root` a 16px
  o cambiar la convención a `min-h-12`/`min-h-[44px]`. No lo he hecho: afecta a toda la app y es tu decisión.
- **El service worker sirve JS viejo tras actualizar el APK.** Al instalar el APK nuevo, la app seguía
  mostrando strings antiguos; el bundle nuevo sí estaba en `assets/public`. Hizo falta `pm clear`. Puede
  afectar a tus usuarios en cada release (verían la versión anterior hasta que el SW se actualice).
- **`formatVolume()` ya existe** en `shared/lib/weight.ts` y es consciente de kg/lb, pero **ni `StatsPage` ni
  `UserStatsPage` lo usan**: ambas hardcodean `/1000` y `'t'`, así que **ignoran `unitSystem`** y un usuario en
  libras ve toneladas. No lo he tocado (no estaba en el informe y cambia el comportamiento de unidades), pero
  es un bug real pendiente.
- **`PermissionRequests.tsx` tiene los textos hardcodeados en español**, saltándose la regla de i18next de
  `CLAUDE.md`. No lo he tocado.

---

## Plan de corrección priorizado _(histórico — ya ejecutado)_

1. **QA-01** — desacoplar la status bar del tema del sistema y arreglar `overlaysWebView`. Afecta a toda la
   app en la configuración por defecto de Android. _(Alto)_
2. **QA-08** — `toFixed(0)` → `toFixed(1)` en `UserStatsPage.tsx:439`. **Una línea**, y quita una
   contradicción numérica visible dentro de una misma pantalla. _(Medio, coste mínimo)_
3. **QA-10** — conectar el toggle "Recordatorios de entreno" a `reconcileReminders()`. Un control que miente
   es peor que no tenerlo. _(Medio)_
4. **QA-07** — arreglar el mapeo invertido de "Recuperación" y renombrar los estados para que digan lo que
   significan. Añadir un test del **mapeo a etiquetas**, que es justo lo que los tests actuales no cubren.
   _(Medio)_
5. **QA-09** — pedir el permiso de alarma exacta (`checkExactNotificationSetting` /
   `changeExactNotificationSetting`) o usar `USE_EXACT_ALARM`. Corregir el comentario de
   `notifications.ts:220` que afirma que la alarma es exacta. _(Medio)_
6. **QA-02** — dar feedback de error en `WeeklyWeightPrompt.tsx:61` en vez de un `return` mudo. _(Medio)_
7. **QA-12** — derivar el toggle de notificaciones del permiso real; pedirlo en el onboarding. _(Bajo)_
8. **QA-11** — bloquear a `portrait`. _(Bajo, una línea)_
9. **QA-03** — corregir la sección de diseño de `CLAUDE.md`. _(Bajo, coste casi nulo)_
10. **QA-05** — subir "¿Sin cuenta? Crea una" a ≥44dp. _(Bajo)_
11. **QA-04** — envolver el enlace del APK con `Capacitor.isNativePlatform()`. _(Bajo)_
12. **QA-06** — añadir oscurecido al backdrop y secuenciar los dos avisos del primer arranque. _(Bajo)_

---

## Evidencia

Capturas en:
`C:\Users\franc\AppData\Local\Temp\claude\C--Users-franc-proyectos-gymlog\87ef96a2-a0a9-43e7-b2c0-40bffbb84ce5\scratchpad\shots\`

> Nota: es una carpeta temporal de sesión. Si quieres conservar la evidencia, cópiala fuera antes de limpiar
> el scratchpad (no la he metido en el repo porque `versiones/`, `coverage/` y demás artefactos locales están
> fuera de git, y no me consta que quieras capturas versionadas).

| Archivo                                            | Contenido                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `01-login.jpeg`                                    | QA-01: sistema claro + app oscura, reloj ilegible                                                  |
| `04-login-dark-ok.jpeg`                            | QA-01: sistema oscuro, barra correcta (control)                                                    |
| `05-after-login.jpeg`                              | QA-06: dos avisos simultáneos, backdrop transparente                                               |
| `09-theme-claro.jpeg`                              | QA-03: modo claro funcional                                                                        |
| `10-app-light-sys-light.png`                       | QA-01: app clara + sistema claro, iconos blancos ilegibles                                         |
| `12-cardio-running.png` / `13-cardio-after-bg.png` | Cardio antes/después de 50s en background (control)                                                |
| `shade.png`                                        | QA-09: notificación "Descanso terminado" con el icono `ic_stat_notify` correcto                    |
| `stats1.png`                                       | `/stats`: KPIs, "Volumen total 0.6t"                                                               |
| `stats3.png`                                       | **QA-07**: "Pecho · ✓ Recuperado · Hoy" con la barra de recuperación a 0%                          |
| `us1.png`                                          | **QA-08**: `/user-stats` KPI "Volumen total **1t**"                                                |
| `us2.png`                                          | **QA-08 + QA-07**: misma página, "Pecho 0.6t" y "Press banca 0.6t"; "Pecho · hace 0d · Descansado" |
| `off1.png`                                         | Offline: aviso "Sin conexión"                                                                      |
| `off11.png`                                        | Offline: "1 entreno pendiente de sincronizar" tras guardar                                         |
| `on2.png`                                          | Offline: "Sentadilla: 8×100" sincronizado en HISTORIAL al recuperar la red                         |
| `rot1.png` / `rot2.png`                            | QA-11: horizontal, contenido cortado por la barra inferior                                         |
