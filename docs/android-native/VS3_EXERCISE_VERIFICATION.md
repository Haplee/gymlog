# Vertical Slice 3 (VS3): Exercise / `ExerciseSessionRecord` — Verificación

## Objetivo

Verificar el flujo **completo** de lectura de **Ejercicio/Sesiones** desde Health Connect hasta las dos tablas destino:

```
RGPD consent → Permiso READ_EXERCISE → HealthBridgePlugin.readWorkouts (paginado) →
  ├─ Cardio (running, cycling, swimming, etc.) → cardio_sessions (type, distance, HR, etc.)
  └─ Strength (STRENGTH_TRAINING, WEIGHTLIFTING, etc. + unknown sin distancia) → health_sessions (duration, kcal, HR)
→ UI: HistoryPage (cardio) + WearablesPage/RecoveryCard (strength sessions count) →
→ health_connect_audit (record_types incluye 'exercise' y 'strength_session')
```

**Regla de alcance**: _Cero cambios en código de producción, columnas DB ni permisos manifest_. Solo verificación, tests y documentación. Si se detecta un **bug real** (mapeo incorrecto, dedupe falla, PHI en logs), se documenta y se decide fix puntual.

---

## Estado Actual (Pre-verificación)

| Componente               | Estado                                                                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manifest**             | ✅ `READ_EXERCISE` declarado (línea 443)                                                                                                                                                                       |
| **Permiso solicitado**   | ✅ `HealthPermission.getReadPermission(ExerciseSessionRecord::class)` en plugin                                                                                                                                |
| **Lectura paginada**     | ✅ `readAllPages(client, ExerciseSessionRecord::class, filter)` (línea 365)                                                                                                                                    |
| **Mapeo tipo conocido**  | ✅ `mapKnownExerciseType()` cubre running, cycling, rowing, swimming, elliptical, walking, hiking, stair_climbing, HIIT, dancing, boxing, martial_arts, skating, skiing, snowboarding, paddling, rock_climbing |
| **Detección fuerza**     | ✅ `isStrengthType()` → STRENGTH_TRAINING, WEIGHTLIFTING, CALISTHENICS, GYMNASTICS                                                                                                                             |
| **Fallback unknown**     | ✅ `inferTypeFromPace()` usa velocidad + FC vs reposo; sin distancia → strength                                                                                                                                |
| **Agregados por sesión** | ✅ Distancia, kcal activas/totales, HR avg/max por sesión (líneas 394-421)                                                                                                                                     |
| **Logging crudo**        | ✅ Log.w con tipo, título, origen, timestamps, segmentos (líneas 371-377)                                                                                                                                      |
| **External ID**          | ✅ `hc:${rec.metadata.id}` (línea 379)                                                                                                                                                                         |
| **Dedupe cardio**        | ✅ `UNIQUE (user_id, external_id)` + upsert actualiza type/duration/HR (migración 20260727224345)                                                                                                              |
| **Dedupe strength**      | ✅ `UNIQUE (user_id, external_id)` + upsert actualiza duration/ended_at/title/HR (líneas 87-96)                                                                                                                |
| **Limpieza histórico**   | ✅ DELETE cardio 'other' sin distancia < 0.2 km (líneas 170-173)                                                                                                                                               |
| **Tipos TS**             | ✅ `HealthSession` (strength), `CardioSession` (cardio)                                                                                                                                                        |
| **UI cardio**            | ✅ HistoryPage muestra cardio_sessions con delete                                                                                                                                                              |
| **UI strength**          | ✅ WearablesPage muestra contador `strength` sessions importadas                                                                                                                                               |
| **Auditoría**            | ✅ `record_types` incluye `'exercise'` (cardio) y `'strength_session'` (strength)                                                                                                                              |

---

## Checklist Verificable Extremo a Extremo

