import Foundation
import Capacitor
import LocalAuthentication

/// iOS mirror of android/.../BiometricPlugin.kt.
/// Same JS contract as src/shared/lib/biometric.ts:
///   checkBiometry()        -> { available, status, message }
///   authenticate()         -> { success, message?, code? }   (resolves on cancel, never rejects)
///   setBiometricEnabled()  -> persists UserDefaults["biometric_enabled"]
///
/// Drop into ios/App/App/ (the CI workflow copies it automatically before pod install).
@objc(BiometricPlugin)
public class BiometricPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BiometricPlugin"
    public let jsName = "BiometricPlugin"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkBiometry", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBiometricEnabled", returnType: CAPPluginReturnPromise),
    ]

    private let prefsKey = "biometric_enabled"

    @objc func checkBiometry(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?

        // .deviceOwnerAuthentication = Face ID / Touch ID, falling back to passcode.
        // Mirrors Android's BIOMETRIC_STRONG or DEVICE_CREDENTIAL + isDeviceSecure.
        let available = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)

        call.resolve([
            "available": available,
            "status": available ? 0 : -1,
            "message": available ? "Disponible" : "Debes configurar Face ID, Touch ID o un código en tu iPhone",
        ])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        let context = LAContext()

        context.evaluatePolicy(
            .deviceOwnerAuthentication,
            localizedReason: "Confirma tu identidad"
        ) { success, error in
            // Resolve (not reject) on failure/cancel so the frontend can handle it,
            // exactly like the Android onAuthenticationError path.
            if success {
                call.resolve(["success": true])
            } else {
                let nsError = error as NSError?
                call.resolve([
                    "success": false,
                    "message": nsError?.localizedDescription ?? "Autenticación cancelada",
                    "code": nsError?.code ?? -1,
                ])
            }
        }
    }

    @objc func setBiometricEnabled(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        UserDefaults.standard.set(enabled, forKey: prefsKey)
        call.resolve(["saved": true])
    }
}
