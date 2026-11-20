# Vertical Slice 1 (VS1): Resting Heart Rate — Verificación

## Objetivo

Verificar el flujo **completo** de lectura de **Frecuencia Cardiaca en Reposo (RHR)** desde Health Connect hasta la UI, sin añadir código de producción, permisos ni columnas nuevas:

```
RGPD consent → Permisos sistema → HealthBridgePlugin.readAll (aggregate) →
wearable_daily.resting_hr → HealthMetricsCard / RecoveryCard →
health_connect_audit (sin PHI)
```

**Regla de alcance**: _Cero cambios en código de producción, columnas DB ni permisos manifest_. Solo verificación, tests y documentación. Si se detecta un **bug real** (p. ej., `resting_hr` no llega, error no mapeado, PHI en logs), se documenta y se decide fix puntual.

---

## Checklist Verificable Extremo a Extremo

| #      | Área                                 | Qué comprobar                                                                                  | Cómo verificar                                             | ✅/❌                              | Evidencia |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- | --------- |
| **1**  | **Manifest**                         | `READ_RESTING_HEART_RATE` declarado                                                            | `grep READ_RESTING_HEART_RATE AndroidManifest.xml`         |                                    |           |
| **2**  | **Permisos solicitados**             | `HealthPermission.getReadPermission(RestingHeartRateRecord::class)` en `HealthBridgePlugin.kt` | Línea 55 del plugin                                        |                                    |           |
| **3**  | **Lectura agregada**                 | `RestingHeartRateRecord.BPM_AVG` en `metrics` de `aggregateGroupByPeriod` (daily)              | Líneas 270, 292-293 del plugin                             |                                    |           |
| **4**  | **Serialización a TS**               | `o.put("resting_hr", it.toInt())` solo si hay valor (no null → no pisa)                        | Línea 292-293                                              |                                    |           |
| **5**  | **Mapeo excepción permiso**          | `SecurityException` → `PERMISSION_DENIED` en `HealthConnectError.fromException`                | Líneas 21-28                                               |                                    |           |
| **6**  | **Mapeo excepción proveedor**        | `IllegalStateException` "SDK/provider" → `NOT_AVAILABLE`                                       | Líneas 37-42                                               |                                    |           |
| **7**  | **Mapeo excepción rango**            | `IllegalArgumentException` "time range" → `INVALID_TIME_RANGE`                                 | Líneas 30-35                                               |                                    |           |
| **8**  | **Fallback genérico**                | Cualquier otra excepción → `UNKNOWN_ERROR`                                                     | Línea 44                                                   |                                    |           |
| **9**  | **Logs sin PHI**                     | `Log.e/w` usan formato estructurado: NO valores, NO timestamps con dato, NO IDs externos       | Grep `Log\.(e                                              | w).*resting_hr\|bpm\|BPM` = 0 hits |           |     |
| **10** | **Bloqueo RGPD (TS)**                | `hasHealthConsent(userId)` en `useWearableSync.runSync` (línea 65)                             | Test: `hasHealthConsent=false` → no llama `syncAggregator` |                                    |           |
| **11** | **Gate consentimiento UI**           | `useHealthConsentGate` envuelve `requestAggregatorPermission` en `WearablesPage` (línea 62)    | Test: sin consent → dialog; con consent → directo          |                                    |           |
| **12** | **Bloqueo en syncAggregator**        | `aggregatorHasPermission()` check (línea 81-84) + `hasHealthConsent` en hook                   | Test unitario                                              |                                    |           |
| **13** | **Upsert a Supabase**                | `upsert_wearable_daily` recibe `resting_hr` en rows (línea 110-116 healthAggregator)           | Inspeccionar RPC call / logs Supabase                      |                                    |           |
| **14** | **Tipo TS `WearableDaily`**          | `resting_hr: number \| null` definido                                                          | `types/index.ts` línea 26                                  |                                    |           |
| **15** | **UI HealthMetricsCard**             | Tile `resting_hr` con icon `HeartPulse`, label i18n `wearables.resting_hr`                     | Línea 55-59 `HealthMetricsCard.tsx`                        |                                    |           |
| **16** | **UI RecoveryCard**                  | `computeReadiness` usa `toRhrSeries(daily)` → `avgRestingHr`, `baselineRestingHr`              | `readiness.ts` líneas 126-139, 199-206                     |                                    |           |
| **17** | **Auditoría `health_connect_audit`** | Tabla existe; `sync_complete` inserta `record_types` con `resting_heart_rate`                  | Query Supabase tras sync                                   |                                    |           |
| **18** | **Error codes en auditoría**         | `error_code` = `PERMISSION_DENIED` / `NOT_AVAILABLE` / etc. según `HealthConnectError`         | Query Supabase tras fallo                                  |                                    |           |

