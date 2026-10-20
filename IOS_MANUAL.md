# GymLog — Libro de funcionalidades + Manual de iOS

> Escrito 2026-07-24. Parte 1 es el "qué tiene la app hoy". Parte 2 es el "cómo
> lo llevamos al iPhone esta tarde", con los dos caminos posibles y qué falta
> por portar para que sea de verdad idéntica a Android.

---

## Parte 1 — El libro: qué tiene GymLog hoy

### 1. Entrenamiento de fuerza (`/`, WorkoutPage)

Sesión activa: eliges ejercicio desde un buscador/catálogo, registras series
(reps + peso, RPE opcional, marca de calentamiento), ves las series de tu
última sesión con ese ejercicio para repetirlas, y guardas el entrenamiento
(se encola offline si no hay conexión). El descanso arranca solo tras cada
serie y se dobla (hasta 10 min) en ejercicios compuestos.

Tres modalidades de carga por ejercicio — **`external`** (barra/mancuerna/
máquina/polea/banda/kettlebell), **`bodyweight`** (peso corporal puro) y
**`bodyweight_loaded`** (peso corporal + lastre) — con el peso corporal vigente
tomado de tus medidas más recientes. Detecta PRs en vivo por banda de
repeticiones usando la **fórmula de Brzycki** para el 1RM estimado
(`src/shared/lib/brzycki.ts`). Incluye calculadora de discos (barras de 20/15/
10/7 kg), notas por ejercicio, borrado de ejercicios propios, "repetir última
sesión", valoración (1-5 ⭐) y notas de la sesión, y un banner para retomar una
sesión dejada a medias (<12 h).

`/exercises` (ExerciseLibraryPage/ExerciseCatalog): explora una base de datos
externa de ejercicios con GIFs de demostración, busca y filtra por músculo/
equipo, y crea ejercicios propios (la modalidad de carga se infiere del
equipo). Los iconos de equipo (barra/mancuerna/máquina/polea/banda/kettlebell/
peso corporal) tienen ahora la forma real de cada implemento, no un icono
genérico (`src/shared/components/icons/EquipmentIcons.tsx`, añadido hoy).

### 2. Cardio (`/cardio`, CardioPage)

8 tipos de cardio (correr, ciclismo, andar, remo, natación, elíptica, comba,
otro), cada uno con su icono. Sesión en vivo con pausa/reanudar; al parar pide
distancia, calorías y notas. Guarda FC media/máxima y de dónde viene el dato
(manual o importado de un wearable). Estadística semanal agregada e historial
con borrado por swipe.

### 3. Rutinas (`/routine`, RoutinePage)

Varias rutinas con nombre, una activa a la vez, ejercicios por día de la
semana reordenables por arrastre. Clonar/borrar rutinas, modo "sesión guiada"
que va paso a paso por los ejercicios del día. Recordatorios locales
reconciliados por rutina/día, más un aviso inmediato al abrir la app si hoy
tocaba entrenar y aún no se ha hecho.

### 4. Estadísticas e historial (`/stats`, `/history`, UserStatsPage)

KPIs: racha actual/máxima, volumen semanal vs. semana pasada (%), sesiones en
30 días, duración media, total de PRs. Gráficas (recharts, lazy): volumen por
grupo muscular, tendencia semanal, progresión de un ejercicio (1RM/peso
máx./volumen, filtro 4/8/12 semanas), comparativa entre dos ejercicios.
**Análisis de fatiga muscular**: por cada grupo muscular calcula días desde el
último entreno y lo clasifica en recuperando (≤2 d) / parcial (3-4 d) /
recuperado (≥5 d o nunca), con un mapa de músculos ponderado por ejercicio, y
sugiere qué entrenar hoy. Historial navegable por fecha, edición/borrado/
repetir, exportar como imagen, e importar/exportar en Excel/CSV (fuerza,
cardio y rutinas). UserStatsPage añade medidas corporales, heatmap de
consistencia, frecuencia por día de la semana y top de ejercicios.

### 5. Salud y wearables (`/wearables`... , WearablesPage)

No hay integración directa con APIs de marca (Fitbit, Garmin...): GymLog lee
del **agregador de salud de la plataforma** — Health Connect en Android,
HealthKit en iOS — así que cualquier reloj que sincronice ahí (Amazfit/Zepp,
Samsung Health, Garmin, Apple Watch) aparece automáticamente. Métricas: pasos,
distancia, calorías, frecuencia cardiaca (media y reposo), sueño y sesiones de
entrenamiento/ejercicio, con sincronización opcional al abrir la app.

### 6. Cuenta y ajustes (SettingsPage)

