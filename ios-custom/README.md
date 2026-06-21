# `ios-custom/` — staging del nativo iOS

El proyecto nativo `ios/` **no se versiona** (se genera con `npx cap add ios`, que
requiere macOS + Xcode + CocoaPods). Esta carpeta es la **fuente de verdad** del
código nativo iOS custom y se inyecta en el `ios/` efímero:

- `BiometricPlugin.swift` — plugin Capacitor de biometría (Face ID / Touch ID) con
  `LocalAuthentication`. Espejo de `android/app/src/main/java/com/franvi/gymlog/BiometricPlugin.kt`
  y del contrato `src/shared/lib/biometric.ts`.
- `BiometricPlugin.m` — bridge ObjC (`CAP_PLUGIN`) que registra el plugin y sus 3 métodos.
- `Info.plist.patch.sh` — añade el URL scheme `com.franvi.gymlog` (deep links + OAuth)
  y `NSFaceIDUsageDescription`. Idempotente (`PlistBuddy`).
- `add-plugin-to-target.rb` — registra los dos ficheros nativos en el target `App`
  del `.pbxproj` (el template usa file refs explícitas, no synchronized groups).
  Requiere la gema `xcodeproj` (incluida con CocoaPods).

## Qué hace el CI (`.github/workflows/ios-build.yml`)

En runner `macos-latest`, sin firma (solo verifica compilación):

1. `npm ci` + `npm run build` (con secrets Supabase del repo).
2. `npx cap add ios --packagemanager CocoaPods` (genera `ios/`) + `npx cap sync ios`.
3. Copia `BiometricPlugin.swift` y `.m` a `ios/App/App/`.
4. `add-plugin-to-target.rb` (añade los ficheros al target) + `Info.plist.patch.sh`.
5. `pod install` + `xcodebuild ... CODE_SIGNING_ALLOWED=NO`.

Verde = bundle web + Capacitor iOS + plugin Swift + config de deep links compilan.
**No** produce un IPA instalable.

## Integración manual cuando tengas un Mac

```bash
npm run build
npx cap add ios --packagemanager CocoaPods   # genera ios/ (solo la primera vez)
npx cap sync ios
cp ios-custom/BiometricPlugin.swift ios-custom/BiometricPlugin.m ios/App/App/
ruby ios-custom/add-plugin-to-target.rb ios/App/App.xcodeproj
bash ios-custom/Info.plist.patch.sh ios/App/App/Info.plist
npx cap open ios         # abre Xcode
```

En Xcode: añadir los dos ficheros al target `App` (si no aparecen), seleccionar un
equipo de firma y ejecutar en simulador/dispositivo.

### Pendiente (requiere Mac y/o cuenta de pago)

- Firma de código + IPA + TestFlight/App Store (Apple Developer Program, de pago).
- Push remoto APNs (de pago) y Universal Links (entitlement Associated Domains).
- Overlay biométrico al lanzar (equivalente al `onStart` de `MainActivity.kt`):
  va en `SceneDelegate`; el plugin `authenticate()`/`checkBiometry()` ya está listo.
- Iconos iOS (`AppIcon.appiconset`) — `cap add ios` pone defaults.
- Widget de pantalla de inicio (WidgetKit) — target nativo aparte.
