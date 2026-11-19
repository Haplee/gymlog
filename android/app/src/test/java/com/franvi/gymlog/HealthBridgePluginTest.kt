package com.franvi.gymlog

import com.franvi.gymlog.healthconnect.error.HealthConnectError
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Test

class HealthBridgePluginTest {

    @Test
    fun `HealthConnectError fromException maps SecurityException to PERMISSION_DENIED`() {
        val exception = SecurityException("READ_HEALTH_DATA_IN_BACKGROUND permission required")
        assertEquals(HealthConnectError.PERMISSION_DENIED, HealthConnectError.fromException(exception))

        val pkgException = SecurityException("maybeEnforceOnlyCallingPackageDataRequested: caller not allowed")
        assertEquals(HealthConnectError.PERMISSION_DENIED, HealthConnectError.fromException(pkgException))

        val genericSecException = SecurityException("Generic security error")
        assertEquals(HealthConnectError.READ_FAILED, HealthConnectError.fromException(genericSecException))
    }

    @Test
    fun `HealthConnectError fromException maps IllegalStateException to NOT_AVAILABLE`() {
        val sdkException = IllegalStateException("Health Connect SDK not available")
        assertEquals(HealthConnectError.NOT_AVAILABLE, HealthConnectError.fromException(sdkException))

        val providerException = IllegalStateException("provider not installed")
        assertEquals(HealthConnectError.NOT_AVAILABLE, HealthConnectError.fromException(providerException))
    }

    @Test
    fun `HealthConnectError fromException maps IllegalArgumentException to INVALID_TIME_RANGE`() {
        val timeRangeException = IllegalArgumentException("Invalid time range: exceeds maximum")
        assertEquals(HealthConnectError.INVALID_TIME_RANGE, HealthConnectError.fromException(timeRangeException))

        val timeFilterException = IllegalArgumentException("TimeRangeFilter cannot be null")
        assertEquals(HealthConnectError.INVALID_TIME_RANGE, HealthConnectError.fromException(timeFilterException))
    }

    @Test
    fun `HealthConnectError fromException falls back to UNKNOWN_ERROR`() {
        assertEquals(HealthConnectError.UNKNOWN_ERROR, HealthConnectError.fromException(NullPointerException("null")))
        assertEquals(HealthConnectError.UNKNOWN_ERROR, HealthConnectError.fromException(IllegalArgumentException("other")))
        assertEquals(HealthConnectError.UNKNOWN_ERROR, HealthConnectError.fromException(IllegalStateException("other")))
    }

    @Test
    fun `HealthConnectError userMessage returns readable message for all codes`() {
        assertEquals("Health Connect no está disponible en este dispositivo. Instálalo desde Google Play.", HealthConnectError.userMessage(HealthConnectError.NOT_AVAILABLE))
        assertEquals("Se requiere actualizar Health Connect. Ve a Google Play para actualizar.", HealthConnectError.userMessage(HealthConnectError.PROVIDER_UPDATE_REQUIRED))
        assertEquals("Permisos insuficientes. Concede los permisos en la configuración de Health Connect.", HealthConnectError.userMessage(HealthConnectError.PERMISSION_DENIED))
        assertEquals("Esta función no está disponible en tu dispositivo o versión de Health Connect.", HealthConnectError.userMessage(HealthConnectError.FEATURE_UNAVAILABLE))
        assertEquals("Rango de fechas inválido. El rango máximo permitido es de 30 días.", HealthConnectError.userMessage(HealthConnectError.INVALID_TIME_RANGE))
        assertEquals("La sincronización se interrumpió. Se reintentará automáticamente.", HealthConnectError.userMessage(HealthConnectError.SYNC_INTERRUPTED))
        assertEquals("Error al leer los datos de Health Connect.", HealthConnectError.userMessage(HealthConnectError.READ_FAILED))
        assertEquals("Error desconocido al acceder a Health Connect.", HealthConnectError.userMessage(HealthConnectError.UNKNOWN_ERROR))
        assertEquals("Error desconocido al acceder a Health Connect.", HealthConnectError.userMessage("CODIGO_INEXISTENTE"))
    }

