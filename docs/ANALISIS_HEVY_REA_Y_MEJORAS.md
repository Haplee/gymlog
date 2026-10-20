# Análisis de Hevy (ingeniería inversa) y plan de mejora para GymLog

> Informe generado con la skill `reverse-engineer-anything` (REA 6.5.0) sobre el APK de **Hevy 3.2.0** extraído del móvil conectado, más una auditoría del estado actual de **GymLog v5.14.0**.
>
> Fecha: 2026-10-16 · Analista: agente OpenCode · Alcance: análisis **estático** (el APK nunca se ejecuta).

---

## 1. Resumen ejecutivo

1. **`KFSWGMUKYDNNM7DU` no es la app**: es el **número de serie ADB del teléfono** (Realme RMX3910, producto `RMX3910EEA`). La app de Hevy es el paquete **`com.hevy`** (versionName **3.2.0**, versionCode 3364731).
2. Hevy **no es nativa pura ni Flutter**: es una app **Expo / React Native 0.8x sobre Hermes** (SDK 54) con un **puente nativo propio muy grande** en Kotlin (28.989 clases, 3 DEX) y 2 módulos de UI nativa Compose (widgets con Glance).
3. La **lógica de negocio (rutinas, entrenamiento, red, suscripciones) está en el bundle Hermes** `assets/index.android.bundle` (22,6 MB), no en DEX. En el código nativo solo hay 7 URLs, todas de librerías de Google/JetBrains: el "motor" de Hevy es JavaScript.
4. Hevy ha construido **mucha superficie nativa que GymLog aún no tiene**: escritura en Health Connect, **10 widgets**, servicio en primer plano para el temporizador de descanso, app de **Wear OS**, integración **Strava**, editor de foto/vídeo (IMG.LY), analítica de producto (Amplitude) y pagos (RevenueCat + Paddle).
5. GymLog **ya cubre** lo esencial y con buena calidad: registro de entrenamiento, rutinas, cardio, stats/historial, medidas corporales, wearables (Health Connect/HealthKit **solo lectura**), notificaciones, push, 2 widgets, logros/rachas, calculadora de discos, 1RM, exportación Excel, i18n, temas, Sentry, tests extensos y funciones edge de Supabase (incluido `ai-coach` con seguridad y memoria).
6. Las **mejores 5 acciones** para GymLog, por relación valor/esfuerzo: **cerrar la UI del AI Coach** (el backend ya existe), **escritura en Health Connect**, **ampliar el paquete de widgets**, **temporizador de descanso en primer plano** y **publicar/terminar el coach antes de añadir features nuevas**.
7. Lo que **no** hay que copiar de Hevy: SDKs de atribución/ads (Adjust, `AD_ID`, AdServices), `usesCleartextTraffic="true"`, Amazon IAP, 10 widgets a la vez, editor de vídeo de pago. Suma peso y deuda sin aportar al usuario.
8. Antes de añadir nada: **cablear `database.types.ts` al cliente Supabase** y refactorizar las páginas gigantes. Hevy tiene 28.989 clases porque creció sin freno; GymLog puede evitar ese destino.

---

## 2. Identidad del artefacto analizado

Identificador del objetivo en REA: `KFSWGMUKYDNNM7DU` (serie del dispositivo, no de la app).

| Campo                                      | Valor                                                       |
| ------------------------------------------ | ----------------------------------------------------------- |
| Dispositivo                                | Realme **RMX3910** (`RMX3910EEA`), serie `KFSWGMUKYDNNM7DU` |
| Paquete                                    | `com.hevy`                                                  |
| versionName / versionCode                  | **3.2.0** / 3364731                                         |
| Instalado desde                            | `com.android.vending` (Google Play)                         |
| Primera instalación / última actualización | 2026-10-16 10:45:45 (ambas)                                 |
| Permisos solicitados                       | 34                                                          |
| Flags de paquete                           | `HAS_CODE ALLOW_CLEAR_USER_DATA LARGE_HEAP`                 |

Artefactos extraídos (SHA-256 calculado en local):

| APK                          | Bytes       | SHA-256                                                            |
| ---------------------------- | ----------- | ------------------------------------------------------------------ |
| `base.apk`                   | 126.951.001 | `f2ed9540352c6e503fe5176cabf221f3e4f3687229ca576a119b8a7309bf8c56` |
| `split_config.arm64_v8a.apk` | 30.366.462  | `a266bb6441033d70fb322894c870dfdfa042dbeed53f966c896400460d47fb4e` |
| `split_config.es.apk`        | 86.425      | `6352264114a330e90802f85df67a10858904a4595355068708c89064bad88026` |
| `split_config.xhdpi.apk`     | 18.165.080  | `d81fab661cd61329df7a96567fff8df219fb32b01d53a0f0d1db8cbbf541ca15` |

Contenido de `base.apk`: **3.863 entradas** de ZIP, 3 ficheros DEX (`classes.dex` 12,7 MB, `classes2.dex` 9,5 MB, `classes3.dex` 9,4 MB), **28.989 clases** y 3.863 recursos según JADX, bundle Hermes de 22.644.948 bytes.

