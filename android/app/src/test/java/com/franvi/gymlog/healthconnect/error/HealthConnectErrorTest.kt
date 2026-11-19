package com.franvi.gymlog.healthconnect.error

import org.junit.Assert.assertEquals
import org.junit.Test

class HealthConnectErrorTest {

    @Test
    fun `fromException mapea SecurityException a PERMISSION_DENIED`() {
        // SecurityException por permiso de background denegado
        val bgException = SecurityException("READ_HEALTH_DATA_IN_BACKGROUND permission required")
        assertEquals(HealthConnectError.PERMISSION_DENIED, HealthConnectError.fromException(bgException))

        // SecurityException por maybeEnforceOnlyCallingPackageDataRequested
        val pkgException = SecurityException("maybeEnforceOnlyCallingPackageDataRequested: caller not allowed")
        assertEquals(HealthConnectError.PERMISSION_DENIED, HealthConnectError.fromException(pkgException))

        // SecurityException genérica -> READ_FAILED
        val genericSecException = SecurityException("Generic security error")
        assertEquals(HealthConnectError.READ_FAILED, HealthConnectError.fromException(genericSecException))
    }

    @Test
    fun `fromException mapea IllegalStateException a NOT_AVAILABLE cuando menciona SDK o provider`() {
        val sdkException = IllegalStateException("Health Connect SDK not available")
        assertEquals(HealthConnectError.NOT_AVAILABLE, HealthConnectError.fromException(sdkException))

        val providerException = IllegalStateException("provider not installed")
        assertEquals(HealthConnectError.NOT_AVAILABLE, HealthConnectError.fromException(providerException))
    }

    @Test
    fun `fromException mapea IllegalStateException genérica a UNKNOWN_ERROR`() {
        val genericException = IllegalStateException("Some other illegal state")
        assertEquals(HealthConnectError.UNKNOWN_ERROR, HealthConnectError.fromException(genericException))
    }

    @Test
    fun `fromException mapea IllegalArgumentException con time range a INVALID_TIME_RANGE`() {
        val timeRangeException = IllegalArgumentException("Invalid time range: exceeds maximum")
        assertEquals(HealthConnectError.INVALID_TIME_RANGE, HealthConnectError.fromException(timeRangeException))

        val timeFilterException = IllegalArgumentException("TimeRangeFilter cannot be null")
        assertEquals(HealthConnectError.INVALID_TIME_RANGE, HealthConnectError.fromException(timeFilterException))
    }

    @Test
    fun `fromException mapea IllegalArgumentException genérica a UNKNOWN_ERROR`() {
        val genericException = IllegalArgumentException("Some other illegal argument")
        assertEquals(HealthConnectError.UNKNOWN_ERROR, HealthConnectError.fromException(genericException))
    }

    @Test
    fun `fromException mapea cualquier otra excepción a UNKNOWN_ERROR`() {
        val npe = NullPointerException("null pointer")
        assertEquals(HealthConnectError.UNKNOWN_ERROR, HealthConnectError.fromException(npe))

        val ioe = java.io.IOException("IO error")
        assertEquals(HealthConnectError.UNKNOWN_ERROR, HealthConnectError.fromException(ioe))
    }

    @Test
    fun `userMessage devuelve mensaje legible para cada código`() {
        assertEquals(
            "Health Connect no está disponible en este dispositivo. Instálalo desde Google Play.",
            HealthConnectError.userMessage(HealthConnectError.NOT_AVAILABLE)
        )
        assertEquals(
            "Se requiere actualizar Health Connect. Ve a Google Play para actualizar.",
            HealthConnectError.userMessage(HealthConnectError.PROVIDER_UPDATE_REQUIRED)
        )
        assertEquals(
            "Permisos insuficientes. Concede los permisos en la configuración de Health Connect.",
            HealthConnectError.userMessage(HealthConnectError.PERMISSION_DENIED)
        )
        assertEquals(
            "Esta función no está disponible en tu dispositivo o versión de Health Connect.",
            HealthConnectError.userMessage(HealthConnectError.FEATURE_UNAVAILABLE)
        )
        assertEquals(
            "Rango de fechas inválido. El rango máximo permitido es de 30 días.",
            HealthConnectError.userMessage(HealthConnectError.INVALID_TIME_RANGE)
        )
        assertEquals(
            "La sincronización se interrumpió. Se reintentará automáticamente.",
            HealthConnectError.userMessage(HealthConnectError.SYNC_INTERRUPTED)
        )
        assertEquals(
            "Error al leer los datos de Health Connect.",
            HealthConnectError.userMessage(HealthConnectError.READ_FAILED)
        )
        assertEquals(
            "Error desconocido al acceder a Health Connect.",
            HealthConnectError.userMessage(HealthConnectError.UNKNOWN_ERROR)
        )
        assertEquals(
            "Error desconocido al acceder a Health Connect.",
            HealthConnectError.userMessage("CODIGO_INEXISTENTE")
        )
    }
}