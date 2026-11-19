# INVENTARIO PRECISO PULSE → GYMLOG: TODO EL CÓDIGO REUTILIZABLE

Formato: inventario de Pulse con el estado real del port a GymLog (revisado el 2026-11-04). Las fichas de la sección 1 y 2 describen el código de origen; el estado de cada pieza está en la tabla de cabecera de la sección 1 y en la 2.9.

---

## 1. ALGORITMOS PUROS (`src/core/scoring` de Pulse)

> Corrección de ruta: el código puro de Pulse vive en `src/core/scoring/`, no en
> `src/core/algorithms/`. `algorithms/` contiene módulos de producto (reports,
> coach, energyBank…) que dependen de datos que GymLog no tiene. Las rutas de las
> fichas de abajo ya apuntaban a `scoring/`.

Estado en GymLog (2026-11-04). Capa nueva: `src/shared/lib/scoring/`.

| Módulo Pulse                                                                                    | Estado en GymLog            | Motivo                                                              |
| ----------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| `types.ts`                                                                                      | Portado                     | Formas base                                                         |
| `baselines.ts`                                                                                  | Portado                     | EWMA + z-score                                                      |
| `confidence.ts`                                                                                 | Portado                     | calibrating / building / solid                                      |
| `trainingLoad.ts`                                                                               | Portado como `dailyLoad.ts` | Evita colisión con `features/stats/utils/trainingLoad.ts`           |
| `sleep.ts`                                                                                      | Portado                     | Deuda, descanso y consistencia                                      |
| `illness.ts`                                                                                    | Portado (sin UI)            | Con solo FC en reposo no corrobora 2 señales; la tarjeta se aplaza  |
| `readiness.ts`                                                                                  | Portado y adaptado          | Contrato `low\|normal` conservado en `wearables/utils/readiness.ts` |
| `strain.ts`                                                                                     | Aplazado                    | Exige serie de FC                                                   |
| `stressBase.ts`                                                                                 | Aplazado                    | Exige series de FC y estrés                                         |
| `zones.ts`                                                                                      | Aplazado                    | Exige serie de FC                                                   |
| `sleepRegularity.ts`                                                                            | Aplazado                    | Exige sesiones de sueño con horas                                   |
| `fitnessLevel.ts`                                                                               | Aplazado                    | Exige VO2max                                                        |
| `recovery.ts`, `drivers.ts`, `hrRecovery.ts`, `restingHr.ts`, `forecast.ts`, `healthMonitor.ts` | Descartados                 | Exigen HRV o serie de FC                                            |

Tests: 104 en `src/shared/lib/scoring/`, 12 de adaptadores y 14 de readiness.

### 1.1 types.ts — Formato exacto

- **Ruta:** `C:\Users\franc\proyectos\apps\pulse\src\core\scoring\types.ts`
- **Líneas:** 81
- **Exportaciones exactas:**
  - `HrSample { ts: number, bpm: number }` — interfaz
  - `Stage = "wake" | "awake" | "light" | "deep" | "rem"` — tipo
  - `StageSegment { start: number, end: number, stage: Stage }` — interfaz
  - `SleepSession { start: number, end: number, stages: StageSegment[] }` — interfaz
  - `HypnogramMetrics { tibS: number, tstS: number, sptS: number, solS: number, remLatencyS: number | null, wasoS: number, efficiency: number, disturbances: number, deepMin: number, remMin: number, lightMin: number, deepPct: number, remPct: number, lightPct: number }` — interfaz
  - `UserProfile { weightKg: number, heightCm: number, age: number, sex: "male" | "female" | "nonbinary" }` — interfaz
  - `MetricCfg { minVal: number, maxVal: number, floorSpread: number, halfLifeB: number, halfLifeS: number }` — interfaz
  - `BaselineStatus = "calibrating" | "provisional" | "trusted" | "stale"` — tipo
  - `BaselineState { baseline: number, spread: number, nValid: number, nightsSinceUpdate: number, status: BaselineStatus }` — interfaz
  - `Deviation { z: number, delta: number, ratio: number, inNormalRange: boolean }` — interfaz
  - `ScoreConfidence = "calibrating" | "building" | "solid"` — tipo

### 1.2 strain.ts — Formato exacto

- **Ruta:** `C:\Users\franc\proyectos\apps\pulse\src\core\scoring\strain.ts`
- **Líneas:** 202
- **Constantes exportadas (valores exactos):**
  - `minReadings = 600`, `minSparseReadings = 20`, `minSpanSeconds = 600`
  - `maxStrain = 100.0`, `strainScaleMax = 21.0`, `strainDenominator = 7201.0`
  - `fallbackSampleMin = 1.0 / 60.0`, `defaultAge = 30`, `defaultRestingHR = 60.0`
  - `hrmaxMinSamples = 600`, `hrmaxPercentile = 99.5`, `banisterScale = 0.64`
  - `banisterBMen = 1.92`, `banisterBWomen = 1.67`, `banisterSedentaryHRR = 0.1`
  - `maxSampleGapMin = 2.0`
- **Zonas exportadas:**
  - `edwardsZones: readonly [number, number][] = [[90.0, 5], [80.0, 4], [70.0, 3], [60.0, 2], [50.0, 1]]`
- **Tipos:**
  - `StrainMethod = "edwards" | "banister"`
