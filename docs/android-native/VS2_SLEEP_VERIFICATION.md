# Vertical Slice 2 (VS2): Sleep / `SleepSessionRecord` — Verificación

## Objetivo

Verificar el flujo **completo** de lectura de **Sueño** desde Health Connect hasta la UI y scoring, sin añadir código de producción, permisos ni columnas nuevas:

```
RGPD consent → Permiso READ_SLEEP → HealthBridgePlugin.readSleep (paginado) →
wearable_sleep (duration_min, deep_min, light_min, rem_min, awake_min, efficiency_pct) →
HealthMetricsCard (sleep tile) + RecoveryCard (signals: sleep, sleepDebt, rest, consistency) →
health_connect_audit (record_types incluye 'sleep') →
Scoring readiness (computeReadiness usa toRestNight, toDebtSeries, sleepConsistency)
```

**Regla de alcance**: _Cero cambios en código de producción, columnas DB ni permisos manifest_. Solo verificación, tests y documentación. Si se detecta un **bug real** (p. ej., stages no parsean, paginación falla, eficiencia mal calculada, PHI en logs), se documenta y se decide fix puntual.

---

## Estado Actual (Pre-verificación)

| Componente                    | Estado                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------- |
| **Manifest**                  | ✅ `READ_SLEEP` declarado (línea 442)                                           |
| **Permiso solicitado**        | ✅ `HealthPermission.getReadPermission(SleepSessionRecord::class)` en plugin    |
| **Lectura paginada**          | ✅ `readAllPages(client, SleepSessionRecord::class, filter)` (línea 303)        |
| **Parsing stages**            | ✅ deep/light/rem/awake/awake_in_bed → minutos (líneas 308-322)                 |
| **Serialización condicional** | ✅ `if (deep > 0) o.put("deep_min", ...)` — no envía nulls                      |
| **Eficiencia**                | ❌ **No calculada** en plugin — se debe derivar en TS o añadir en plugin        |
| **Tipo TS `HealthSleepRow`**  | ✅ `duration_min`, `deep_min`, `light_min`, `rem_min`, `awake_min`              |
| **Tipo TS `WearableSleep`**   | ✅ + `efficiency_pct` (líneas 32-43)                                            |
| **Upsert Supabase**           | ✅ `upsert_wearable_sleep` RPC (línea 184 healthAggregator)                     |
| **Tabla `wearable_sleep`**    | ✅ Migración 20260622194522 tiene todas las columnas + CHECK constraints        |
| **UI HealthMetricsCard**      | ✅ Tile sleep con `fmtMinutesOrNull(sleep?.duration_min)` (línea 53)            |
| **UI RecoveryCard**           | ✅ Usa `computeReadiness` → signals `sleep`, `sleepDebt`, `rest`, `consistency` |
| **Scoring inputs**            | ✅ `toRestNight`, `toDebtSeries`, `toNightlyHours`, `sleepConsistency`          |
| **Auditoría**                 | ✅ `record_types` incluye `'sleep'` cuando `sleep.length > 0`                   |

---

## Checklist Verificable Extremo a Extremo

