package com.franvi.gymlog.healthconnect.error

/**
 * Códigos de error estandarizados para Health Connect.
 * Deben coincidir con los definidos en TypeScript (healthConnect.ts).
 */
object HealthConnectError {
    const val NOT_AVAILABLE = "NOT_AVAILABLE"
    const val PROVIDER_UPDATE_REQUIRED = "PROVIDER_UPDATE_REQUIRED"
    const val PERMISSION_DENIED = "PERMISSION_DENIED"
    const val FEATURE_UNAVAILABLE = "FEATURE_UNAVAILABLE"
    const val INVALID_TIME_RANGE = "INVALID_TIME_RANGE"
    const val SYNC_INTERRUPTED = "SYNC_INTERRUPTED"
    const val READ_FAILED = "READ_FAILED"
    const val UNKNOWN_ERROR = "UNKNOWN_ERROR"

    /**
     * Mapea excepciones de Health Connect a códigos de error estandarizados.
     */
    fun fromException(e: Exception): String = when (e) {
        is SecurityException -> {
            if (e.message?.contains("READ_HEALTH_DATA_IN_BACKGROUND") == true) {
                PERMISSION_DENIED
            } else if (e.message?.contains("maybeEnforceOnlyCallingPackageDataRequested") == true) {
                PERMISSION_DENIED
            } else {
                READ_FAILED
            }
        }
        is IllegalArgumentException -> {
            if (e.message?.contains("time range") == true || e.message?.contains("TimeRangeFilter") == true) {
                INVALID_TIME_RANGE
            } else {
                UNKNOWN_ERROR
            }
        }
        is IllegalStateException -> {
            if (e.message?.contains("SDK") == true || e.message?.contains("provider") == true) {
                NOT_AVAILABLE
            } else {
                UNKNOWN_ERROR
            }
        }
        else -> UNKNOWN_ERROR
    }

    /**
     * Mensaje legible para el usuario según el código de error.
     */
    fun userMessage(errorCode: String): String = when (errorCode) {
        NOT_AVAILABLE -> "Health Connect no está disponible en este dispositivo. Instálalo desde Google Play."
        PROVIDER_UPDATE_REQUIRED -> "Se requiere actualizar Health Connect. Ve a Google Play para actualizar."
        PERMISSION_DENIED -> "Permisos insuficientes. Concede los permisos en la configuración de Health Connect."
        FEATURE_UNAVAILABLE -> "Esta función no está disponible en tu dispositivo o versión de Health Connect."
        INVALID_TIME_RANGE -> "Rango de fechas inválido. El rango máximo permitido es de 30 días."
        SYNC_INTERRUPTED -> "La sincronización se interrumpió. Se reintentará automáticamente."
        READ_FAILED -> "Error al leer los datos de Health Connect."
        else -> "Error desconocido al acceder a Health Connect."
    }
}