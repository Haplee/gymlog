package com.franvi.gymlog

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * Widget de pantalla de inicio: qué toca entrenar hoy.
 *
 * El dato lo escribe la web vía WidgetBridgePlugin en SharedPreferences
 * "GymLogWidget", pero **solo cuando el usuario abre la app**. Eso obliga a dos
 * cosas para que el widget no mienta:
 *
 * 1. El día se resuelve AQUÍ, no allí. Se guarda el plan de la semana entero y
 *    el provider elige la casilla de hoy. Así, al cruzar la medianoche, el
 *    sistema manda ACTION_DATE_CHANGED y el widget pasa solo al día siguiente
 *    sin que nadie abra nada. Guardar "la rutina de hoy" ya resuelta habría
 *    dejado el widget mostrando lo de ayer hasta la próxima apertura.
 * 2. Lo que sí depende del servidor —si ya se ha entrenado— se muestra con la
 *    hora del último refresco. Un dato con fecha es honesto; un dato viejo sin
 *    fecha, no.
 */
class TodayWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        updateAll(context, appWidgetManager, appWidgetIds)
    }

    /**
     * Además del update normal, escuchamos el cambio de día y de hora del
     * sistema. Sin esto el widget se quedaría en el día anterior hasta que el
     * usuario abriese la app.
     */
    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            Intent.ACTION_DATE_CHANGED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            -> refresh(context)
        }
    }

    companion object {
        private const val PREFS = "GymLogWidget"

        /** Refresca todas las instancias colocadas. */
        fun refresh(context: Context) {
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, TodayWidgetProvider::class.java))
            if (ids.isNotEmpty()) updateAll(context, mgr, ids)
        }

        fun updateAll(context: Context, mgr: AppWidgetManager, ids: IntArray) {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val accent = safeParseColor(prefs.getString("accent", "") ?: "", "#FFD93D")
            val accentFg = safeParseColor(prefs.getString("fg", "") ?: "", "#241C00")
            val trainedToday = prefs.getBoolean("trainedToday", false)
            val updatedAt = prefs.getLong("updatedAt", 0L)

            val routineToday = routineForToday(prefs.getString("weekPlan", "") ?: "")

            // Estado de hoy: entrenado > toca rutina > descanso. El orden importa:
            // si ya entrenó, decir "toca Push" sería empujar a repetir.
            val headline = when {
                trainedToday -> context.getString(R.string.widget_today_done)
                routineToday.isNotBlank() -> routineToday
                else -> context.getString(R.string.widget_today_rest)
            }

            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val rootPi = launchIntent?.let {
                PendingIntent.getActivity(
                    context,
                    10,
                    it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            }

            val workoutIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("com.franvi.gymlog://workout/new"),
            ).apply {
                setPackage(context.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            val workoutPi = PendingIntent.getActivity(
                context,
                11,
                workoutIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            for (id in ids) {
                val views = RemoteViews(context.packageName, R.layout.widget_today)
                views.setTextViewText(R.id.today_routine, headline)
                views.setTextColor(R.id.today_routine, accent)
                views.setInt(R.id.today_cta, "setColorFilter", accent)
                views.setTextColor(R.id.today_cta, accentFg)
                views.setTextViewText(R.id.today_updated, freshnessLabel(context, updatedAt))

                rootPi?.let { views.setOnClickPendingIntent(R.id.today_root, it) }
                views.setOnClickPendingIntent(R.id.today_cta, workoutPi)

                mgr.updateAppWidget(id, views)
            }
        }

        /**
         * Casilla de hoy del plan semanal. El JSON es un array de 7 nombres
         * indexado por la convención de Capacitor (1=domingo … 7=sábado), que
         * coincide con `Calendar.DAY_OF_WEEK`.
         *
         * Devuelve cadena vacía ante cualquier dato raro: un widget que dice
         * "descanso" es mejor que uno que peta y desaparece de la pantalla.
         */
        private fun routineForToday(rawJson: String): String {
            if (rawJson.isBlank()) return ""
            return try {
                val plan = JSONArray(rawJson)
                val index = Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - 1
                if (index < 0 || index >= plan.length()) "" else plan.optString(index, "")
            } catch (_: Exception) {
                ""
            }
        }

        /** "Actualizado 08:12", o el texto de sin datos si nunca se ha refrescado. */
        private fun freshnessLabel(context: Context, updatedAt: Long): String {
            if (updatedAt <= 0L) return context.getString(R.string.widget_no_data)
            val hhmm = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(updatedAt))
            return context.getString(R.string.widget_updated_at, hhmm)
        }

        private fun safeParseColor(raw: String, fallback: String): Int {
            return try {
                Color.parseColor(raw)
            } catch (_: IllegalArgumentException) {
                Color.parseColor(fallback)
            }
        }
    }
}