| #      | Área                        | Qué comprobar                                                          | Cómo verificar                                                      | ✅/❌ | Evidencia |
| ------ | --------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------- | ----- | --------- |
| **1**  | **Manifest**                | `READ_SLEEP` declarado                                                 | `grep READ_SLEEP AndroidManifest.xml`                               |       |           |
| **2**  | **Permiso plugin**          | `SleepSessionRecord` en lista de permisos                              | `grep SleepSessionRecord HealthBridgePlugin.kt`                     |       |           |
| **3**  | **Paginación**              | `readAllPages` usado para Sleep                                        | Línea 303 `readAllPages(client, SleepSessionRecord::class, filter)` |       |           |
| **4**  | **Parsing stages**          | 5 stages parseados: deep, light, rem, awake, awake_in_bed              | Líneas 311-317                                                      |       |           |
| **5**  | **Serialización**           | Solo envía stage si `> 0` (no nulls)                                   | Líneas 319-322 `if (deep > 0)`                                      |       |           |
| **6**  | **Eficiencia**              | `efficiency_pct` calculada: `(deep+light+rem) / total * 100`           | **Verificar/Implementar** en plugin o TS                            |       |           |
| **7**  | **Mapeo excepción permiso** | `SecurityException` → `PERMISSION_DENIED` (ya en `HealthConnectError`) | Test unitario                                                       |       |           |
| **8**  | **Logs sin PHI**            | No valores de stages, duración, timestamps en logs                     | Grep logcat `deep_min\|rem_min\|duration_min` = 0                   |       |           |
| **9**  | **Bloqueo RGPD**            | `hasHealthConsent` bloquea `syncAggregator` (igual que RHR)            | Test: consent=false → no readSleep                                  |       |           |
| **10** | **Upsert sleep**            | `upsert_wearable_sleep` recibe todos los campos                        | Inspeccionar RPC call / logs Supabase                               |       |           |
| **11** | **Dedupe**                  | `UNIQUE (user_id, date, source)` + COALESCE en RPC                     | Migración + RPC code                                                |       |           |
| **12** | **UI HealthMetricsCard**    | Tile sleep muestra duración formateada                                 | Línea 53 `fmtMinutesOrNull(sleep?.duration_min)`                    |       |           |
| **13** | **UI RecoveryCard**         | 4 signals de sueño: `sleep`, `sleepDebt`, `rest`, `consistency`        | `readiness.ts` líneas 167-197                                       |       |           |
| **14** | **Scoring `rest`**          | `toRestNight` usa `deep_min`, `rem_min`, `efficiency_pct`              | `scoringInputs.ts` líneas 72-84                                     |       |           |
| **15** | **Scoring `sleepDebt`**     | `toDebtSeries` usa `duration_min` → ledger                             | `scoringInputs.ts` línea 92                                         |       |           |
| **16** | **Scoring `consistency`**   | `sleepConsistency` usa `toNightlyHours` (28 noches)                    | `readiness.ts` línea 150                                            |       |           |
| **17** | **Auditoría**               | `sync_complete` con `record_types` incluye `'sleep'`                   | Query `health_connect_audit`                                        |       |           |

---

## Tests Necesarios para VS2

| Capa                           | Test a crear                                               | Qué valida                                                                             |
| ------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Kotlin Unit**                | `HealthBridgePluginTest.readSleep_parsesStagesCorrectly`   | Parsing deep/light/rem/awake, eficiencia calculada                                     |
| **Kotlin Unit**                | `HealthBridgePluginTest.readSleep_paginationRespectsLimit` | `MAX_RECORDS` / pageToken                                                              |
| **TS Unit (healthAggregator)** | `syncAggregator_upsertsSleepWithAllStages`                 | `upsert_wearable_sleep` recibe deep_min, light_min, rem_min, awake_min, efficiency_pct |
| **TS Unit (healthAggregator)** | `syncAggregator_auditIncludesSleepRecordType`              | `record_types` contiene `'sleep'`                                                      |
| **TS Unit (scoringInputs)**    | `toRestNight_calculatesEfficiencyFromStages`               | `efficiency_pct = (deep+light+rem)/total * 100`                                        |
| **TS Unit (readiness)**        | `computeReadiness_restSignalUsesDeepAndRem`                | `restScore` > 0 cuando hay deep/rem                                                    |
| **E2E Playwright**             | `wearables.spec.ts` sleep flow                             | Consent → permiso → sync → UI muestra sleep tile + RecoveryCard signals                |

> **Nota**: La eficiencia (`efficiency_pct`) **no se calcula actualmente en el plugin Kotlin**. Opción A: añadir en plugin (preferible, single source of truth). Opción B: calcular en TS en `healthAggregator` antes del upsert. Recomendación: **Opción A** — fix puntual permitido.

---

## Pasos de Ejecución de Pruebas

### 1. Tests Unitarios TypeScript

```bash
cd C:\Users\franc\proyectos\apps\gymlog
npm test -- --run
```

### 2. Tests Unitarios Kotlin (Gradle)

```bash
cd C:\Users\franc\proyectos\apps\gymlog\android
gradlew.bat test
```

### 3. Prueba Instrumentada en Dispositivo Real / Emulador

**Prerrequisitos**: Android 14+, Health Connect instalado, app proveedora (Zepp/Samsung/Garmin) **con datos de sueño históricos**.

**Pasos**:

1. **Limpiar estado previo** (igual que VS1)
2. **Login → `/wearables` → consentimiento RGPD → permiso READ_SLEEP**
3. **Sync manual** → Toast "Sincronización OK: X diarios, Y sueño, ..."
4. **Verificación UI**:
   - `HealthMetricsCard` muestra tile **Sueño** con duración (ej. "7h 30m")
   - `RecoveryCard` muestra signals: `sleep` (bueno/vigilancia), `sleepDebt`, `rest` (score 0-100), `consistency` (%)
