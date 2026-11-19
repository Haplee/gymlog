# Health Connect Data Mapping

## Overview

This document defines the mapping between Health Connect record types and GymLog's existing data models, ensuring seamless integration without duplicating existing TypeScript logic.

## Health Connect Record Types Analysis

### Available Record Types (Health Connect SDK 1.1+)

| Health Connect Record               | Permission                  | Availability           | Data Structure                            | Typical Frequency    |
| ----------------------------------- | --------------------------- | ---------------------- | ----------------------------------------- | -------------------- |
| **HeartRateRecord**                 | READ_HEART_RATE             | Android 14+ / Provider | bpm, time, metadata                       | Continuous (seconds) |
| **RestingHeartRateRecord**          | READ_RESTING_HEART_RATE     | Android 14+ / Provider | bpm, time, metadata                       | Daily (morning)      |
| **HeartRateVariabilityRmssdRecord** | READ_HEART_RATE_VARIABILITY | Android 14+ / Provider | ms (RMSSD), time, metadata                | Daily/Periodic       |
| **SleepSessionRecord**              | READ_SLEEP                  | Android 14+ / Provider | stages (deep/light/rem/awake), time range | Per sleep session    |
| **StepsRecord**                     | READ_STEPS                  | Android 14+ / Provider | count, time range                         | Continuous (batched) |
| **ExerciseSessionRecord**           | READ_EXERCISE               | Android 14+ / Provider | type, segments, title, time range         | Per workout          |
| **WeightRecord**                    | READ_WEIGHT                 | Android 14+ / Provider | kg, time, metadata                        | Periodic             |
| **Vo2MaxRecord**                    | READ_VO2_MAX                | Android 14+ / Provider | ml/kg/min, time, metadata                 | Periodic             |
| **RespiratoryRateRecord**           | READ_RESPIRATORY_RATE       | Android 14+ / Provider | breaths/min, time, metadata               | During sleep         |
| **SkinTemperatureRecord**           | READ_SKIN_TEMPERATURE       | Android 14+ / Provider | °C, time, metadata                        | During sleep         |

### Provider Data Availability

| Provider                      | Heart Rate | Resting HR | HRV | Sleep | Steps | Exercise | Weight | VO2 Max | Resp Rate | Skin Temp |
| ----------------------------- | ---------- | ---------- | --- | ----- | ----- | -------- | ------ | ------- | --------- | --------- |
| Google Fit / Pixel Watch      | ✅         | ✅         | ✅  | ✅    | ✅    | ✅       | ✅     | ❌      | ✅        | ❌        |
| Samsung Health / Galaxy Watch | ✅         | ✅         | ✅  | ✅    | ✅    | ✅       | ✅     | ✅      | ✅        | ✅        |
| Zepp / Amazfit                | ✅         | ✅         | ✅  | ✅    | ✅    | ✅       | ✅     | ❌      | ❌        | ❌        |
| Garmin Connect                | ✅         | ✅         | ✅  | ✅    | ✅    | ✅       | ✅     | ✅      | ✅        | ❌        |
| Fitbit                        | ✅         | ✅         | ✅  | ✅    | ✅    | ✅       | ✅     | ✅      | ✅        | ✅        |

**Critical**: Not all providers write all record types. Implementation must handle missing data gracefully.

## Data Mapping Matrix

