package com.franvi.gymlog

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Puente web -> sistema para el tema.
 *
 * Expone el modo claro/oscuro del sistema (para la opción «Sistema» de Ajustes),
 * permite teñir el fondo de la ventana nativa con el tema elegido por el usuario
 * en JS (evita franjas oscuras en transiciones/overscroll en tema claro) y
 * espeja la preferencia de tema a SharedPreferences para que el splash de la
 * siguiente apertura salga ya con el tema correcto (lo lee MainActivity).
 */
@CapacitorPlugin(name = "ThemeBridge")
class ThemeBridgePlugin : Plugin() {

    @PluginMethod
    fun getSystemDark(call: PluginCall) {
        val ret = JSObject()
        ret.put("dark", isSystemDark())
        call.resolve(ret)
    }

    /** Pinta el fondo de la ventana (detrás del WebView) con el color del tema. */
    @PluginMethod
    fun setWindowBackground(call: PluginCall) {
        val color = call.getString("color") ?: "#0A0A0B"
        activity?.runOnUiThread {
            try {
                activity?.window?.decorView?.setBackgroundColor(Color.parseColor(color))
            } catch (_: IllegalArgumentException) {
                // Color mal formado: no romper el tema por un valor inválido.
            }
        }
        call.resolve()
    }

    /** Espeja la preferencia de tema para que el arranque nativo la lea. */
    @PluginMethod
    fun persistTheme(call: PluginCall) {
        val theme = call.getString("theme") ?: "dark"
        context.getSharedPreferences("GymLogPrefs", Context.MODE_PRIVATE)
            .edit()
            .putString("theme", theme)
            .apply()
        call.resolve()
    }

    private fun isSystemDark(): Boolean {
        val uiMode = activity.resources.configuration.uiMode
        return uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
    }
}
