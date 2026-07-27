package com.franvi.gymlog

import android.util.Log
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
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
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
    )

    /**
     * Leer datos de OTRAS apps con la nuestra en segundo plano exige este permiso
     * aparte. Sin él, Health Connect responde SecurityException
     * (`maybeEnforceOnlyCallingPackageDataRequested`) y la sync queda en nada —
     * medido en dispositivo: con la pantalla bloqueada, readAll fallaba entero.
     * Va aparte de `permissions` a propósito: es deseable, no imprescindible. Si
     * el usuario lo deniega, la sync en primer plano debe seguir funcionando.
     */
    private val backgroundPermission = HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND

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
                if (granted.containsAll(permissions + backgroundPermission)) {
                    val ret = JSObject(); ret.put("granted", true); call.resolve(ret)
                    return@launch
                }
                // Lanza la pantalla de permisos de Health Connect vía ActivityResult.
                // Se pide también el de segundo plano; que lo deniegue no bloquea
                // nada (hasPermissions solo exige los de datos).
                val contract = PermissionController.createRequestPermissionResultContract()
                val intent = contract.createIntent(context, permissions + backgroundPermission)
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
            // Cada lectura va aislada. Con un try/catch común, un solo fallo
            // —típicamente la SecurityException de Health Connect al leer datos
            // de otras apps en segundo plano— vaciaba TAMBIÉN diarios y entrenos,
            // y la app lo mostraba como "no hay datos". Medido en dispositivo con
            // la pantalla bloqueada: readAll entero a cero por el sueño.
            val errors = JSArray()
            val daily = section("daily", errors) { readDaily(client, startDate, endDate) }
                ?: JSArray()
            val sleep = section("sleep", errors) { readSleep(client, filter) } ?: JSArray()
            val sessions = section("workouts", errors) { readWorkouts(client, filter) }
            val workouts = sessions?.first ?: JSArray()
            val strength = sessions?.second ?: JSArray()

            // Traza del camino feliz: sin esto es imposible diagnosticar en
            // campo si "no me llegó el dato" fue lectura vacía, permiso o red.
            // Nivel W a propósito: proguard-android-optimize.txt elimina
            // Log.v/d/i con -assumenosideeffects, así que en la APK de release
            // —la única que se instala— una traza en Log.i no existe.
            Log.w(
                TAG,
                "readAll [$startStr..$endStr]: daily=${daily.length()} " +
                    "sleep=${sleep.length()} workouts=${workouts.length()} " +
                    "strength=${strength.length()} errors=${errors.length()}",
            )
            val ret = JSObject()
            ret.put("daily", daily)
            ret.put("sleep", sleep)
            ret.put("workouts", workouts)
            ret.put("strengthSessions", strength)
            ret.put("errors", errors)
            call.resolve(ret)
        }
    }

    /** Ejecuta una lectura acotando su fallo a esa sección; null si peta. */
    private suspend fun <T> section(name: String, errors: JSArray, block: suspend () -> T): T? =
        try {
            block()
        } catch (e: Exception) {
            Log.e(TAG, "readAll/$name: ${e.message}")
            errors.put("$name: ${e.message}")
            null
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
     * Lee las sesiones de ejercicio y las reparte en dos cubos:
     *  - **cardio**: va a `cardio_sessions` con un tipo de GymLog.
     *  - **fuerza/gimnasio**: va a `health_sessions`. Una sesión de fuerza de
     *    Health Connect no trae ejercicios/series/pesos, así que no reconstruye
     *    un entrenamiento de GymLog; pero su tiempo, kcal y FC sí valen y antes
     *    se tiraban — o peor, entraban como cardio "otro".
     *
     * @return (cardio, fuerza)
     */
    private suspend fun readWorkouts(
        client: HealthConnectClient,
        filter: TimeRangeFilter,
    ): Pair<JSArray, JSArray> {
        val cardio = JSArray()
        val strength = JSArray()
        readAllPages(client, ExerciseSessionRecord::class, filter).forEach { rec ->
            // Traza obligatoria del tipo CRUDO. Sin esto, el `else` del mapeo se
            // come en silencio cualquier int desconocido y desde fuera del
            // dispositivo es imposible saber qué escribió la app de salud — que es
            // exactamente cómo una sesión de pesas y una de cinta acabaron las dos
            // como cardio "otro". Nivel W: R8 elimina Log.i en release.
            Log.w(
                TAG,
                "session type=${rec.exerciseType} title=${rec.title} " +
                    "origin=${rec.metadata.dataOrigin.packageName} " +
                    "${rec.startTime}..${rec.endTime}",
            )
            val o = JSObject()
            o.put("external_id", "hc:${rec.metadata.id}")
            o.put("started_at", rec.startTime.toString())
            o.put("ended_at", rec.endTime.toString())
            val durationSec = (rec.endTime.epochSecond - rec.startTime.epochSecond).toInt()
            o.put("duration", durationSec)
            // El título que puso la app de origen ("Cinta", "Pesas"…). Es lo que
            // hace que la sesión se reconozca en el historial en vez de aparecer
            // como una fila anónima.
            rec.title?.takeIf { it.isNotBlank() }?.let { o.put("title", it) }

            // Distancia (km), calorías (kcal) y FC de la sesión — mismo contrato
            // que el plugin de HealthKit (iOS). Best-effort: sin datos o sin
            // permiso, la sesión se devuelve igualmente sin esos campos.
            var km: Double? = null
            try {
                val agg = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(
                            DistanceRecord.DISTANCE_TOTAL,
                            ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL,
                            TotalCaloriesBurnedRecord.ENERGY_TOTAL,
                            HeartRateRecord.BPM_AVG,
                            HeartRateRecord.BPM_MAX,
                        ),
                        timeRangeFilter = TimeRangeFilter.between(rec.startTime, rec.endTime),
                    ),
                )
                km = agg[DistanceRecord.DISTANCE_TOTAL]?.inKilometers?.takeIf { it > 0 }
                km?.let { o.put("distance", it) }
                // Calorías ACTIVAS, no totales: el total incluye el metabolismo
                // basal y en una sesión de pesas de ~1h inflaba la cifra (523 kcal
                // medidos en dispositivo). Se cae al total solo si no hay activas.
                val active = agg[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories
                val total = agg[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories
                (active ?: total)?.takeIf { it > 0 }?.let { o.put("calories", it.toInt()) }
                // Cuál de las dos se usó: si la fuente no escribe activas, las
                // kcal que enseña la app llevan el basal dentro y quedan altas.
                // Sin esta traza eso solo se puede suponer.
                Log.w(TAG, "  kcal active=$active total=$total")
                agg[HeartRateRecord.BPM_AVG]?.let { o.put("avg_hr", it.toInt()) }
                agg[HeartRateRecord.BPM_MAX]?.let { o.put("max_hr", it.toInt()) }
            } catch (e: Exception) {
                Log.w(TAG, "readWorkouts aggregate: ${e.message}")
            }

            val known = mapKnownExerciseType(rec.exerciseType)
            if (isStrengthType(rec.exerciseType) || (known == null && !hasDistance(km))) {
                // Tipo de fuerza declarado, o tipo desconocido sin distancia: lo
                // segundo es lo que escribe Google Health para una sesión de
                // gimnasio (OTHER_WORKOUT). Sin metros recorridos, cardio es lo
                // único que seguro no es.
                o.put("type", "strength")
                strength.put(o)
            } else {
                o.put("type", known ?: inferTypeFromPace(km, durationSec))
                cardio.put(o)
            }
        }
        return cardio to strength
    }

    /** Distancia significativa: 0,01 km es ruido del GPS dentro del gimnasio. */
    private fun hasDistance(km: Double?): Boolean = km != null && km >= 0.2

    private fun isStrengthType(type: Int): Boolean = when (type) {
        ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING,
        ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING,
        ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS,
        ExerciseSessionRecord.EXERCISE_TYPE_GYMNASTICS -> true
        else -> false
    }

    /** Tipo de GymLog para un `EXERCISE_TYPE_*` conocido; null si no lo es. */
    private fun mapKnownExerciseType(type: Int): String? = when (type) {
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
        // Cardio reconocible que GymLog no tipifica: se queda en "other", pero
        // como CARDIO — no debe caer en el respaldo de gimnasio de abajo.
        // (Health Connect no tiene tipo de SESIÓN para comba: JUMP_ROPE solo
        // existe como ExerciseSegmentType.)
        ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING,
        ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING_MACHINE,
        ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING,
        ExerciseSessionRecord.EXERCISE_TYPE_DANCING,
        ExerciseSessionRecord.EXERCISE_TYPE_BOXING,
        ExerciseSessionRecord.EXERCISE_TYPE_MARTIAL_ARTS,
        ExerciseSessionRecord.EXERCISE_TYPE_SKATING,
        ExerciseSessionRecord.EXERCISE_TYPE_SKIING,
        ExerciseSessionRecord.EXERCISE_TYPE_SNOWBOARDING,
        ExerciseSessionRecord.EXERCISE_TYPE_PADDLING,
        ExerciseSessionRecord.EXERCISE_TYPE_ROCK_CLIMBING -> "other"
        else -> null
    }

    /**
     * Último recurso para un tipo desconocido que SÍ recorrió distancia: deducir
     * por velocidad media. Preferible a marcarlo "otro", que no dice nada.
     */
    private fun inferTypeFromPace(km: Double?, durationSec: Int): String {
        if (km == null || km <= 0 || durationSec <= 0) return "other"
        val kmh = km / (durationSec / 3600.0)
        return when {
            kmh >= 15.0 -> "cycling"
            kmh >= 7.0 -> "running"
            else -> "walking"
        }
    }

    private fun emptyResult(): JSObject {
        val ret = JSObject()
        ret.put("daily", JSArray())
        ret.put("sleep", JSArray())
        ret.put("workouts", JSArray())
        ret.put("strengthSessions", JSArray())
        ret.put("errors", JSArray())
        return ret
    }
}
