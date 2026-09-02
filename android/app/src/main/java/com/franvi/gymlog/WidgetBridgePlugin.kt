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
 * Puente web -> widgets Android. La web escribe aquí lo que los widgets pintan;
 * se guarda en SharedPreferences y se fuerza el refresco de todos.
 *
 * Un solo contrato de datos para todos los widgets a propósito: dos puentes
 * distintos acabarían enseñando cifras que no cuadran entre sí en la misma
 * pantalla de inicio.
 *
 * El plan de la semana viaja ENTERO (7 casillas), no ya resuelto a "lo de hoy":
 * eso es lo que permite a TodayWidgetProvider pasar de día por su cuenta al
 * cruzar la medianoche, sin esperar a que el usuario abra la app.
 */
@CapacitorPlugin(name = "WidgetBridge")
class WidgetBridgePlugin : Plugin() {

    @PluginMethod
    fun update(call: PluginCall) {
        val streak = call.getInt("streak", 0) ?: 0
        val lastLabel = call.getString("lastLabel", "") ?: ""
        val accent = call.getString("accent", "") ?: ""
        val fg = call.getString("fg", "") ?: ""
        val trainedToday = call.getBoolean("trainedToday", false) ?: false

        // Array de 7 nombres de rutina indexado por weekday (1=domingo … 7=sábado).
        // Se guarda como JSON crudo: el provider ya lo sabe leer y así no hay que
        // inventar un formato de serialización propio.
        val weekPlan = call.getArray("weekPlan")?.toString() ?: ""

        // Marca de frescura: la pone el puente, no la web, para que sea la hora
        // del dispositivo que pinta el widget y no la de otro reloj.
        val updatedAt = System.currentTimeMillis()

        val prefs = context.getSharedPreferences("GymLogWidget", Context.MODE_PRIVATE)
        prefs.edit()
            .putInt("streak", streak)
            .putString("lastLabel", lastLabel)
            .putString("accent", accent)
            .putString("fg", fg)
            .putString("weekPlan", weekPlan)
            .putBoolean("trainedToday", trainedToday)
            .putLong("updatedAt", updatedAt)
            .apply()

        refreshAll()

        val ret = JSObject()
        ret.put("ok", true)
        call.resolve(ret)
    }

    /** Refresca las instancias colocadas de cada widget. */
    private fun refreshAll() {
        val mgr = AppWidgetManager.getInstance(context)

        val streakIds = mgr.getAppWidgetIds(ComponentName(context, StreakWidgetProvider::class.java))
        if (streakIds.isNotEmpty()) {
            StreakWidgetProvider.updateAll(context, mgr, streakIds)
        }

        val todayIds = mgr.getAppWidgetIds(ComponentName(context, TodayWidgetProvider::class.java))
        if (todayIds.isNotEmpty()) {
            TodayWidgetProvider.updateAll(context, mgr, todayIds)
        }
    }
}