| Health Connect                                       | GymLog Model                           | Adapter                             | Destination Table         |
| ---------------------------------------------------- | -------------------------------------- | ----------------------------------- | ------------------------- |
| `StepsRecord.COUNT_TOTAL` (aggregate)                | `WearableDaily.steps`                  | `aggregateGroupByPeriod` daily      | `wearable_daily`          |
| `DistanceRecord.DISTANCE_TOTAL` (aggregate)          | `WearableDaily.distance_km`            | `aggregateGroupByPeriod` daily      | `wearable_daily`          |
| `TotalCaloriesBurnedRecord.ENERGY_TOTAL` (aggregate) | `WearableDaily.calories`               | `aggregateGroupByPeriod` daily      | `wearable_daily`          |
| `HeartRateRecord.BPM_AVG` (aggregate)                | `WearableDaily.avg_hr`                 | `aggregateGroupByPeriod` daily      | `wearable_daily`          |
| `HeartRateRecord.BPM_MAX` (aggregate)                | `WearableDaily.max_hr`                 | `aggregateGroupByPeriod` daily      | `wearable_daily`          |
| `RestingHeartRateRecord.BPM_AVG` (aggregate)         | `WearableDaily.resting_hr`             | `aggregateGroupByPeriod` daily      | `wearable_daily`          |
| `SleepSessionRecord`                                 | `WearableSleep`                        | `readAllPages` + stage parsing      | `wearable_sleep`          |
| `ExerciseSessionRecord` (cardio)                     | `HealthWorkoutRow` → `cardio_sessions` | `readWorkouts` + type mapping       | `cardio_sessions`         |
| `ExerciseSessionRecord` (strength)                   | `HealthWorkoutRow` → `health_sessions` | `readWorkouts` + strength detection | `health_sessions`         |
| `HeartRateVariabilityRmssdRecord`                    | **NEW** `WearableDaily.hrv_rmssd_ms`   | **NEW** field + aggregate           | `wearable_daily` (extend) |
| `RespiratoryRateRecord`                              | **NEW** `WearableSleep.resp_rate_avg`  | **NEW** field + aggregate           | `wearable_sleep` (extend) |
| `SkinTemperatureRecord`                              | **NEW** `WearableSleep.skin_temp_c`    | **NEW** field + aggregate           | `wearable_sleep` (extend) |
| `WeightRecord`                                       | **NEW** `WearableDaily.weight_kg`      | **NEW** field + latest              | `wearable_daily` (extend) |
| `Vo2MaxRecord`                                       | **NEW** `WearableDaily.vo2_max`        | **NEW** field + latest              | `wearable_daily` (extend) |

## Mapping Rules

### Preservation Requirements

1. **Timestamp UTC** - All timestamps stored as ISO 8601 UTC
2. **Timezone** - Local date derived from UTC timestamp for daily bucketing
3. **Unit** - SI units preferred (km, bpm, ms, °C, kg, ml/kg/min)
4. **Provenance** - `source` field: `'health_connect'` | `'healthkit'` | `'fitbit'`
5. **External ID** - `hc:${metadata.id}` format for deduplication
6. **Modification Timestamp** - `metadata.lastModifiedTime` if available
7. **User Identity** - `user_id` from Supabase auth
8. **Measurement Date** - Local date (YYYY-MM-DD) for daily aggregation

### No Fabrication Policy

- **No zeros for missing data** - Use `null`
- **No invented averages** - Only real measurements
- **No cross-provider merging** - Each provider's data kept separate by `source`

### Deduplication Policy

1. **By (user_id, date, source)** for `wearable_daily` and `wearable_sleep`
2. **By (user_id, external_id)** for `cardio_sessions` and `health_sessions`
3. **COALESCE strategy** - New non-null values update; null preserves existing
4. **Multiple providers** - Separate rows per source; UI decides display priority

## GymLog Model Extensions Required

### WearableDaily (Additions)

```typescript
interface WearableDaily {
  // Existing fields...
  hrv_rmssd_ms?: number | null; // NEW: from HeartRateVariabilityRmssdRecord
  weight_kg?: number | null; // NEW: from WeightRecord (latest per day)
  vo2_max?: number | null; // NEW: from Vo2MaxRecord (latest per day)
}
```

### WearableSleep (Additions)

```typescript
interface WearableSleep {
  // Existing fields...
  resp_rate_avg?: number | null; // NEW: from RespiratoryRateRecord (avg during sleep)
  skin_temp_c?: number | null; // NEW: from SkinTemperatureRecord (avg during sleep)
}
```

### Database Migration Needed

