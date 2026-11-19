# Scoring Integration Design

## Overview

This document analyzes how Health Connect metrics enhance GymLog's existing scoring engine and defines integration points without breaking existing contracts.

## Current Scoring Architecture

### Two Readiness Systems (Coexistence)

| System                  | Location                                    | Purpose                                      | Data Sources                                    |
| ----------------------- | ------------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| **Wearables Readiness** | `src/features/wearables/utils/readiness.ts` | Daily recovery badge, load hold suggestion   | `wearable_daily` (resting_hr), `wearable_sleep` |
| **Core Readiness**      | `src/shared/lib/scoring/readiness.ts`       | Training load modulation, ACWR, HRV z-scores | `DailyMetric` (hrv, rhr, resp, effort)          |

### Wearables Readiness (computeReadiness)

```typescript
// Input: WearableDaily[], WearableSleep[]
// Output: Readiness { level: 'low'|'normal', holdLoad, reasonKey, signals[], confidence }
// Signals: sleep, sleepDebt, rest, consistency, restingHr
// Thresholds: LOW_SLEEP_MIN=360, HIGH_RHR_DELTA=7, SLEEP_DEBT_HOLD_MIN=60, LOW_REST_SCORE=50, LOW_CONSISTENCY=0.7
```

### Core Readiness (evaluate)

```typescript
// Input: ReadinessDay[] { day, hrv?, rhr?, resp?, effort? }
// Output: Readiness { level: 'primed'|'balanced'|'strained'|'rundown'|'insufficient', signals[], acwr, monotony, confidence }
// Signals: hrv, rhr, respRate, acwr, monotony
// Z-score baselines: EWMA with outlier rejection
```

### Data Flow Gap

```
Health Connect → wearable_daily/sleep → computeReadiness → UI (RecoveryCard)
                                      ↘
                                       → Missing: HRV, resp → Core Readiness (evaluate)
```

## Health Connect Metrics → Scoring Mapping

### Currently Available (MVP 1)

| Health Connect                   | GymLog Field                          | Scoring Consumer                                    | Status     |
| -------------------------------- | ------------------------------------- | --------------------------------------------------- | ---------- |
| `RestingHeartRateRecord.BPM_AVG` | `WearableDaily.resting_hr`            | `computeReadiness` (rhr signal)                     | ✅ Working |
| `SleepSessionRecord` stages      | `WearableSleep.*`                     | `computeReadiness` (sleep, debt, rest, consistency) | ✅ Working |
| `StepsRecord.COUNT_TOTAL`        | `WearableDaily.steps`                 | Not used in scoring                                 | ✅ Stored  |
| `HeartRateRecord.BPM_AVG/MAX`    | `WearableDaily.avg_hr/max_hr`         | Not used in scoring                                 | ✅ Stored  |
| `ExerciseSessionRecord`          | `cardio_sessions` / `health_sessions` | Effort calculation (indirect)                       | ✅ Working |

### NEW in MVP 1 (Require Model Extensions)

| Health Connect                              | New Field                     | Scoring Consumer                     | Priority |
| ------------------------------------------- | ----------------------------- | ------------------------------------ | -------- |
| `HeartRateVariabilityRmssdRecord.RMSSD_AVG` | `WearableDaily.hrv_rmssd_ms`  | **Core Readiness (hrv signal)**      | **HIGH** |
| `RespiratoryRateRecord` (sleep avg)         | `WearableSleep.resp_rate_avg` | **Core Readiness (respRate signal)** | **HIGH** |
| `SkinTemperatureRecord` (sleep avg)         | `WearableSleep.skin_temp_c`   | Future: illness detection            | MEDIUM   |
| `Vo2MaxRecord`                              | `WearableDaily.vo2_max`       | Future: fitnessLevel module          | MEDIUM   |
| `WeightRecord`                              | `WearableDaily.weight_kg`     | Future: body composition             | LOW      |

## Integration Strategy

### Option A: Extend computeReadiness (Recommended for MVP 1)

Add HRV and respiratory rate to wearables readiness without touching core.

```typescript
// scoringInputs.ts - NEW adapters
export function toHrvSeries(daily: readonly WearableDaily[]): ScoringSeries {
  return collectSeries(daily, (row) =>
    isFiniteNumber(row.hrv_rmssd_ms) ? row.hrv_rmssd_ms : null,
  );
}

export function toRespRateSeries(sleep: readonly WearableSleep[]): ScoringSeries {
  return collectSeries(sleep, (row) =>
    isFiniteNumber(row.resp_rate_avg) ? row.resp_rate_avg : null,
  );
}

// readiness.ts - extend computeReadiness
export function computeReadiness(
  daily: WearableDaily[] | undefined,
  sleep: WearableSleep[] | undefined,
): Readiness | null {
  // ... existing code ...

  // NEW: HRV signal
  const hrvSeries = toHrvSeries(daily ?? []);
  const recentHrv = hrvSeries
    .slice(-RECENT_DAYS)
    .map(([, v]) => v)
    .filter(isValid);
  const avgHrv = recentHrv.length >= MIN_DAYS ? mean(recentHrv) : null;

  // NEW: Respiratory rate signal
  const respSeries = toRespRateSeries(sleep ?? []);
  const recentResp = respSeries
    .slice(-RECENT_DAYS)
    .map(([, v]) => v)
    .filter(isValid);
  const avgResp = recentResp.length >= MIN_DAYS ? mean(recentResp) : null;

  // Add to signals array...
}
```

