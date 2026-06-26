package com.franvi.gymlog

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

/**
 * Widget de pantalla de inicio: muestra la racha actual y el último entreno.
 * Los datos los escribe la web vía WidgetBridgePlugin en SharedPreferences
 * "GymLogWidget". Tocar el widget abre la app en "nuevo entreno".
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

            for (id in ids) {
                val views = RemoteViews(context.packageName, R.layout.widget_streak)
                views.setTextViewText(R.id.widget_streak_value, streak.toString())
                views.setTextViewText(
                    R.id.widget_last_label,
                    if (lastLabel.isBlank()) context.getString(R.string.widget_no_data) else lastLabel,
                )

                // Tap -> abre la app en nuevo entreno (deep link existente)
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("com.franvi.gymlog://workout/new")).apply {
                    setPackage(context.packageName)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                val pi = PendingIntent.getActivity(context, 0, intent, flags)
                views.setOnClickPendingIntent(R.id.widget_root, pi)

                mgr.updateAppWidget(id, views)
            }
        }
    }
}