Metadatos Expo incrustados (`assets/app.config`):

```json
{
  "name": "Hevy",
  "slug": "pump",
  "android": { "package": "com.hevy" },
  "ios": { "bundleIdentifier": "com.hevyapp.hevy" },
  "extra": { "eas": { "projectId": "447faa45-5117-46b0-98a8-863deae6c626" } },
  "owner": "hevy-organization",
  "version": "1.8.1",
  "sdkVersion": "54.0.0",
  "platforms": ["ios", "android"]
}
```

> Nota: la `version` del proyecto Expo (1.8.1) **no coincide** con la `versionName` publicada en Play (3.2.0). Es habitual, pero indica que ese campo no se usa como fuente de verdad.

---

## 3. Metodología y trazabilidad

Herramientas y cadena de evidencia (cada conclusión se apoya en un `evidence_id` de REA):

| Paso                                      | Operación REA              | Proveedor           | Evidence ID                                                           |
| ----------------------------------------- | -------------------------- | ------------------- | --------------------------------------------------------------------- |
| Estado del paquete en el móvil            | `inspect_adb_package`      | adb 37.0.1          | `ev_4fff0cfb50508bd097bb76ddb1658baadde247a90e1feb2e558ed8ce9e3561f4` |
| Extracción del APK set                    | `pull_adb_package`         | adb 37.0.1          | `ev_ffc6168f2c438fff7e3afb696974e5191410d8c12055a91af4b1af875a2c8601` |
| ¿Flutter? (**no**)                        | `identify_flutter_build`   | flutter             | `ev_02ea1b2440933d8b5409636415df212a0e962aca9e58d4b368b47b66a0bec318` |
| Manifiesto y recursos (3915 ficheros)     | `decode_android_resources` | apktool 3.0.3       | `ev_41221221eb1aeac32b5fb52d317488f62578edbc7a6315a4c412faaca472e239` |
| Declaraciones del paquete (28.989 clases) | `inspect_android_package`  | JADX headless 0.7.1 | `ev_7ea1a0dec1ad3089e77d81ed8c9e7c71d5d30ea8fb0d38de43a5eb189634edb6` |
| Inventario de clases propias              | `search_android_classes`   | JADX headless 0.7.1 | `ev_7e8b1732f85fb5bcfced6b8cb9e6f0e0eddb84d2b4457e2aa0cbd9daf4eff793` |
| Registro de módulos nativos               | `inspect_android_class`    | JADX headless 0.7.1 | `ev_70e0662f8371350849a44c061f0e03869725a0b78edba3be039442dd0b1574fe` |
| Arranque de la app                        | `inspect_android_class`    | JADX headless 0.7.1 | `ev_c701d5c1c5b5fb8c5bb050aafcde26255c2ea6defa918182958d1a3aacd4597e` |

Prerequisitos instalados para esta sesión (no forman parte de REA, que no los instala por diseño):

- `jadx-headless-mcp-0.7.1-all.jar` — SHA-256 verificado contra el publicado: `6e5eacf500b64292bfb73c49797c1958f6ee44646e43e868039ae7feb573ff75` ✔
- `apktool_3.0.3.jar` + envoltorio `apktool.bat`
- Java: Zulu **21.0.12** (JDK completo)