- **Funciones exportadas (firma completa):**
  - `effortFromStrainScale(value: number): number` — `value * (maxStrain / strainScaleMax)`
  - `toStrainScale(effort: number): number` — `(effort * strainScaleMax) / maxStrain`
  - `banisterDailyCeiling(b: number): number` — `24.0 * 60.0 * 1.0 * banisterScale * Math.exp(b)`
  - `banisterBaselineRatePerMinute(b: number): number` — `banisterScale * banisterSedentaryHRR * Math.exp(b * banisterSedentaryHRR)`
  - `banisterBaseline(minutes: number, b: number): number` — `banisterBaselineRatePerMinute(b) * minutes`
  - `banisterB(sex: string): number` — `(sex.toLowerCase().startsWith("f") ? banisterBWomen : banisterBMen)`
  - `logMapDenominator(method: StrainMethod, sex: string): number` — devuelve `strainDenominator` para edwards, o `banisterDailyCeiling(b) - banisterBaseline(24.0 * 60.0, b) + 1.0` para banister
  - `tanakaHRmax(age: number): number` — `208.0 - 0.7 * age`
  - `defaultMaxHR(age: number = defaultAge): number` — `220 - age`
  - `percentile(sortedValues: number[], pct: number): number` — interpolación lineal numpy-style
  - `estimateHRmax(hrHistory: number[], age: number | null): { hrmax: number, source: "observed" | "tanaka" | "unknown" }`
  - `pctHRR(bpm: number, restingHR: number, hrReserve: number): number` — `Math.min(100, Math.max(0, ((bpm - restingHR) / hrReserve) * 100.0))`
  - `zoneWeight(bpm: number, restingHR: number, hrReserve: number): number` — recorre `edwardsZones`, retorna weight 0-5
  - `effectiveEffort(live: number | null, stored: number | null): number | null`
  - `sampleDurationsMinutes(hr: HrSample[]): number[]`
  - `edwardsTRIMP(hr: HrSample[], restingHR: number, hrReserve: number, durations: number[]): number`
  - `zoneMinutes(hr: HrSample[], restingHR: number, hrReserve: number, durations: number[]): number[]` — array de 6 elementos [0-5]
  - `banisterTRIMP(hr: HrSample[], restingHR: number, hrReserve: number, durations: number[], b: number, floorRatePerMinute = 0.0): number`
  - `trimpToStrain(trimp: number, denominator: number = strainDenominator): number` — `Math.abs(scaled) < 9007199254740992 ? Math.round(scaled) : scaled` donde `scaled = ((maxStrain * Math.log(trimp + 1.0)) / Math.log(denominator)) * 100`
  - `strain(hr: HrSample[], maxHR: number | null = null, restingHR: number = defaultRestingHR, method: StrainMethod = "edwards", sex = "male", denominator: number | null = null): number | null` — Algoritmo completo: valida datos, calcula TRIMP, retorna strain 0-100 o null
  - `zoneNumber(set: HrZoneSet, bpm: number): number`
  - `timeInZone(hr: HrSample[], zoneSet: HrZoneSet): TimeInZone`

### 1.3 stressBase.ts — Formato exacto

- **Ruta:** `C:\Users\franc\proyectos\apps\pulse\src\core\scoring\stressBase.ts`
- **Líneas:** 169
- **Constantes:**
  - `minHourHrSamples = 300`, `bucketSeconds = 3_600`, `highBandFloor = 2.0`
  - `sustainedHours = 3`, `wakingStartHour = 6`, `wakingEndHour = 22`
  - `baselineRelativeHighMarginBPM = 15.0`, `daytimeHRAggregatePercentile = 0.1`
- **Tipos:**
  - `ScoringMode = { kind: "dayRelative" } | { kind: "baselineRelative"; hr: BaselineState }`
  - `HourPoint { hour: number, startTs: number, level: number | null, meanHr: number | null }`
  - `DaytimeStressResult { hours: HourPoint[], sustainedHigh: boolean, sustainedRun: number, dayMean: number | null, peak: HourPoint | null, highStressMinutes: number }`
- **Funciones exportadas:**
  - `EMPTY: DaytimeStressResult` — objeto vacío
  - `mean(xs: number[]): number | null`
  - `std(xs: number[], m: number | null): number` — desviación poblacional
  - `squash(raw: number): number` — `Math.min(3.0, Math.max(0.0, 3.0 / (1.0 + Math.exp(-raw))))`
  - `marginToSigma(marginBPM: number, band: number): number`
  - `quantile(sorted: number[], q: number): number`
  - `isWakingHourOfDay(hourOfDay: number): boolean` — `hourOfDay >= 6 && hourOfDay < 22`
  - `isWakingHour(bucket: number): boolean`
  - `hrBuckets(hr: HrSample[], tzOffsetSeconds: number): [number, number[]][]`
  - `gatedMean(hrs: number[]): number | null`
  - `calmReference(xs: number[]): number | null` — cuartil bajo o mean si < 4 valores
  - `analyze(hr: HrSample[], tzOffsetSeconds = 0, mode: ScoringMode = { kind: "dayRelative" }): DaytimeStressResult` — Algoritmo completo
  - `dayDaytimeAggregate(hr: HrSample[], tzOffsetSeconds = 0): number | null`
  - `foldDaytimeBaseline(aggregates: (number | null)[]): BaselineState`
  - `scoringMode(aggregates: (number | null)[]): ScoringMode`

### 1.4 recovery.ts — Formato exacto

- **Ruta:** `C:\Users\franc\proyectos\apps\pulse\src\core\scoring\recovery.ts`
- **Líneas:** 177
- **Constantes exportadas:**
  - `wHRV = 0.55`, `wRHR = 0.2`, `wResp = 0.05`, `wSleep = 0.15`, `wSkinTemp = 0.05`
  - `wRecoveryIndex = 0.05`, `logisticK = 1.6`, `logisticZ0 = -0.2`, `populationMean = 58.0`
  - `bandRedMax = 34.0`, `bandYellowMax = 67.0`, `sleepPerfCenter = 0.85`, `sleepPerfScale = 0.12`
  - `satEnterZ = 0.5`, `satFullZ = 1.5`, `satMaxDampFraction = 0.5`, `minBaselineNights = 7`
- **Interfaces:**
  - `ParasympatheticSaturation { easedHrvZ: number, active: boolean, dampFraction: number }`
  - `DriverBaseline { mean: number, spread: number }`