| #      | Área                               | Qué comprobar                                                                  | Cómo verificar                                                         | ✅/❌ | Evidencia |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ----- | --------- |
| **1**  | **Manifest**                       | `READ_EXERCISE` declarado                                                      | `grep READ_EXERCISE AndroidManifest.xml`                               |       |           |
| **2**  | **Permiso plugin**                 | `ExerciseSessionRecord` en lista de permisos                                   | `grep ExerciseSessionRecord HealthBridgePlugin.kt`                     |       |           |
| **3**  | **Paginación**                     | `readAllPages` usado para Exercise                                             | Línea 365 `readAllPages(client, ExerciseSessionRecord::class, filter)` |       |           |
| **4**  | **Mapeo cardio conocido**          | 13+ tipos mapeados a string GymLog                                             | `mapKnownExerciseType()` líneas 454-482                                |       |           |
| **5**  | **Detección fuerza declarada**     | 4 tipos → strength                                                             | `isStrengthType()` líneas 445-451                                      |       |           |
| **6**  | **Fallback unknown sin distancia** | Tipo desconocido + `!hasDistance(km)` → strength                               | Línea 427                                                              |       |           |
| **7**  | **Fallback unknown con distancia** | `inferTypeFromPace()` → running/cycling/walking/other                          | Líneas 505-519                                                         |       |           |
| **8**  | **Agregados por sesión**           | Distancia, kcal activas/totales, HR avg/max                                    | Líneas 394-421                                                         |       |           |
| **9**  | **Logging sin PHI**                | Log.w usa tipo, título, origen, NO valores HR/kcal                             | Grep logcat `avg_hr\|max_hr\|calories\|distance` = 0                   |       |           |
| **10** | **External ID**                    | Formato `hc:${metadata.id}`                                                    | Línea 379                                                              |       |           |
| **11** | **Upsert cardio**                  | `import_wearable_workouts` actualiza type/duration/HR                          | Migración líneas 144-151                                               |       |           |
| **12** | **Upsert strength**                | `import_health_sessions` actualiza duration/ended_at/title/HR                  | Líneas 87-96                                                           |       |           |
| **13** | **Limpieza histórico**             | DELETE cardio 'other' sin distancia < 0.2 km                                   | Migración líneas 170-173                                               |       |           |
| **14** | **Bloqueo RGPD**                   | `hasHealthConsent` bloquea `syncAggregator`                                    | Test: consent=false → no readWorkouts                                  |       |           |
| **15** | **UI cardio**                      | HistoryPage muestra sesiones importadas                                        | `fetchHealthSessions` + HistoryPage                                    |       |           |
| **16** | **UI strength**                    | WearablesPage muestra contador `strength > 0`                                  | Línea 110-120 WearablesPage                                            |       |           |
| **17** | **Auditoría**                      | `sync_complete` con `record_types` incluye `'exercise'` y `'strength_session'` | Query `health_connect_audit`                                           |       |           |

---

## Tests Necesarios para VS3

| Capa                           | Test a crear                                                          | Qué valida                                                                                   |
| ------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Kotlin Unit**                | `HealthBridgePluginTest.readWorkouts_mapsKnownTypesToCardio`          | `mapKnownExerciseType` devuelve string correcto para running, cycling, etc.                  |
| **Kotlin Unit**                | `HealthBridgePluginTest.readWorkouts_detectsStrengthTypes`            | `isStrengthType` true para STRENGTH_TRAINING, WEIGHTLIFTING, etc.                            |
| **Kotlin Unit**                | `HealthBridgePluginTest.readWorkouts_unknownNoDistanceGoesToStrength` | Tipo unknown + `!hasDistance` → strength                                                     |
| **Kotlin Unit**                | `HealthBridgePluginTest.readWorkouts_inferTypeFromPace`               | Velocidad 8 km/h → running; 20 km/h → cycling; <7 km/h → walking                             |
| **Kotlin Unit**                | `HealthBridgePluginTest.readWorkouts_externalIdFormat`                | Formato `hc:${metadata.id}`                                                                  |
| **TS Unit (healthAggregator)** | `syncAggregator_upsertsCardioWithTypeAndHR`                           | `import_wearable_workouts` recibe type, avg_hr, max_hr, distance                             |
| **TS Unit (healthAggregator)** | `syncAggregator_upsertsStrengthSessions`                              | `import_health_sessions` recibe duration, calories, avg_hr, max_hr                           |
| **TS Unit (healthAggregator)** | `syncAggregator_auditIncludesExerciseAndStrength`                     | `record_types` contiene `'exercise'` y `'strength_session'`                                  |
| **E2E Playwright**             | `wearables.spec.ts` exercise flow                                     | Consent → permiso → sync → HistoryPage muestra cardio + WearablesPage muestra strength count |

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

**Prerrequisitos**: Android 14+, Health Connect instalado, app proveedora (Zepp/Samsung/Garmin) **con sesiones de ejercicio históricas** (cardio: correr, bici, natación; fuerza: gimnasio/pesas).

**Pasos**:

1. **Limpiar estado previo** (igual que VS1/VS2)
2. **Login → `/wearables` → consentimiento RGPD → permiso READ_EXERCISE**
3. **Sync manual** → Toast "Sincronización OK: X diarios, Y sueño, Z entrenos, W fuerza"
4. **Verificación UI Cardio**:
   - Navegar a `/history` → lista cardio_sessions muestra sesiones importadas con tipo (running, cycling, etc.), distancia, HR, calorías
   - Botón delete funciona
5. **Verificación UI Strength**:
   - `/wearables` → tarjeta "Sesiones de gimnasio importadas" muestra contador > 0
6. **Verificación logs (sin PHI)**:
   ```bash
   adb logcat -d -s HealthBridgePlugin | grep -i "avg_hr\|max_hr\|calories\|distance\|kcal"
   # Debe devolver 0 líneas
   adb logcat -d -s HealthBridgePlugin | head -30
   # Formato: "session type=1 title=Cinta origin=com.zepp.app 2026-01-15T10:00..2026-01-15T11:00 segments=[...]"
   ```
7. **Verificación auditoría Supabase**:
   ```sql
   SELECT * FROM health_connect_audit
   WHERE user_id = '<test-user-id>'
   ORDER BY created_at DESC LIMIT 5;
   ```
   - `event_type='sync_complete'`, `record_types` incluye `'exercise'` y `'strength_session'`, `error_code=null`
8. **Verificación base de datos**:
   ```sql
   -- Cardio
   SELECT type, started_at, duration, distance, calories, avg_hr, max_hr, source
   FROM cardio_sessions
   WHERE user_id = '<test-user-id>' AND source = 'health_connect'
   ORDER BY started_at DESC LIMIT 10;

   -- Strength
   SELECT title, started_at, duration, calories, avg_hr, max_hr, source
   FROM health_sessions
   WHERE user_id = '<test-user-id>' AND source = 'health_connect'
   ORDER BY started_at DESC LIMIT 10;
   ```
   - Tipos correctos (running, cycling, walking, other, strength)
   - `external_id` formato `hc:...`
   - `source = 'health_connect'`

---

## Evidencias a Guardar en `artifacts/verification/VS3_EXERCISE/`

| Archivo                             | Contenido                                                  |
| ----------------------------------- | ---------------------------------------------------------- |
| `unit-ts-results.json`              | `npm test -- --run --reporter=json > unit-ts-results.json` |
| `unit-kotlin-log.txt`               | Salida completa `gradlew.bat test`                         |
| `device-logcat.txt`                 | `adb logcat -d -s HealthBridgePlugin > device-logcat.txt`  |
| `audit-rows.json`                   | Query `health_connect_audit` (JSON)                        |
| `cardio-sessions-rows.json`         | Query `cardio_sessions` (JSON)                             |
| `health-sessions-rows.json`         | Query `health_sessions` (JSON)                             |
| `screenshot-history-cardio.png`     | Captura HistoryPage con cardio importado                   |
| `screenshot-wearables-strength.png` | Captura WearablesPage con strength count                   |

---

## Criterio **Go / No-Go** para VS3

| Resultado                                                                                                                  | Acción                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **✅ Go**: Tipos mapeados correctamente, cardio+strength en tablas correctas, UI muestra ambos, auditoría OK, logs limpios | Marcar VS3 **completado**. Proceder a **VS4: HRV / `HeartRateVariabilityRmssdRecord`** (requiere migración DB) |
| **⚠️ Parcial**: Proveedor no reporta ciertos tipos (ej. no HIIT) pero running/cycling/strength funcionan                   | **Go con salvedad** → documentar limitación por proveedor, proceder a VS4                                      |
| **❌ No-Go**: Mapeo incorrecto (fuerza va a cardio o viceversa), dedupe falla (duplicados), PHI en logs, upsert falla      | **Fix puntual** (ej. ajustar `isStrengthType`, `inferTypeFromPace`, o logging). Re-verificar.                  |

---

## Próximos Pasos Inmediatos

1. **Crear `artifacts/verification/VS3_EXERCISE/`** y plantillas
2. **Añadir tests Kotlin** en `HealthBridgePluginTest.kt` (mapeo tipos, detección fuerza, inferTypeFromPace, external_id)
3. **Añadir tests TS** en `healthAggregator.test.ts` (upsert cardio/strength, auditoría exercise+strength)
4. **Ejecutar tests** → verde
5. **Probar en dispositivo físico** (pasos arriba)
6. **Rellenar checklist** y decidir Go/No-Go
7. **Commit** `feat(phase-5): VS3 Exercise verification, type mapping tests, and unit tests`

---

_Documento generado para VS3. Actualizar con resultados reales tras prueba en dispositivo y tests._