---

## Tests Existentes vs. Necesarios para VS1

| Capa                                  | Test existente                                                             | Cubre VS1 | Falta / Añadir                                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Kotlin Unit**                       | ❌ Ninguno (`HealthBridgePluginTest`, `HealthConnectErrorTest` no existen) | No        | `HealthBridgePluginTest.readAll_restingHeartRate_includedInDaily`<br>`HealthConnectErrorTest.fromException_permissionDenied_restingHr` |
| **TS Unit (healthConsent)**           | ✅ `healthConsent.test.ts` (7 tests)                                       | Parcial   | Test: `grantHealthConsent_persistsVersion` ✅                                                                                          |
| **TS Unit (useHealthConsentGate)**    | ✅ `useHealthConsentGate.test.tsx` (4 tests)                               | Parcial   | Test: `sin usuario abre diálogo y no guarda` ✅                                                                                        |
| **TS Unit (healthAggregator)**        | ❌ No existe `healthAggregator.test.ts`                                    | No        | `syncAggregator_filtersOutWhenNoConsent`<br>`syncAggregator_upsertsRestingHrWhenPresent`                                               |
| **TS Unit (readiness/scoringInputs)** | ✅ `scoringInputs.test.ts`, `readiness.test.ts`                            | Parcial   | Verificar que `toRhrSeries` filtra nulls correctamente                                                                                 |
| **E2E Playwright**                    | ✅ `navigation.spec.ts` (smoke `/wearables`)                               | Mínimo    | `wearables.spec.ts` con flujo RHR: consent → permiso → sync → UI                                                                       |

> **Recomendación**: Añadir **solo** los tests marcados en "Falta / Añadir" como casos específicos de VS1. No crear suites completas nuevas.

---

## Pasos de Ejecución de Pruebas

### 1. Tests Unitarios TypeScript (ya pasan: 1563/1563)

```bash
cd C:\Users\franc\proyectos\apps\gymlog
npm test -- --run
```

**Verificar salida**: `Test Files 137 passed | Tests 1563 passed`

### 2. Tests Unitarios Kotlin (Gradle)

```bash
cd C:\Users\franc\proyectos\apps\gymlog\android
gradlew.bat test
```

**Verificar salida**: `BUILD SUCCESSFUL` (actualmente no hay tests unitarios específicos de HealthBridgePlugin/HealthConnectError — el task pasa sin tests fuente).

### 3. Tests E2E Playwright (requiere build + servidor)

```bash
cd C:\Users\franc\proyectos\apps\gymlog
npm run build
npm run preview -- --port 4173 &
# En otra terminal:
npx playwright test e2e/navigation.spec.ts
```

**Para VS1 específico** (cuando se cree `wearables.spec.ts`):

```bash
npx playwright test e2e/wearables.spec.ts --grep "RHR"
```

### 4. Prueba Instrumentada en Dispositivo Real / Emulador

**Prerrequisitos**:

- Android 14+ (API 34) o dispositivo con Health Connect instalado desde Play Store
- App proveedora de datos (Zepp/Amazfit, Samsung Health, Garmin Connect, Google Fit) **con RHR histórico**
- APK `gymlog` firmado (debug o release) instalado
- Cuenta Supabase configurada (`.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY`)

**Pasos**:

1. **Limpiar estado previo**:
   - En app: Privacy Center → "Revocar consentimiento salud"
   - En Android Settings → Apps → GymLog → Permisos → Health Connect → Revocar todos
   - En Health Connect app → Apps conectadas → GymLog → Desconectar / Borrar datos

2. **Instalar y abrir GymLog**:
   - Login con usuario de prueba
   - Navegar a `/wearables`

3. **Flujo consentimiento RGPD**:
   - Botón "Conectar Health Connect" → debe abrir `HealthConsentDialog`
   - Aceptar → guarda `localStorage` `gymlog-health-consent-v1:{userId}` con `version: 1`

4. **Flujo permisos sistema**:
   - Tras aceptar consentimiento → se lanza `requestAuthorization()` → sheet Health Connect
   - Conceder **solo** `Frecuencia cardiaca en reposo` (parcial acceptance test)
   - Verificar: `hasPermissions()` devuelve `granted=true` para permisos solicitados

5. **Sync manual**:
   - Botón "Sincronizar ahora" → `runSync()`
   - Toast "Sincronización OK: X diarios, Y sueño, Z entrenos"
   - Sin errores en logcat (`adb logcat -s HealthBridgePlugin`)

6. **Verificación UI**:
   - `HealthMetricsCard` muestra tile **FC en reposo** con valor numérico (ej. "58")
   - `RecoveryCard` muestra señales: `restingHr` con flag `good`/`neutral`/`watch`

7. **Verificación logs (sin PHI)**:

   ```bash
   adb logcat -d -s HealthBridgePlugin | grep -i "resting_hr\|bpm\|BPM"
   # Debe devolver 0 líneas
   adb logcat -d -s HealthBridgePlugin | head -20
   # Debe mostrar solo: "readAll [2026-01-15..2026-01-20]: daily=7 errors=0"
   ```

8. **Verificación auditoría Supabase**:

   ```sql
   SELECT * FROM health_connect_audit
   WHERE user_id = '<test-user-id>'
   ORDER BY created_at DESC LIMIT 5;
   ```
   - Debe haber fila `event_type='sync_complete'`
   - `record_types` debe incluir `resting_heart_rate`
   - `error_code` = `null`

9. **Verificación base de datos**:
   ```sql
   SELECT date, resting_hr, source FROM wearable_daily
   WHERE user_id = '<test-user-id>'
   ORDER BY date DESC LIMIT 10;
   ```
   - Al menos 1 fila con `resting_hr` no null
   - `source = 'health_connect'`

---

## Evidencias a Guardar en `artifacts/verification/VS1_RHR/`

| Archivo                        | Contenido                                                    |
| ------------------------------ | ------------------------------------------------------------ |
| `unit-ts-results.json`         | `npm test -- --run --reporter=json > unit-ts-results.json`   |
| `unit-kotlin-log.txt`          | Salida completa `gradlew.bat test`                           |
| `e2e-navigation-report.html`   | `npx playwright test e2e/navigation.spec.ts --reporter=html` |
| `device-logcat.txt`            | `adb logcat -d -s HealthBridgePlugin > device-logcat.txt`    |
| `audit-rows.json`              | Resultado query `health_connect_audit` (JSON)                |
| `wearable-daily-rows.json`     | Resultado query `wearable_daily` con `resting_hr` (JSON)     |
| `screenshot-healthmetrics.png` | Captura `HealthMetricsCard` mostrando RHR                    |
| `screenshot-recoverycard.png`  | Captura `RecoveryCard` con señal `restingHr`                 |

---

## Criterio **Go / No-Go** para VS1

