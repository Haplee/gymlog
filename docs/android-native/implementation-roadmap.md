# Implementation Roadmap

## Overview

Phased implementation plan for Health Connect integration, organized by MVP with clear dependencies, risks, and acceptance criteria.

## MVP 1: Foundation (Weeks 1-4)

### Goal

Basic Health Connect read integration with existing GymLog models. Sync daily aggregates, sleep, and workouts.

### Scope

#### New Kotlin Plugin: `HealthConnectPlugin`

```
android/app/src/main/java/com/franvi/gymlog/
├── healthconnect/
│   ├── HealthConnectPlugin.kt           # Capacitor plugin entry point
│   ├── manager/
│   │   ├── HealthConnectAvailabilityManager.kt
│   │   ├── HealthConnectPermissionManager.kt
│   │   ├── HealthConnectReader.kt
│   │   ├── HealthConnectAggregateReader.kt
│   │   └── HealthConnectChangesManager.kt
│   ├── model/
│   │   ├── HealthConnectMapper.kt
│   │   └── dto/
│   │       ├── HealthDailyRow.kt
│   │       ├── HealthSleepRow.kt
│   │       └── HealthWorkoutRow.kt
│   └── repository/
│       └── HealthConnectRepository.kt   # Token persistence
```

#### TypeScript API (New Plugin)

```typescript
// @shared/lib/healthConnect.ts - NEW plugin registration
export interface HealthConnectPlugin {
  getAvailability(): Promise<{ available: boolean; providerUpdateRequired?: boolean }>;
  getCapabilities(): Promise<{ recordTypes: string[] }>;
  getGrantedPermissions(): Promise<{ permissions: string[] }>;
  requestPermissions(permissions: string[]): Promise<{ granted: string[]; denied: string[] }>;
  readRecords(options: ReadRecordsOptions): Promise<ReadRecordsResult>;
  readAggregateData(options: AggregateOptions): Promise<AggregateResult>;
  getChangesToken(recordType: string): Promise<{ token: string }>;
  getChanges(recordType: string, token: string): Promise<ChangesResult>;
  getSyncState(): Promise<SyncState>;
  openHealthConnectSettings(): Promise<void>;
}

// Error codes
export type HealthConnectErrorCode =
  | 'NOT_AVAILABLE'
  | 'PROVIDER_UPDATE_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'FEATURE_UNAVAILABLE'
  | 'INVALID_TIME_RANGE'
  | 'SYNC_INTERRUPTED'
  | 'READ_FAILED'
  | 'UNKNOWN_ERROR';
```

#### Database Migrations

```sql
-- 1. Add HRV, weight, VO2 max to wearable_daily
ALTER TABLE wearable_daily ADD COLUMN IF NOT EXISTS hrv_rmssd_ms real;
ALTER TABLE wearable_daily ADD COLUMN IF NOT EXISTS weight_kg real;
ALTER TABLE wearable_daily ADD COLUMN IF NOT EXISTS vo2_max real;

-- 2. Add resp rate, skin temp to wearable_sleep
ALTER TABLE wearable_sleep ADD COLUMN IF NOT EXISTS resp_rate_avg real;
ALTER TABLE wearable_sleep ADD COLUMN IF NOT EXISTS skin_temp_c real;

-- 3. Add Changes tokens to wearable_connections
ALTER TABLE wearable_connections ADD COLUMN IF NOT EXISTS health_connect_tokens jsonb DEFAULT '{}';

-- 4. Add constraints
ALTER TABLE wearable_daily ADD CONSTRAINT chk_hrv CHECK (hrv_rmssd_ms IS NULL OR hrv_rmssd_ms >= 0);
ALTER TABLE wearable_daily ADD CONSTRAINT chk_weight CHECK (weight_kg IS NULL OR weight_kg > 0);
ALTER TABLE wearable_sleep ADD CONSTRAINT chk_resp CHECK (resp_rate_avg IS NULL OR resp_rate_avg BETWEEN 4 AND 60);
```

#### Scoring Integration

- Extend `WearableDaily` / `WearableSleep` types
- Add `toHrvSeries()`, `toRespRateSeries()` adapters
- Extend `computeReadiness()` with HRV and resp signals
- Update `RecoveryCard` to display new signals

