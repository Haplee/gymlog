package com.franvi.gymlog

import android.util.Log
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "BiometricPlugin")
class BiometricPlugin : Plugin() {
    private val TAG = "BiometricPlugin"

    @PluginMethod
    fun checkBiometry(call: PluginCall) {
        Log.d(TAG, "checkBiometry called")
        try {
            val activity = activity ?: throw Exception("Actividad no disponible")
            val biometricManager = BiometricManager.from(context)
            val keyguardManager = activity.getSystemService(android.content.Context.KEYGUARD_SERVICE) as android.app.KeyguardManager
            
            val canAuthenticate = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
            val isSecure = keyguardManager.isDeviceSecure
            
            Log.d(TAG, "Detección: canAuthenticate=$canAuthenticate, isSecure=$isSecure")

            val available = canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS || isSecure
            
            val ret = JSObject()
            ret.put("available", available)
            ret.put("status", canAuthenticate)
            ret.put("message", if (available) "Disponible" else "Debes configurar un PIN o Huella en tu móvil")
            
            call.resolve(ret)
        } catch (e: Exception) {
            Log.e(TAG, "Error en checkBiometry: ${e.message}")
            val ret = JSObject()
            ret.put("available", false)
            ret.put("status", -1)
            ret.put("message", "Error de detección: ${e.message}")
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun authenticate(call: PluginCall) {
        val activity = activity
        if (activity == null) {
            call.reject("Actividad no encontrada")
            return
        }
        
        val executor = ContextCompat.getMainExecutor(context)
        
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Acceso GymLog")
            .setSubtitle("Confirma tu identidad")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
            .build()

        activity.runOnUiThread {
            try {
                val biometricPrompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        super.onAuthenticationError(errorCode, errString)
                        val ret = JSObject()
                        ret.put("success", false)
                        ret.put("message", errString.toString())
                        ret.put("code", errorCode)
                        // No rechazamos con error fatal para que el frontend pueda manejar el "cancelado"
                        call.resolve(ret)
                    }

                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        super.onAuthenticationSucceeded(result)
                        val ret = JSObject()
                        ret.put("success", true)
                        call.resolve(ret)
                    }

                    override fun onAuthenticationFailed() {
                        super.onAuthenticationFailed()
                    }
                })
                biometricPrompt.authenticate(promptInfo)
            } catch (e: Exception) {
                call.reject("Error al iniciar biometric: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun setBiometricEnabled(call: PluginCall) {
        val enabled = call.getBoolean("enabled", false) ?: false
        val prefs = context.getSharedPreferences("GymLogPrefs", android.content.Context.MODE_PRIVATE)
        prefs.edit().putBoolean("biometric_enabled", enabled).apply()
        
        val ret = JSObject()
        ret.put("saved", true)
        call.resolve(ret)
    }
}