Login por email/contraseña (con medidor de fortaleza) o Google OAuth vía
Supabase. Onboarding recoge objetivo, días/semana, sexo, altura, peso.
Ajustes: tema oscuro/claro, **26 colores de acento** (con variantes
oscuro/claro pensadas para contraste WCAG AA), icono de la app dinámico según
el acento elegido (o "igualar al acento"), unidades kg/lb, notificaciones
(push/local + permiso de alarma exacta en Android), sonido, visibilidad de
series de calentamiento. **Bloqueo biométrico**: pantalla de bloqueo a pantalla
completa al abrir/reanudar la app, lanza el diálogo biométrico del sistema con
animación de "sonar" mientras verifica, reintento si falla o se cancela.

### 7. Diseño y PWA

Sistema "Stitch": tema oscuro por defecto (`#0a0a0b` base, acento menta
`#60eca8`) con tema claro completo (`:root.light` en `tokens.css`), tipografía
Inter (cuerpo) + Space Grotesk (display/números). La web es una PWA instalable
(`vite-plugin-pwa`, precache de assets, caché `NetworkFirst` para Supabase);
en la app nativa el service worker no se registra porque los assets ya son
locales.

### 8. Funciones nativas Android sin equivalente web

- `AppIconPlugin.kt` — cambia el icono del launcher según el acento (activa/
  desactiva activity-aliases).
- `BiometricPlugin.kt` — huella/Face desde AndroidX BiometricPrompt.
- `StreakWidgetProvider.kt` + `WidgetBridgePlugin.kt` — widget de pantalla de
  inicio con la racha.
- `TrainingReminderWorker.kt` + `NotificationHelper.kt` — recordatorio en
  segundo plano si llevas >48 h sin entrenar.

---

## Parte 2 — El manual: GymLog en el iPhone esta tarde

### Punto de partida importante

El repo **ya tenía preparado** casi todo el terreno para iOS antes de hoy —
no partíamos de cero:

- `ios-custom/` (versionado en git) contiene los plugins nativos Swift
  espejo de los de Android: `BiometricPlugin.swift`/`.m` (Face ID/Touch ID vía
  `LocalAuthentication`) y `HealthBridgePlugin.swift`/`.m` (HealthKit: pasos,
  FC, sueño, entrenamientos), más `App.entitlements` (capability HealthKit),
  el icono `AppIcon-1024.png`, un script `Info.plist.patch.sh` (añade
  `NSFaceIDUsageDescription`, permisos HealthKit y el URL scheme
  `com.franvi.gymlog` para OAuth/deep links) y `add-plugin-to-target.rb`
  (registra los ficheros Swift en el `.pbxproj`).
- `.github/workflows/ios-build.yml` ya construye, en cada push a `main` o tag
  `v*` (o manualmente), un **IPA sin firmar** en un runner macOS gratuito de
  GitHub Actions inyectando todo lo anterior automáticamente.
- `ios/` (el proyecto Xcode en sí) **no se versiona**: se regenera con
  `npx cap add ios` tanto en local como en CI. Hoy, durante la sesión, lo
  generé una vez en local para comprobar que `cap add ios` y `cap sync ios`
  funcionan sin errores (sin problema: no requiere macOS para generarse, solo
  para compilarse) y añadí `ios/` a `.gitignore` para que nadie lo commitee
  por accidente.

Esto cambia el plan: **no hace falta un Mac para tener un IPA instalado esta
tarde** (Camino A). Si además quieres desarrollar/depurar con Xcode en tu Mac
con hot-reload y firma "de verdad", ese es el Camino B.

### Camino A — IPA sin firmar por CI + sideload (sin Mac)

1. Lanza el workflow: en GitHub → pestaña **Actions** → `iOS Build` →
   **Run workflow** (o simplemente haz push/mergea a `main`; también se
   dispara solo). Tarda ~10-15 min en un runner macOS gratuito.
2. Al terminar, descarga el artifact `GymLog-ipa-unsigned` de esa ejecución
   (o, si fue un tag `v*`, el IPA queda adjunto directamente a la Release).
3. El IPA **no está firmado** — iOS no lo instala tal cual. Hay que re-firmarlo
   con un Apple ID (vale la cuenta gratuita) usando una de estas herramientas:
   - **Sideloadly** (Windows o Mac, necesita iTunes instalado en Windows):
     arrastra el IPA, mete tu Apple ID/contraseña, conecta el iPhone por
     cable y dale a Start.
   - **AltStore**: instalas AltServer en el PC/Mac, AltStore en el iPhone
     (por USB una vez), y desde ahí "instalar" el IPA.
   - **Esign/Feather** (todo en el iPhone, sin PC): necesita un certificado
     de firma ya cargado.
4. Límites de la cuenta gratuita: la firma caduca a los **7 días** (hay que
   re-firmar con la misma herramienta), máximo 3 apps sideloaded a la vez, y
   **sin push remoto (APNs)**. HealthKit y Face ID **sí funcionan** con cuenta
   gratuita. Con Apple Developer de pago (99 $/año) la firma dura 1 año y no
   hay límite de apps.

Este camino no requiere Mac en ningún paso — es el más rápido para "tenerlo
en el iPhone hoy".