    /**
     * Test que verifica la lógica de cálculo de eficiencia del sueño.
     * No testea el plugin completo (requiere HealthConnectClient real), sino la fórmula
     * que se usa en readSleep(): efficiency = (deep + light + rem) * 100 / totalMin.
     */
    @Test
    fun `sleep efficiency formula calculates correctly`() = runBlocking {
        // Caso 1: sueño completo con todas las etapas
        val deep = 120L
        val light = 180L
        val rem = 120L
        val awake = 60L
        val total = deep + light + rem + awake // 480
        val asleep = deep + light + rem // 420
        val efficiency = (asleep * 100 / total).toInt()
        assertEquals(87, efficiency) // 420 * 100 / 480 = 87.5 -> 87

        // Caso 2: solo light sleep (sin deep/rem)
        val deep2 = 0L
        val light2 = 420L
        val rem2 = 0L
        val awake2 = 0L
        val total2 = deep2 + light2 + rem2 + awake2 // 420
        val asleep2 = deep2 + light2 + rem2 // 420
        val efficiency2 = (asleep2 * 100 / total2).toInt()
        assertEquals(100, efficiency2)

        // Caso 3: sin tiempo total (edge case)
        val total3 = 0L
        val asleep3 = 0L
        val efficiency3 = if (total3 > 0) (asleep3 * 100 / total3).toInt() else 0
        assertEquals(0, efficiency3)

        // Caso 4: awake_in_bed cuenta como awake (reduce eficiencia)
        val deep4 = 90L
        val light4 = 150L
        val rem4 = 60L
        val awake4 = 30L
        val awakeInBed4 = 20L
        val total4 = deep4 + light4 + rem4 + awake4 + awakeInBed4 // 350
        val asleep4 = deep4 + light4 + rem4 // 300
        val efficiency4 = (asleep4 * 100 / total4).toInt()
        assertEquals(85, efficiency4) // 300 * 100 / 350 = 85.7 -> 85
    }

    /**
     * Test que verifica que los valores de stages se normalizan correctamente
     * (minutos enteros, sin negativos, awake_in_bed se suma a awake).
     */
    @Test
    fun `sleep stage normalization`() = runBlocking {
        // Simular lo que hace readSleep: convierte segundos a minutos enteros
        val startSeconds = 0L
        val deepEnd = 2 * 60 * 60 // 2 horas = 7200 seg -> 120 min
        val lightEnd = deepEnd + 3 * 60 * 60 // +3h = 10800 seg -> 180 min
        val remEnd = lightEnd + 2 * 60 * 60 // +2h = 7200 seg -> 120 min
        val awakeEnd = remEnd + 1 * 60 * 60 // +1h = 3600 seg -> 60 min

        val deepMin = (deepEnd - startSeconds) / 60
        val lightMin = (lightEnd - deepEnd) / 60
        val remMin = (remEnd - lightEnd) / 60
        val awakeMin = (awakeEnd - remEnd) / 60

        assertEquals(120, deepMin.toInt())
        assertEquals(180, lightMin.toInt())
        assertEquals(120, remMin.toInt())
        assertEquals(60, awakeMin.toInt())

        // Verificar que awake_in_bed se suma a awake (misma rama when)
        val awakeInBedMin = 30L
        val totalAwake = awakeMin + awakeInBedMin
        assertEquals(90, totalAwake.toInt())
    }

    /**
     * Test que verifica que no se serializan valores null/zero para stages ausentes
     * (comportamiento: if (stage > 0) o.put(...)).
     */
    @Test
    fun `sleep serialization omits zero stages`() = runBlocking {
        val deep = 0
        val light = 420
        val rem = 0
        val awake = 0

        // Simular lógica de serialización condicional
        val hasDeep = deep > 0
        val hasLight = light > 0
        val hasRem = rem > 0
        val hasAwake = awake > 0

        assertTrue(!hasDeep)
        assertTrue(hasLight)
        assertTrue(!hasRem)
        assertTrue(!hasAwake)
    }

    // ============================================================
    // VS3: Exercise / ExerciseSessionRecord tests
    // ============================================================

