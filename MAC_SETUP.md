# GymLog en Mac — qué instalar y qué hacer

> Guía autocontenida de la parte que solo se puede hacer en un Mac (compilar y
> firmar la app iOS). El resto del proyecto (Android, web, Supabase) no
> necesita Mac para nada. Para el detalle de funcionalidades y el checklist de
> paridad Android → iOS, ver `IOS_MANUAL.md`.

---

## 1. Qué instalar

| Programa        | Para qué                                                           | Cómo se instala                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Xcode**       | Compilar, firmar y ejecutar la app iOS                             | App Store (gratis)                                                                                                                                                                |
| **CocoaPods**   | Gestor de dependencias nativas que usa el proyecto iOS (`Podfile`) | `sudo gem install cocoapods` en Terminal                                                                                                                                          |
| **Node.js 18+** | Igual que en Windows: `npm run build`, `npx cap ...`               | [nodejs.org](https://nodejs.org) o `brew install node`                                                                                                                            |
| **Apple ID**    | Firmar la app en tu iPhone                                         | Uno normal (gratis) sirve para desarrollo local; de pago (99 $/año, Apple Developer Program) hace falta solo para TestFlight/App Store o para que la firma no caduque cada 7 días |

No hace falta instalar Android Studio, Java ni nada de Android en el Mac — eso ya está resuelto en Windows.

## 2. Clonar el repo y traer las dependencias

```bash
git clone https://github.com/Haplee/gymlog.git
cd gymlog
npm install
```

## 3. Generar el proyecto iOS y aplicar los plugins nativos propios

`ios/` **no está en git** (se regenera siempre desde cero, como `android/` con
`cap sync` pero sin versionarse). `ios-custom/` sí está versionado: son los
plugins Swift espejo de los de Android (biometría, HealthKit) más un par de
scripts que los inyectan en el proyecto Xcode generado.

```bash
npm run build
npx cap add ios --packagemanager CocoaPods   # genera ios/, solo la primera vez
npx cap sync ios

cp ios-custom/BiometricPlugin.swift ios-custom/BiometricPlugin.m ios/App/App/
cp ios-custom/HealthBridgePlugin.swift ios-custom/HealthBridgePlugin.m ios/App/App/
cp ios-custom/App.entitlements ios/App/App/
cp ios-custom/AppIcon-1024.png ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
ruby ios-custom/add-plugin-to-target.rb ios/App/App.xcodeproj
bash ios-custom/Info.plist.patch.sh ios/App/App/Info.plist

npx cap open ios   # abre Xcode
```

> **Nota sobre el fix de hoy (2026-07-24):** `HealthBridgePlugin.swift` se
> acaba de tocar (ya no importa sesiones de fuerza de HealthKit como cardio
> "other"; nuevo campo `skippedStrength` en la respuesta de `readAll`). Ese
> cambio se ha escrito y revisado en Windows pero **nunca se ha compilado**
> porque aquí no hay Xcode — la primera vez que generes `ios/` en el Mac es
> también la primera compilación real de ese fix. Si Xcode se queja de algo en
> ese fichero, es el sitio para arreglarlo.

## 4. Firmar y ejecutar en tu iPhone

En Xcode, con el proyecto abierto:

1. Panel izquierdo → target **App** → pestaña **Signing & Capabilities**.
2. Marca **"Automatically manage signing"** y elige tu Apple ID como **Team**
   (si no aparece: Xcode → Settings → Accounts → botón `+` para añadirlo).
3. Comprueba que `BiometricPlugin.swift`/`.m` y
   `HealthBridgePlugin.swift`/`.m` aparecen en el navegador de ficheros dentro
   del target `App` (el script `add-plugin-to-target.rb` ya los registra; si
   no aparecieran, arrástralos a mano al target).
4. Conecta el iPhone por cable, confía en el Mac si te lo pide, y selecciónalo
   como destino en la barra superior de Xcode (junto al botón ▶).
5. Pulsa **Run (▶)**.
6. La primera vez, en el iPhone: **Ajustes → General → VPN y gestión de
   dispositivos** → confía en tu Apple ID/certificado.

Con Apple ID gratis, la app caduca a los **7 días** (hay que volver a darle a
Run desde Xcode para renovarla). Con cuenta de pago, dura un año y además
desbloquea TestFlight.

## 5. Alternativa sin usar Xcode para instalar (IPA de CI + sideload)

Si solo quieres tener la app en el iPhone sin tocar Xcode:

1. En GitHub → pestaña **Actions** → workflow `iOS Build` → **Run workflow**
   (o espera a que se dispare solo en un push/tag). Compila un **IPA sin
   firmar** en un runner macOS gratuito — no usa tu Mac para nada.
2. Descarga el artifact `GymLog-ipa-unsigned` (o, si fue un tag `v*`, ya viene
   adjunto a la Release de GitHub).
3. Re-fírmalo con tu Apple ID usando **Sideloadly** o **AltStore** e
   instálalo por cable. Mismas limitaciones de cuenta gratuita: 7 días, sin
   push remoto (APNs).

## 6. Qué NO vas a tener todavía en iOS

Portado y funcionando: Face ID/Touch ID, HealthKit (pasos/FC/sueño/entrenos,
incluido el fix de hoy), tema/acentos/i18n, OAuth Google/deep links,
notificaciones locales.

Sin portar (necesitan trabajo nativo extra, no son solo "compilar en Mac"):
icono dinámico por acento (necesita "Alternate Icons" + un plugin Swift
nuevo), widget de racha en pantalla de inicio (necesita un target WidgetKit
aparte), recordatorio en segundo plano >48h sin entrenar (equivalente iOS es
`BGTaskScheduler`, con restricciones distintas a WorkManager de Android).

Ver `IOS_MANUAL.md` para el detalle completo de cada punto.
