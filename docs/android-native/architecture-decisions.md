# Architecture Decision Records (ADRs)

## ADR-001: Hybrid Architecture (React + Kotlin via Capacitor)

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: GymLog is a React/TypeScript app using Capacitor. Need Health Connect integration which is Android-native.

**Decision**:

- Keep React/TypeScript as primary UI and logic layer
- Use Capacitor plugins for native Android functionality
- Kotlin only for: Health Connect access, platform-specific APIs, Compose screens (when value add)
- No full rewrite in Kotlin
- No duplication of TypeScript algorithms in Kotlin

**Consequences**:

- ✅ Single codebase for iOS/Android/Web
- ✅ Existing scoring, UI, Supabase logic preserved
- ✅ Team expertise in React leveraged
- ⚠️ Capacitor plugin maintenance overhead
- ⚠️ Bridge serialization constraints (DTOs only)

---

## ADR-002: Health Connect SDK Version

**Date**: 2025-11-05  
**Status**: Accepted (Pending Verification)  
**Context**: Current `variables.gradle` uses `healthConnectVersion = '1.1.0-rc03'` (release candidate).

**Decision**:

- Verify stable 1.1.0 release before implementation
- If 1.1.0 stable exists: upgrade to stable
- If only RC: use RC with pin; monitor for stable
- Do not use alpha/beta in production

**Consequences**:

- RC may have breaking changes before stable
- Need regression testing on SDK update
- Document version in CHANGELOG

---

## ADR-003: Read-Only MVP (No Write Permissions Initially)

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Health Connect write permissions require Play Console Health Apps review, additional privacy scrutiny.

**Decision**:

- MVP 1-3: Read-only (READ_* permissions only)
- MVP 4+: Write permissions (WRITE_EXERCISE, WRITE_HEART_RATE, etc.) when feature justified
- No `READ_HEALTH_DATA_IN_BACKGROUND` in MVP 1 (already in manifest but not requested)
- No `READ_HEALTH_DATA_HISTORY` in MVP 1-3

**Consequences**:

- Simpler privacy review for initial launch
- Faster time to value
- Write features deferred but architecturally prepared

---

## ADR-004: Aggregate Reads Over Raw Reads

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Health Connect provides both raw records (paginated) and aggregates (pre-computed).

**Decision**:

- **ALWAYS use aggregates** for: steps, distance, calories, heart rate (avg/max), resting HR, HRV
- **Raw reads only for**: SleepSessionRecord, ExerciseSessionRecord (need metadata, stages, segments)
- **Never read raw**: HeartRateRecord samples, StepsRecord batches

**Rationale**:

1. Aggregates apply Health Connect's provider priority list (deduplication)
2. Aggregates computed in HC process - no 1000-record page limits
3. Raw HR samples = thousands per day; memory/bandwidth waste
4. Daily buckets align with GymLog's `wearable_daily` model

---

## ADR-005: Per-Record-Type Changes Tokens

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Health Connect Changes API returns tokens per record type.

**Decision**:

- Store separate Changes token for each record type
- Token key: record type class name (e.g., "SleepSessionRecord")
- Storage: `wearable_connections.health_connect_tokens` JSONB
- Update token **only after successful Supabase upsert**

**Consequences**:

- Fine-grained incremental sync
- Partial failure doesn't corrupt other types' tokens
- Token corruption recovery: clear token → full re-read

---

## ADR-006: Daily Aggregates Re-read (Not Changes API)

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Changes API returns raw record changes; daily aggregates are computed views.

**Decision**:

- Do NOT use Changes API for daily metrics (steps, HR, calories, etc.)
- Instead: Re-read aggregate for recent window (7 days + 2 day overlap)
- Rationale: Re-aggregating from raw changes is complex and error-prone
- Aggregate re-read is fast (single call) and handles provider priority changes

**Consequences**:

- Slightly more data transfer (negligible: ~7 buckets × 6 metrics)
- Guarantees correct aggregates after provider priority changes
- Simpler implementation

---

## ADR-007: No Data Fabrication (Nulls Over Zeros)

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Missing health data could be filled with zeros or averages.

**Decision**:

- **Never** fill missing values with zeros, averages, or interpolations
- Use `null` for missing measurements
- Scoring functions handle `null` gracefully (skip signal)
- UI shows "no data" not "0"

**Consequences**:

- Honest representation of data availability
- Scoring confidence reflects actual data
- No misleading recovery scores

---

## ADR-008: Multi-Provider Deduplication via Health Connect

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Multiple apps (Zepp, Samsung Health, Google Fit) write to Health Connect.

**Decision**:

