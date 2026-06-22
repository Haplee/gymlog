import Foundation
import Capacitor
import HealthKit

/// iOS mirror of android/.../HealthBridgePlugin.kt and src/shared/lib/healthBridge.ts.
/// Lee de Apple HealthKit — por aquí entran Amazfit (vía Zepp), Apple Watch, etc.
/// Devuelve el mismo modelo normalizado: { daily[], sleep[], workouts[] }.
///
/// Métodos:
///   isAvailable()          -> { available }
///   requestPermissions()   -> { granted }
///   readAll({startDate,endDate}) -> { daily, sleep, workouts }
///
/// Requiere capability HealthKit + NSHealthShareUsageDescription en Info.plist.
@objc(HealthBridgePlugin)
public class HealthBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthBridgePlugin"
    public let jsName = "HealthBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readAll", returnType: CAPPluginReturnPromise),
    ]

    private let store = HKHealthStore()

    private func readTypes() -> Set<HKObjectType> {
        var types = Set<HKObjectType>()
        if let t = HKObjectType.quantityType(forIdentifier: .stepCount) { types.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) { types.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) { types.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .heartRate) { types.insert(t) }
        if let t = HKObjectType.quantityType(forIdentifier: .restingHeartRate) { types.insert(t) }
        if let t = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(t) }
        types.insert(HKObjectType.workoutType())
        return types
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestPermissions(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": false]); return
        }
        store.requestAuthorization(toShare: nil, read: readTypes()) { success, _ in
            call.resolve(["granted": success])
        }
    }

    @objc func readAll(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["daily": [], "sleep": [], "workouts": []]); return
        }
        guard let startStr = call.getString("startDate"),
              let endStr = call.getString("endDate") else {
            call.reject("startDate y endDate son obligatorios"); return
        }
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        df.timeZone = TimeZone.current
        guard let start = df.date(from: startStr),
              let endDay = df.date(from: endStr) else {
            call.reject("Formato de fecha inválido"); return
        }
        let cal = Calendar.current
        let end = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: endDay)) ?? endDay

        // Acumuladores por fecha (yyyy-MM-dd).
        var daily: [String: [String: Any]] = [:]
        let group = DispatchGroup()
        let lock = NSLock()

        func upsert(_ key: String, _ field: String, _ value: Any) {
            lock.lock(); defer { lock.unlock() }
            var row = daily[key] ?? ["date": key]
            row[field] = value
            daily[key] = row
        }

        let dayKey: (Date) -> String = { d in df.string(from: d) }

        // --- Cumulativos diarios (pasos, distancia, calorías) ---
        func collectCumulative(_ id: HKQuantityTypeIdentifier, unit: HKUnit, field: String, asInt: Bool) {
            guard let qt = HKQuantityType.quantityType(forIdentifier: id) else { return }
            group.enter()
            var interval = DateComponents(); interval.day = 1
            let q = HKStatisticsCollectionQuery(
                quantityType: qt,
                quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: end),
                options: .cumulativeSum,
                anchorDate: cal.startOfDay(for: start),
                intervalComponents: interval)
            q.initialResultsHandler = { _, results, _ in
                results?.enumerateStatistics(from: start, to: end) { stat, _ in
                    if let sum = stat.sumQuantity() {
                        let v = sum.doubleValue(for: unit)
                        upsert(dayKey(stat.startDate), field, asInt ? Int(v) : v)
                    }
                }
                group.leave()
            }
            store.execute(q)
        }

        // --- Discretos diarios (resting HR avg) ---
        func collectDiscreteAvg(_ id: HKQuantityTypeIdentifier, unit: HKUnit, field: String) {
            guard let qt = HKQuantityType.quantityType(forIdentifier: id) else { return }
            group.enter()
            var interval = DateComponents(); interval.day = 1
            let q = HKStatisticsCollectionQuery(
                quantityType: qt,
                quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: end),
                options: .discreteAverage,
                anchorDate: cal.startOfDay(for: start),
                intervalComponents: interval)
            q.initialResultsHandler = { _, results, _ in
                results?.enumerateStatistics(from: start, to: end) { stat, _ in
                    if let avg = stat.averageQuantity() {
                        upsert(dayKey(stat.startDate), field, Int(avg.doubleValue(for: unit)))
                    }
                }
                group.leave()
            }
            store.execute(q)
        }

        // --- Heart rate avg + max por día ---
        func collectHeartRate() {
            guard let qt = HKQuantityType.quantityType(forIdentifier: .heartRate) else { return }
            group.enter()
            var interval = DateComponents(); interval.day = 1
            let bpm = HKUnit.count().unitDivided(by: .minute())
            let q = HKStatisticsCollectionQuery(
                quantityType: qt,
                quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: end),
                options: [.discreteAverage, .discreteMax],
                anchorDate: cal.startOfDay(for: start),
                intervalComponents: interval)
            q.initialResultsHandler = { _, results, _ in
                results?.enumerateStatistics(from: start, to: end) { stat, _ in
                    let k = dayKey(stat.startDate)
                    if let avg = stat.averageQuantity() { upsert(k, "avg_hr", Int(avg.doubleValue(for: bpm))) }
                    if let mx = stat.maximumQuantity() { upsert(k, "max_hr", Int(mx.doubleValue(for: bpm))) }
                }
                group.leave()
            }
            store.execute(q)
        }

        // --- Sueño ---
        var sleepRows: [[String: Any]] = []
        func collectSleep() {
            guard let ct = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return }
            group.enter()
            let pred = HKQuery.predicateForSamples(withStart: start, end: end)
            let q = HKSampleQuery(sampleType: ct, predicate: pred, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                var byDate: [String: [String: Int]] = [:]
                for s in (samples as? [HKCategorySample]) ?? [] {
                    let k = dayKey(s.startDate)
                    let mins = Int(s.endDate.timeIntervalSince(s.startDate) / 60)
                    var row = byDate[k] ?? [:]
                    var field: String? = nil
                    if #available(iOS 16.0, *) {
                        switch s.value {
                        case HKCategoryValueSleepAnalysis.asleepDeep.rawValue: field = "deep_min"
                        case HKCategoryValueSleepAnalysis.asleepCore.rawValue: field = "light_min"
                        case HKCategoryValueSleepAnalysis.asleepREM.rawValue: field = "rem_min"
                        case HKCategoryValueSleepAnalysis.awake.rawValue: field = "awake_min"
                        case HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue: field = "light_min"
                        default: break
                        }
                    } else {
                        if s.value == HKCategoryValueSleepAnalysis.asleep.rawValue { field = "light_min" }
                        else if s.value == HKCategoryValueSleepAnalysis.awake.rawValue { field = "awake_min" }
                    }
                    if field != "awake_min" { row["duration_min"] = (row["duration_min"] ?? 0) + mins }
                    if let f = field { row[f] = (row[f] ?? 0) + mins }
                    byDate[k] = row
                }
                lock.lock()
                for (k, v) in byDate {
                    var r: [String: Any] = ["date": k, "source": "healthkit"]
                    v.forEach { r[$0.key] = $0.value }
                    sleepRows.append(r)
                }
                lock.unlock()
                group.leave()
            }
            store.execute(q)
        }

        // --- Workouts ---
        var workoutRows: [[String: Any]] = []
        func collectWorkouts() {
            group.enter()
            let pred = HKQuery.predicateForSamples(withStart: start, end: end)
            let q = HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: pred, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                var rows: [[String: Any]] = []
                let iso = ISO8601DateFormatter()
                for w in (samples as? [HKWorkout]) ?? [] {
                    var r: [String: Any] = [
                        "external_id": "hk:\(w.uuid.uuidString)",
                        "type": self.mapWorkout(w.workoutActivityType),
                        "started_at": iso.string(from: w.startDate),
                        "duration": Int(w.duration),
                    ]
                    if let dist = w.totalDistance?.doubleValue(for: .meter()) { r["distance"] = dist / 1000.0 }
                    if let kcal = w.totalEnergyBurned?.doubleValue(for: .kilocalorie()) { r["calories"] = Int(kcal) }
                    rows.append(r)
                }
                lock.lock(); workoutRows.append(contentsOf: rows); lock.unlock()
                group.leave()
            }
            store.execute(q)
        }

        collectCumulative(.stepCount, unit: .count(), field: "steps", asInt: true)
        collectCumulative(.distanceWalkingRunning, unit: .meterUnit(with: .kilo), field: "distance_km", asInt: false)
        collectCumulative(.activeEnergyBurned, unit: .kilocalorie(), field: "calories", asInt: true)
        collectDiscreteAvg(.restingHeartRate, unit: HKUnit.count().unitDivided(by: .minute()), field: "resting_hr")
        collectHeartRate()
        collectSleep()
        collectWorkouts()

        group.notify(queue: .main) {
            let dailyArr: [[String: Any]] = daily.values.map { row in
                var r = row; r["source"] = "healthkit"; return r
            }
            call.resolve([
                "daily": dailyArr,
                "sleep": sleepRows,
                "workouts": workoutRows,
            ])
        }
    }

    private func mapWorkout(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .running: return "running"
        case .cycling: return "cycling"
        case .rowing: return "rowing"
        case .swimming: return "swimming"
        case .elliptical: return "elliptical"
        case .walking, .hiking: return "walking"
        case .jumpRope: return "jump_rope"
        default: return "other"
        }
    }
}
