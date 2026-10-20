import Foundation
import UIKit
import Capacitor
import LocalAuthentication

/// iOS mirror of android/.../BiometricPlugin.kt.
/// Same JS contract as src/shared/lib/biometric.ts:
///   checkBiometry()        -> { available, status, message }
///   authenticate()         -> { success, message?, code? }   (resolves on cancel, never rejects)
///   setBiometricEnabled()  -> persists UserDefaults["biometric_enabled"]
///
/// Además, espeja el bloqueo al arrancar de MainActivity.kt: si
/// UserDefaults["biometric_enabled"], superpone una vista opaca sobre la web y
/// pide autenticación en el arranque en frío (load) y al volver a primer plano
/// (willEnterForeground). Divergencia deliberada con Android: allí un error de
/// autenticación cierra la app (finishAffinity); en iOS salir programáticamente
/// va contra las guidelines de Apple, así que se mantiene el bloqueo con botón
/// de reintento.
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
    private let retryButtonTag = 9_999
    private var lockView: UIView?

    // MARK: - Bloqueo al arrancar / volver a primer plano

    override public func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
        // Arranque en frío: equivalente a MainActivity.onCreate + onStart.
        DispatchQueue.main.async { [weak self] in
            self?.lockIfEnabled()
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc private func handleWillEnterForeground() {
        lockIfEnabled()
    }

    private func lockIfEnabled() {
        guard UserDefaults.standard.bool(forKey: prefsKey) else { return }
        guard lockView == nil else { return }
        guard let container = bridge?.viewController?.view else { return }

        // Mismo fondo que el lockView de Android (#141418).
        let lock = UIView(frame: container.bounds)
        lock.backgroundColor = UIColor(red: 0x14 / 255.0, green: 0x14 / 255.0, blue: 0x18 / 255.0, alpha: 1)
        lock.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        lock.isUserInteractionEnabled = true
        container.addSubview(lock)
        lockView = lock

        promptUnlock()
    }

    private func promptUnlock() {
        let context = LAContext()
        var error: NSError?
        // Sin Face ID/Touch ID/código configurados no se puede autenticar:
        // no dejar al usuario fuera de su app (mismo criterio que checkBiometry).
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            removeLock()
            return
        }
        context.evaluatePolicy(
            .deviceOwnerAuthentication,
            localizedReason: "Autentícate para continuar"
        ) { [weak self] success, _ in
            DispatchQueue.main.async {
                if success {
                    self?.removeLock()
                } else {
                    self?.showRetryButton()
                }
            }
        }
    }

    private func removeLock() {
        lockView?.removeFromSuperview()
        lockView = nil
    }

    private func showRetryButton() {
        guard let lock = lockView, lock.viewWithTag(retryButtonTag) == nil else { return }
        let button = UIButton(type: .system)
        button.tag = retryButtonTag
        button.setTitle("Reintentar", for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        button.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        lock.addSubview(button)
        NSLayoutConstraint.activate([
            button.centerXAnchor.constraint(equalTo: lock.centerXAnchor),
            button.centerYAnchor.constraint(equalTo: lock.centerYAnchor),
            button.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            button.widthAnchor.constraint(greaterThanOrEqualToConstant: 44),
        ])
    }

    @objc private func retryTapped() {
        promptUnlock()
    }

    // MARK: - Contrato JS

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
