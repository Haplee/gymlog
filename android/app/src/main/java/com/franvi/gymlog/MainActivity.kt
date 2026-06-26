package com.franvi.gymlog

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.getcapacitor.BridgeActivity
import androidx.biometric.BiometricPrompt
import androidx.biometric.BiometricManager
import androidx.core.content.ContextCompat
import android.content.Context

class MainActivity : BridgeActivity() {
    private var lockView: View? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        // Registrar plugins personalizados antes de super.onCreate
        registerPlugin(BiometricPlugin::class.java)
        registerPlugin(WidgetBridgePlugin::class.java)
        registerPlugin(HealthBridgePlugin::class.java)
        
        super.onCreate(savedInstanceState)
        
        // Inicializar canales de notificación
        NotificationHelper.createNotificationChannel(this)

        val window = window
        
        // 1. Edge-to-Edge
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // 2. Transparencia total
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode = 
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }

        // 3. Configurar Insets Listener: publicar los insets reales de las barras
        //    del sistema como variables CSS. El WebView de Android devuelve ~0 en
        //    env(safe-area-inset-top) para la barra de estado, así que la web los
        //    lee de --inset-* en su lugar.
        ViewCompat.setOnApplyWindowInsetsListener(window.decorView) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val d = resources.displayMetrics.density
            val top = (bars.top / d).toInt()
            val right = (bars.right / d).toInt()
            val bottom = (bars.bottom / d).toInt()
            val left = (bars.left / d).toInt()
            val js = """
                document.documentElement.style.setProperty('--inset-top', '${top}px');
                document.documentElement.style.setProperty('--inset-right', '${right}px');
                document.documentElement.style.setProperty('--inset-bottom', '${bottom}px');
                document.documentElement.style.setProperty('--inset-left', '${left}px');
            """.trimIndent()
            bridge?.webView?.post { bridge.webView.evaluateJavascript(js, null) }
            insets
        }
        ViewCompat.requestApplyInsets(window.decorView)

        // 4. Forzar iconos claros/oscuros según el tema
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.isAppearanceLightStatusBars = false 
        controller.isAppearanceLightNavigationBars = false
        
        // 5. Instalar vista de bloqueo si biometría está habilitada
        val prefs = getSharedPreferences("GymLogPrefs", Context.MODE_PRIVATE)
        if (prefs.getBoolean("biometric_enabled", false)) {
            lockView = View(this).apply {
                setBackgroundColor(Color.parseColor("#141418"))
                layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                elevation = 9999f
                isClickable = true
                isFocusable = true
            }
            (window.decorView as ViewGroup).addView(lockView)
        }
    }

    override fun onStart() {
        super.onStart()
        checkBiometricLock()
    }

    private fun checkBiometricLock() {
        val prefs = getSharedPreferences("GymLogPrefs", Context.MODE_PRIVATE)
        val isEnabled = prefs.getBoolean("biometric_enabled", false)

        if (isEnabled) {
            val executor = ContextCompat.getMainExecutor(this)
            val biometricPrompt = BiometricPrompt(this, executor, 
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        super.onAuthenticationError(errorCode, errString)
                        finishAffinity()
                    }
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        super.onAuthenticationSucceeded(result)
                        lockView?.let {
                            (window.decorView as ViewGroup).removeView(it)
                            lockView = null
                        }
                    }
                    override fun onAuthenticationFailed() {
                        super.onAuthenticationFailed()
                    }
                })

            val promptInfo = BiometricPrompt.PromptInfo.Builder()
                .setTitle("GymLog Protegido")
                .setSubtitle("Autentícate para continuar")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                .setConfirmationRequired(false)
                .build()

            window.decorView.postDelayed({
                try {
                    biometricPrompt.authenticate(promptInfo)
                } catch (e: Exception) {
                    e.printStackTrace()
                    finishAffinity()
                }
            }, 500)
        }
    }
}
