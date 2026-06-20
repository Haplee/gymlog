package com.franvi.gymlog

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Puente web -> widget Android. La web (JS) envía la racha y el último entreno;
 * los guardamos en SharedPreferences y forzamos el refresco del widget.
 */
@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridgePlugin : Plugin() {

    @PluginMethod
    fun update(call: PluginCall) {
        val streak = call.getInt("streak", 0) ?: 0
        val lastLabel = call.getString("lastLabel", "") ?: ""

        val prefs = context.getSharedPreferences("GymLogWidget", Context.MODE_PRIVATE)
        prefs.edit()
            .putInt("streak", streak)
            .putString("lastLabel", lastLabel)
            .apply()

        // Refrescar todas las instancias del widget
        val mgr = AppWidgetManager.getInstance(context)
        val ids = mgr.getAppWidgetIds(ComponentName(context, StreakWidgetProvider::class.java))
        if (ids.isNotEmpty()) {
            StreakWidgetProvider.updateAll(context, mgr, ids)
        }

        val ret = JSObject()
        ret.put("ok", true)
        call.resolve(ret)
    }
}