- **Funciones exportadas:**
  - `parasympatheticSaturation(hrvZ: number, rhrZ: number | null): ParasympatheticSaturation`
  - `band(score: number): "red" | "yellow" | "green` — umbrales: < 34 red, < 67 yellow, >= 67 green
  - `zScore(value: number, mean: number, spread: number): number` — `(value - mean) / Math.max(1.253 * spread, 1e-9)`
  - `RecoveryArgs` — interface completa con: hrv, rhr?, resp?, hrvBaseline, rhrBaseline?, respBaseline?, sleepPerf?, skinTempDev?, hrvBaselineUsable?, recoveryIndexSlope?, effortBaseline?, priorDayEffort?
  - `recovery(a: RecoveryArgs): number | null` — retorna score 0-100 o null
  - `logisticScore(compositeZ: number): number` — `100.0 / (1.0 + Math.exp(-logisticK * (compositeZ - logisticZ0))) , clamped [0, 100]
  - `RecoveryStateArgs` — extends Omit<RecoveryArgs, "hrvBaseline" | "rhrBaseline" | "respBaseline" | "effortBaseline" | "hrvBaselineUsable">, añade hrvBaseline, rhrBaseline?, respBaseline?, effortBaseline
  - `recoveryFromStates(a: RecoveryStateArgs): number | null`
  - `GatedRecoveryArgs extends Omit<RecoveryStateArgs, "hrv"> { hrv: number | null }`
  - `gatedRecovery(a: GatedRecoveryArgs): { recovery: number | null, confidence: ScoreConfidence }`
  - `watchRecovery(todayHrv: number | null, todayRhr: number | null, hrvHistory: number[], rhrHistory: number[]): { recovery: number | null, confidence: ScoreConfidence }`

### 1.5 readiness.ts — Formato exacto

- **Ruta:** `C:\Users\franc\proyectos\apps\pulse\src\core\scoring\readiness.ts`
- **Líneas:** 208
- **Tipos exportados:**
  - `ReadinessDay { day: string, hrv?: number | null, rhr?: number | null, resp?: number | null, effort?: number | null }`
  - `ReadinessLevel = "primed" | "balanced" | "strained" | "rundown" | "insufficient"`
  - `ReadinessFlag = "good" | "neutral" | "watch" | "bad"`
  - `ReadinessSignalKey = "hrv" | "rhr" | "respRate" | "acwr" | "monotony"`
  - `ReadinessDetail = "HRV_GOOD" | "HRV_WATCH" | "HRV_BAD" | "RHR_GOOD" | "RHR_WATCH" | "RHR_BAD" | "RESP_WATCH" | "RESP_BAD" | "NORMAL_RANGE" | AcwrBand | "MONOTONY_WATCH"`
  - `ReadinessEvidence = { kind: "metricVsBaseline"; value: number; baseline: number; decimals: number; unit: "ms" | "bpm" | "rpm" } | { kind: "monotony"; value: number } | { kind: "trainingLoad"; acute: number; chronic: number }`
  - `ReadinessSignal { key: ReadinessSignalKey; flag: ReadinessFlag; detail: ReadinessDetail; evidence: ReadinessEvidence | null }`
  - `Readiness { level: ReadinessLevel; signals: ReadinessSignal[]; acwr: number | null; monotony: number | null; confidence: ScoreConfidence }`
- **Constantes:**
  - `baselineWindow = 30`, `minBaseline = 7`, `acuteWindow = 7`, `chronicWindow = 28`, `minChronic = 14`
  - `respZWatch = 1.5`, `respZBad = 2.0`, `respPlausibleRange = { min: 8.0, max: 25.0 }`, `monotonyWatch = 2.0`
- **Funciones exportadas:**
  - `zSignal(value, baseline, key, unit, higherIsBetter, cfg, logDomain): ReadinessSignal | null`
  - `acwrBand(ratio: number): "LOAD_RAMPING_DOWN" | "LOAD_SWEET_SPOT" | "LOAD_BUILDING_FAST" | "LOAD_SPIKING"` — bandas: < 0.8 ramping down, [0.8, 1.3) sweet spot, [1.3, 1.5) building fast, >= 1.5 spiking
  - `ACWR_FLAG: Record<AcwrBand, ReadinessFlag>` — ramping down: watch, sweet spot: good, building fast: watch, spiking: bad
  - `acwrSignal(ratio: number, acute: number, chronic: number): ReadinessSignal`
  - `synthesize(signals: ReadinessSignal[], hasHistory: boolean): ReadinessLevel` — lógica de síntesis
  - `evaluate(days: ReadinessDay[], today: string | null = null): Readiness` — algoritmo completo
  - `evaluateWithTrainingLoad(days, today, config): { readiness: Readiness, trainingLoad: TrainingLoadResult }`

### 1.6 sleep.ts — Formato exacto

- **Ruta:** `C:\Users\franc\proyectos\apps\pulse\src\core\scoring\sleep.ts`
- **Líneas:** 238
- **Constantes:**
  - `wDuration = 0.5`, `wEfficiency = 0.2`, `wRestorative = 0.2`, `wConsistency = 0.1`
  - `defaultSleepNeedHours = 8.0`, `minNeedNights = 7`, `maxNeedHours = 9.5`
  - `restorativeTargetShare = 0.5`, `deepShareTarget = 0.13`, `deepFloorFactor = 0.5`, `NEUTRAL_CONSISTENCY = 0.5`
- **Funciones:**
  - `populationNeedFloorHours(age: number | null): number` — 8.0 si age <= 0 o age < 18, else 8.0
  - `personalizedNeedHours(nightlyHours: number[], age: number | null): number` — percentil 75 de horas nocturnas, floored en populationNeedFloor, capped en maxNeedHours
  - `rest(asleepSeconds: number, efficiency: number, deepSeconds: number, remSeconds: number, sleepNeedHours = null, consistency = null): number | null` — score 0-100 o null
  - `restFromTotals(night: { totalSleepMin: number | null, efficiency: number | null, deepMin: number | null, remMin: number | null }, consistency = null): number | null`
  - `sleepConsistency(nightlyHours: number[]): number | null` — `1 - CV`, null si < 3 noches
  - `DEFAULT_WINDOW_NIGHTS = 14`, `ON_TARGET_BAND_MIN = 10.0`, `DEBT_CARRY = 0.55`
  - `SleepDebtNight { day: string, sleptMin: number, deltaMin: number }`
  - `SleepDebtLedger { balanceMin: number, nights: SleepDebtNight[], needMin: number, nightCount: number, isDebt: boolean, magnitudeMin: number }`
  - `creditedSleepMin(mainSleepMin: number | null, napSleepMin = 0.0): number | null`
  - `round1(v: number): number` — redondeo a 1 decimal con simetría alrededor de cero
  - `nextDebt(needMin: number, currentDebt: number, sleptMin: number): number` — `DEBT_CARRY * max(needMin + currentDebt - sleptMin, 0.0)`; si < ON_TARGET_BAND_MIN retorna 0.0
  - `ledger(series: [string, number | null][], needHours = defaultSleepNeedHours, window = DEFAULT_WINDOW_NIGHTS): SleepDebtLedger` — ledger completo
  - `debtSeries(series, needHours, importedDebtMin, window): [string, number][]`

### 1.7 trainingLoad.ts — Formato exacto

- **Ruta:** `C:\Users\franc\proyectos\apps\pulse\src\core\scoring\trainingLoad.ts`
- **Líneas:** 176
- **Interfaces y tipos:**
  - `TrainingLoadConfig { chronicTimeConstantDays: number, acuteTimeConstantDays: number, primeDays: number, minimumDays: number, establishedDays: number }`
  - `standardConfig: TrainingLoadConfig` — { chronic: 42.0, acute: 7.0, primeDays: 7, minimumDays: 14, establishedDays: 42 }
  - `DailyLoad { day: string, load: number | null }`
  - `TrainingLoadState = "unavailable" | "building" | "established"`
  - `TrainingLoadUnavailableReason = "NO_DATA" | "MISSING_TARGET_DAY" | "NOT_ENOUGH_CONTIGUOUS_DAYS" | "INVALID_CONFIGURATION" | "INVALID_DAY" | "DUPLICATE_DAY" | "INVALID_LOAD"`
  - `TrainingLoadPoint { day: string, load: number, ctl: number, atl: number, tsb: number }`
  - `TrainingLoadResult { state: TrainingLoadState, unavailableReason: TrainingLoadUnavailableReason | null, contiguousDays: number, startDay: string | null, endDay: string | null, points: TrainingLoadPoint[], ctl: number | null, atl: number | null, tsb: number | null }`
- **Funciones exportadas:**
  - `evaluate(days: DailyLoad[], through: string | null = null, config: TrainingLoadConfig = standardConfig): TrainingLoadResult` — algoritmo EWMA completo con validación de configuración, días consecutivos, seeding, CTL/ATL/TSB
  - `evaluateDense(loads: number[], config: TrainingLoadConfig = standardConfig): TrainingLoadResult`

### 1.8 baselines.ts — Formato exacto

- **Ruta:** `C:\Users\franc\proyectos\apps\pulse\src\core\scoring\baselines.ts`
- **Líneas:** 236
- **Constantes:**
  - `winsorK = 3.0`, `hardOutlierK = 5.0`, `minNightsSeed = 4`, `minNightsTrust = 14`, `staleDays = 14`, `vitalCarryDays = 7`, `earlyAdaptNights = 8`, `earlyHalfLifeB = 3.0`, `earlySpreadInflate = 2.5`
  - `metricCfg: Record<string, MetricCfg>` — hrv: cfg(5.0, 250.0, 5.0), resting_hr: cfg(30.0, 120.0, 2.0), resp: cfg(4.0, 40.0, 0.5), skin_temp: cfg(20.0, 42.0, 0.3), strain: cfg(0.0, 100.0, 5.0), readiness_hrv_ln: cfg(2.079, 5.521, 0.08), daytime_hr: cfg(35.0, 160.0, 3.0), daytime_rmssd: cfg(5.0, 250.0, 7.0)
  - `hrvCfg, restingHRCfg, respCfg, skinTempCfg, strainCfg, readinessHRVLnCfg, daytimeHRCfg, daytimeRMSSDCfg`
  - `isTrusted(s: BaselineState): boolean` — `s.status === "trusted"`
  - `isUsable(s: BaselineState): boolean` — `s.status === "provisional" || s.status === "trusted"`
  - `lambda(halfLife: number): number` — `1.0 - 0.5 ** (1.0 / halfLife)`
  - `computeStatus(nValid: number, nightsSinceUpdate: number): BaselineStatus` — rules order: stale > calibrating > provisional > trusted
  - `state(baseline: number, spread: number, nValid: number, nightsSinceUpdate: number): BaselineState`
  - `inRange(v: number | null, cfg: MetricCfg): v is number` — `v != null && cfg.minVal <= v && v <= cfg.maxVal`
  - `update(prev: BaselineState | null, value: number | null, cfg: MetricCfg, rejectHardOutliers = true): BaselineState` — EWMA completa
  - `foldHistory(values: (number | null)[], cfg: MetricCfg, rejectHardOutliers = true): BaselineState` — fold over values
  - `sigma(s: BaselineState): number` — `Math.max(1.253 * s.spread, 1e-9)`
  - `deviation(value: number, s: BaselineState): Deviation` — z-score y ratio
  - `rollingMeanSD(values: (number | null)[], cfg: MetricCfg, window = 30): BaselineState`
  - `isoEpochDay(iso: string): number | null` — algoritmo de Howard Hinnant
  - `epochDayToIso(day: number): string`
  - `cutoffKey(todayKey: string, carryDays = vitalCarryDays): string`
  - `freshestCarried<T>(points: [string, T][], todayKey: string, carryDays = vitalCarryDays): [string, T] | null`
  - `nightsSinceNewestValidNight(dayKeys: string[], nightlyHrv: (number | null)[], today: string): number | null`
  - `recentHrvCoverage(dayKeys: string[], nightlyHrv: (number | null)[], today: string, window = staleDays): { observed: number, missing: number }`

### 1.9 confidence.ts — Formato exacto

- **Ruta:** `C:\Users\franc\proyectos\apps\pulse\src\core\scoring\confidence.ts`
- **Líneas:** 51
- **Constantes:**
  - `buildingNightsThreshold = 7`, `solidHrSamples = 3600`, `restorativeLowConfidenceShare = 0.1`, `highEfficiencyThreshold = 0.85`, `minCoverage = 0.95`
- **Funciones:**
  - `forCharge(score: number | null, hrvBaseline: BaselineState | null): ScoreConfidence`
  - `readiness(hasRead: boolean, baselineNights: number, fullWindow: number): ScoreConfidence`
  - `forEffort(score: number | null, hrSampleCount: number): ScoreConfidence`
  - `forRest(hasSession: boolean, hasStagedSleep: boolean, night?: RestNight): ScoreConfidence`
  - `RestNight { asleepSeconds: number, restorativeSeconds: number, efficiency: number, stageCoverage?: number | null }`
  - `coverageFraction(coveredSeconds: number, spanSeconds: number): number | null`

### 1.10 zones.ts — Formato exacto

- **Ruta:** `C:\Users\franc\proyectos\apps\pulse\src\core\scoring\zones.ts`
- **Líneas:** 88
- **Constantes:**
  - `ZONE_NAMES = ["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5"] as const`
  - `zoneEdges = [0.5, 0.6, 0.7, 0.8, 0.9]`
- **Interfaces:**
  - `HrZone { number: number, lower: number, upper: number }`
  - `HrZoneSet { zones: HrZone[], maxHR: number, restingHR: number }`
  - `TimeInZone { seconds: number[], belowZone1: number }`
- **Funciones exportadas:**
  - `zones(restingHR: number, maxHR: number): HrZoneSet` — reserva = max(1, maxHR - restingHR), lower = zoneEdges.map(e => restingHR + e * reserve)
  - `zoneNumber(set: HrZoneSet, bpm: number): number` — recursa de 4 a 0
  - `timeInZone(hr: HrSample[], zoneSet: HrZoneSet): TimeInZone`
  - `totalSeconds(t: TimeInZone): number` — `t.seconds.reduce((a, b) => a + b, 0) + t.belowZone1`
  - `secondsInZone(t: TimeInZone, zone: number): number`

### 1.11 illness.ts — Formato exacto

- **Ruta:** `C:\Users\franc\proyectos\apps\pulse\src\core\scoring\illness.ts`
- **Líneas:** 181
- **Constantes:**
  - `raiseThreshold = 50.0`, `mildThreshold = 25.0`, `minCorroboratingSignals = 2`, `signalZThreshold = 2.0`, `kZToScore = 22.0`, `perSignalCap = 40.0`, `confounderDampen = 0.45`
  - `illnessBaselineWindow = 30`, `illnessMinBaselineNights = 14`
  - `IllnessSignalKey = "restingHR" | "skinTemp" | "hrv" | "respiration"`
  - `SignalReading { zIllnessward: number, present?: boolean }`
  - `IllnessInputs = Partial<Record<IllnessSignalKey, SignalReading | null>>`
  - `IllnessContext { alcohol?, stress?, sauna?, hardOrLateWorkout?, travelPhaseJump?, alreadyUnwell?, baselineTrusted? }`
  - `IllnessLevel = "quiet" | "mild" | "raised" | "suppressed" | "alreadyUnwell"`
  - `IllnessResult { score: number, level: IllnessLevel, firedSignals: string[], suppressedBy: string[], signalCount: number, copy: string }`
- **Funciones:**
  - `evaluate(inputs: IllnessInputs, context: IllnessContext = {}, firedLabels: Partial<Record<IllnessSignalKey, string>> = {}): IllnessResult`
  - `illnessFromDays(days: IllnessDay[], journal: Omit<IllnessContext, "baselineTrusted"> = {}): IllnessResult & { baselineTrusted: boolean }`
  - `joinReasons(reasons: string[]): string`

---

## 2. UI COMPONENTES: PULSE vs GYMLOG

### 2.1 Button — Pulse (shadcn)

- **Ruta:** `C:\Users\franc\proyectos\apps\pulse\src\components\ui\button.tsx`
- **Líneas:** 87
- **Variantes:** `primary`, `secondary`, `ghost`, `danger`, `icon`
- **Sizes:** `sm`, `md`, `lg`
- **Propiedades:** `variant?`, `size?`, `loading?`, `children`, `disabled`, `className`, props rest
- **Estilos variantes:** `variantStyles: Record<Variant, string>` — primary: `bg-accent text-accent-fg font-semibold shadow-btn-accent active:scale-[0.97]`, secondary: `bg-surface-2 text-fg active:scale-[0.97]`, ghost: `bg-transparent text-fg-muted hover:bg-hover`, danger: `bg-error text-accent-fg active:scale-[0.97]`, icon: `bg-transparent text-fg-subtle hover:bg-hover aspect-square`
- **Estilos size:** `sizeStyles: Record<Size, string>` — sm: `h-9 px-4 text-sm rounded-pill`, md: `h-11 px-6 text-base rounded-pill`, lg: `h-12 px-7 text-base rounded-pill`
- **Componente interno:** `ButtonComponent` con memo, renderiza `<button>` con clases de composición y loading spinner `<Spinner>`
- **Spinner:** SVG círculo animado con `animate-spin`

### 2.2 Button — Gymlog (YA EXISTE)

- **Ruta:** `C:\Users\franc\proyectos\apps\gymlog\src\shared\components\ui\Button.tsx`
- **Líneas:** 87 (misma estructura)
- **Variantes idénticas:** `primary`, `secondary`, `ghost`, `danger`, `icon`
- **Sizes idénticas:** `sm`, `md`, `lg`
- **Estilos variante idénticos** con clases Tailwind: `bg-accent text-accent-fg`, etc. (usando tokens de gymlog)
- **Spinner idéntico:** mismo SVG con `animate-spin`
- **Veredicto:** **YA EXISTE** — compatibilidad total. No portar.

### 2.3 BottomSheet — Pulse

- **Usa:** `framer-motion`, `createPortal`, `AnimatePresence`, Radix base, clases Tailwind
- **Propiedades:** `open: boolean`, `onClose: () => void`, `title?`, `children`, `maxHeightVh?`, `showCloseButton?`, `icon?`, `variant?`
- **Comportamiento:** portal con overlay backdrop con `backdrop-filter: blur(4px)` o opaco en Android, sheet con animación spring (damping: 28, stiffness: 320), registro `registerBackAction` para tecla Back, `Escape` cierra, `overflow-y: auto` en contenido

### 2.4 BottomSheet — Gymlog (YA EXISTE)

- **Ruta:** `C:\Users\franc\proyectos\apps\gymlog\src\shared\components\ui\BottomSheet.tsx`
- **Líneas:** 153
- **Patrón idéntico:** `createPortal` + `AnimatePresence` + `framer-motion` `m.div`
- **Backdrop:** `IS_ANDROID` check, `backgroundColor: rgba(0,0,0,0.6)` en Android, `rgba(0,0,0,0.5) + backdropFilter: blur(4px)` en web
- **Efectos:** `registerBackAction` para tecla Back, `Escape` cierra, `document.body.style.overflow = 'hidden'` al abrir, restablecer al cerrar
- **Animación sheet:** `initial={{ y: '100%' }}` → `animate={{ y: 0 }}` → `exit={{ y: '100%' }}` con `type: 'spring', damping: 28, stiffness: 320`
- **Header:** vidrio `glass-3`, canto acento, botón close con `t('common.close')` i18n, `Xmark` icon
- **Content:** `overflow-y-auto overscroll-contain flex-1 px-4 pb-[var(--inset-bottom,env(safe-area-inset-bottom))]`
- **Veredicto:** **YA EXISTE** — patrón idéntico. No portar.

### 2.5 Card — Pulse

- **Ruta:** `C:\Users\franc\proyectos\apps\pulse\src\components\ui\card.tsx`
- **Líneas:** 38
- **Variantes:** `surface` (default)
- **Propiedades:** `variant?`, `title?`, `subtitle?`, `action?`, `className`, `children`
- **Comportamiento:** renderiza `<div className={cardClass(variant, className)}>`, condicionally renderiza `SectionHeader` si hay title/subtitle/action

### 2.6 Card — Gymlog (YA EXISTE)

- **Ruta:** `C:\Users\franc\proyectos\apps\gymlog\src\shared\components\ui\Card.tsx`
- **Líneas:** 38 (misma estructura)
- **Variante:** `surface` por defecto
- **Propiedades idénticas:** `variant`, `title`, `subtitle`, `action`, `className`, `children`
- **Comportamiento idéntico:** `cardClass(variant, className)` + `SectionHeader` para título
- **Veredicto:** **YA EXISTE** — idéntico. No portar.

### 2.7 Skeleton — Pulse

- **Ruta:** `C:\Users\franc\proyectos\apps\pulse\src\components\ui\skeleton.tsx`
- **Líneas:** 56 + PageSkeleton (44 líneas adicionales)
- **Propiedades:** `className`, `lines?`, `card?`
- **Modo card:** `<div className="glass-2 rounded-card p-4 space-y-3">` con skeleton h-4 w-2/3, h-3 w-full, h-3 w-4/5, flex gap-2 con two skeleton items
- **Modo lines:** `<div className="space-y-2">` con array de skeleton items
- **Default:** `<div className="skeleton rounded-md">`
- **PageSkeleton:** componente completo con GymLogLogo, skeleton h-6 w-32 rounded-card, y dos skeleton card

### 2.8 Skeleton — Gymlog (YA EXISTE)

- **Ruta:** `C:\Users\franc\proyectos\apps\gymlog\src\shared\components\ui\Skeleton.tsx`
- **Líneas:** 56 + PageSkeleton
- **Patrón idéntico:** card mode con `glass-2`, skeleton items idénticos
- **Veredicto:** **YA EXISTE** — mismo patrón. No portar.

### 2.9 Qué faltaba de verdad en GymLog (revisado el 2026-11-04)

La tabla original daba por ausentes componentes que GymLog ya cubre con otro
nombre. Estado real:

| Componente Pulse                                     | Equivalente en GymLog                       | Veredicto                                           |
| ---------------------------------------------------- | ------------------------------------------- | --------------------------------------------------- |
| **Progress**                                         | `shared/components/ui/Progress.tsx` (nuevo) | **Portado** sin dependencias                        |
| Dialog / AlertDialog                                 | `Modal.tsx` + `ConfirmDialog.tsx`           | YA EXISTE                                           |
| Drawer / BottomSheet                                 | `BottomSheet.tsx`                           | YA EXISTE                                           |
| Tabs / ToggleGroup                                   | `SegmentedControl.tsx`                      | YA EXISTE                                           |
| Switch                                               | `Toggle.tsx`                                | YA EXISTE                                           |
| Label                                                | Etiqueta de `Input.tsx`                     | YA EXISTE                                           |
| Separator                                            | `<hr className="border-t border-line">`     | No hace falta componente                            |
| DropdownMenu, Popover, Accordion, ScrollArea, Slider | —                                           | **No se portan**: sin caso de uso y exigirían Radix |

`Progress` era el único hueco real: no existía ninguna barra con
`role="progressbar"` en `src/`.

---

## 3. TOKENS DE DISEÑO: LISTA PRECISA

### 3.1 Pulse tokens (src/app/globals.css, líneas 1-357)

**Colores (variables --):**
--color-background, --color-foreground, --color-chart-1 a --5, --color-ring, --color-input, --color-border, --color-destructive, --color-accent-foreground, --color-accent, --color-muted-foreground, --color-muted, --color-secondary-foreground, --color-secondary, --color-primary-foreground, --color-primary, --color-popover-foreground, --color-popover, --color-card-foreground, --color-card

**Tokens extended Pulse (líneas 48-95):**
--color-background-top, --color-background-mid, --color-foreground-secondary, --color-inset, --color-card-top, --color-card-hover, --color-popover-top, --color-sheet, --color-sheet-bottom, --color-field, --color-recovery-green, --color-recovery-yellow, --color-recovery-red, --color-recovery-red-text, --color-strain, --color-strain-text, --color-strain-deep, --color-sleep, --color-sleep-deep, --color-optimal, --color-optimal-text, --color-warning-text, --color-stress-low-text, --color-stress-medium-text, --color-stress-high-text, --color-coach-text, --color-warning, --color-stress-low, --color-stress-medium, --color-stress-high, --color-coach, --color-insight-from, --color-insight-to, --color-banner-from, --color-banner-to, --color-outlook-from, --color-outlook-to, --color-outlook-accent, --color-glow-sand, --color-on-color, --color-on-strain, --color-key-from, --color-key-to, --color-key-foreground, --color-dial-track, --color-dial-target, --color-chart-grid, --color-chart-band, --color-chart-cursor

**Radio scale (líneas 126-132):**
--radius-sm: 0.25rem, --radius-md: 0.5rem, --radius-lg: 0.625rem, --radius-xl: 0.75rem, --radius-2xl: 1rem, --radius-3xl: 1.5rem, --radius-4xl: 1.75rem

**Easing (líneas 135-138):**
--ease-standard: cubic-bezier(0.2, 0, 0, 1), --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1), --ease-in-quick: cubic-bezier(0.4, 0, 1, 1)

**Animaciones beat (líneas 141-155):**
--animate-beat-up, --animate-beat-down, --animate-beat-glow, @keyframes beat-up, @keyframes beat-down, @keyframes beat-glow

**Tokens de superficie y profundidad (líneas 158-323):**
--background: #101518, --foreground: #ffffff, --foreground-secondary: #babac0
--card: #232629, --card-top: #272a2d, --card-hover: #2c3033, --card-foreground: #ffffff
--popover: #252c32, --popover-top: #2a373f, --popover-foreground: #ffffff
--primary: #ffffff, --primary-foreground: #101518
--secondary: #3b4244, --secondary-foreground: #ffffff
--muted: #22282c, --muted-foreground: #a9aeb3
--accent: #41484b, --accent-foreground: #ffffff
--inset: #111619, --sheet: #14181c, --sheet-bottom: #0f1316
--field: #32393e, --destructive: #ff0026, --border: rgb(255 255 255 / 0.1), --input: rgb(255 255 255 / 0.15), --ring: #ffffff

**Recovery bands (líneas 207-210):**
--recovery-green: #16ec06, --recovery-yellow: #ffde00, --recovery-red: #ff0026, --recovery-red-text: #ff5a6a

**Strain/sleep (líneas 213-217):**
--strain: #0093e7, --strain-text: #1fa0f0, --strain-deep: #0d48be, --sleep: #7ba1bb, --sleep-deep: #39597b

**Status (líneas 220-236):**
--optimal: #00f19f, --warning: #ffa722

**Recovery blue (línea 224):**
--recovery-blue: #67aee6

**Stress 0-3 (líneas 227-229):**
--stress-low: var(--recovery-blue), --stress-medium: #00f19f, --stress-high: #ffa722

**Coach/insight (líneas 239-258):**
--coach: #7095fe, --insight-from: #4b418c, --insight-to: #346e8c, --banner-from: #2e2c4f, --banner-to: #2b3f50, --outlook-from: #6a5a45, --outlook-to: #2f4a5e, --outlook-accent: #e8d6b4, --glow-sand: #8c7a63, --answer-yes: var(--recovery-blue), --on-color: #101518, --on-strain: #ffffff

**Key/dial (líneas 256-270):**
--key-from: #ffffff, --key-to: #dfe2e6, --key-foreground: #101518
--dial-track: #33383c, --dial-target: #5a5e61

**Chart grid/band/cursor (líneas 263-265):**
--chart-grid: rgb(255 255 255 / 0.08), --chart-band: rgb(255 255 255 / 0.05), --chart-cursor: rgb(255 255 255 / 0.4)

**Chart 1-5 (líneas 266-270):**
--chart-1: #0093e7, --chart-2: #00f19f, --chart-3: #7ba1bb, --chart-4: #ffa722, --chart-5: var(--recovery-blue)

**Strain bands (líneas 276-279):**
--strain-band-1: var(--strain), --strain-band-2: color-mix(in srgb, var(--strain) 78%, var(--card)), --strain-band-3: color-mix(in srgb, var(--strain) 58%, var(--card)), --strain-band-4: color-mix(in srgb, var(--strain) 40%, var(--card))

**Sleep stages (líneas 282-286):**
--stage-awake: #dfe3e8, --stage-rem: #a35cf0, --stage-light: #a9a6f4, --stage-deep: #f39ae4

**Energy (líneas 289-290):**
--energy-active: #0093e7, --energy-resting: #b9c3cc

**Pattern hatch (líneas 293-297):**
--pattern-hatch: repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.09) 0 1.5px, transparent 1.5px 5px)

**Glass (líneas 301-312):**
--glass-top, --glass-bottom, --glass-edge, --glass-rim, --glass-lens, --glass-shadow, --glass-action-top, --glass-action-bottom, --action-rim-from: #7778dd, --action-rim-to: #4c94db, --action-face: #1f2436

**Dim/shadow (líneas 313-319):**
--dim: rgb(0 0 0 / 0.65), --dim-strong: rgb(0 0 0 / 0.85), --card-edge: rgb(255 255 255 / 0.06), --sheet-edge: rgb(255 255 255 / 0.14), --selection: rgb(255 255 255 / 0.25), --card-shadow: 0 0 #0000, --thumb-shadow: 0 1px 3px rgb(0 0 0 / 0.4), --overlay-shadow: 0 8px 24px rgb(0 0 0 / 0.45)

**Orb (líneas 327-348):**
--orb-green a --orb-empty, --orb-highlight: #ffffff, --orb-lift: 1.3, --orb-sparkle: 0.12, --orb-blend: lighter, --orb-text: #ffffff, --orb-text-muted: #999ea3

**Flame (líneas 352-356):**
--flame-tip: #ff8a52, --flame-body: #ff6538, --flame-edge: #ee4e33, --flame-core-top: #ffc56e, --flame-core-bottom: #ff9862

### 3.2 Gymlog tokens (tokens.css + DESIGN.md)

**Superficies (tokens.css):**
--bg-canvas, --bg-surface, --bg-surface-2, --bg-surface-3

**Texto:**
--text-primary, --text-secondary, --text-tertiary, --inverse

**Acento (24 presets en accents.ts):**
Cada preset es un par [dark, light] de --interactive-primary y --interactive-primary-fg
Ejemplo: preset por defecto: --interactive-primary: #ffd93d (y su par de texto)

**Bordes:**
--border-subtle, --border-default, --border-interactive

**Semánticos:**
--success, --warning, --error, --info (colores que NO cambian con el acento)

**Vidrio (3 capas, sin backdrop-filter):**
--glass-1: contenido, sin sombra
--glass-2: elevado (tarjetas, filas) - opaco con canto
--glass-3: flotante (header, FAB, modales, sheets) - --glass-3-solid para cierres

**Canto y velo:**
--glass-edge-top: luz asimétrica arriba
--glass-veil: techo medido 0.027

**Tipografía:**
Inter para cuerpo, Space Grotesk para títulos
Tamaños escalonados: text-2xs, xs, sm, base (default 15px/160%), lg, xl, 2xl, display-huge
Numerales: tabular

**Espaciado --space-\*:**
De 4px a 48px, base 4px (p-4 = 16px, no 15px por radius 15px)

**Formas:**
--radius-sm, --radius-md, --radius-card, --radius-xl, --radius-pill (en componentes: rounded-sm, rounded-card, rounded-pill)

**Táctil:**
--tap-44: pseudo-elemento transparente 44×44 para controles

---

## 4. CONVENCIONES DE CODIGO PRECISAS

### 4.1 Importaciones y aliases

**Pulse (Next.js 16):**

- `import { cn } from '@/lib/utils'` (asumiendo helper cn)
- Alias: `@` → `src`, rutas Next propias

**Gymlog:**

- `import { aliases } from '@/vite.aliases'` — define `@` → `./src`, `@features` → `src/features`, `@shared` → `src/shared`, `@app` → `src/app`
- `import clsx from 'clsx'` o usar templates literales de Tailwind
- `import { useTranslation } from 'react-i18next'`
- `import { Capacitor } from '@capacitor/core'` — SOLO en gymlog, NO en Pulse

### 4.2 Componente patrón (ambos usan):

```
const Component = memo(function Component({ prop1, prop2, ...props }) {
  // body
  return <div className="clases tailwind">...</div>
})