Rutas locales usadas: `%TEMP%\opencode\rea-tools\` (herramientas) y `%TEMP%\opencode\hevy-rea\com.hevy\` (APK).

**Cómo leer este informe**: _observado_ = dato devuelto por una herramienta sobre el artefacto; _inferido_ = deducción razonada a partir de observaciones; _desconocido_ = no establecido.

---

## 4. Hevy: stack y arquitectura

### 4.1 Plataforma

| Capa                            | Observado                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Framework                       | **Expo SDK 54 / React Native** (`libreactnative.so`, `libappmodules.so`, `expo.modules.adapters.react`) |
| Runtime JS                      | **Hermes** (`libhermes.so`, `libhermestooling.so`; cabecera de bytecode `c6 1f bc 03`)                  |
| Lógica de negocio               | `assets/index.android.bundle`, 22,6 MB de **bytecode Hermes** (no es JS legible)                        |
| Nativo                          | Kotlin + Java, 3 DEX (31,6 MB), 28.989 clases                                                           |
| UI nativa                       | **Jetpack Compose / Glance** para widgets y alguna vista (`reactnative` + módulos propios)              |
| minSdk / targetSdk / compileSdk | 24 / **36** / 36 (Android 16)                                                                           |
| Tamaño instalado                | ~176 MB de APK set (sin contar datos del usuario)                                                       |

### 4.2 Librerías nativas incluidas (split `arm64_v8a`, 33 `.so`)

`libreactnative` (5,9 MB), `libhermes` (2,1 MB), `libhermestooling`, `libjsi`, `libfbjni`, `libexpo-modules-core`, `libNitroModules`, `libappmodules`, `libreanimated`, `libworklets`, `libgesturehandler`, `librnscreens`, `libreact_codegen_rnscreens`, `libsafeareacontext`, `libRNCSlider`, `librive` + `librive-android` (animaciones), `libsentry` + `libsentry-android`, `libsigner`, `libandroidlame` (codificar MP3), `libVisionCamera`, `libimagepipeline` + `libnative-imagetranscoder`/`-jpeg`/`-filters` (Fresco/imágenes), `libpl_droidsonroids_gif`, `libdatastore_shared_counter`, `libandroidx.graphics.path`, `libimage_processing_util_jni`.

### 4.3 Módulos nativos propios (kebab observado en `com.hevy.*`)

`HevyReactPackage` expone `createNativeModules()` + `createViewManagers()` (3 métodos). Módulos y clases `com.hevy.*` observados incluyen: `AppLog`, `AppLogBridgeModule`, `BigStorageModule`, `HevyDeviceInfoModule`, `MemoryDebugModule`, `NavigationBarModule`, `NetworkTypeModule`, `QuickActionsModule`, `RNRestartModule`, `SettingsModule`, `SoundsModule`, `SplashScreenModule`, `TimerNotificationModule`, `UuidModule`, `WearOSConnectorModule`, `WidgetModule`, `WidgetStatusModule`, `WorkoutStorageModule`, `NotificationsModule`, más `components.nativebottomtabs.*` (barra inferior nativa), `healthconnect.*`, `notifications.*`, `services.*` (timer, Wear, imágenes) y `widgets.*` (10 widgets).

**Inferido**: GymLog resuelve esto mismo en el WebView; Hevy baja a nativo solo donde la WebView no llega (widgets Compose, timer en primer plano, Wear, almacenamiento masivo, vídeo/cámara).

---

## 5. Hevy: superficie nativa declarada (manifiesto)

Fuente: `ev_41221221…` (manifiesto decodificado completo, apktool 3.0.1/3.0.3, coverage `complete`).

### 5.1 Salud y actividad

- Escritura: `health.WRITE_BODY_FAT`, `WRITE_EXERCISE`, `WRITE_WEIGHT`, `WRITE_TOTAL_CALORIES_BURNED`, `WRITE_HEART_RATE`; lectura: `health.READ_WEIGHT`, `READ_BODY_FAT`.
- `PermissionsRationaleActivity` + `ViewPermissionUsageActivity` (alias) + servicio `HealthDataSdkService`.
- `ACTIVITY_RECOGNITION` (GMS).

### 5.2 Widgets (10 receptores + 5 pantallas de configuración)

`streak`, `rest`, `calendarstats`, `weeklystats`, `dayroutine`, `lastroutines`, `lastworkouts`, `calendar`, `quickaccess`, `chart` — todos `AppWidgetReceiver` con `android.appwidget.action.APPWIDGET_UPDATE`, y actividades `APPWIDGET_CONFIGURE` para los configurables. Base técnica: **Glance** (`GlanceRemoteViewsService`, `RemoteViewsCompatService`).

### 5.3 Trabajo en segundo plano

- `TimerNotificationService` con `foregroundServiceType="specialUse"` y subtipo declarado: _"Provide rest timer and workout information while the user is logging a workout"_.
- `TimerExpiredReceiver`, `NotificationActionReceiver` (acciones desde la notificación).
- `WearListenerService` (`exported=true`, path `/workout-started`) → **app de Wear OS**.
- FCM: `HevyFirebaseMessagingService` + `HevyFirebaseMessagingReceiver`; icono/color de notificación propios.
- WorkManager completo (SystemJobService, SystemAlarmService, proxies de batería/red/almacenamiento).

### 5.4 Deep links y atribución

- Esquema `hevy://`; `https://hevyapp.app.link` y `https://hevy.go.link` (Branch); `hevy.com/deeplink`, `/routine`, `/folder`, `/workout`, `/user`, `/program`, `/coach/accept-invite` — todos `autoVerify=true`.
- `io.branch.sdk.BranchKey` = `key_live_…` **en claro en el manifiesto**; Facebook App ID `796148157495272`; `com.adjust.sdk.AdjustReferrerReceiver`; `ACCESS_ADSERVICES_*` y `AD_ID`.
- `MainActivity`: `singleTask`, `portrait`, `windowSoftInputMode=adjustNothing`.

### 5.5 Pagos, cámara y otros

- Billing: `com.android.vending.BILLING`, `billingclient 8.3.0`, **RevenueCat** (`com.revenuecat.purchases.*`, incl. Amazon IAP) y **Paddle** (web).
- **IMG.LY PhotoEditor/VideoEditor SDK** (`pesdk`/`vesdk`, licencias en `assets/`): editor de foto y vídeo in-app.
- **ML Kit barcode** (`BarcodeRegistrar`) declarado.
- 4 FileProviders (RNShare, WebView, BlobUtil, imagepicker, Expo filesystem) y `ShareStoriesFileProvider` (compartir historias).
- `usesCleartextTraffic="true"`, `allowBackup="false"`, `largeHeap="true"`, `extractNativeLibs="false"`.
- `queries`: Instagram, Facebook (+Lite), TikTok (`musically`/`trill`), **Strava**, Snapchat, **ChatGPT**, Health Connect, Google Maps.

