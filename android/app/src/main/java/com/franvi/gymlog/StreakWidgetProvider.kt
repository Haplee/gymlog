package com.franvi.gymlog

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.widget.RemoteViews
/**
 * Widget de pantalla de inicio: muestra la racha actual y el último entreno.
 * Los datos y el color de acento los escribe la web vía WidgetBridgePlugin en
 * SharedPreferences "GymLogWidget". Tocar el widget abre la app; el botón «+»
 * va directo a nuevo entreno.
 */
class StreakWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        updateAll(context, appWidgetManager, appWidgetIds)
    }

    companion object {
        fun updateAll(context: Context, mgr: AppWidgetManager, ids: IntArray) {
            val prefs = context.getSharedPreferences("GymLogWidget", Context.MODE_PRIVATE)
            val streak = prefs.getInt("streak", 0)
            val lastLabel = prefs.getString("lastLabel", "") ?: ""
            val accent = safeParseColor(prefs.getString("accent", "") ?: "", "#FFD93D")
            val accentFg = safeParseColor(prefs.getString("fg", "") ?: "", "#241C00")

            // Abrir la app en general
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val rootPi = launchIntent?.let {
                PendingIntent.getActivity(
                    context,
                    0,
                    it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            }

            // Acción rápida: nuevo entreno (deep link existente)
            val workoutIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("com.franvi.gymlog://workout/new"),
            ).apply {
                setPackage(context.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            val workoutPi = PendingIntent.getActivity(
                context,
                1,
                workoutIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            for (id in ids) {
                val views = RemoteViews(context.packageName, R.layout.widget_streak)
                views.setTextViewText(R.id.widget_streak_value, streak.toString())
                views.setTextViewText(
                    R.id.widget_last_label,
                    if (lastLabel.isBlank()) context.getString(R.string.widget_no_data) else lastLabel,
                )

                // Acento del usuario: valor de racha + FAB de acción rápida
                views.setTextColor(R.id.widget_streak_value, accent)
                views.setInt(R.id.widget_fab_bg, "setColorFilter", accent)
                views.setTextColor(R.id.widget_fab_plus, accentFg)

                rootPi?.let { views.setOnClickPendingIntent(R.id.widget_root, it) }
                views.setOnClickPendingIntent(R.id.widget_fab, workoutPi)

                mgr.updateAppWidget(id, views)
            }
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