export const Component = memo(Component)
```

### 4.3 Tailwind v4 className composición:

**Pulse usa:** templates literales + `classnames`/clsx subyacente
Ejemplo: `className={[ 'inline-flex items-center justify-center', variantStyles[variant], sizeStyles[size], className ].join(' ')}`

**Gymlog usa:** mismo patrón con clases Tailwind directas
Ejemplo Button: `className={[ 'inline-flex items-center justify-center gap-2 cursor-pointer font-medium', 'transition-all duration-100', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas', 'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none', variantStyles[variant], sizeStyles[size], className ].join(' ')}`

### 4.4 i18n patrón (idéntico en ambos):

```
const { t } = useTranslation()
// Uso: t('key:hola', { nombre }) para interpolación
// Pluralización: t('key:contar', { count }, { count }) — gymlog usa react-i18next plural
```

### 4.5 Zustand store patrón (gymlog solo):

```
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
// ...
interface State { ... }
export const useStore = create<State>()(persist(...));
```

### 4.6 TypeScript strict (ambos):

- `tsconfig.json` con `strict: true` implícito
- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- JSX: `jsx: "react-jsx"` o `"react"` en ambos

### 4.6 Patrones de estado vacía (DESIGN.md gymlog):

- **Estado vacío:** icono 32px + título + descripción "qué hacer" + máximo 1 botón primario (dos como mucho)
- **Nunca:** "Get Started" (no dice a dónde lleva), sí "Crear primera rutina"
- **Máximo:** 2 botones CTA en estado vacío, verbo + sustantivo (ej: "Crear primera rutina")

---

## 5. PAQUETES NPM PRECISOS PARA PORTAR

### 5.1 Que ya vienen en gymlog (no comprar):

| Paquete                 | Versión                          | Usos                              |
| ----------------------- | -------------------------------- | --------------------------------- |
| `@tanstack/react-query` | `^5.96.2`                        | Data fetching, mutations          |
| `@supabase/supabase-js` | `^2.118.0`                       | API backend                       |
| `framer-motion`         | `^12.38.0`                       | Animaciones BottomSheet, Skeleton |
| `sonner`                | `^2.0.1`                         | Toasts                            |
| `recharts`              | `^3.8.1`                         | Gráficas SVG                      |
| `zod`                   | `^3.24.2`                        | Validaciones                      |
| `zustand`               | `^5.0.12`                        | Stores con persist                |
| `tailwindcss`           | `^4.2.2`                         | Styling                           |
| `vite`                  | `^6.2.0`                         | Build                             |
| `vitest`                | `^4.1.3`                         | Tests                             |
| `msw`                   | `^2.8.4`                         | Mock servers                      |
| `@capacitor/core`       | `^8.3.0`                         | Capacitor                         |
| `@capacitor/app`        | `^8.0.1`                         | Capacitor                         |
| `react`                 | `^19.2.7`, `react-dom` `^19.2.7` | React 19                          |

### 5.2 Qué hay que instalar de verdad: nada

La tabla anterior era inventada y, además, no aplicaba: proponía Radix y
`tailwind-merge` para portar componentes shadcn, que es justo lo que este port
descarta. Lo que se ha portado no añade ni una dependencia.

| Paquete que la tabla pedía                                                                                         | Estado real                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@radix-ui/react-slot`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-popover`, `@radix-ui/react-dropdown-menu` | **No se instalan.** GymLog cubre diálogo, hoja inferior, segmentado y toggle con componentes propios (`Modal`, `ConfirmDialog`, `BottomSheet`, `SegmentedControl`, `Toggle`). |
| `class-variance-authority`                                                                                         | **No se instala.** GymLog compone clases con `[].join(' ')` y mapas `Record<Variant, string>`.                                                                                |
| `tailwind-merge`                                                                                                   | **No se instala.** Mismo motivo; los componentes aceptan `className` al final de la cadena.                                                                                   |
| `date-fns`                                                                                                         | **Ya está** (`^4.1.0`). La nota de la tabla se contradecía.                                                                                                                   |
| `clsx` / `lucide-react`                                                                                            | **No se instalan.** GymLog no los usa: iconos vía `reicon-react` y `@shared/components/icons`.                                                                                |

La barra de progreso nueva (`Progress.tsx`) es un `<div>` con `role="progressbar"`
y dos tokens CSS (`--progress-track`, `--progress-fill`), sin dependencias.

---

## 6. LO QUE NO PORTAR: ACOPLAMIENTO NEXT.JS EXACTO

### 6.1 Rutas y layouts Next.js (NUNCA):

- `src/app/(app)/` routes — file-based routing de Next
- `layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`
- `next/navigation` imports: `useSearchParams`, `useNavigation`, `useRouter`, `useBlocker`
- `next/dist` cualquier cosa
- `next/config` / `next/env`
- `dynamic()` import de Next
- `ssr` / `client` / `server` directives (`"use client"`, `"use server"`)
- `next/image`, `next/font`
- `generateStaticParams`, `generateServerContent`

### 6.2 Cualquier cosa que use:

- `import from 'next'` — bander rojas
- `next/image` — images optimized de Next
- `next/font` — Inter/Space Grotesk ya están en gymlog vía CSS/tokens
- `app-dir` patterns — routes anidadas, segments, etc.

### 6.3 Hooks específicos Next:

- `usePathname`, `useSearchParams`, `useRouter` de `next/navigation`
- `useSelectedLayoutList` / `useCurrentLayoutList`
- `useSearchParams` actualización
- `redirect`, `rewrite` de next

---

## RESUMEN EJECUTIVO: QUÉ SE PORTÓ Y QUÉ NO

### Implementado (2026-11-04)

| Pieza                         | Dónde vive en GymLog                                 | Qué aporta                                                                                                                             |
| ----------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Lógica de scoring (7 módulos) | `src/shared/lib/scoring/`                            | Líneas base EWMA, confianza, carga diaria, sueño, enfermedad y preparación                                                             |
| Adaptadores de datos          | `src/features/wearables/utils/scoringInputs.ts`      | Traduce `wearable_daily` / `wearable_sleep` a series; nunca inventa un valor                                                           |
| `computeReadiness` v2         | `src/features/wearables/utils/readiness.ts`          | Mismo contrato (`low\|normal`, `holdLoad`, claves `coach.readiness.*`) con línea base robusta, deuda de sueño, descanso y consistencia |
| Tarjeta de recuperación       | `src/features/wearables/components/RecoveryCard.tsx` | Explica en `WearablesPage` por qué se pide mantener la carga                                                                           |
| Barra de progreso accesible   | `src/shared/components/ui/Progress.tsx`              | Único hueco real de UI; `role="progressbar"` + tokens `--progress-track` / `--progress-fill`                                           |

Verificación: 104 tests de scoring + 12 de adaptadores + 14 de readiness + 3 de
`Progress` en verde; `npx vite build` completo; `eslint` sin errores nuevos.

### Aplazado (necesita datos o proyecto propio)

- **`strain.ts`, `stressBase.ts`, `zones.ts`**: exigen serie de frecuencia
  cardiaca, que GymLog todavía no guarda.
- **`sleepRegularity.ts`**: exige sesiones de sueño con horas de inicio y fin,
  no solo la duración.
- **`fitnessLevel.ts`**: exige VO2max.
- **Aviso de enfermedad (UI)**: el módulo está portado y probado, pero
  `illnessFromDays` pide **2 señales corroborantes** y GymLog solo tiene FC en
  reposo. Mostrar la tarjeta daría falsos negativos permanentes. Se activa en
  cuanto entren HRV, temperatura de piel o respiración.
- **Capa nativa / base de datos / RGPD** (fase 5 del plan): es un proyecto
  propio, no un port.

### Descartado

- Componentes UI de Pulse y todo Radix: GymLog ya los cubre con piezas propias.
- Módulos que dependen de HRV, serie de FC, VO2max o sueño con fases
  (`recovery`, `drivers`, `hrRecovery`, `restingHr`, `forecast`,
  `healthMonitor`, `energyBank`, `healthspan`, `strainTarget`,
  `journalImpact`).
- Cualquier cosa de Next.js: rutas de `src/app/`, `next/*`, `dynamic()`,
  `"use client"` / `"use server"` y su configuración de despliegue.

### Regla para lo que venga después

Antes de portar un módulo nuevo, comprobar que sus entradas existen en las
tablas de GymLog. Si falta la fuente, el módulo se queda fuera: no se rellena
con medias ni con valores por defecto.

## Cierre de alcance (sin datos fuente en GymLog)

Quedan cerrados como **No aplica / Fuera de alcance** siguiendo la regla de no portar nada cuyas entradas no existan en las tablas de GymLog:

- **Scoring avanzado (`strain.ts`, `stressBase.ts`, `zones.ts`)**: Cerrado — GymLog no almacena serie continua de FC.
- **Sueño (`sleepRegularity.ts`)**: Cerrado — solo se registra duración, sin hora de inicio ni fin.
- **VO2max (`fitnessLevel.ts`)**: Cerrado — no existe dato de VO2max.
- **Aviso de enfermedad (UI)**: Cerrado — requiere al menos 2 señales (HRV, temperatura de piel, respiración) y GymLog solo dispone de FC en reposo.
