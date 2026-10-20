# `ios-custom/` — staging del nativo iOS

El proyecto nativo `ios/` **no se versiona** (se genera con `npx cap add ios`, que
requiere macOS + Xcode + CocoaPods). Esta carpeta es la **fuente de verdad** del
código nativo iOS custom y se inyecta en el `ios/` efímero:

- `BiometricPlugin.swift` — plugin Capacitor de biometría (Face ID / Touch ID) con
  `LocalAuthentication`. Espejo de `android/app/src/main/java/com/franvi/gymlog/BiometricPlugin.kt`
  y del contrato `src/shared/lib/biometric.ts`.
- `BiometricPlugin.m` — bridge ObjC (`CAP_PLUGIN`) que registra el plugin y sus 3 métodos.
- `HealthBridgePlugin.swift` / `.m` — plugin HealthKit (lectura de pasos, FC, sueño,
  workouts) para la feature wearables.
- `App.entitlements` — capability HealthKit (`CODE_SIGN_ENTITLEMENTS` lo apunta
  `add-plugin-to-target.rb`; se aplica al firmar).
- `AppIcon-1024.png` — icono de app 1024×1024 **sin canal alfa** (requisito iOS),
  aplanado sobre `#0a0a0b` desde `public/icon-512x512.png`. El CI lo copia sobre el
  `AppIcon.appiconset` del template.
- `Info.plist.patch.sh` — añade el URL scheme `com.franvi.gymlog` (deep links + OAuth),
  `NSFaceIDUsageDescription` y los usage descriptions de HealthKit. Idempotente (`PlistBuddy`).
- `add-plugin-to-target.rb` — registra los ficheros nativos en el target `App`
  del `.pbxproj` (el template usa file refs explícitas, no synchronized groups).
  Requiere la gema `xcodeproj` (incluida con CocoaPods).

## Qué hace el CI (`.github/workflows/ios-build.yml`)

En runner `macos-latest`, **produce un IPA sin firmar** (Release, SDK `iphoneos`):

1. `npm ci` + `npm run build` (con secrets Supabase del repo).
2. `npx cap add ios --packagemanager CocoaPods` (genera `ios/`) + `npx cap sync ios`.
3. Copia plugins nativos + entitlements + icono; `add-plugin-to-target.rb` +
   `Info.plist.patch.sh`.
4. `pod install` + `xcodebuild -configuration Release -sdk iphoneos
CODE_SIGNING_ALLOWED=NO` con la versión de `package.json` (`MARKETING_VERSION`).
5. Empaqueta `Payload/App.app` → `GymLog-unsigned-vX.Y.Z.ipa`, lo sube como
   artifact `GymLog-ipa-unsigned` y, en push de tag `v*`, lo adjunta a la release.

## Instalar el IPA (sin App Store, sin cuenta de pago)

El IPA va **sin firmar**: iOS no lo instala tal cual. Hay que re-firmarlo con un
Apple ID (cuenta gratuita vale) usando una herramienta de sideload:

- **Sideloadly** (Windows/macOS; necesita iTunes en Windows) — arrastra el IPA,
  pon tu Apple ID, conecta el iPhone por USB.
- **AltStore** (AltServer en el PC) — instala AltStore en el iPhone y añade el IPA.
- **Esign / Feather** (on-device) — necesita un certificado ya instalado.

Límites de la cuenta gratuita: la firma caduca a los **7 días** (re-firmar con la
misma herramienta), máx. 3 apps sideloaded, y **sin push remoto APNs**. HealthKit
sí funciona con cuenta gratuita. Con Apple Developer de pago (99 $/año) la firma
dura 1 año y no hay límite de 3 apps.

## Integración manual cuando tengas un Mac

```bash
npm run build
npx cap add ios --packagemanager CocoaPods   # genera ios/ (solo la primera vez)
npx cap sync ios
cp ios-custom/BiometricPlugin.swift ios-custom/BiometricPlugin.m ios/App/App/
cp ios-custom/HealthBridgePlugin.swift ios-custom/HealthBridgePlugin.m ios/App/App/
cp ios-custom/App.entitlements ios/App/App/
cp ios-custom/AppIcon-1024.png ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
ruby ios-custom/add-plugin-to-target.rb ios/App/App.xcodeproj
bash ios-custom/Info.plist.patch.sh ios/App/App/Info.plist
npx cap open ios         # abre Xcode
```

En Xcode: añadir los ficheros al target `App` (si no aparecen), seleccionar un
equipo de firma y ejecutar en simulador/dispositivo.

### Pendiente (requiere Mac y/o cuenta de pago)

- TestFlight/App Store (Apple Developer Program, de pago).
- Push remoto APNs (de pago) y Universal Links (entitlement Associated Domains).
- Overlay biométrico al lanzar (equivalente al `onStart` de `MainActivity.kt`):
  va en `SceneDelegate`; el plugin `authenticate()`/`checkBiometry()` ya está listo.
- Widget de pantalla de inicio (WidgetKit) — target nativo aparte.
