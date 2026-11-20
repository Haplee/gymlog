# Android Testing Strategy

## Overview

This document defines the testing strategy for Health Connect integration, covering environment setup, test types, automation, and CI/CD integration.

## Test Environment

### Current Configuration (Verified)

| Component          | Version/Path                               | Status        |
| ------------------ | ------------------------------------------ | ------------- |
| **ANDROID_HOME**   | `C:/Users/franc/AppData/Local/Android/Sdk` | ✅ Configured |
| **SDK Platform**   | API 36 (Android 14)                        | ✅ Installed  |
| **Build Tools**    | 36.0.0                                     | ✅ Installed  |
| **ADB**            | `%ANDROID_HOME%/platform-tools/adb.exe`    | ✅ In PATH    |
| **Java**           | JDK 21                                     | ✅ Detected   |
| **Emulator**       | Android Emulator                           | ✅ Installed  |
| **AVD**            | `Pixel_9a` (API 36)                        | ✅ Created    |
| **Gradle Wrapper** | 9.3.1                                      | ✅ Configured |

### Emulator Specs (Pixel 9a)

```bash
# Verify AVD exists
%ANDROID_HOME%/emulator/emulator.exe -list-avds
# Should show: Pixel_9a

# Start emulator
%ANDROID_HOME%/emulator/emulator.exe -avd Pixel_9a -no-snapshot-load -gpu auto

# Verify ADB connection
adb devices
# Should show: emulator-5554  device
```

### Health Connect on Emulator

```bash
# Install Health Connect (if not preinstalled)
adb install health-connect.apk
# Or via Play Store in emulator

# Verify Health Connect version
adb shell dumpsys package com.google.android.apps.healthdata | grep versionName

# Open Health Connect Toolbox (for testing)
adb shell am start -n com.google.android.apps.healthdata/.toolbox.ToolboxActivity
```

## Test Pyramid

```
                    ┌─────────────────┐
                    │   E2E / UI      │  ← Appium + Emulator (few, critical paths)
                    │   (Appium)      │
            ┌───────┴─────────────────┴───────┐
            │      Integration Tests          │  ← Plugin + Aggregator + Supabase (mocked)
            │  (Vitest + TestContainers)      │
    ┌─────────┴───────────────────────────────┴─────────┐
    │              Unit Tests                           │  ← Pure functions, mappers, logic
    │  (Vitest - scoring, mappers, adapters)            │
    └───────────────────────────────────────────────────┘
```

## Test Categories

### 1. Unit Tests (Vitest) - Fast, No Device

#### Scoring & Adapters (`src/features/wearables/utils/__tests__/`)

```typescript
// Existing: scoringInputs.test.ts, readiness.test.ts
// Add: hrv/resp adapters, new signal logic

// scoringInputs.test.ts - extend
describe('toHrvSeries', () => { ... });
describe('toRespRateSeries', () => { ... });

// readiness.test.ts - extend
describe('computeReadiness with HRV', () => { ... });
describe('computeReadiness with Resp Rate', () => { ... });
```

#### Health Bridge TypeScript Types

```typescript
// healthBridge.test.ts - NEW
describe('HealthBridgePlugin types', () => {
  it('HealthReadResult serializes correctly', () => { ... });
  it('Error codes map to user messages', () => { ... });
});
```

#### Data Mappers (Kotlin → JS DTOs)

```kotlin
// HealthConnectMapperTest.kt - NEW
class HealthConnectMapperTest {
    @Test fun `maps HeartRateRecord to HealthDailyRow`() { ... }
    @Test fun `maps SleepSessionRecord to HealthSleepRow`() { ... }
    @Test fun `handles missing optional fields`() { ... }
    @Test fun `preserves UTC timestamps`() { ... }
}
```

### 2. Integration Tests (Vitest + Mocked Services)

#### Plugin Communication