---

## 6. Hevy: integraciones y endpoints observados

Extraídos de la tabla de cadenas del bundle Hermes (regex sobre el binario; **inferido** como endpoint real, no confirmado por tráfico):

| Dominio / URL                                                                                                                                                                   | Uso inferido                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `https://api.hevyapp.com/live_sync/body_sensors_data`                                                                                                                           | Sincronización en vivo de sesión + sensores (FC)                |
| `http://www.hevy.com/live_sync/ack`                                                                                                                                             | Confirmación de live sync (**HTTP sin TLS**)                    |
| `https://app.hevycoach.com/`                                                                                                                                                    | Producto "Hevy Coach" (web)                                     |
| `https://api.wellness.gympass`                                                                                                                                                  | Integración **Gympass / Wellhub**                               |
| `https://api.eu.amplitude.com/2/httpapi`, `https://api2.amplitude.com/2/httpapi`, `https://api.lab.amplitude.com/v1/vardata`, `https://sr-client-cfg[.eu].amplitude.com/config` | Analítica de producto + flags remotos (Amplitude)               |
| `https://api.revenuecat`                                                                                                                                                        | Compras/entitlements móviles                                    |
| `https://cdn.paddle.com/paddle/v2/paddle.js`                                                                                                                                    | Pagos web                                                       |
| `https://d2l9nsnmtah87f.cloudfront.net/exercise-assets/*.mp4`, `/exercise-thumbnails/*.jpg`                                                                                     | **CDN de vídeos y miniaturas de ejercicios** (~1 por ejercicio) |
| `https://chatgpt.com/?q=`                                                                                                                                                       | Integración "HevyGPT" (abrir consulta en ChatGPT)               |
| `http://localhost:8081/link`                                                                                                                                                    | Resto de desarrollo (Metro)                                     |
| `https://freesound.org/s/320657/`                                                                                                                                               | Asset de sonido con licencia                                    |

Nombres de ejercicio observados en el CDN (muestra): `01661201-Cable-Hammer-Curl_Forearm.mp4`, `04711201-Handstand-Push-Up_Shoulders_.mp4`, `11821201-Push-up-(on-knees)-(female)_Chest-FIX_.mp4`. **Inferido**: cada ejercicio tiene ID numérico + músculo + variante (male/female/FIX_).

---

## 7. Hevy: señales de funcionalidad (mapa de features)

Conteo de coincidencias (case-insensitive) en la tabla de cadenas del bundle. **Es un indicador de presencia, no una prueba de comportamiento**: identificadores minificados pueden inflar cifras.

| Señal                                            | Coincidencias | Lectura                                                                    |
| ------------------------------------------------ | ------------- | -------------------------------------------------------------------------- |
| `hevyTrainer`                                    | 780           | Asistente/entrenador con IA muy presente en textos                         |
| `plate` / `plateCalculator`                      | 429 / 44      | Calculadora de discos integrada                                            |
| `coach`                                          | 390           | Producto coach (humano + IA)                                               |
| `timer`                                          | 303           | Descanso y cronómetros                                                     |
| `subscription`                                   | 239           | Muro de pago / planes                                                      |
| `wearable`                                       | 219           | Integración de dispositivos                                                |
| `widget`                                         | 146           | Widgets                                                                    |
| `strava`                                         | 115           | Integración Strava                                                         |
| `bodyMeasurement`                                | 111           | Medidas corporales                                                         |
| `paddle`                                         | 85            | Pagos web                                                                  |
| `hevyCoach`                                      | 80            | Enlace a Hevy Coach                                                        |
| `healthConnect`                                  | 50            | Health Connect                                                             |
| `superset`                                       | 44            | Superseries                                                                |
| `csv`                                            | 39            | Export/import tabular                                                      |
| `revenuecat`                                     | 29            | Compras in-app                                                             |
| `hevyGPT`                                        | 15            | Puente a ChatGPT                                                           |
| `live_sync`                                      | 14            | Sesión en vivo entre dispositivos                                          |
| `gympass`                                        | 14            | Wellhub                                                                    |
| `entitlement`                                    | 8             | Control de acceso por plan                                                 |
| `deload` / `dropset`                             | 4 / 4         | Deload y dropsets                                                          |
| `plate_calculator`                               | 3             | Variante de nombre                                                         |
| `nutrition`                                      | 1             | Prácticamente ausente                                                      |
| `macro`, `barcode`, `progressPhoto`, `mesocycle` | 0             | **No** hay macros, escáner, fotos de progreso ni mesociclos con ese nombre |