### Camino B — Xcode en tu Mac (desarrollo real, firma con tu Apple ID)

```bash
npm run build
npx cap add ios --packagemanager CocoaPods   # solo la primera vez, genera ios/
npx cap sync ios
cp ios-custom/BiometricPlugin.swift ios-custom/BiometricPlugin.m ios/App/App/
cp ios-custom/HealthBridgePlugin.swift ios-custom/HealthBridgePlugin.m ios/App/App/
cp ios-custom/App.entitlements ios/App/App/
cp ios-custom/AppIcon-1024.png ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
ruby ios-custom/add-plugin-to-target.rb ios/App/App.xcodeproj
bash ios-custom/Info.plist.patch.sh ios/App/App/Info.plist
npx cap open ios   # abre Xcode
```

En Xcode:

1. Seleccionar el target `App` → pestaña **Signing & Capabilities** → marcar
   "Automatically manage signing" → elegir tu Apple ID como Team (si no
   aparece: Xcode → Settings → Accounts → `+` para añadirlo).
2. Confirmar que `BiometricPlugin.swift`/`.m` y `HealthBridgePlugin.swift`/`.m`
   aparecen en el navegador de ficheros dentro del target `App` (el script
   `add-plugin-to-target.rb` ya los registra; si no aparecieran, arrastrarlos
   a mano al target).
3. Conectar el iPhone por cable, "confiar" en el Mac si lo pide, seleccionarlo
   como destino en la barra superior de Xcode.
4. Run (▶). La primera vez, en el iPhone: Ajustes → General → VPN y gestión de
   dispositivos → confiar en tu Apple ID/certificado.
5. Requiere CocoaPods instalado (`sudo gem install cocoapods` si no lo tienes)
   — `cap add ios --packagemanager CocoaPods` genera `Podfile`/`.xcworkspace`
   en vez de Swift Package Manager, que es lo que espera el resto del
   pipeline.

Con Apple ID gratis, la app instalada así también caduca a los 7 días (hay que
volver a darle a Run desde Xcode). Con cuenta de pago, un año.

### Checklist de paridad Android → iOS

| Función                                                          | Estado en iOS                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Face ID / Touch ID (bloqueo biométrico)                          | ✅ Portado (`BiometricPlugin.swift`), mismo contrato que Android                                                                                                                                                                                             |
| HealthKit (pasos, FC, sueño, entrenamientos)                     | ✅ Portado (`HealthBridgePlugin.swift`)                                                                                                                                                                                                                      |
| Tema claro/oscuro, 26 acentos, i18n, toda la lógica de negocio   | ✅ Idéntico — es la misma web empaquetada                                                                                                                                                                                                                    |
| OAuth Google / deep links                                        | ✅ URL scheme parcheado en Info.plist                                                                                                                                                                                                                        |
| Icono de app dinámico por acento                                 | ❌ No portado. iOS no tiene activity-alias: necesita la API "Alternate Icons" (`UIApplication.setAlternateIconName`) + un icono PNG pre-renderizado por acento en el asset catalog + un plugin Swift nuevo. Hoy solo hay un icono único (`AppIcon-1024.png`) |
| Widget de racha en pantalla de inicio                            | ❌ No portado. Necesita un target WidgetKit aparte (extensión), no es un simple plugin                                                                                                                                                                       |
| Recordatorio en segundo plano (>48h sin entrenar)                | ❌ No portado. El equivalente iOS es `BGTaskScheduler`, con restricciones de frecuencia mucho más estrictas que WorkManager en Android                                                                                                                       |
| Notificaciones locales (fin de descanso, recordatorio de rutina) | ✅ Deberían funcionar (`@capacitor/local-notifications` ya en el proyecto)                                                                                                                                                                                   |
| Push remoto (APNs)                                               | ⚠️ Requiere cuenta de pago (certificado/key APNs)                                                                                                                                                                                                            |
| TestFlight / App Store                                           | ⚠️ Requiere Apple Developer Program de pago (99 $/año)                                                                                                                                                                                                       |

### Lo que solo puedes decidir/hacer tú

- Tener un Mac a mano (Camino B) o resignarte al sideload (Camino A, sin Mac).
- Tu Apple ID y si vale la pena pasar a cuenta de pago (99 $/año) para evitar
  la caducidad de 7 días y poder usar TestFlight.
- Elegir herramienta de sideload si vas por el Camino A (Sideloadly/AltStore/
  Esign) — todas piden tu Apple ID directamente, no hay atajo sin él.

### Qué haré yo cuando me digas "adelante"

En cuanto confirmes el camino (A, B o ambos), ejecuto el paso a paso de
arriba sin volver a preguntar: disparo o reviso el workflow de CI si es el
Camino A, o preparo/dejo listos los comandos exactos para pegar en tu Mac si
es el Camino B (yo no puedo ejecutarlos desde este Windows — Xcode y
CocoaPods no corren aquí).