```typescript
// healthAggregator.test.ts - NEW
import { HealthBridge } from '@shared/lib/healthBridge';

// Mock Capacitor plugin
vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({
    web: () => ({
      isAvailable: vi.fn().mockResolvedValue({ available: true }),
      hasPermissions: vi.fn().mockResolvedValue({ granted: true }),
      requestAuthorization: vi.fn().mockResolvedValue({ granted: true }),
      readAll: vi.fn().mockResolvedValue(mockHealthData),
    }),
  }),
}));

describe('syncAggregator', () => {
  it('reads data and upserts to Supabase', async () => {
    const result = await syncAggregator('user-123', 7);
    expect(result.daily).toBeGreaterThan(0);
    expect(supabase.rpc).toHaveBeenCalledWith('upsert_wearable_daily', ...);
  });

  it('handles partial permission gracefully', async () => {
    // Mock hasPermissions = false
    await expect(syncAggregator('user-123', 7)).rejects.toThrow('no_permission');
  });

  it('uses dynamic window from last_sync_at', async () => {
    // Mock connection with last_sync_at
    // Verify startDate calculation
  });
});
```

#### Supabase RPC Contracts

```typescript
// rpcContracts.test.ts - NEW
describe('upsert_wearable_daily RPC', () => {
  it('upserts with COALESCE semantics', async () => {
    // Test: new null doesn't overwrite existing value
  });

  it('respects UNIQUE constraint (user_id, date, source)', async () => {
    // Test: same date/source updates not inserts
  });
});
```

### 3. Native Unit Tests (JUnit + Robolectric)

#### FakeHealthConnectClient

```kotlin
// FakeHealthConnectClient.kt - TEST DOUBLE
class FakeHealthConnectClient : HealthConnectClient {
    private val records = mutableMapOf<KClass<*>, MutableList<Record>>()
    private var sdkStatus = SDK_AVAILABLE
    private val grantedPermissions = mutableSetOf<HealthPermission>()
    private val changesTokens = mutableMapOf<KClass<*>, String>()

    // Test control API
    fun addRecords(type: KClass<out Record>, vararg records: Record) { ... }
    fun setSdkStatus(status: Int) { ... }
    fun grantPermissions(vararg perms: HealthPermission) { ... }
    fun getChangesToken(type: KClass<*>) = changesTokens[type] ?: "token_${type.simpleName}"

    // Override HealthConnectClient methods
    override suspend fun readRecords(request: ReadRecordsRequest): ReadRecordsResponse { ... }
    override suspend fun aggregateGroupByPeriod(request: AggregateGroupByPeriodRequest): List<AggregateBucket> { ... }
    override suspend fun aggregate(request: AggregateRequest): Map<Metric, Any?> { ... }
    override val permissionController: PermissionController = FakePermissionController(grantedPermissions)
    override val changesClient: ChangesClient = FakeChangesClient(changesTokens)
}

class FakePermissionController(private val granted: MutableSet<HealthPermission>) : PermissionController {
    override suspend fun getGrantedPermissions(): Set<HealthPermission> = granted
    override fun createRequestPermissionResultContract(): ActivityResultContract<PermissionRequest, ActivityResult> = ...
}
```

#### HealthConnectManager Tests

```kotlin
// HealthConnectManagerTest.kt
@RunWith(RobolectricTestRunner::class)
class HealthConnectManagerTest {

    private lateinit var manager: HealthConnectManager
    private lateinit var fakeClient: FakeHealthConnectClient

    @Before
    fun setup() {
        fakeClient = FakeHealthConnectClient()
        manager = HealthConnectManager(context, fakeClient)
    }

    @Test
    fun `getAvailability returns false when SDK unavailable`() {
        fakeClient.setSdkStatus(SDK_UNAVAILABLE)
        assertFalse(manager.isAvailable())
    }

    @Test
    fun `readDailyAggregates returns mapped daily rows`() {
        fakeClient.addRecords(StepsRecord::class,
            stepsRecord("2026-01-15", 5000),
            stepsRecord("2026-01-16", 8000)
        )
        val result = manager.readDailyAggregates(start, end)
        assertEquals(2, result.size)
        assertEquals(5000, result[0].steps)
    }

    @Test
    fun `handles pagination for sleep records`() {
        // Add 1500 sleep records (exceeds page size)
        // Verify all pages read
    }

    @Test
    fun `permission revocation clears tokens`() {
        fakeClient.grantPermissions(READ_HEART_RATE)
        manager.sync()
        fakeClient.grantPermissions() // Revoke
        manager.onPermissionsChanged()
        assertTrue(manager.getTokens().isEmpty())
    }
}
```