**Features de Hevy, en una frase**: registro de entrenamiento con progresión, supersets/dropsets, calculadora de discos, cardio, medidas corporales, widgets, Wear OS, Health Connect (lectura y escritura), notificaciones, IA (HevyGPT + Hevy Trainer), coach humano con invitaciones, planes de suscripción, feed social/compartir historias, import/export CSV, deep links de routine/workout/program/user y CDN de vídeo por ejercicio.

---

## 8. GymLog hoy (verificado en el repositorio)

`package.json` → `gymlog-v2` **v5.14.0**, ESM, Vite.

| Capa              | GymLog                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend          | **React 19.3 + TypeScript 5.7 + Vite 6 + Tailwind 4**, React Router 8                                                                                                                              |
| Móvil             | **Capacitor 8** (Android + iOS), plugins: app, browser, filesystem, haptics, keyboard, local-notifications, push-notifications, share, splash-screen, status-bar                                   |
| Estado / datos    | **Zustand 5**, **TanStack Query 5** (+persist), `idb` (IndexedDB), Zod 3                                                                                                                           |
| Backend           | **Supabase** (`@supabase/supabase-js` 2.117), migraciones + **edge functions**: `ai-coach` (provider, prompt, memory, safety, schema, context + tests, incl. adversarial) y `send-push`            |
| UI                | framer-motion, recharts, sonner, reicon-react, i18next + react-i18next                                                                                                                             |
| Export / imágenes | exceljs (export), html-to-image (tarjetas para compartir)                                                                                                                                          |
| Calidad           | ESLint 9 (+jsx-a11y, +i18next), Prettier, Husky + lint-staged, **Vitest 4 + Testing Library + MSW + fake-indexeddb**, **Playwright**, script `audit:contrast`, script `check:secrets` sobre `dist` |
| Observabilidad    | Sentry (React + Capacitor + Vite plugin), Vercel Analytics                                                                                                                                         |
| PWA               | `vite-plugin-pwa`                                                                                                                                                                                  |
| Planes de dominio | landings y tutoriales en `docs/`                                                                                                                                                                   |

Feature dirs reales: `auth`, `cardio`, `fitbody`, `guide`, `routine`, `stats`, `wearables`, `workout` (+ `shared`). Páginas: `WorkoutPage`, `ExerciseLibraryPage`, `GuidePage`, `FitBodyShowcasePage`, `SettingsPage`, `NotificationsPage`, `AuthPage`, `AuthCallback`, `CardioPage`, `WearablesPage`, `UserStatsPage`, `StatsPage`, `HistoryPage`, `RoutinePage`.

Nativo propio ya implementado (Android): **`StreakWidgetProvider` + `today_widget_info` + `streak_widget_info`** (2 widgets), `WidgetBridgePlugin.kt`, `HealthBridgePlugin.kt` (Health Connect), receptor de restauración de notificaciones, `USE_BIOMETRIC`, `SCHEDULE_EXACT_ALARM`, `POST_NOTIFICATIONS`. Health Connect: **solo lectura** (`READ_STEPS`, `READ_DISTANCE`, `READ_TOTAL_ACTIVE_CALORIES_BURNED`, `READ_HEART_RATE`, `READ_RESTING_HEART_RATE`, `READ_SLEEP`, `READ_EXERCISE`, `READ_HEALTH_DATA_IN_BACKGROUND`) — **sin ningún `WRITE_*`** y sin métodos de escritura en `healthBridge.ts`.

Librerías de lógica con tests propios: progresión (`progression`, `progressionCycle`), descanso/placas (`plates`, `perSide`), 1RM (`brzycki`), series (`setShape`), rachas (`streakChecker`), logros (`achievements`), notificaciones y recordatorios, i18n, peso, fechas, targets de ejercicio.

Backlog vigente (`docs/TODO-MAESTRO.md`): bugs B1/B2, 4 items de seguridad, alineación con mockups (5 fases), cierre del AI Coach (items 0.5, 0.8, 1.V*, 2.3, 2.14, 4.*), ExerciseDB, Lift Analysis (MediaPipe/YOLO), dominio, paridad iOS, deuda técnica (páginas de 1300/1027/812/757 líneas), tests al 22–51 % en 3 módulos y dead code (5 archivos, 39 exports, 29 tipos).

---

## 9. Comparativa: Hevy vs GymLog