### Option B: Bridge to Core Readiness (MVP 2+)

Feed wearables data into `evaluate()` for unified readiness.

```typescript
// Bridge function
export function wearablesToReadinessDays(
  daily: WearableDaily[],
  sleep: WearableSleep[],
  effortByDay: Map<string, number>,
): ReadinessDay[] {
  return toReadinessDays(daily, effortByDay).map((day) => ({
    ...day,
    hrv: daily.find((d) => d.date === day.day)?.hrv_rmssd_ms ?? null,
    resp: sleep.find((s) => s.date === day.day)?.resp_rate_avg ?? null,
  }));
}

// Usage in coach engine
const readinessDays = wearablesToReadinessDays(daily, sleep, effortMap);
const coreReadiness = evaluate(readinessDays, today);
```

## Deferred Scoring Modules Analysis

### Modules Currently Deferred (from scoring folder)

| Module              | File           | Required Inputs            | HC Availability                    | Activation Condition                    |
| ------------------- | -------------- | -------------------------- | ---------------------------------- | --------------------------------------- |
| **strain**          | `dailyLoad.ts` | Effort, HR zones           | ExerciseSessionRecord + HR         | When zone-based effort implemented      |
| **stressBase**      | Not explicit   | HRV, RHR trend             | HRV RMSSD + RHR                    | When HRV baseline established (30 days) |
| **zones**           | Not explicit   | Max HR, Resting HR         | ExerciseSessionRecord.max_hr + RHR | When HR zone model defined              |
| **sleepRegularity** | `sleep.ts`     | Sleep midpoint consistency | SleepSessionRecord                 | When 14+ nights available               |
| **fitnessLevel**    | Not explicit   | VO2 Max, HR response       | Vo2MaxRecord + Exercise HR         | When VO2 Max available                  |

### Activation Decision Matrix

```typescript
// scoringInputs.ts - feature flags
export interface ScoringFeatureFlags {
  hrvEnabled: boolean; // TRUE when 7+ days HRV data
  respRateEnabled: boolean; // TRUE when 7+ nights resp data
  sleepRegularityEnabled: boolean; // TRUE when 14+ nights
  strainEnabled: boolean; // TRUE when zone model ready
  fitnessLevelEnabled: boolean; // TRUE when VO2 Max available
}

// Compute dynamically based on data availability
export function getScoringFlags(
  daily: WearableDaily[],
  sleep: WearableSleep[],
): ScoringFeatureFlags {
  const hrvDays = daily.filter((d) => d.hrv_rmssd_ms != null).length;
  const respNights = sleep.filter((s) => s.resp_rate_avg != null).length;
  const sleepNights = sleep.filter((s) => s.duration_min != null && s.duration_min > 0).length;
  const vo2MaxAvailable = daily.some((d) => d.vo2_max != null);

  return {
    hrvEnabled: hrvDays >= 7,
    respRateEnabled: respNights >= 7,
    sleepRegularityEnabled: sleepNights >= 14,
    strainEnabled: false, // Requires zone config
    fitnessLevelEnabled: vo2MaxAvailable,
  };
}
```

## Contract Preservation

### computeReadiness Contract (UNCHANGED)

```typescript
// EXISTING - DO NOT MODIFY
export function computeReadiness(
  daily: WearableDaily[] | undefined,
  sleep: WearableSleep[] | undefined,
): Readiness | null;

// Return type unchanged
export interface Readiness {
  level: 'low' | 'normal';
  holdLoad: boolean;
  reasonKey: string;
  avgSleepMin: number | null;
  avgRestingHr: number | null;
  baselineRestingHr: number | null;
  signals: ReadinessSignal[]; // Can ADD new signals
  confidence: ScoreConfidence;
  sleepDebtMin: number | null;
  restScore: number | null;
  sleepConsistency: number | null;
}
```

### New Signals (Additive Only)

```typescript
// Extended signal keys (additive)
export type ReadinessSignalKey =
  'sleep' | 'sleepDebt' | 'rest' | 'consistency' | 'restingHr' | 'hrv' | 'respRate'; // NEW - only appear when data exists

// UI handles unknown keys gracefully (ignores or shows generic)
```

### Core Readiness Contract (UNCHANGED)

```typescript
// EXISTING - DO NOT MODIFY
export function evaluate(days: ReadinessDay[], today?: string): Readiness;

// Input contract unchanged
export interface ReadinessDay {
  day: string;
  hrv?: number | null; // Now can be populated from HC
  rhr?: number | null; // Already from HC
  resp?: number | null; // Now can be populated from HC
  effort?: number | null; // From GymLog workouts
}
```

## Data Quality Requirements for Scoring

### HRV (RMSSD) Quality