### 4. Instrumented Tests (AndroidJUnitRunner on Emulator)

#### HealthBridgePlugin Integration

```kotlin
// HealthBridgePluginInstrumentedTest.kt
@RunWith(AndroidJUnit4::class)
class HealthBridgePluginInstrumentedTest {

    @get:Rule
    val activityRule = ActivityScenarioRule(MainActivity::class.java)

    @Test
    fun `plugin registers and responds to isAvailable`() {
        val plugin = HealthBridgePlugin()
        plugin.setContext(InstrumentationRegistry.getInstrumentation().targetContext)
        plugin.setActivity(activityRule.scenario.result.get())

        val result = plugin.isAvailable(PluginCallTestHelper.create())
        assertTrue(result.getBoolean("available"))
    }

    @Test
    fun `requestAuthorization launches permission activity`() {
        // Requires Health Connect installed on emulator
        // Verify ActivityResult flow
    }
}
```

#### Changes API Test

```kotlin
// HealthConnectChangesTest.kt
@RunWith(AndroidJUnit4::class)
class HealthConnectChangesTest {

    @Test
    fun `getChangesToken returns valid token`() {
        val client = HealthConnectClient.getOrCreate(context)
        val token = client.changesClient.getChangesToken(
            ChangesTokenRequest(HeartRateRecord::class)
        )
        assertNotNull(token)
        assertTrue(token.isNotBlank())
    }

    @Test
    fun `getChanges returns inserts since token`() {
        // 1. Get initial token
        // 2. Insert records via Health Connect Toolbox
        // 3. Call getChanges with token
        // 4. Verify inserts returned
    }
}
```

### 5. E2E Tests (Appium + UiAutomator2)

#### Critical User Flows

```python
# test_health_connect_flow.py
import pytest
from appium import webdriver
from appium.options.android import UiAutomator2Options

@pytest.fixture
def driver():
    caps = UiAutomator2Options()
    caps.platform_name = "Android"
    caps.device_name = "Pixel_9a"
    caps.app = "path/to/GymLog-debug.apk"
    caps.automation_name = "UiAutomator2"
    driver = webdriver.Remote("http://localhost:4723", options=caps)
    yield driver
    driver.quit()

def test_first_time_health_connect_setup(driver):
    """User opens app, connects Health Connect, sees data"""
    # 1. Launch app, navigate to Wearables
    # 2. Tap "Connect Health Connect"
    # 3. Grant permissions in system sheet
    # 4. Verify sync starts
    # 5. Verify data appears (steps, sleep, etc.)
    pass

def test_permission_revocation(driver):
    """User revokes permission, app handles gracefully"""
    # 1. Connected state
    # 2. Revoke HR permission in HC settings
    # 3. Return to app, trigger sync
    # 4. Verify "permission needed" toast
    # 5. Verify other data still syncs
    pass

def test_multi_user_isolation(driver):
    """Two GymLog accounts on same device"""
    # 1. User A syncs
    # 2. Sign out, User B signs in
    # 3. Verify User B sees empty HC state
    # 4. User B grants permissions
    # 5. Verify User B data separate
    pass
```

## Health Connect Toolbox Automation

### Synthetic Data Insertion

