package com.franvi.gymlog

import android.util.Log
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.AggregateRequest
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
import java.time.Period
import java.time.ZoneId
import kotlin.reflect.KClass

// Puente a Health Connect (Android). Lee pasos, HR, sueño y ejercicios — por aquí
// entran los datos de Amazfit (vía Zepp), Samsung, Garmin, etc. Devuelve el mismo
// modelo normalizado que el plugin de HealthKit (iOS).
@CapacitorPlugin(name = "HealthBridge")
class HealthBridgePlugin : Plugin() {
    private val TAG = "HealthBridge"

    /** Tope de registros por tipo al paginar: evita quedarse sin memoria. */
    private val MAX_RECORDS = 20000
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
    fun hasPermissions(call: PluginCall) {
        val client = clientOrNull()
        if (client == null) {
            val ret = JSObject(); ret.put("granted", false); call.resolve(ret); return
        }
        scope.launch {
            val granted = try {
                client.permissionController.getGrantedPermissions().containsAll(permissions)
            } catch (e: Exception) {
                Log.e(TAG, "hasPermissions: ${e.message}")
                false
            }
            val ret = JSObject(); ret.put("granted", granted); call.resolve(ret)
        }
    }

    @PluginMethod
    fun requestAuthorization(call: PluginCall) {
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
        val startDate = LocalDate.parse(startStr)
        val endDate = LocalDate.parse(endStr)
        val startInstant = startDate.atStartOfDay(zone).toInstant()
        val endInstant = endDate.plusDays(1).atStartOfDay(zone).toInstant()
        val filter = TimeRangeFilter.between(startInstant, endInstant)

        scope.launch {
            try {
                val daily = readDaily(client, startDate, endDate)
                val sleep = readSleep(client, filter)
                val (workouts, skippedStrength) = readWorkouts(client, filter)
                // Traza del camino feliz: sin esto es imposible diagnosticar en
                // campo si "no me llegó el dato" fue lectura vacía, permiso o red.
                Log.i(
                    TAG,
                    "readAll [$startStr..$endStr]: daily=${daily.length()} " +
                        "sleep=${sleep.length()} workouts=${workouts.length()} " +
                        "skippedStrength=$skippedStrength",
                )
                val ret = JSObject()
                ret.put("daily", daily)
                ret.put("sleep", sleep)
                ret.put("workouts", workouts)
                ret.put("skippedStrength", skippedStrength)
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

    /**
     * Lee TODAS las páginas de un tipo de registro.
     *
     * readRecords devuelve como mucho pageSize registros (1000 por defecto) y
     * deja el resto detrás de un pageToken; sin paginar se truncaría en silencio.
     * Hoy solo lo usan SleepSessionRecord y ExerciseSessionRecord (bajo volumen);
     * las métricas de alto volumen (pasos, FC…) van por aggregateGroupByPeriod y
     * ni siquiera pasan por aquí. El tope MAX_RECORDS es un cinturón de seguridad
     * frente a un pageToken que no avance, no un límite esperado en la práctica.
     */
    private suspend fun <T : Record> readAllPages(
        client: HealthConnectClient,
        type: KClass<T>,
        filter: TimeRangeFilter,
    ): List<T> {
        val all = mutableListOf<T>()
        var token: String? = null
        do {
            val resp = client.readRecords(
                ReadRecordsRequest(type, filter, pageToken = token),
            )
            all += resp.records
            token = resp.pageToken
            // Cinturón de seguridad: no dar vueltas infinitas si el token no avanza.
        } while (token != null && all.size < MAX_RECORDS)
        return all
    }

    /**
     * Métricas diarias vía agregación, no sumando registros crudos.
     *
     * Dos motivos, ambos medidos en dispositivo:
     *  1. Sumar los registros crudos duplicaba los datos cuando hay más de una
     *     fuente escribiendo lo mismo (el teléfono y el reloj cuentan los mismos
     *     pasos; Fitbit y Amazfit, la misma distancia). Health Connect aplica su
     *     lista de prioridad de apps al agregar y devuelve un único valor.
     *  2. La agregación la resuelve Health Connect en su proceso: ni truncado a
     *     1000 registros ni decenas de miles de muestras de FC en memoria.
     */
    private suspend fun readDaily(
        client: HealthConnectClient,
        startDate: LocalDate,
        endDate: LocalDate,
    ): JSArray {
        val arr = JSArray()
        // La agregación por periodo exige un filtro en tiempo LOCAL, no Instant.
        val localFilter = TimeRangeFilter.between(
            startDate.atStartOfDay(),
            endDate.plusDays(1).atStartOfDay(),
        )
        val buckets = try {
            client.aggregateGroupByPeriod(
                AggregateGroupByPeriodRequest(
                    metrics = setOf(
                        StepsRecord.COUNT_TOTAL,
                        DistanceRecord.DISTANCE_TOTAL,
                        TotalCaloriesBurnedRecord.ENERGY_TOTAL,
                        HeartRateRecord.BPM_AVG,
                        HeartRateRecord.BPM_MAX,
                        RestingHeartRateRecord.BPM_AVG,
                    ),
                    timeRangeFilter = localFilter,
                    timeRangeSlicer = Period.ofDays(1),
                ),
            )
        } catch (e: Exception) {
            Log.e(TAG, "readDaily aggregate: ${e.message}")
            return arr
        }

        for (b in buckets) {
            val o = JSObject()
            o.put("date", b.startTime.toLocalDate().toString())
            var any = false
            b.result[StepsRecord.COUNT_TOTAL]?.let { o.put("steps", it.toInt()); any = true }
            b.result[DistanceRecord.DISTANCE_TOTAL]?.inKilometers
                ?.let { o.put("distance_km", it); any = true }
            b.result[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories
                ?.let { o.put("calories", it.toInt()); any = true }
            b.result[HeartRateRecord.BPM_AVG]?.let { o.put("avg_hr", it.toInt()); any = true }
            b.result[HeartRateRecord.BPM_MAX]?.let { o.put("max_hr", it.toInt()); any = true }
            b.result[RestingHeartRateRecord.BPM_AVG]
                ?.let { o.put("resting_hr", it.toInt()); any = true }
            // Días sin ningún dato no se envían: escribirlos pisaría con NULL lo
            // que ya hubiera en Supabase de una sincronización anterior.
            if (any) arr.put(o)
        }
        return arr
    }

    private suspend fun readSleep(client: HealthConnectClient, filter: TimeRangeFilter): JSArray {
        val arr = JSArray()
        readAllPages(client, SleepSessionRecord::class, filter).forEach { rec ->
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

    /**
     * @return el array de sesiones importables (JSArray) y cuántas sesiones de
     * fuerza (STRENGTH_TRAINING/WEIGHTLIFTING) se descartaron. Una sesión de
     * fuerza de Health Connect no trae ejercicios/series/pesos — no hay forma
     * de reconstruir un entrenamiento real de GymLog a partir de ella, así que
     * NO se importa como cardio "other" (induciría a error). Se cuenta aparte
     * para poder avisar al usuario en vez de importarla en silencio.
     */
    private suspend fun readWorkouts(client: HealthConnectClient, filter: TimeRangeFilter): Pair<JSArray, Int> {
        val arr = JSArray()
        var skippedStrength = 0
        readAllPages(client, ExerciseSessionRecord::class, filter).forEach { rec ->
            if (isStrengthType(rec.exerciseType)) {
                skippedStrength++
                return@forEach
            }
            val o = JSObject()
            o.put("external_id", "hc:${rec.metadata.id}")
            o.put("type", mapExerciseType(rec.exerciseType))
            o.put("started_at", rec.startTime.toString())
            o.put("duration", (rec.endTime.epochSecond - rec.startTime.epochSecond).toInt())
            // Distancia (km) y calorías (kcal) de la sesión — mismo contrato que
            // el plugin de HealthKit (iOS). Best-effort: sin datos o sin permiso
            // de agregación, la sesión se devuelve igualmente sin esos campos.
            try {
                val agg = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(
                            DistanceRecord.DISTANCE_TOTAL,
                            TotalCaloriesBurnedRecord.ENERGY_TOTAL,
                            HeartRateRecord.BPM_AVG,
                            HeartRateRecord.BPM_MAX,
                        ),
                        timeRangeFilter = TimeRangeFilter.between(rec.startTime, rec.endTime),
                    ),
                )
                agg[DistanceRecord.DISTANCE_TOTAL]?.inKilometers
                    ?.takeIf { it > 0 }?.let { o.put("distance", it) }
                agg[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories
                    ?.takeIf { it > 0 }?.let { o.put("calories", it.toInt()) }
                // FC de la sesión: el esquema (cardio_sessions.avg_hr/max_hr) y la
                // RPC ya la soportan; sin esto el cardio importado entraba siempre
                // con FC a NULL aunque Health Connect tuviera el dato.
                agg[HeartRateRecord.BPM_AVG]?.let { o.put("avg_hr", it.toInt()) }
                agg[HeartRateRecord.BPM_MAX]?.let { o.put("max_hr", it.toInt()) }
            } catch (e: Exception) {
                Log.w(TAG, "readWorkouts aggregate: ${e.message}")
            }
            arr.put(o)
        }
        return arr to skippedStrength
    }

    private fun isStrengthType(type: Int): Boolean = when (type) {
        ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING,
        ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING -> true
        else -> false
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
        // Health Connect no tiene tipo de SESIÓN para comba: JUMP_ROPE solo
        // existe como ExerciseSegmentType, así que cae en "other".
        else -> "other"
    }

    private fun emptyResult(): JSObject {
        val ret = JSObject()
        ret.put("daily", JSArray())
        ret.put("sleep", JSArray())
        ret.put("workouts", JSArray())
        ret.put("skippedStrength", 0)
        return ret
    }
}
