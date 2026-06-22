package com.franvi.gymlog

import android.util.Log
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

// Puente a Health Connect (Android). Lee pasos, HR, sueño y ejercicios — por aquí
// entran los datos de Amazfit (vía Zepp), Samsung, Garmin, etc. Devuelve el mismo
// modelo normalizado que el plugin de HealthKit (iOS) y que la edge function Fitbit.
@CapacitorPlugin(name = "HealthBridge")
class HealthBridgePlugin : Plugin() {
    private val TAG = "HealthBridge"
    private val scope = CoroutineScope(Dispatchers.IO)
    private val zone: ZoneId get() = ZoneId.systemDefault()

    private val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
    )

    private fun clientOrNull(): HealthConnectClient? {
        return if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
            HealthConnectClient.getOrCreate(context)
        } else null
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val ret = JSObject()
        ret.put("available", clientOrNull() != null)
        call.resolve(ret)
    }

    @PluginMethod
    fun requestPermissions(call: PluginCall) {
        val client = clientOrNull()
        if (client == null) {
            val ret = JSObject(); ret.put("granted", false); call.resolve(ret); return
        }
        scope.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                if (granted.containsAll(permissions)) {
                    val ret = JSObject(); ret.put("granted", true); call.resolve(ret)
                    return@launch
                }
                // Lanza la pantalla de permisos de Health Connect vía ActivityResult.
                val contract = PermissionController.createRequestPermissionResultContract()
                val intent = contract.createIntent(context, permissions)
                activity.runOnUiThread {
                    startActivityForResult(call, intent, "permissionCallback")
                }
            } catch (e: Exception) {
                Log.e(TAG, "requestPermissions: ${e.message}")
                val ret = JSObject(); ret.put("granted", false); call.resolve(ret)
            }
        }
    }

    @ActivityCallback
    fun permissionCallback(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val client = clientOrNull()
        if (client == null) {
            val ret = JSObject(); ret.put("granted", false); call.resolve(ret); return
        }
        scope.launch {
            val granted = try {
                client.permissionController.getGrantedPermissions().containsAll(permissions)
            } catch (e: Exception) {
                false
            }
            val ret = JSObject(); ret.put("granted", granted); call.resolve(ret)
        }
    }

    @PluginMethod
    fun readAll(call: PluginCall) {
        val client = clientOrNull()
        if (client == null) {
            call.resolve(emptyResult()); return
        }
        val startStr = call.getString("startDate")
        val endStr = call.getString("endDate")
        if (startStr == null || endStr == null) {
            call.reject("startDate y endDate son obligatorios"); return
        }
        val startInstant = LocalDate.parse(startStr).atStartOfDay(zone).toInstant()
        val endInstant = LocalDate.parse(endStr).plusDays(1).atStartOfDay(zone).toInstant()
        val filter = TimeRangeFilter.between(startInstant, endInstant)

        scope.launch {
            try {
                val daily = readDaily(client, filter)
                val sleep = readSleep(client, filter)
                val workouts = readWorkouts(client, filter)
                val ret = JSObject()
                ret.put("daily", daily)
                ret.put("sleep", sleep)
                ret.put("workouts", workouts)
                call.resolve(ret)
            } catch (e: Exception) {
                Log.e(TAG, "readAll: ${e.message}")
                call.resolve(emptyResult())
            }
        }
    }

    // ---- Lectura por tipo, agregada por fecha local ------------------------

    private fun dateKey(instant: Instant): String =
        LocalDate.ofInstant(instant, zone).toString()

    private suspend fun readDaily(client: HealthConnectClient, filter: TimeRangeFilter): JSArray {
        val steps = HashMap<String, Long>()
        val distance = HashMap<String, Double>()
        val calories = HashMap<String, Double>()
        val resting = HashMap<String, Int>()
        val hrSamples = HashMap<String, MutableList<Long>>()

        client.readRecords(ReadRecordsRequest(StepsRecord::class, filter)).records.forEach {
            val k = dateKey(it.startTime); steps[k] = (steps[k] ?: 0) + it.count
        }
        client.readRecords(ReadRecordsRequest(DistanceRecord::class, filter)).records.forEach {
            val k = dateKey(it.startTime); distance[k] = (distance[k] ?: 0.0) + it.distance.inKilometers
        }
        client.readRecords(ReadRecordsRequest(TotalCaloriesBurnedRecord::class, filter)).records.forEach {
            val k = dateKey(it.startTime); calories[k] = (calories[k] ?: 0.0) + it.energy.inKilocalories
        }
        client.readRecords(ReadRecordsRequest(RestingHeartRateRecord::class, filter)).records.forEach {
            resting[dateKey(it.time)] = it.beatsPerMinute.toInt()
        }
        client.readRecords(ReadRecordsRequest(HeartRateRecord::class, filter)).records.forEach { rec ->
            rec.samples.forEach { s ->
                val k = dateKey(s.time)
                hrSamples.getOrPut(k) { mutableListOf() }.add(s.beatsPerMinute)
            }
        }

        val dates = (steps.keys + distance.keys + calories.keys + resting.keys + hrSamples.keys).toSet()
        val arr = JSArray()
        for (d in dates) {
            val o = JSObject()
            o.put("date", d)
            steps[d]?.let { o.put("steps", it.toInt()) }
            distance[d]?.let { o.put("distance_km", it) }
            calories[d]?.let { o.put("calories", it.toInt()) }
            resting[d]?.let { o.put("resting_hr", it) }
            hrSamples[d]?.let { list ->
                if (list.isNotEmpty()) {
                    o.put("avg_hr", (list.average()).toInt())
                    o.put("max_hr", list.max().toInt())
                }
            }
            arr.put(o)
        }
        return arr
    }

    private suspend fun readSleep(client: HealthConnectClient, filter: TimeRangeFilter): JSArray {
        val arr = JSArray()
        client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, filter)).records.forEach { rec ->
            val o = JSObject()
            o.put("date", dateKey(rec.startTime))
            val totalMin = ((rec.endTime.epochSecond - rec.startTime.epochSecond) / 60).toInt()
            o.put("duration_min", totalMin)
            var deep = 0L; var light = 0L; var rem = 0L; var awake = 0L
            rec.stages.forEach { st ->
                val mins = (st.endTime.epochSecond - st.startTime.epochSecond) / 60
                when (st.stage) {
                    SleepSessionRecord.STAGE_TYPE_DEEP -> deep += mins
                    SleepSessionRecord.STAGE_TYPE_LIGHT -> light += mins
                    SleepSessionRecord.STAGE_TYPE_REM -> rem += mins
                    SleepSessionRecord.STAGE_TYPE_AWAKE,
                    SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED -> awake += mins
                }
            }
            if (deep > 0) o.put("deep_min", deep.toInt())
            if (light > 0) o.put("light_min", light.toInt())
            if (rem > 0) o.put("rem_min", rem.toInt())
            if (awake > 0) o.put("awake_min", awake.toInt())
            arr.put(o)
        }
        return arr
    }

    private suspend fun readWorkouts(client: HealthConnectClient, filter: TimeRangeFilter): JSArray {
        val arr = JSArray()
        client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, filter)).records.forEach { rec ->
            val o = JSObject()
            o.put("external_id", "hc:${rec.metadata.id}")
            o.put("type", mapExerciseType(rec.exerciseType))
            o.put("started_at", rec.startTime.toString())
            o.put("duration", (rec.endTime.epochSecond - rec.startTime.epochSecond).toInt())
            arr.put(o)
        }
        return arr
    }

    private fun mapExerciseType(type: Int): String = when (type) {
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING,
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> "running"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING,
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "cycling"
        ExerciseSessionRecord.EXERCISE_TYPE_ROWING,
        ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE -> "rowing"
        ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL,
        ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER -> "swimming"
        ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL -> "elliptical"
        ExerciseSessionRecord.EXERCISE_TYPE_WALKING,
        ExerciseSessionRecord.EXERCISE_TYPE_HIKING -> "walking"
        else -> "other"
    }

    private fun emptyResult(): JSObject {
        val ret = JSObject()
        ret.put("daily", JSArray())
        ret.put("sleep", JSArray())
        ret.put("workouts", JSArray())
        return ret
    }
}