```bash
# Steps
adb shell cmd health_connect insert-record \
  --type steps \
  --count 8000 \
  --time 2026-01-15T20:00:00 \
  --package com.franvi.gymlog

# Heart Rate (single sample)
adb shell cmd health_connect insert-record \
  --type heart_rate \
  --bpm 72 \
  --time 2026-01-15T10:00:00

# Heart Rate Variability
adb shell cmd health_connect insert-record \
  --type heart_rate_variability_rmssd \
  --rmssd 45.5 \
  --time 2026-01-15T07:00:00

# Sleep Session
adb shell cmd health_connect insert-record \
  --type sleep_session \
  --start-time 2026-01-14T23:00:00 \
  --end-time 2026-01-15T07:00:00 \
  --stage deep:120 \
  --stage light:240 \
  --stage rem:90 \
  --stage awake:30

# Exercise Session (Running)
adb shell cmd health_connect insert-record \
  --type exercise_session \
  --exercise-type running \
  --start-time 2026-01-15T18:00:00 \
  --end-time 2026-01-15T18:45:00 \
  --title "Carrera vespertina" \
  --distance 10.5 \
  --calories 650 \
  --avg-heart-rate 155 \
  --max-heart-rate 178

# Exercise Session (Strength)
adb shell cmd health_connect insert-record \
  --type exercise_session \
  --exercise-type strength_training \
  --start-time 2026-01-15T19:00:00 \
  --end-time 2026-01-15T20:30:00 \
  --title "Pesas" \
  --calories 400 \
  --avg-heart-rate 120
```

### Permission Revocation Test

```bash
# Revoke specific permission
adb shell cmd health_connect revoke-permission \
  --package com.franvi.gymlog \
  --permission READ_HEART_RATE

# Grant permission
adb shell cmd health_connect grant-permission \
  --package com.franvi.gymlog \
  --permission READ_HEART_RATE

# Check granted permissions
adb shell cmd health_connect get-permissions --package com.franvi.gymlog
```

### Logcat Monitoring

```bash
# Filter for Health Connect logs
adb logcat -s HealthBridge:V *:S

# Filter for sync logs
adb logcat -s HealthAggregator:V *:S

# All GymLog tags
adb logcat -s HealthBridge:V HealthAggregator:V Wearables:V *:S
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/android-test.yml
name: Android Tests

on:
  push:
    paths:
      - 'android/**'
      - 'src/features/wearables/**'
      - 'src/shared/lib/healthBridge.ts'
  pull_request:

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test -- --run

  native-unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'
      - uses: android-actions/setup-android@v3
        with:
          api-level: 36
          ndk-version: r27
      - name: Run native unit tests
        run: |
          cd android
          ./gradlew testDebugUnitTest

  instrumented-tests:
    runs-on: macos-latest # Required for emulator
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'
      - uses: android-actions/setup-android@v3
        with:
          api-level: 36
          emulator: true
          avd-name: Pixel_9a
      - name: Start emulator
        run: |
          emulator -avd Pixel_9a -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect &
          android-wait-for-emulator
      - name: Install Health Connect
        run: |
          # Download and install Health Connect APK
          curl -L -o health-connect.apk "https://..."
          adb install health-connect.apk
      - name: Run instrumented tests
        run: |
          cd android
          ./gradlew connectedDebugAndroidTest

  e2e-tests:
    runs-on: macos-latest
    if: github.event_name == 'pull_request' && github.base_ref == 'main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: android-actions/setup-android@v3
        with:
          api-level: 36
          emulator: true
      - name: Build debug APK
        run: |
          npm ci
          npm run build:android
      - name: Run Appium tests
        run: |
          # Start Appium server
          # Run Python test suite
          pip install -r test-requirements.txt
          pytest test_health_connect_flow.py -v
```

## Test Data Management

### Test Fixtures