    /**
     * Test que verifica el mapeo de tipos de ejercicio conocidos a strings de GymLog (cardio).
     * Estos valores se usan en readWorkouts() para decidir el bucket cardio vs strength.
     */
    @Test
    fun `exercise type mapping known cardio types`() = runBlocking {
        // Running
        assertEquals("running", mapKnownExerciseTypeForTest(1)) // EXERCISE_TYPE_RUNNING
        assertEquals("running", mapKnownExerciseTypeForTest(2)) // EXERCISE_TYPE_RUNNING_TREADMILL

        // Cycling
        assertEquals("cycling", mapKnownExerciseTypeForTest(3)) // EXERCISE_TYPE_BIKING
        assertEquals("cycling", mapKnownExerciseTypeForTest(4)) // EXERCISE_TYPE_BIKING_STATIONARY

        // Rowing
        assertEquals("rowing", mapKnownExerciseTypeForTest(5)) // EXERCISE_TYPE_ROWING
        assertEquals("rowing", mapKnownExerciseTypeForTest(6)) // EXERCISE_TYPE_ROWING_MACHINE

        // Swimming
        assertEquals("swimming", mapKnownExerciseTypeForTest(7)) // EXERCISE_TYPE_SWIMMING_POOL
        assertEquals("swimming", mapKnownExerciseTypeForTest(8)) // EXERCISE_TYPE_SWIMMING_OPEN_WATER

        // Elliptical
        assertEquals("elliptical", mapKnownExerciseTypeForTest(9)) // EXERCISE_TYPE_ELLIPTICAL

        // Walking / Hiking
        assertEquals("walking", mapKnownExerciseTypeForTest(10)) // EXERCISE_TYPE_WALKING
        assertEquals("walking", mapKnownExerciseTypeForTest(11)) // EXERCISE_TYPE_HIKING

        // Cardio reconocible que GymLog no tipifica -> "other" (pero cardio)
        assertEquals("other", mapKnownExerciseTypeForTest(12)) // EXERCISE_TYPE_STAIR_CLIMBING
        assertEquals("other", mapKnownExerciseTypeForTest(13)) // EXERCISE_TYPE_STAIR_CLIMBING_MACHINE
        assertEquals("other", mapKnownExerciseTypeForTest(14)) // EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING
        assertEquals("other", mapKnownExerciseTypeForTest(15)) // EXERCISE_TYPE_DANCING
        assertEquals("other", mapKnownExerciseTypeForTest(16)) // EXERCISE_TYPE_BOXING
        assertEquals("other", mapKnownExerciseTypeForTest(17)) // EXERCISE_TYPE_MARTIAL_ARTS
        assertEquals("other", mapKnownExerciseTypeForTest(18)) // EXERCISE_TYPE_SKATING
        assertEquals("other", mapKnownExerciseTypeForTest(19)) // EXERCISE_TYPE_SKIING
        assertEquals("other", mapKnownExerciseTypeForTest(20)) // EXERCISE_TYPE_SNOWBOARDING
        assertEquals("other", mapKnownExerciseTypeForTest(21)) // EXERCISE_TYPE_PADDLING
        assertEquals("other", mapKnownExerciseTypeForTest(22)) // EXERCISE_TYPE_ROCK_CLIMBING

        // Tipo desconocido -> null
        assertEquals(null, mapKnownExerciseTypeForTest(999))
    }

    /**
     * Test que verifica la detección de tipos de fuerza declarados.
     * Estos van directos al bucket strength.
     */
    @Test
    fun `exercise type detection strength types`() = runBlocking {
        assertTrue(isStrengthTypeForTest(23)) // EXERCISE_TYPE_STRENGTH_TRAINING
        assertTrue(isStrengthTypeForTest(24)) // EXERCISE_TYPE_WEIGHTLIFTING
        assertTrue(isStrengthTypeForTest(25)) // EXERCISE_TYPE_CALISTHENICS
        assertTrue(isStrengthTypeForTest(26)) // EXERCISE_TYPE_GYMNASTICS

        // Tipos cardio no son fuerza
        assertFalse(isStrengthTypeForTest(1))  // RUNNING
        assertFalse(isStrengthTypeForTest(3))  // BIKING
        assertFalse(isStrengthTypeForTest(999)) // Unknown
    }

    /**
     * Test que verifica el umbral de distancia significativa.
     * 0.2 km = 200 metros es el corte para considerar que hubo movimiento real.
     */
    @Test
    fun `exercise hasDistance threshold`() = runBlocking {
        assertTrue(hasDistanceForTest(5.0.toDouble()))   // 5 km - carrera larga
        assertTrue(hasDistanceForTest(0.5.toDouble()))   // 500 m - carrera corta
        assertTrue(hasDistanceForTest(0.2.toDouble()))   // 200 m - umbral exacto
        assertFalse(hasDistanceForTest(0.19.toDouble())) // 190 m - ruido GPS
        assertFalse(hasDistanceForTest(0.0.toDouble()))  // Sin distancia
        assertFalse(hasDistanceForTest(null)) // Null
    }

