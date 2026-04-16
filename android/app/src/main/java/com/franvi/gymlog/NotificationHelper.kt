package com.franvi.gymlog

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

object NotificationHelper {
    const val CHANNEL_ID = "gymlog_notifications"
    const val CHANNEL_NAME = "GymLog Reminders"
    const val CHANNEL_DESC = "Notifications for your training sessions"

    const val CHANNEL_ID_REVIEWS = "gymlog_reviews"
    const val CHANNEL_NAME_REVIEWS = "Progress Updates"
    const val CHANNEL_DESC_REVIEWS = "Stay updated on your gym progress"

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            
            // Channel 1: Training Reminders (High Importance)
            val channel1 = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESC
                enableLights(true)
                lightColor = Color.GREEN
                enableVibration(true)
            }
            manager.createNotificationChannel(channel1)

            // Channel 2: Progress Updates (Default Importance)
            val channel2 = NotificationChannel(
                CHANNEL_ID_REVIEWS,
                CHANNEL_NAME_REVIEWS,
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = CHANNEL_DESC_REVIEWS
            }
            manager.createNotificationChannel(channel2)
        }
    }

    fun showNotification(context: Context, title: String, message: String) {
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info) // TODO: replace with app icon
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)

        val notificationManager = NotificationManagerCompat.from(context)
        try {
            notificationManager.notify(System.currentTimeMillis().toInt(), builder.build())
        } catch (e: SecurityException) {
            e.printStackTrace()
        }
    }
}
