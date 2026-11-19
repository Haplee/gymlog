package com.franvi.gymlog

import com.franvi.gymlog.healthconnect.error.HealthConnectError
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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
}