#### Sync Enhancements

- Persist Changes tokens per record type
- Implement incremental sync for sleep/exercise
- Keep aggregate re-read for daily metrics (7 days + overlap)
- Add interruption recovery (token only updated on success)

### Dependencies

- Health Connect SDK stable version (currently 1.1.0-rc03 → verify 1.1.0)
- Capacitor 8 plugin API
- Supabase migration deployment

### Risks

| Risk                                        | Probability | Impact | Mitigation                                  |
| ------------------------------------------- | ----------- | ------ | ------------------------------------------- |
| Health Connect SDK breaking changes         | Medium      | High   | Pin version; test on emulator before update |
| Provider data gaps (no HRV on some devices) | High        | Medium | Graceful degradation; feature flags         |
| Changes API not available on older HC       | Low         | Medium | Fallback to full re-read with overlap       |
| Token persistence failures                  | Low         | High   | Transactional token update; retry logic     |

### Acceptance Criteria

- [ ] Plugin builds and registers in MainActivity
- [ ] `getAvailability()` returns correct status on device/emulator
- [ ] Permission request shows granular system sheet
- [ ] `readAggregateData()` returns daily metrics for 30 days
- [ ] `readRecords()` returns sleep sessions with stages
- [ ] `readRecords()` returns exercise sessions (cardio + strength)
- [ ] Data upserts to Supabase with correct `source='health_connect'`
- [ ] Deduplication works (re-sync doesn't duplicate)
- [ ] HRV and resp rate appear in `computeReadiness` signals
- [ ] `RecoveryCard` displays new signals when available
- [ ] Unit tests pass (scoring, mappers, adapters)
- [ ] Native unit tests pass (FakeHealthConnectClient)
- [ ] Instrumented test: plugin registration + basic read

---

## MVP 2: Incremental Sync & Robustness (Weeks 5-8)

### Goal

Production-ready incremental sync with Changes API, deletion handling, permission change detection.

### Scope

#### Changes API Integration

```kotlin
// HealthConnectChangesManager.kt
suspend fun syncIncremental(userId: String): SyncResult {
    val tokens = repository.getAllTokens(userId)

    // Sleep - incremental via Changes
    val sleepChanges = client.changesClient.getChanges(
        GetChangesRequest(SleepSessionRecord::class, tokens.sleep)
    )
    processSleepChanges(sleepChanges)
    repository.saveToken(userId, "sleep", sleepChanges.nextToken)

    // Exercise - incremental via Changes
    val exerciseChanges = client.changesClient.getChanges(
        GetChangesRequest(ExerciseSessionRecord::class, tokens.exercise)
    )
    processExerciseChanges(exerciseChanges)
    repository.saveToken(userId, "exercise", exerciseChanges.nextToken)

    // Daily aggregates - re-read recent window (not via Changes)
    val dailyResult = aggregateReader.readRecentDays(7)
    upsertDaily(dailyResult)

    return SyncResult(...)
}
```

#### Deletion Handling

```kotlin
// Soft delete for sessions, preserve daily/sleep history
when (change.type) {
    ChangeType.DELETE -> when (recordType) {
        ExerciseSessionRecord::class -> softDeleteHealthSession(externalId)
        SleepSessionRecord::class -> markSleepAsDeleted(date) // Don't hard delete
        else -> Unit // Daily aggregates: ignore (re-read handles)
    }
}
```

#### Permission Change Detection

```kotlin
// HealthConnectPermissionManager.kt
suspend fun checkAndHandlePermissionChanges(userId: String) {
    val current = client.permissionController.getGrantedPermissions()
    val previous = repository.getGrantedPermissions(userId)

    val granted = current - previous
    val revoked = previous - current

    granted.forEach { perm ->
        // Schedule backfill for new permission
        syncManager.scheduleBackfill(userId, perm.recordType, 30)
        repository.saveGrantedPermissions(userId, current)
    }

    revoked.forEach { perm ->
        // Clear token, stop syncing this type
        repository.clearToken(userId, perm.recordType)
        connectionManager.setPermissionRevoked(userId, perm)
        repository.saveGrantedPermissions(userId, current)
    }
}
```

#### Multi-User Isolation

```kotlin
// HealthConnectManager.kt
class HealthConnectManager {
    private val userClients = mutableMapOf<String, HealthConnectClient>()
    private val userTokens = mutableMapOf<String, Map<String, String>>()

    fun getClient(userId: String): HealthConnectClient {
        return userClients.getOrPut(userId) {
            HealthConnectClient.getOrCreate(context)
        }
    }

    fun onUserSwitch(oldUserId: String?, newUserId: String?) {
        oldUserId?.let { userClients.remove(it) }
        // New user starts fresh - no shared state
    }
}
```

### Dependencies

- MVP 1 complete
- Changes API stability verified
- Supabase RPC for soft deletes (if needed)

### Risks

| Risk                         | Probability | Impact | Mitigation                                   |
| ---------------------------- | ----------- | ------ | -------------------------------------------- |
| Changes API token expiration | Medium      | Medium | Handle `TOKEN_EXPIRED`; full re-sync         |
| Deletion sync conflicts      | Low         | Medium | Idempotent deletes; last-write-wins          |
| Multi-user token leakage     | Low         | High   | Strict per-user isolation; integration tests |

### Acceptance Criteria

- [ ] Incremental sync uses Changes API for sleep/exercise
- [ ] Daily aggregates re-read 7-day window + 2 day overlap
- [ ] Deleted sleep sessions marked (not hard deleted)
- [ ] Deleted exercise sessions soft-deleted
- [ ] New permission grant triggers 30-day backfill
- [ ] Revoked permission stops sync + clears token
- [ ] User switch clears old user's client/tokens
- [ ] New user sees empty state, must grant permissions
- [ ] Sync completes in <5s for incremental
- [ ] Integration tests: permission changes, deletions, multi-user

---

## MVP 3: Background & Automation (Weeks 9-12)

### Goal

Automated background sync, WorkManager integration, real-time updates.

### Scope

#### WorkManager Periodic Sync

```kotlin
// HealthConnectSyncWorker.kt
@HiltWorker
class HealthConnectSyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val syncManager: HealthConnectSyncManager,
    private val authManager: AuthManager
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val userId = authManager.currentUserId ?: return Result.success()
        val granted = permissionManager.hasPermissions(userId) ?: return Result.success()

        return try {
            syncManager.syncIncremental(userId)
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}

// Schedule in HealthConnectModule
val request = PeriodicWorkRequestBuilder<HealthConnectSyncWorker>(24, TimeUnit.HOURS)
    .setInitialDelay(4, TimeUnit.HOURS)  // 4 AM
    .setConstraints(Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .setRequiresBatteryNotLow(true)
        .build())
    .addTag("health_connect_sync")
    .build()
WorkManager.enqueueUniquePeriodicWork("health_connect_sync", KEEP, request)
```

#### Foreground Sync Optimization

```kotlin
// Only sync on foreground if >15 min since last sync
// Use existing useWearableSync.ts logic but native
```

#### Real-time Changes Listener (If API Stable)

```kotlin
// HealthConnectChangesListener.kt
client.changesClient.addChangesListener(
    ChangesListenerRequest(
        recordTypes = setOf(SleepSessionRecord::class, ExerciseSessionRecord::class),
        listener = { changes ->
            // Debounce: batch changes for 30s
            // Trigger incremental sync
            syncManager.scheduleIncremental(userId)
        }
    )
)
```

#### Background Read Permission

- Request `READ_HEALTH_DATA_IN_BACKGROUND` when user enables "Auto-sync in background"
- Only if WorkManager sync proves valuable
- Clear explanation: "Allows sync when app closed"

### Dependencies

- MVP 2 complete
- WorkManager 2.9.1 (already in project)
- Background permission justification documented

### Risks

| Risk                              | Probability | Impact | Mitigation                                      |
| --------------------------------- | ----------- | ------ | ----------------------------------------------- |
| WorkManager not firing reliably   | Medium      | Medium | Test on multiple OEMs; fallback to foreground   |
| Background permission denial rate | High        | Low    | Make optional; clear value prop                 |
| Battery drain from frequent sync  | Low         | High   | Strict constraints; 24h period; battery not low |

### Acceptance Criteria

- [ ] WorkManager sync runs daily at ~4 AM
- [ ] Sync only runs on WiFi, battery not low
- [ ] Foreground sync throttled (15 min minimum)
- [ ] Background permission requested with clear rationale
- [ ] Real-time listener triggers incremental sync (if API stable)
- [ ] No duplicate syncs (deduplication via tokens)
- [ ] Battery impact negligible (<1% per day)

---

## MVP 4: Write & Advanced (Weeks 13-16+)

### Goal

Write GymLog workouts to Health Connect, native Compose screens, widgets.

### Scope

#### Write Permissions

```xml
<!-- Add to AndroidManifest when needed -->
<uses-permission android:name="android.permission.health.WRITE_EXERCISE" />
<uses-permission android:name="android.permission.health.WRITE_HEART_RATE" />
<uses-permission android:name="android.permission.health.WRITE_SLEEP" />
<uses-permission android:name="android.permission.health.WRITE_STEPS" />
```

#### Write Implementation

```kotlin
// HealthConnectWriter.kt
suspend fun writeWorkout(workout: GymLogWorkout) {
    val session = ExerciseSessionRecord.Builder(
        exerciseType = mapToHCType(workout.type),
        startTime = workout.startedAt,
        endTime = workout.endedAt,
    ).apply {
        title = workout.title
        setMetadata(Metadata.Builder().build())
        // Add segments for intervals if applicable
    }.build()

    client.insertRecords(listOf(session))

    // Write HR samples if available
    workout.heartRateSamples?.let { samples ->
        val hrRecords = samples.map { sample ->
            HeartRateRecord.Builder(sample.bpm, sample.time).build()
        }
        client.insertRecords(hrRecords)
    }
}
```

#### Sync Conflict Resolution

```kotlin
// When both GymLog and HC have workout for same time
// Strategy: GymLog wins (user-entered); HC data supplementary
// External ID format: gl:${workoutId} for GymLog-written sessions
```

#### Jetpack Compose Screens (If Value Add)

- Health Connect permission management screen
- Data source priority editor (HC settings deep link)
- Native recovery dashboard (if significantly better than React)

#### Native Widgets

- Recovery score widget (Glance API)
- Today's readiness widget
- Quick workout logging widget

### Dependencies

- MVP 3 stable
- Play Console Health Apps declaration approved
- User demand validated

### Risks

| Risk                              | Probability | Impact | Mitigation                              |
| --------------------------------- | ----------- | ------ | --------------------------------------- |
| Write permission review rejection | Medium      | High   | Thorough privacy policy; minimal scopes |
| Duplicate workouts (GymLog + HC)  | Medium      | Medium | External ID dedupe; user merge UI       |
| Compose screens fragment UX       | Low         | Medium | Only build if measurable improvement    |

### Acceptance Criteria

- [ ] GymLog workouts appear in Health Connect
- [ ] HR samples written for workouts with HR data
- [ ] No duplicates when workout edited in GymLog
- [ ] Write permissions requested only when needed
- [ ] Play Console review passes
- [ ] Widgets update via WorkManager sync

---

## Cross-Cutting Concerns

### Documentation Updates

| Phase | Documents                                   |
| ----- | ------------------------------------------- |
| MVP 1 | API contracts, data mapping, privacy policy |
| MVP 2 | Sync architecture, token management         |
| MVP 3 | Background sync, WorkManager config         |
| MVP 4 | Write API, Compose components               |

### Testing Milestones

| Phase | Test Coverage Target                                  |
| ----- | ----------------------------------------------------- |
| MVP 1 | 80% unit (scoring, mappers), 100% plugin registration |
| MVP 2 | 100% Changes API, permission changes, multi-user      |
| MVP 3 | WorkManager integration, E2E critical paths           |
| MVP 4 | Write roundtrip, conflict resolution                  |

### Monitoring & Analytics

```kotlin
// Events to track (no PHI)
- health_connect_sync_started { type: 'initial'|'incremental'|'backfill' }
- health_connect_sync_completed { duration_ms, records_daily, records_sleep, records_exercise }
- health_connect_sync_failed { error_code, recoverable }
- health_connect_permission_changed { granted: [...], revoked: [...] }
- health_connect_user_switched { from_user, to_user }
```

### Rollback Plan

| MVP | Rollback Trigger               | Rollback Action                                              |
| --- | ------------------------------ | ------------------------------------------------------------ |
| 1   | Sync crashes / data corruption | Disable plugin via feature flag; keep old HealthBridgePlugin |
| 2   | Incremental sync loses data    | Revert to full re-read; clear tokens                         |
| 3   | Battery drain complaints       | Disable WorkManager; keep foreground sync                    |
| 4   | Write creates duplicates       | Disable write; delete HC-written sessions                    |

---

## Resource Estimates

| Role                      | MVP 1    | MVP 2    | MVP 3    | MVP 4    |
| ------------------------- | -------- | -------- | -------- | -------- |
| Android/Kotlin Engineer   | 1.0 FTE  | 0.5 FTE  | 0.5 FTE  | 0.5 FTE  |
| React/TypeScript Engineer | 0.5 FTE  | 0.25 FTE | 0.25 FTE | 0.25 FTE |
| QA/Automation             | 0.5 FTE  | 0.5 FTE  | 0.5 FTE  | 0.5 FTE  |
| Backend (Supabase)        | 0.25 FTE | 0.1 FTE  | 0.1 FTE  | 0.1 FTE  |

### Total Timeline: ~16 weeks (4 months)

---

## Go/No-Go Decision Points

| Milestone | Criteria                                             | Decision         |
| --------- | ---------------------------------------------------- | ---------------- |
| End MVP 1 | Plugin stable, sync works, scoring enhanced          | Proceed to MVP 2 |
| End MVP 2 | Incremental sync reliable, multi-user tested         | Proceed to MVP 3 |
| End MVP 3 | Background sync battery-neutral, user value proven   | Proceed to MVP 4 |
| Pre-MVP 4 | Play Console pre-check passed, write scope justified | Proceed to MVP 4 |

---

## Appendix: File Inventory (Implementation)

### New Files (MVP 1)

```
android/app/src/main/java/com/franvi/gymlog/healthconnect/
├── HealthConnectPlugin.kt
├── manager/
│   ├── HealthConnectAvailabilityManager.kt
│   ├── HealthConnectPermissionManager.kt
│   ├── HealthConnectReader.kt
│   ├── HealthConnectAggregateReader.kt
│   ├── HealthConnectChangesManager.kt
│   └── HealthConnectWriter.kt (stub)
├── model/
│   ├── HealthConnectMapper.kt
│   └── dto/
│       ├── HealthDailyRow.kt
│       ├── HealthSleepRow.kt
│       ├── HealthWorkoutRow.kt
│       ├── ReadRecordsOptions.kt
│       ├── AggregateOptions.kt
│       ├── ChangesResult.kt
│       └── SyncState.kt
├── repository/
│   └── HealthConnectRepository.kt
└── error/
    └── HealthConnectError.kt
```

### Modified Files (MVP 1)

```
android/app/src/main/java/com/franvi/gymlog/MainActivity.kt          # Register new plugin
android/app/build.gradle                                            # No new deps (HC already there)
src/shared/lib/healthConnect.ts                                     # NEW - TS plugin types
src/shared/lib/healthBridge.ts                                      # DEPRECATE - keep for compat
src/features/wearables/utils/scoringInputs.ts                       # Add HRV, resp adapters
src/features/wearables/utils/readiness.ts                           # Extend computeReadiness
src/features/wearables/types/index.ts                               # Extend WearableDaily, WearableSleep
src/features/wearables/components/RecoveryCard.tsx                  # Display new signals
supabase/migrations/XXXX_health_connect_extensions.sql              # NEW migration
```

### Deprecated (Future)

- `HealthBridgePlugin.kt` → Replace with `HealthConnectPlugin.kt`
- `healthBridge.ts` → Replace with `healthConnect.ts`
- Migration: Keep both for 1 release, then remove old