| Capacidad                             | Hevy                                                                     | GymLog                                           | Veredicto                              |
| ------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------- |
| Registro de series/pesos/reps         | Sí                                                                       | Sí                                               | **Paridad**                            |
| Rutinas y días de rutina              | Sí                                                                       | Sí                                               | **Paridad**                            |
| Progresión automática                 | Sí (`hevyTrainer`)                                                       | Sí (`progression`, `progressionCycle`)           | **Paridad**, con motor propio testeado |
| Supersets / dropsets / deload         | Sí (44/4/4)                                                              | No detectado                                     | Gap menor                              |
| Calculadora de discos                 | Sí                                                                       | Sí (`plates`, `perSide`)                         | **Paridad**                            |
| 1RM estimado                          | Sí                                                                       | Sí (`brzycki`)                                   | **Paridad**                            |
| Cardio                                | Sí                                                                       | Sí (feature `cardio` propia)                     | **Paridad**                            |
| Historial / stats                     | Sí                                                                       | Sí (`StatsPage`, `HistoryPage`, `UserStatsPage`) | **Paridad** (con refactor pendiente)   |
| Medidas corporales                    | Sí (111)                                                                 | Sí (`fitbody`)                                   | **Paridad**                            |
| Logros / rachas                       | Sí (streak)                                                              | Sí (`achievements`, `streakChecker`)             | **Paridad**                            |
| Exportación                           | Sí (CSV, 39)                                                             | Sí (Excel/`exceljs`)                             | **Paridad** (formatos distintos)       |
| Tarjetas para compartir               | Sí (ShareStories)                                                        | Sí (`shareImage`, `html-to-image`)               | **Paridad**                            |
| Widgets                               | **10** (streak, rest, chart, semana, calendario, rutinas, quick access…) | **2** (racha, hoy)                               | **Gap claro**                          |
| Temporizador de descanso en 1er plano | Sí (`specialUse` FGS + receiver)                                         | No detectado en manifiesto                       | **Gap** (crítico en Android)           |
| Health Connect escritura              | Sí (exercise, peso, grasa, FC, kcal)                                     | Solo lectura                                     | **Gap**                                |
| Wear OS / reloj                       | Sí (`WearListenerService`)                                               | No                                               | Gap alto coste                         |
| Strava                                | Sí (115)                                                                 | No                                               | **Gap medio**                          |
| Live sync entre dispositivos          | Sí (14, `body_sensors_data`)                                             | No (sí notificaciones y push)                    | Gap                                    |
| IA coach                              | Sí (HevyGPT + Trainer + coach humano)                                    | **Backend listo, UI pendiente**                  | **Cerrar lo empezado**                 |
| Feed social / seguir usuarios         | Sí (katana/instagram/tiktok queries)                                     | No                                               | Decisión de producto                   |
| Import desde otras apps               | Sí (CSV)                                                                 | No                                               | **Quick win**                          |
| Vídeo/GIF por ejercicio               | Sí (CDN CloudFront)                                                      | Pendiente (Supabase Storage, §9 del TODO)        | Gap con trabajo ya planificado         |
| Pagos / suscripción                   | Sí (RevenueCat + Paddle + Amazon IAP)                                    | No (sin monetización en deps)                    | Decisión de producto                   |
| Analítica de producto                 | Sí (Amplitude, eventos + flags)                                          | Vercel Analytics (básica)                        | Gap opcional                           |
| Editor de foto/vídeo                  | Sí (IMG.LY, ~40 MB de fonts/SDK)                                         | No                                               | **No copiar**                          |
| Atribución / ads                      | Sí (Adjust, AD_ID, AdServices)                                           | No                                               | **No copiar**                          |
| Deep links a contenido                | Sí (`/routine`, `/workout`, `/program`, `/user`)                         | Parcial (app + callback auth)                    | Gap medio                              |
| Tipo `database.types.ts` cableado     | N/A (backend propio)                                                     | **No cableado**                                  | Deuda de motor                         |

---

## 10. Qué AÑADIR a GymLog (priorizado)

> Orden por relación valor/esfuerzo y por encaje con el backlog existente. No empezar más de dos a la vez.

1. **UI del AI Coach (cerrar items 2.14 y 0.8 del TODO).** El backend ya está desplegado con RLS, cuota, memoria y purga; sin chat el trabajo está a medias. Añadir el botón "Aplicar" sobre `SessionExerciseCard` (ya consume claves `coach.*`).
2. **Escritura en Health Connect** (`WRITE_EXERCISE`, `WRITE_WEIGHT`, `WRITE_BODY_FAT`, `WRITE_HEART_RATE`) + rationale y pantalla de permisos. Convierte a GymLog en el hub de salud del usuario en lugar de un consumidor. Requiere ampliar `HealthBridgePlugin.kt` y `healthBridge.ts` (hoy sin métodos de escritura).
3. **Pack de 3–4 widgets** reutilizando la infraestructura que ya funciona (`WidgetBridgePlugin`, `StreakWidgetProvider`): **descanso**, **volumen semanal**, **últimos entrenamientos** y **acceso rápido a rutina de hoy**. Hevy demuestra que son la superficie de retención más barata.
4. **Temporizador de descanso en primer plano** (`foregroundServiceType="specialUse"`, notificación persistente con acciones pausar/+15 s/terminar). En Android evita que el WebView congele el temporizador al bloquear pantalla.
5. **Import de CSV** (y export compatible) para traer datos de otras apps: fideliza al entrar y da salida limpia. `exceljs` ya está en casa.
6. **Strava**: exportación automática de sesiones de cardio. OAuth + subida de actividad. Encaja en `features/cardio`.
7. **Deep links de contenido** (`app.gymlog.dpdns.org/routine/...`, `/workout/...`, esquema `gymlog://`) para compartir rutinas y entrenamientos; el plan de dominio (§6 del TODO) es el momento natural.
8. **Analítica de producto propia** (eventos mínimos, con consentimiento): rutina creada, sesión iniciada, serie registrada, PR, coach usado. Evitar depender de un vendor como Amplitude; Vercel Analytics no da embudos.
9. **Wear OS / watchOS**: solo si aparece demanda real. Hevy lo hace con servicio propio + app aparte; es el item más caro de esta lista.
10. **Escáner de código de barras** para discos/máquinas: valor marginal (Hevy solo lo declara). Dejar para el final.

