package com.franvi.gymlog

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class TrainingReminderWorker(context: Context, workerParams: WorkerParameters) : Worker(context, workerParams) {

    override fun doWork(): Result {
        val prefs = applicationContext.getSharedPreferences("GymLogPrefs", Context.MODE_PRIVATE)
        val lastWorkoutTimestamp = prefs.getLong("last_workout_date", 0)
        val currentTime = System.currentTimeMillis()
        
        // Si han pasado más de 48 horas (2 días) enviamos un recordatorio
        val diffInMs = currentTime - lastWorkoutTimestamp
        val diffInHours = TimeUnit.MILLISECONDS.toHours(diffInMs)

        if (lastWorkoutTimestamp > 0 && diffInHours >= 48) {
            NotificationHelper.showNotification(
                applicationContext,
                "¡Oye! Te echamos de menos",
                "Han pasado $diffInHours horas desde tu último entrenamiento. ¿Le damos caña hoy?"
            )
        }

        return Result.success()
    }
}