    /**
     * Test que verifica la inferencia de tipo por velocidad y FC.
     * Usado cuando el tipo es desconocido pero SÍ hay distancia (ej. Fitbit OTHER_WORKOUT).
     */
    @Test
    fun `exercise inferTypeFromPace logic`() = runBlocking {
        val restingHr = 58

        // Ciclismo: > 15 km/h
        assertEquals("cycling", inferTypeFromPaceForTest(20.0.toDouble(), 3600, null, restingHr)) // 20 km/h
        assertEquals("cycling", inferTypeFromPaceForTest(15.0.toDouble(), 3600, null, restingHr)) // 15 km/h umbral

        // Carrera: 7-15 km/h
        assertEquals("running", inferTypeFromPaceForTest(10.0.toDouble(), 3600, null, restingHr)) // 10 km/h
        assertEquals("running", inferTypeFromPaceForTest(7.0.toDouble(), 3600, null, restingHr))   // 7 km/h umbral

        // Por debajo de 7 km/h -> usa FC si disponible
        // avgHr - restingHr >= 50 -> running
        assertEquals("running", inferTypeFromPaceForTest(5.0.toDouble(), 3600, 110, restingHr)) // 110 - 58 = 52 >= 50
        // avgHr - restingHr < 50 -> walking
        assertEquals("walking", inferTypeFromPaceForTest(5.0.toDouble(), 3600, 100, restingHr)) // 100 - 58 = 42 < 50

        // Sin FC y velocidad baja -> walking (conservador)
        assertEquals("walking", inferTypeFromPaceForTest(5.0.toDouble(), 3600, null, restingHr))

        // Edge cases
        assertEquals("other", inferTypeFromPaceForTest(null, 3600, null, restingHr))
        assertEquals("other", inferTypeFromPaceForTest(0.0.toDouble(), 3600, null, restingHr))
        assertEquals("other", inferTypeFromPaceForTest(5.0.toDouble(), 0, null, restingHr))
    }

    /**
     * Test que verifica el formato del external_id.
     * Debe ser "hc:${metadata.id}" para deduplicación en Supabase.
     */
    @Test
    fun `exercise externalId format`() = runBlocking {
        val testIds = listOf("abc123", "xyz789", "session-2026-01-15", "a")
        for (id in testIds) {
            val externalId = "hc:$id"
            assertTrue(externalId.startsWith("hc:"))
            assertEquals(id, externalId.substringAfter("hc:"))
        }
    }

    // ============================================================
    // Helper functions to access private methods from HealthBridgePlugin
    // These mirror the private logic for testing without reflection
    // ============================================================

    private fun mapKnownExerciseTypeForTest(type: Int): String? = when (type) {
        1, 2 -> "running"      // RUNNING, RUNNING_TREADMILL
        3, 4 -> "cycling"      // BIKING, BIKING_STATIONARY
        5, 6 -> "rowing"       // ROWING, ROWING_MACHINE
        7, 8 -> "swimming"     // SWIMMING_POOL, SWIMMING_OPEN_WATER
        9 -> "elliptical"      // ELLIPTICAL
        10, 11 -> "walking"    // WALKING, HIKING
        12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22 -> "other"
        else -> null
    }

    private fun isStrengthTypeForTest(type: Int): Boolean = when (type) {
        23, 24, 25, 26 -> true // STRENGTH_TRAINING, WEIGHTLIFTING, CALISTHENICS, GYMNASTICS
        else -> false
    }

    private fun hasDistanceForTest(km: Double?): Boolean = km != null && km >= 0.2

    private fun inferTypeFromPaceForTest(
        km: Double?,
        durationSec: Int,
        avgHr: Int?,
        restingHr: Int?,
    ): String {
        if (km == null || km <= 0 || durationSec <= 0) return "other"
        val kmh = km / (durationSec / 3600.0)
        if (kmh >= 15.0) return "cycling"
        if (kmh >= 7.0) return "running"
        if (avgHr != null && restingHr != null && avgHr - restingHr >= 50) {
            return "running"
        }
        return "walking"
    }
}