---

## 11. Qué ELIMINAR o no añadir

### Eliminar en GymLog (ya detectado en tu auditoría)

- **Dead code de knip** (§8 del TODO): 5 archivos sin uso (p. ej. `public/sw-custom.js`, `scripts/optimize-images.mjs`), 39 exports y 29 tipos. Verificar y borrar.
- **Script `analyze` roto en Windows** (item S4): arreglar con `cross-env` o borrarlo.
- **Dependencia fantasma `@dnd-kit/utilities`** (item S1): declararla o dejar de importarla.
- **Páginas gigantes** como estrategia: no eliminarlas, pero **no** añadir features nuevas dentro de `HistoryPage`/`StatsPage` hasta refactorizarlas.

### De Hevy: lo que NO hay que copiar

| Elemento                                   | Motivo                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Adjust + `AD_ID` + AdServices + atribución | Solo tiene sentido monetizando con ads; añade obligaciones de privacidad (Play Data Safety) |
| Amazon IAP + Paddle + RevenueCat a la vez  | Triple pasarela = triple deuda. Si algún día hay pagos, una sola vía                        |
| IMG.LY PE/VS SDK                           | ~40 MB de fuentes y SDK para editar foto/vídeo; GymLog se basta con `html-to-image`         |
| 10 widgets simultáneos                     | Fragmenta mantenimiento en cada release de Android; 3–4 bien elegidos rinden más            |
| `usesCleartextTraffic="true"`              | Permite HTTP en claro (`hevy.com/live_sync/ack` va por HTTP). No es un modelo a seguir      |
| Rive + LAME + VisionCamera                 | Solo si hay una feature concreta que los exija                                              |
| Feed social con TikTok/Instagram           | Coste de moderación y privacidad desproporcionado para una app personal                     |

---

## 12. Qué MEJORAR (el motor de GymLog)

1. **Type-safety de datos de punta a punta.** `src/shared/lib/supabase.ts` crea el cliente sin `<Database>` aunque `database.types.ts` se genera. Cablearlo destapará errores reales en toda la app; hacerlo **antes** de añadir features.
2. **Motor de progresión**: extender `generateTips` (item 0.5) sin romper i18n ni el `slice(0,6)`, y cablear los consejos en la vista de ejercicio (item 0.8). Es el diferencial frente a Hevy: progresión determinista + IA, no caja negra.
3. **Outbox y offline**: el patrón `workoutOutbox` con tests ya es una buena base. Añadir deduplicación e idempotencia para cerrar el bug B2 (ejercicio custom duplicable) y B1 (comparación de timestamps `Z` vs `+00:00`).
4. **Refactor de páginas** (HistoryPage 1316 → ~300, StatsPage 1027 → ~300, WorkoutPage 812 → ~400, UserStatsPage 757 → ~300). Es la diferencia entre una app mantenible y las 28.989 clases de Hevy.
5. **Tests que faltan**: `excelExport` (42 %), `kpiCalculations` (51 %), `historyHelpers` (22 %). Añadir _coverage gates_ + SARIF en CI (§8).
6. **Verificación de seguridad del AI Coach** (items 1.V1–1.V3, 2.V1–2.V9): RLS entre usuarios, cuota no burlable, 403 sin consentimiento, prueba de inyección de prompt. Ya tienes los tests escritos; falta ejecutarlos como checklist.
7. **Accesibilidad**: subir las 3 reglas jsx-a11y de `warn` a `error` (S3) y cerrar la revisión del chat (item 4.3).
8. **Rendimiento en WebView Android**: sin `backdrop-blur` nuevos, medir scroll en dispositivo real (item 4.4). Hevy baja a nativo justo donde la WebView sufre; identifica esos puntos en GymLog antes de añadir nativo.
9. **Observabilidad de sesión**: un crash a mitad de entrenamiento es el fallo más caro. Enviar a Sentry el estado de sesión (ejercicio, serie, tiempo transcurrido) sin datos personales.
10. **Widgets: rendimiento de datos.** Ahora el puente lee un plan semanal; para el pack nuevo conviene cachear en el lado nativo y refrescar por `WorkManager`, no consultar Supabase desde el widget.
11. **Mantenlo pequeño**: Hevy = 176 MB de APK por acumulación. GymLog debería fijar un presupuesto (p. ej. <25 MB de APK) y medirlo en cada release.

---

## 13. Riesgos y límites éticos/legales