- Rely on Health Connect's built-in provider priority for aggregates
- Store single row per (user_id, date, source='health_connect') in `wearable_daily`
- Do NOT store per-provider rows in GymLog
- UI cannot distinguish Zepp vs Samsung steps (HC merges them)

**Consequences**:

- Simpler data model
- User manages priority in HC settings
- Loss of per-provider granularity (acceptable for scoring)

---

## ADR-009: Soft Delete for Sessions, Preserve Daily/Sleep

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Health Connect Changes API reports deletions.

**Decision**:

- **Exercise sessions** (cardio_sessions, health_sessions): Soft delete (`deleted_at` timestamp) or mark via `source` change
- **Sleep sessions**: Do NOT delete; mark `deleted_at` if needed; preserve history
- **Daily aggregates**: Ignore deletions; re-read handles (bucket becomes empty → null)

**Rationale**:

- User may want history even if source deleted
- Sleep data valuable for longitudinal trends
- Daily aggregates re-computed on re-read

---

## ADR-010: Account Isolation (No Cross-User Data Sharing)

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Health Connect stores device-level data; GymLog has per-user accounts.

**Decision**:

- Each GymLog user gets isolated HealthConnectClient instance
- No automatic association of historical data on user switch
- New user must explicitly grant permissions
- RLS enforces per-user data in Supabase
- Clear tokens on user switch

**Consequences**:

- Shared device = separate permission grants per user
- No data leakage between accounts
- Slight friction for multi-user devices (acceptable)

---

## ADR-011: Extend computeReadiness (Not Replace Core)

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Two readiness systems exist: wearables (`computeReadiness`) and core (`evaluate`).

**Decision**:

- MVP 1: Extend `computeReadiness` with HRV and respiratory rate signals
- Keep existing `Readiness` contract unchanged (additive signals only)
- MVP 2: Bridge wearables data to core `evaluate()` via `wearablesToReadinessDays()`
- Do NOT modify core readiness thresholds or logic without validation

**Consequences**:

- Backward compatible
- RecoveryCard automatically shows new signals
- Core readiness unlocked when HRV/resp data available

---

## ADR-012: Feature Flags for Deferred Scoring Modules

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Several scoring modules deferred (strain, stressBase, zones, sleepRegularity, fitnessLevel).

**Decision**:

- Implement `getScoringFlags(data)` returning enabled/disabled per module
- Activation criteria based on data availability (e.g., 7 days HRV → hrvEnabled)
- Modules remain in code but gated by flags
- No automatic activation; explicit decision per module

**Consequences**:

- Progressive enhancement as data accumulates
- No breaking changes to existing scoring
- Clear activation criteria documented

---

## ADR-013: Error Codes as String Constants (Not Exceptions)

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Capacitor plugin errors must be serializable to JavaScript.

**Decision**:

- Define error codes as string constants: `NOT_AVAILABLE`, `PERMISSION_DENIED`, etc.
- Plugin returns `{ error: { code: string, message: string } }`
- TypeScript maps codes to user-facing messages
- No Kotlin exceptions cross the bridge

**Error Code List**:

```
NOT_AVAILABLE
PROVIDER_UPDATE_REQUIRED
PERMISSION_DENIED
FEATURE_UNAVAILABLE
INVALID_TIME_RANGE
SYNC_INTERRUPTED
READ_FAILED
UNKNOWN_ERROR
```

---

## ADR-014: Pagination Safety Cap

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Health Connect `readRecords` uses pagination tokens.

**Decision**:

- Keep `MAX_RECORDS = 20000` safety cap in `readAllPages()`
- Page size: default (1000) or 100 for sessions
- Log warning if cap hit (indicates token loop bug)
- Sleep: ~1000 records = 3 years daily sleep
- Exercise: ~1000 records = 3 years daily workouts

---

## ADR-015: WorkManager for Background Sync (MVP 3)

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Current sync triggers: app open, foreground resume (15min throttle), manual.

**Decision**:

- MVP 3: Add WorkManager periodic sync (daily 4 AM)
- Constraints: WiFi, battery not low, network connected
- Foreground sync remains with 15min throttle
- Background permission (`READ_HEALTH_DATA_IN_BACKGROUND`) only if user enables "Auto-sync"

**Consequences**:

- Reliable daily sync without app open
- Battery-friendly
- User controls background behavior

---

## ADR-016: FakeHealthConnectClient for Testing

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Health Connect requires device/emulator; slow for unit tests.

**Decision**:

- Implement `FakeHealthConnectClient` implementing `HealthConnectClient` interface
- In-memory record storage per type
- Controllable SDK status, permissions, tokens
- Used in Robolectric unit tests (fast, no emulator)
- Instrumented tests use real HC on emulator

**Consequences**:

- Fast unit test execution (<1s)
- Deterministic test scenarios
- CI/CD friendly (no emulator needed for unit tests)

---

## ADR-017: Deprecate HealthBridgePlugin (Replace with HealthConnectPlugin)

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Existing `HealthBridgePlugin.kt` works but lacks Changes API, token persistence, new record types.

**Decision**:

- Build new `HealthConnectPlugin` with full API
- Keep `HealthBridgePlugin` for 1 release (backward compat)
- TypeScript: new `healthConnect.ts` plugin, deprecate `healthBridge.ts`
- Migration: Feature flag to switch; remove old after validation

**Migration Path**:

```
Release N:   Both plugins registered; healthAggregator uses HealthBridgePlugin
Release N+1: healthAggregator switches to HealthConnectPlugin; HealthBridgePlugin deprecated
Release N+2: HealthBridgePlugin removed
```

---

## ADR-018: No Background Permission in MVP 1

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Manifest already declares `READ_HEALTH_DATA_IN_BACKGROUND` but plugin doesn't request it.

**Decision**:

- MVP 1: Do NOT request background permission
- Sync only in foreground (app open, foreground resume)
- If sync fails due to background read (SecurityException), catch and log; don't crash
- MVP 3: Request background permission when WorkManager sync added

**Current Code Handles This**:

```kotlin
// HealthBridgePlugin.kt line 63-68: backgroundPermission separate from permissions
// hasPermissions() only checks data permissions, not background
// readAll() catches SecurityException per-section (line 168-185)
```

---

## ADR-019: UTC Timestamps, Local Date Bucketing

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Health Connect returns `Instant` (UTC); GymLog stores daily buckets by local date.

**Decision**:

- Store all timestamps as ISO 8601 UTC in Supabase
- Daily bucket key: local date (YYYY-MM-DD) derived from UTC instant
- Use device timezone for bucketing (consistent with user's day)
- Plugin converts using `ZoneId.systemDefault()`

**Implementation** (existing in HealthBridgePlugin.kt):

```kotlin
private val zone: ZoneId get() = ZoneId.systemDefault()
private fun dateKey(instant: Instant): String = LocalDate.ofInstant(instant, zone).toString()
```

---

## ADR-020: Play Console Health Apps Declaration Required

**Date**: 2025-11-05  
**Status**: Accepted  
**Context**: Apps accessing Health Connect must declare in Play Console.

**Decision**:

- Complete Data Safety section before first release with HC
- Declare all READ_* permissions used
- Purpose: "Fitness tracking and recovery analytics"
- Data handling: "Encrypted in transit (TLS 1.2+), encrypted at rest (Supabase)"
- Deletion: "User can delete all health data from app settings"
- Privacy policy URL required
- Pre-launch review may take 1-2 weeks

---

## Decision Summary Table

| ADR | Topic                   | Status    | MVP Impact        |
| --- | ----------------------- | --------- | ----------------- |
| 001 | Hybrid Architecture     | Accepted  | All               |
| 002 | HC SDK Version          | Accepted* | 1 (verify stable) |
| 003 | Read-Only MVP           | Accepted  | 1-3               |
| 004 | Aggregate Reads         | Accepted  | 1                 |
| 005 | Per-Type Tokens         | Accepted  | 1-2               |
| 006 | Aggregate Re-read       | Accepted  | 1-2               |
| 007 | No Fabrication          | Accepted  | All               |
| 008 | HC Deduplication        | Accepted  | 1                 |
| 009 | Soft Delete             | Accepted  | 2                 |
| 010 | Account Isolation       | Accepted  | 1-3               |
| 011 | Extend computeReadiness | Accepted  | 1-2               |
| 012 | Feature Flags           | Accepted  | 1-3               |
| 013 | Error Codes             | Accepted  | 1                 |
| 014 | Pagination Cap          | Accepted  | 1                 |
| 015 | WorkManager             | Accepted  | 3                 |
| 016 | Fake Client             | Accepted  | 1 (testing)       |
| 017 | Deprecate Old Plugin    | Accepted  | 1-2               |
| 018 | No Background Perm      | Accepted  | 1                 |
| 019 | UTC/Local Dates         | Accepted  | All               |
| 020 | Play Console            | Accepted  | Pre-launch        |

_\*Pending stable version verification_

---

## Revisit Triggers

| ADR | Revisit When                           |
| --- | -------------------------------------- |
| 002 | Health Connect 1.1.0 stable released   |
| 003 | User demand for writing workouts to HC |
| 006 | Changes API supports aggregate changes |
| 010 | Google adds per-app-user HC storage    |
| 011 | Core readiness proven superior; unify  |
| 015 | WorkManager reliability issues on OEMs |
| 020 | Play Console policy changes            |