```typescript
// test/fixtures/healthConnect.ts
export const mockHealthDaily: HealthDailyRow[] = [
  {
    date: '2026-01-15',
    steps: 8000,
    distance_km: 5.2,
    calories: 2100,
    resting_hr: 58,
    avg_hr: 72,
    max_hr: 145,
  },
  {
    date: '2026-01-14',
    steps: 6500,
    distance_km: 4.1,
    calories: 1950,
    resting_hr: 60,
    avg_hr: 70,
    max_hr: 138,
  },
];

export const mockHealthSleep: HealthSleepRow[] = [
  {
    date: '2026-01-15',
    duration_min: 480,
    deep_min: 90,
    light_min: 240,
    rem_min: 100,
    awake_min: 30,
  },
  {
    date: '2026-01-14',
    duration_min: 420,
    deep_min: 60,
    light_min: 220,
    rem_min: 80,
    awake_min: 40,
  },
];

export const mockHealthWorkouts: HealthWorkoutRow[] = [
  {
    external_id: 'hc:workout-1',
    type: 'running',
    title: 'Carrera',
    started_at: '2026-01-15T18:00:00Z',
    ended_at: '2026-01-15T18:45:00Z',
    duration: 2700,
    distance: 10.5,
    calories: 650,
    avg_hr: 155,
    max_hr: 178,
  },
  {
    external_id: 'hc:workout-2',
    type: 'strength',
    title: 'Pesas',
    started_at: '2026-01-15T19:00:00Z',
    ended_at: '2026-01-15T20:30:00Z',
    duration: 5400,
    calories: 400,
    avg_hr: 120,
    max_hr: 145,
  },
];
```

## Test Checklist per MVP

### MVP 1

- [ ] Unit tests: scoring adapters, new signal logic
- [ ] Unit tests: HealthBridge TypeScript types
- [ ] Native unit tests: FakeHealthConnectClient, mappers
- [ ] Integration tests: syncAggregator with mocked plugin
- [ ] Instrumented tests: plugin registration, isAvailable
- [ ] Manual: Health Connect Toolbox data insertion
- [ ] Manual: Permission grant/revoke flow

### MVP 2

- [ ] Native unit tests: Changes API, token persistence
- [ ] Integration tests: incremental sync logic
- [ ] Instrumented tests: getChanges, permission change detection
- [ ] E2E: Full sync flow with synthetic data

### MVP 3

- [ ] Native unit tests: WorkManager sync worker
- [ ] Integration tests: background sync, multi-user
- [ ] E2E: Multi-user isolation, account switch

### MVP 4

- [ ] Native unit tests: Write records to Health Connect
- [ ] Instrumented tests: write permissions, conflict resolution
- [ ] E2E: GymLog workout → Health Connect roundtrip

## Performance Benchmarks

| Operation                  | Target | Measurement                         |
| -------------------------- | ------ | ----------------------------------- |
| Initial sync (30 days)     | < 30s  | Instrumented test with 1000 records |
| Incremental sync (7 days)  | < 5s   | Instrumented test with 200 records  |
| Daily aggregate read       | < 2s   | Unit test with mock                 |
| Sleep read (30 nights)     | < 3s   | Unit test with mock                 |
| Plugin method overhead     | < 10ms | JUnit benchmark                     |
| Supabase upsert (100 rows) | < 2s   | Integration test                    |

## Debugging Commands

```bash
# Clear app data (reset permissions, tokens)
adb shell pm clear com.franvi.gymlog

# View Health Connect database (root required)
adb shell su -c "cp /data/data/com.google.android.apps.healthdata/databases/health_connect.db /sdcard/"
adb pull /sdcard/health_connect.db

# Dump Health Connect package info
adb shell dumpsys package com.google.android.apps.healthdata

# Force stop Health Connect
adb shell am force-stop com.google.android.apps.healthdata

# Enable verbose Health Connect logging
adb shell setprop log.tag.HealthConnect VERBOSE
```