| Requirement         | Threshold                             | Rationale                           |
| ------------------- | ------------------------------------- | ----------------------------------- |
| Minimum nights      | 7                                     | Baseline EWMA needs `minBaseline=7` |
| Plausible range     | 10-200 ms                             | Physiological limits                |
| Outlier rejection   | EWMA with `hardOutlierRejection=true` | Built into `foldHistory`            |
| Measurement context | During sleep, supine                  | HC RMSSD typically nocturnal        |

### Respiratory Rate Quality

| Requirement         | Threshold    | Rationale                              |
| ------------------- | ------------ | -------------------------------------- |
| Plausible range     | 8-25 rpm     | `respPlausibleRange` in core readiness |
| Measurement context | During sleep | HC provides sleep-period averages      |
| Minimum nights      | 7            | Baseline needs `minBaseline=7`         |

### Data Freshness

```typescript
// Scoring uses RECENT_DAYS = 7 window
// Data older than 7 days only used for baseline (30 days)
// Ensure sync runs at least daily for fresh signals
```

## Implementation Phases

### MVP 1: HRV + Resp Rate in Wearables Readiness

1. Extend `WearableDaily` with `hrv_rmssd_ms`
2. Extend `WearableSleep` with `resp_rate_avg`
3. Add `toHrvSeries()`, `toRespRateSeries()` adapters
4. Extend `computeReadiness()` with HRV and resp signals
5. Update `RecoveryCard` to display new signals
6. Add feature flags for progressive enhancement

### MVP 2: Bridge to Core Readiness

1. Implement `wearablesToReadinessDays()` bridge
2. Feed HRV/Resp into `evaluate()` when available
3. Unify readiness display (single source of truth)
4. Preserve `computeReadiness` for backward compatibility

### MVP 3: Deferred Modules

1. **sleepRegularity**: Activate when 14+ nights (uses `sleepConsistency` from `sleep.ts`)
2. **strain**: Requires HR zone model (separate design)
3. **fitnessLevel**: Activate when VO2 Max available

## Threshold Justification (No Changes Without Evidence)

### Current Thresholds (Preserved)

| Threshold           | Value        | Source                                |
| ------------------- | ------------ | ------------------------------------- |
| LOW_SLEEP_MIN       | 360 min (6h) | Literature: <6h impairs recovery      |
| HIGH_RHR_DELTA      | 7 bpm        | Literature: >5-7 bpm indicates stress |
| SLEEP_DEBT_HOLD_MIN | 60 min       | Conservative buffer                   |
| LOW_REST_SCORE      | 50/100       | Midpoint of rest quality              |
| LOW_CONSISTENCY     | 0.7          | 70% night-to-night consistency        |

### New Thresholds (Need Validation)

| Metric              | Proposed Watch        | Proposed Bad          | Validation Needed                        |
| ------------------- | --------------------- | --------------------- | ---------------------------------------- |
| HRV RMSSD drop      | >20% below baseline   | >35% below baseline   | Compare with literature (typically 1 SD) |
| Resp rate elevation | >2 rpm above baseline | >4 rpm above baseline | Validate with illness detection studies  |

**Rule**: No threshold changes without A/B test or literature citation.

## Testing Strategy

### Unit Tests (Existing Patterns)

```typescript
// scoringInputs.test.ts - extend
describe('toHrvSeries', () => {
  it('collects HRV from daily with null for missing', () => {
    const daily = [
      { date: '2026-01-01', hrv_rmssd_ms: 45 },
      { date: '2026-01-02', hrv_rmssd_ms: null },
      { date: '2026-01-03', hrv_rmssd_ms: 48 },
    ];
    expect(toHrvSeries(daily)).toEqual([
      ['2026-01-01', 45],
      ['2026-01-02', null],
      ['2026-01-03', 48],
    ]);
  });
});

// readiness.test.ts - extend
describe('computeReadiness with HRV', () => {
  it('adds hrv signal when 7+ days available', () => {
    const daily = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      resting_hr: 60,
      hrv_rmssd_ms: 45 + i, // Improving trend
    }));
    const result = computeReadiness(daily, []);
    expect(result?.signals.some((s) => s.key === 'hrv')).toBe(true);
  });
});
```

### Integration Tests

- Mock Health Connect plugin responses
- Verify end-to-end: HC → Plugin → Aggregator → Supabase → Query → Scoring → UI
- Test partial data scenarios (HRV but no resp, etc.)
- Test multi-provider deduplication

## Summary

| Aspect                    | Decision                                        |
| ------------------------- | ----------------------------------------------- |
| **Primary integration**   | Extend `computeReadiness` (wearables readiness) |
| **Core readiness bridge** | MVP 2 via `wearablesToReadinessDays()`          |
| **Contract changes**      | None - additive signals only                    |
| **Threshold changes**     | None without validation                         |
| **Deferred modules**      | Activate via feature flags when data available  |
| **HRV priority**          | HIGH - unlocks core readiness z-scoring         |
| **Resp rate priority**    | HIGH - unlocks respiratory signal               |
| **Testing**               | Extend existing vitest suites                   |