- Hevy es software **propietario**. Este informe se limita a **observación estática de un artefacto que ya está en tu dispositivo**, con fines de aprendizaje e interoperabilidad.
- **No reutilizar**: endpoints (`api.hevyapp.com`, `live_sync`), claves expuestas (la `key_live_…` de Branch, Facebook App ID), assets (vídeos/imágenes del CDN CloudFront), textos de i18n ni nombres de producto. Están protegidos o son credenciales de terceros.
- **No** se ha capturado tráfico de red ni se ha instrumentado el proceso: no hay datos de comportamiento real, ni credenciales, ni datos de usuarios de Hevy.
- Copiar funcionalidad y patrones de arquitectura es legítimo; copiar activos, credenciales o implementaciones literales, no.

---

## 14. Cómo reproducir este análisis

```powershell
# 1) Prerequisitos de REA para Android (no los instala REA)
#    jadx-headless-mcp-0.7.1-all.jar  (SHA-256 6e5eacf5…ff75) + apktool_3.0.3.jar + Java 21
$env:REA_JADX_MCP_JAR = "<ruta>\jadx-headless-mcp-0.7.1-all.jar"
$env:REA_APKTOOL_COMMAND = "<ruta>\apktool.bat"   # java -jar "%~dp0apktool_3.0.3.jar" %*

# 2) Estado y extracción del paquete desde el móvil
npx -y rea-agents@6.5.0 inspect-adb-package KFSWGMUKYDNNM7DU com.hevy --format json
npx -y rea-agents@6.5.0 pull-adb-package  KFSWGMUKYDNNM7DU com.hevy --output-directory "<destino>" --format json

# 3) Análisis estático
npx -y rea-agents@6.5.0 identify-flutter-build "<destino>\com.hevy\base.apk" --format json
npx -y rea-agents@6.5.0 decode-android-resources "<destino>\com.hevy\base.apk" --format json --no-strings
npx -y rea-agents@6.5.0 inspect-android-package "<destino>\com.hevy\base.apk" --format json
npx -y rea-agents@6.5.0 search-android-classes "<destino>\com.hevy\base.apk" "com.hevy" --format json
npx -y rea-agents@6.5.0 inspect-android-class "<destino>\com.hevy\base.apk" "com.hevy.HevyReactPackage" --format json
npx -y rea-agents@6.5.0 inspect-android-class "<destino>\com.hevy\base.apk" "com.hevy.MainApplication" --format json

# 4) Señales del bundle Hermes (no hay decompilador de Hermes en REA)
#    Extraer assets/index.android.bundle del ZIP y aplicar el regex de URLs descrito en §6.
```

Aviso: `%TEMP%\opencode\rea-tools\` es temporal. Si quieres reutilizar las herramientas, muévelas a una carpeta estable (p. ej. `C:\Users\franc\tools\rea-tools\`).

---

## 15. Desconocidos y preguntas abiertas

| Pregunta                                                  | Estado                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| ¿Cómo funciona la lógica de Hevy (rutinas, red, paywall)? | **Desconocido**: vive en bytecode Hermes de 22,6 MB y REA no incluye decompilador de Hermes |
| ¿Qué llama realmente la app en red?                       | **Desconocido**: sin captura de tráfico (Fiddler/mitmproxy) ni instrumentación (Frida)      |
| ¿Se usa el escáner ML Kit barcode?                        | **Desconocido**: la dependencia está declarada, 0 cadenas `barcode` en el bundle            |
| ¿Cómo se firman los APK y qué claves?                     | **No verificado**: REA reporta `signature_verification: not_performed`                      |
| ¿Los splits de densidad/idioma cambian el comportamiento? | **No analizado**: solo se inspeccionó `base.apk`                                            |
| ¿Hay `WRITE_*` de salud en el lado JS?                    | **Desconocido** (bytecode); el manifiesto **sí** declara escritura                          |
| ¿Hevy usa los mesociclos de "program"?                    | **Inferido por deep link** `/program`; 0 cadenas `mesocycle`                                |
| ¿Se puede comparar con una versión anterior de Hevy?      | **Pendiente**: requiere conservar un APK previo y `compare-application-versions` (solo JS)  |

---

## 16. Siguientes pasos concretos (checklist)

- [ ] Cablear `database.types.ts` al cliente Supabase y corregir los errores que afloren.
- [ ] Cerrar la UI del AI Coach (2.14 + 0.8) con botón "Aplicar" en `SessionExerciseCard`.
- [ ] Añadir escritura en Health Connect (plug-in + bridge + permisos + rationale).
- [ ] Implementar el widget de temporizador de descanso y el servicio en primer plano.
- [ ] Import de CSV compatible con exportaciones de otras apps.
- [ ] Refactor de `HistoryPage` y `StatsPage` (empezar por la de más líneas).
- [ ] Ejecutar la checklist de seguridad del AI Coach y subir reglas jsx-a11y a `error`.
- [ ] Limpiar dead code confirmado y arreglar el script `analyze`.