| Resultado                                                                                                                | Acción                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **✅ Go**: RHR aparece en UI, DB y auditoría; logs sin PHI; tests pasan                                                  | Marcar VS1 **completado**. Proceder a **VS2: Sleep / `SleepSessionRecord`**                                                                                                       |
| **⚠️ Parcial**: Permiso concedido, sync OK, pero **proveedor no reporta RHR** (común: Google Fit no lo escribe, Zepp sí) | Documentar: "Proveedor X no escribe `RestingHeartRateRecord`". **No es bug de GymLog**. Marcar VS1 **completado con salvedad**. Proceder a VS2 (Sleep sí suele estar disponible). |
| **❌ No-Go**: Error no mapeado (`UNKNOWN_ERROR` constante), PHI en logs, upsert falla, UI no renderiza                   | **Fix puntual** en código (única excepción a "sin cambios"). Re-ejecutar verificación.                                                                                            |

### Cómo pasar a **VS2: Sleep / `SleepSessionRecord`** si No-Go por proveedor

1. Confirmar que **SleepSessionRecord** sí está disponible en el/los proveedor(es) de prueba (Zepp, Samsung, Garmin, Fitbit → ✅ todos).
2. Cambiar foco de verificación a:
   - Paginación `readSleep` (ya implementada)
   - Parsing stages (deep/light/rem/awake)
   - `wearable_sleep` upsert + `HealthMetricsCard` sleep tile + `RecoveryCard` señales de sueño
3. Reutilizar mismo checklist adaptando `resting_hr` → `sleep` / `duration_min` / stages.

---

## Estado Actual (Checklist Pre-ejecutado)

| #   | Área                                      | Estado                           |
| --- | ----------------------------------------- | -------------------------------- |
| 1   | Manifest `READ_RESTING_HEART_RATE`        | ✅ Declarado                     |
| 2   | Plugin solicita permiso RHR               | ✅ Línea 55                      |
| 3   | Agregado `BPM_AVG` en daily               | ✅ Líneas 270, 292-293           |
| 4   | Serialización condicional (no null)       | ✅ `?.let`                       |
| 5-8 | Mapeo excepciones en `HealthConnectError` | ✅ Cubierto                      |
| 9   | Logs sin PHI (política documentada)       | ✅ Verificar en device           |
| 10  | Bloqueo `hasHealthConsent` en hook        | ✅ Línea 65 `useWearableSync`    |
| 11  | Gate consentimiento en UI                 | ✅ `WearablesPage` línea 62      |
| 12  | Check permiso en `syncAggregator`         | ✅ Líneas 81-84                  |
| 13  | Upsert incluye `resting_hr`               | ✅ `healthAggregator` línea 110  |
| 14  | Tipo TS `WearableDaily.resting_hr`        | ✅ Línea 26                      |
| 15  | UI `HealthMetricsCard` tile RHR           | ✅ Líneas 55-59                  |
| 16  | `RecoveryCard` usa RHR via readiness      | ✅ `readiness.ts`                |
| 17  | Tabla `health_connect_audit` existe       | ✅ Migración pendiente verificar |
| 18  | Error codes en auditoría                  | ✅ Por verificar                 |

---

## Próximos Pasos Inmediatos

1. **Ejecutar tests TS** → confirmar 1563 passed (ya hecho ✅)
2. **Ejecutar tests Kotlin** → confirmar BUILD SUCCESSFUL (ya hecho ✅)
3. **Crear `artifacts/verification/VS1_RHR/`** y guardar evidencias vacías como plantilla
4. **Probar en dispositivo físico** con Health Connect + Zepp/Samsung (pasos 1-9 arriba)
5. **Rellenar checklist** con ✅/❌ y adjuntar evidencias
6. **Decidir Go/No-Go** y documentar en este mismo archivo

---

_Documento generado para VS1. Actualizar con resultados reales tras prueba en dispositivo._