```sql
ALTER TABLE public.wearable_daily
  ADD COLUMN IF NOT EXISTS hrv_rmssd_ms real CHECK (hrv_rmssd_ms IS NULL OR hrv_rmssd_ms >= 0),
  ADD COLUMN IF NOT EXISTS weight_kg real CHECK (weight_kg IS NULL OR weight_kg > 0),
  ADD COLUMN IF NOT EXISTS vo2_max real CHECK (vo2_max IS NULL OR vo2_max > 0);

ALTER TABLE public.wearable_sleep
  ADD COLUMN IF NOT EXISTS resp_rate_avg real CHECK (resp_rate_avg IS NULL OR (resp_rate_avg BETWEEN 4 AND 60)),
  ADD COLUMN IF NOT EXISTS skin_temp_c real CHECK (skin_temp_c IS NULL OR (skin_temp_c BETWEEN 20 AND 45));
```

## Pagination Strategy

### Current Implementation (HealthBridgePlugin.kt)

- `MAX_RECORDS = 20000` safety cap
- `readAllPages()` with `pageToken` for SleepSessionRecord and ExerciseSessionRecord
- Aggregate queries for high-volume metrics (steps, HR) - no pagination needed

### Recommended Limits

| Record Type           | Page Size | Max Pages          | Rationale                          |
| --------------------- | --------- | ------------------ | ---------------------------------- |
| HeartRateRecord (raw) | 1000      | **NEVER READ RAW** | Use aggregate only                 |
| SleepSessionRecord    | 100       | 10                 | ~1000 sessions max (years of data) |
| ExerciseSessionRecord | 100       | 10                 | ~1000 workouts max                 |
| StepsRecord (raw)     | 1000      | **NEVER READ RAW** | Use aggregate only                 |

### Aggregate vs Raw Read Policy

- **ALWAYS use aggregates** for: steps, distance, calories, HR (avg/max), resting HR, HRV
- **Raw reads only for**: Sleep sessions, Exercise sessions (need metadata)
- **Never read raw** high-frequency records (HR samples, step batches)

## Sync Window Strategy

### Current (healthAggregator.ts)

```typescript
const SYNC_OVERLAP_DAYS = 2;
const SYNC_MAX_DAYS = 30;

function windowDaysFrom(lastSyncAt, floorDays) {
  if (!lastSyncAt) return SYNC_MAX_DAYS;
  const daysSince = Math.ceil((Date.now() - new Date(lastSyncAt).getTime()) / 86400000);
  return Math.min(SYNC_MAX_DAYS, Math.max(floorDays, daysSince + SYNC_OVERLAP_DAYS));
}
```

### Recommended Enhancement

- Track **per-record-type tokens** via Changes API (Phase H)
- Initial sync: 30 days max (configurable)
- Incremental: Changes token + 2 day overlap
- Full re-sync capability for permission changes

## Error Handling Mapping

| Health Connect Error           | GymLog Error Code          | User Action                                  |
| ------------------------------ | -------------------------- | -------------------------------------------- |
| SDK_UNAVAILABLE                | `NOT_AVAILABLE`            | Install/update Health Connect app            |
| PROVIDER_UPDATE_REQUIRED       | `PROVIDER_UPDATE_REQUIRED` | Update Health Connect via Play Store         |
| PERMISSION_DENIED              | `PERMISSION_DENIED`        | Request permissions in-app                   |
| FEATURE_UNAVAILABLE            | `FEATURE_UNAVAILABLE`      | Record type not supported on device          |
| INVALID_TIME_RANGE             | `INVALID_TIME_RANGE`       | Adjust date range (max ~30 days)             |
| SecurityException (background) | `READ_FAILED`              | Foreground sync only / grant background perm |

## Limitations & Caveats

1. **HRV RMSSD**: Only available on Android 14+ with supporting provider (Samsung, Pixel, Garmin)
2. **Respiratory Rate**: Primarily during sleep; not all providers
3. **Skin Temperature**: Samsung Galaxy Watch 5+/6+, Fitbit Sense, Pixel Watch 2+
4. **VO2 Max**: Garmin, Samsung, Apple (via HealthKit), not Google Fit
5. **Background reads**: Require `READ_HEALTH_DATA_IN_BACKGROUND` permission (user-granted)
6. **Data freshness**: Wearables may sync to Health Connect with hours of delay
7. **No historical backfill** beyond what provider has synced to Health Connect