5. **Verificación logs (sin PHI)**:
   ```bash
   adb logcat -d -s HealthBridgePlugin | grep -i "deep_min\|light_min\|rem_min\|awake_min\|duration_min\|efficiency"
   # Debe devolver 0 líneas
   adb logcat -d -s HealthBridgePlugin | head -20
   # Formato estructurado: "readAll [2026-01-15..2026-01-20]: daily=7 sleep=6 workouts=2 strength=1 errors=0"
   ```
6. **Verificación auditoría Supabase**:
   ```sql
   SELECT * FROM health_connect_audit
   WHERE user_id = '<test-user-id>'
   ORDER BY created_at DESC LIMIT 5;
   ```
   - `event_type='sync_complete'`, `record_types` incluye `'sleep'`, `error_code=null`
7. **Verificación base de datos**:
   ```sql
   SELECT date, duration_min, deep_min, light_min, rem_min, awake_min, efficiency_pct, source
   FROM wearable_sleep
   WHERE user_id = '<test-user-id>'
   ORDER BY date DESC LIMIT 10;
   ```
   - Al menos 1 fila con stages no null
   - `efficiency_pct` entre 0-100
   - `source = 'health_connect'`

---

## Evidencias a Guardar en `artifacts/verification/VS2_SLEEP/`

| Archivo                              | Contenido                                                  |
| ------------------------------------ | ---------------------------------------------------------- |
| `unit-ts-results.json`               | `npm test -- --run --reporter=json > unit-ts-results.json` |
| `unit-kotlin-log.txt`                | Salida completa `gradlew.bat test`                         |
| `device-logcat.txt`                  | `adb logcat -d -s HealthBridgePlugin > device-logcat.txt`  |
| `audit-rows.json`                    | Query `health_connect_audit` (JSON)                        |
| `wearable-sleep-rows.json`           | Query `wearable_sleep` con stages + efficiency (JSON)      |
| `screenshot-healthmetrics-sleep.png` | Captura `HealthMetricsCard` mostrando sleep tile           |
| `screenshot-recoverycard-sleep.png`  | Captura `RecoveryCard` con 4 signals de sueño              |

---

## Criterio **Go / No-Go** para VS2

| Resultado                                                                                                   | Acción                                                                                                |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **✅ Go**: Stages parseados, eficiencia calculada, UI muestra sleep + 4 signals, auditoría OK, logs limpios | Marcar VS2 **completado**. Proceder a **VS3: Exercise / `ExerciseSessionRecord` (cardio + strength)** |
| **⚠️ Parcial**: Proveedor no reporta stages (algunos solo duration) pero duration sí funciona               | Documentar limitación por proveedor. Marcar VS2 **completado con salvedad**. Proceder a VS3.          |
| **❌ No-Go**: Paginación falla, stages mal parseados, eficiencia null/incorrecta, PHI en logs, upsert falla | **Fix puntual** (ej. añadir eficiencia en plugin, corregir parsing). Re-verificar.                    |

---

## Fix Puntual Permitido: Eficiencia en Plugin

Si `efficiency_pct` no se calcula en el plugin, añadir en `readSleep()`:

```kotlin
// En readSleep, tras el bucle de stages:
val totalSleepMin = deep + light + rem + awake
val efficiency = if (totalSleepMin > 0) {
    ((deep + light + rem) * 100 / totalSleepMin).toInt() // solo deep+light+rem = "asleep"
} else null

if (efficiency != null) o.put("efficiency_pct", efficiency)
```

Esto no rompe nada (campo ya existe en TS, DB, RPC) y es single source of truth.

---

## Próximos Pasos Inmediatos

1. **Crear `artifacts/verification/VS2_SLEEP/`** y plantillas
2. **Añadir test Kotlin** `HealthBridgePluginTest.readSleep_parsesStagesCorrectly` (con eficiencia)
3. **Añadir tests TS** en `healthAggregator.test.ts` (sleep upsert + auditoría)
4. **Añadir tests TS** en `scoringInputs.test.ts` / `readiness.test.ts` (sleep scoring)
5. **Ejecutar tests** → verde
6. **Probar en dispositivo físico** (pasos arriba)
7. **Rellenar checklist** y decidir Go/No-Go
8. **Commit** `feat(phase-5): VS2 Sleep verification and unit tests`

---

_Documento generado para VS2. Actualizar con resultados reales tras prueba en dispositivo y tests._
