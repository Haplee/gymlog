# GymLog — Grafo Relacional Completo (Optimizado para IA)

> Documento estructurado para ser consumido por asistentes IA (Claude).
> Contiene la totalidad del árbol, dependencias, stores, rutas y flujo de datos.

---

## 0. FICHA DEL PROYECTO

```
Nombre:       GymLog
Versión:      v5.2.0
Stack:        React 19 + TypeScript ~5.7 + Vite 6 + Capacitor 8
Estado:       Zustand 5 + TanStack Query 5
Backend:      Supabase (PostgreSQL + Auth + RLS + Storage)
Testing:      Vitest (375 tests) + Playwright (E2E)
Mobile:       Android + iOS nativos vía Capacitor
PW:           PWA desplegada en Vercel
Offline:      IndexedDB outbox + localStorage persist + cache persist
i18n:         ES/EN via i18next
Auth:         Google OAuth + email/password + biométrico
```

---

## 1. ÁRBOL COMPLETO CON DEPENDENCIAS

### 1.1 `src/App.tsx` — Punto de entrada

```
Imports:
  React, Suspense, lazy
  ErrorBoundary           ← @shared/components/ErrorBoundary
  Providers               ← @app/providers
  AppLockGate             ← @features/auth/components/AppLockGate
  OnboardingModal         ← @features/auth/components/OnboardingModal
  Pages (lazy):
    AuthPage              ← @features/auth/pages/AuthPage
    AuthCallback          ← @features/auth/pages/AuthCallback
    SettingsPage          ← @features/auth/pages/SettingsPage
    NotificationsPage     ← @features/auth/pages/NotificationsPage
    WorkoutPage           ← @features/workout/pages/WorkoutPage
    ExerciseLibraryPage   ← @features/workout/pages/ExerciseLibraryPage
    StatsPage             ← @features/stats/pages/StatsPage
    HistoryPage           ← @features/stats/pages/HistoryPage
    UserStatsPage         ← @features/stats/pages/UserStatsPage
    CardioPage            ← @features/cardio/pages/CardioPage
    RoutinePage           ← @features/routine/pages/RoutinePage
    WearablesPage         ← @features/wearables/pages/WearablesPage
    CoachPage             ← @features/coach/pages/CoachPage
    CoachMemoryPage       ← @features/coach/pages/CoachMemoryPage
    GuidePage             ← @features/guide/pages/GuidePage
    FitBodyShowcasePage   ← @features/fitbody/pages/FitBodyShowcasePage
  Stores:
    useAuthStore          ← @features/auth/stores/authStore
    useSettingsStore      ← @shared/stores/settingsStore
    useOutboxStore        ← @shared/stores/outboxStore
  Hooks:
    useBackgroundNotifications ← @shared/hooks/useBackgroundNotifications
    useFatigueSuggestion       ← @features/stats/hooks/useFatigueSuggestion
    useWorkoutReminder         ← @features/routine/hooks/useWorkoutReminder
  Lib:
    supabase              ← @shared/lib/supabase
    flushWorkoutOutbox    ← @shared/lib/workoutOutbox
    updateWidget          ← @shared/lib/widget
    devLog, devError      ← @shared/lib/devtools
    calculateCurrentStreak ← @features/stats/utils/kpiCalculations
  UI:
    PageSkeleton          ← @shared/components/ui (index)
    PermissionRequests    ← @app/components/PermissionRequests

Layout: ErrorBoundary → MotionConfig → LazyMotion → BrowserRouter
Routes: 17 lazy + 1 catch-all
```

---

### 1.2 `src/features/` — Cada feature con TODAS sus relaciones

#### `auth/` — Autenticación, perfil, settings, notificaciones

```
pages/
  AuthPage.tsx
    imports: useRateLimit (shared/hooks), useSettingsStore (shared/stores),
             checkPasswordStrength (shared/lib), APK_DOWNLOAD_URL (shared/constants),
             useAuthStore (auth/stores)
    exports: AuthPage (named)

  AuthCallback.tsx
    imports: supabase (shared/lib)
    exports: default

  SettingsPage.tsx
    imports: useSettingsStore (shared/stores), SectionHeader, SegmentedControl,
             SettingRow, Toggle (shared/components/ui), supabase (shared/lib),
             reconcileReminders (shared/lib), registerPushNotifications (shared/lib),
             unregisterPushToken (shared/lib), BiometricPlugin (shared/lib/biometric),
             devError (shared/lib), playSettingsChime (shared/lib/alarm),
             isAppIconSupported, setAppIcon (shared/lib/appIcon),
             ACCENT_PRESETS, getAccentPreset (shared/constants/accents),
             APK_DOWNLOAD_URL (shared/constants/links),
             IconBook, IconRuler, IconWatch (shared/components/icons),
             useAuthStore (auth/stores), useUpdateProfileCache (auth/hooks),
             Layout (app/components)
    exports: SettingsPage (named)

  NotificationsPage.tsx
    imports: useNotificationsStore (shared/stores),
             IconCheckBadge, IconTimer (shared/components/icons),
             Layout (app/components)
    exports: NotificationsPage (named)

components/
  AppLockGate.tsx
    imports: BiometricPlugin (shared/lib/biometric), impact, ImpactStyle (shared/lib/haptics), devError (shared/lib)

  OnboardingModal.tsx
    imports: Modal, Button (shared/components/ui),
             IconFemale, IconMale, IconRuler, IconUser (shared/components/icons),
             supabase (shared/lib), Profile type (shared/lib/types)

  RulerPicker.tsx — sin imports externos significativos

stores/
  authStore.ts
    imports: supabase, SB_URL, SB_KEY (shared/lib/supabase),
             getAuthErrorMessage (shared/lib/authErrors),
             runSignOutPhase (shared/lib/sessionLifecycle),
             devError, devLog, devWarn (shared/lib/devtools),
             queryClient (app/queryClient)
    state: user (User|null), loading (boolean=true), initialized (boolean=false)
    actions: init(), signIn(), signUp(), signInWithGoogle(), signOut()
    persist: NO

hooks/
  useProfile.ts
    imports: supabase (shared/lib), useAuthStore (auth/stores)
```

#### `workout/` — Registro de ejercicios de fuerza

```
pages/
  WorkoutPage.tsx
    imports:
      auth: useAuthStore
      routine: useRoutineStore
      stats: NextSessionCard, useExerciseAdvice
      wearables: HealthMetricsCard, pickDaily, pickSleepFor
      coach: CoachSuggestionBanner
      shared: useSettingsStore, useWeight, calcular1RM, isBodyweightLoad,
              ExerciseNote, PersonalRecord types, haptics, celebrate, playSuccessChime,
              devError, ExerciseSelector
      app: Layout
    exports: WorkoutPage (named)

  ExerciseLibraryPage.tsx
    imports:
      auth: useAuthStore
      shared: createCustomExercise (api), loadTypeFromEquipment (lib),
              fetchExerciseLibrary, LibraryExercise (api/queries),
              Chip, SegmentedControl (components/ui), EquipmentIcon (components/icons)
      app: Layout
    exports: ExerciseLibraryPage (named)

components/
  WorkoutSetList.tsx → haptics (shared/lib)
  RestTimer.tsx → useRestTimerStore (workout/stores), useSettingsStore, haptics, useVisibilityPausedInterval
  RestAlarmBanner.tsx → useRestTimerStore (workout/stores), haptics
  PlatesCalculator.tsx → BottomSheet (shared/ui), calcularDiscos, DEFAULT_BAR_KG (shared/lib/plates)
  LastSessionCard.tsx → fetchLastExerciseSets (shared/api), suggestProgression (shared/lib), useWeight
  ExerciseLoadType.tsx → createCustomExercise, updateExerciseLoadType (shared/api), LOAD_TYPES (shared/lib), EquipmentIcon
  ExerciseCatalog.tsx → useExerciseCatalog, useExerciseDetail, useWorkoutStore, useTranslatedTexts, useAuthStore, createCustomExercise, loadTypeFromEquipment
  WorkoutSavedCard.tsx → shared/components/icons (IconCheckBadge, IconTimer, IconDumbbell, IconChart)
  WorkoutSessionStats.tsx → useVisibilityPausedInterval
  WeeklyWeightPrompt.tsx → useAuthStore, daysSinceLastWeight, fetchBodyMeasurements, upsertTodayWeight
  ResumeWorkoutBanner.tsx → sin imports externos

stores/
  workoutStore.ts
    imports:
      shared: DEFAULT_MUSCLE_GROUP (constants), createThrottledLocalStorage (lib/throttledStorage),
              supabase (lib), WorkoutWithSets type (lib/types), devError (lib),
              enqueueWorkout, isNetworkError (lib/workoutOutbox),
              resolveOrCreateExercise (lib), reconcileReminders (lib),
              useOutboxStore (shared/stores)
    state: activeExerciseId, customExerciseName, customMuscleGroup, sets, startedAt,
           sessionNotes, sessionRating, loading, error, bodyweightMode, bodyWeightKg
    actions: setBodyweightContext, repeatWorkout, setActiveExercise,
             setCustomExerciseName, setSessionNotes, setSessionRating,
             addSet, setSets, updateSet, removeSet, removeAllSets,
             saveWorkout, clearPersistedState
    persist: SI (throttled localStorage, key: "gymlog-workout")

  restTimerStore.ts
    imports:
      shared: scheduleTimerNotification, cancelTimerNotification (lib/notifications),
              startAlarm, stopAlarm (lib/alarm), useSettingsStore (stores)
    state: endTime, duration, isRunning, alarmRinging
    actions: start(), stop(), extend(), complete(), dismissAlarm(), remaining()
    persist: SI (localStorage, key: "gymlog-rest-timer")

hooks/
  useExerciseCatalog.ts → mapExercise (workout/utils)
  useRestAlarm.ts → useRestTimerStore, useNotificationsStore, useVisibilityPausedInterval, resumeIfRinging, haptics
  useTranslatedTexts.ts → translateTexts (workout/utils)

utils/
  bodyweight.ts → DEFAULT_MUSCLE_GROUP (shared/constants)
  exerciseVocab.ts → sin imports
  mapExercise.ts → RawExercise type (workout/api/exercisedb)
  translate.ts → sin imports

api/
  exercisedb.ts → sin imports (fetch externo a ExerciseDB API)
```

#### `cardio/` — Sesiones de cardio

```
pages/
  CardioPage.tsx
    imports:
      auth: useAuthStore
      shared: CardioTypeIcon, SectionHeader, haptics
      app: Layout
    exports: CardioPage (named)

components/
  ActiveSessionCard.tsx → useCardioStore, CARDIO_LABELS, CardioTypeIcon, haptics, formatSeconds, useVisibilityPausedInterval
  SessionHistoryItem.tsx → CARDIO_LABELS, CardioSession type, CardioTypeIcon, formatDuration
  WeeklyStats.tsx → CardioSession type (cardio/stores), formatDuration

stores/
  cardioStore.ts
    imports: createThrottledLocalStorage (shared/lib/throttledStorage), supabase (shared/lib), devError, devWarn (shared/lib/devtools)
    state: isActive, isPaused, activeType, startedAt, pausedAt, pausedDuration, sessions[CardioSession]
    actions: startSession, pauseSession, resumeSession, stopSession, discardSession, deleteSession, syncFromRemote, getElapsed
    persist: SI (throttled localStorage, key: "gymlog-cardio")
    tipos exportados: CardioSession, CardioType, CARDIO_LABELS
```

#### `stats/` — Estadísticas, histórico, análisis

```
pages/
  StatsPage.tsx
    imports:
      auth: useAuthStore
      cardio: useCardioStore, CARDIO_LABELS
      shared: calcular1RM, devError, Skeleton, CardioTypeIcon, useWeight
      app: Layout
    exports: StatsPage (named)

  HistoryPage.tsx
    imports:
      auth: useAuthStore
      workout: useWorkoutStore
      routine: useRoutineStore
      cardio: useCardioStore, CARDIO_LABELS
      wearables: HEALTH_SESSIONS_KEY, fetchHealthSessions (api/wearablesQueries)
      shared: useWeight, supabase, shareWorkoutImage, formatDuration, formatDisplayDate,
              WorkoutWithSets, WorkoutSetWithDetails types, devError,
              fetchWorkouts, fetchRecentSets (api), EmptyHistory, SwipeToDelete,
              Modal, CardioTypeIcon, Button
      app: Layout
    exports: HistoryPage (named)

  UserStatsPage.tsx
    imports:
      auth: useAuthStore
      cardio: useCardioStore
      wearables: WearablesSummary
      shared: useWeight, computeAchievements, calcular1RM, celebrate,
              fetchWorkoutsAndSets, fetchPersonalRecords (api)
      app: Layout
    exports: UserStatsPage (named)

components/
  KPICards.tsx → sin imports externos significativos
  Charts.tsx → useWeight (shared/hooks), CHART_COLORS (stats/constants)
  FatigueAnalysis.tsx → CardioTypeIcon (a.k.a. MuscleGroupIcon), MUSCLE_COLORS, DEFAULT_MUSCLE_GROUP, MuscleGroupStatus, RecoveryStatus types
  HistoryRows.tsx → WorkoutWithSets, WorkoutSetWithDetails types (shared/lib/types)
  NextSessionCard.tsx → ExerciseAdvice type (stats/hooks/useAutoregulation)
  userStats/WorkoutCalendar.tsx → toLocalDateKey (shared/lib), WorkoutWithSets type
  userStats/WeeklyVolumeChart.tsx → useWeight (shared/hooks)
  userStats/MuscleDistributionChart.tsx → useWeight, CHART_COLORS
  userStats/DayFrequencyChart.tsx → sin imports externos significativos
  userStats/TopExercisesList.tsx → useWeight, CHART_COLORS
  userStats/BodyMeasurements.tsx → useWeight
  userStats/SectionLabel.tsx → sin imports

hooks/
  useAutoregulation.ts → computeReadiness (wearables/utils/readiness)
  useExerciseAdvice.ts → fetchExerciseSessions (shared/api), computeReadiness (wearables/utils),
                          suggestNextLoad, detectStall, applyReadiness (stats/utils/autoregulation),
                          ExerciseAdvice type
  useExerciseMusclesMap.ts → useAuthStore, fetchExerciseMusclesMap, ExerciseMuscle (shared/api)
  useFatigueSuggestion.ts → useAuthStore, analyzeMuscleRecovery, getSuggestedMuscleGroup (stats/utils),
                            useExerciseMusclesMap, fetchRecentSets (shared/api),
                            notify (shared/lib/notifications), toLocalDateKey
  useHistoryTransfer.ts → useAuthStore, useCardioStore, CARDIO_LABELS, supabase, devError,
                           fetchExercises (shared/api), DEFAULT_MUSCLE_GROUP,
                           WorkoutWithSets type, parseXlsxFile, DAY_LABELS (stats/utils),
                           applyExcelImport (stats/utils)

utils/
  applyExcelImport.ts → supabase, DEFAULT_MUSCLE_GROUP (shared/constants), fetchExercises (shared/api), CARDIO_LABELS, CardioType (cardio/stores)
  autoregulation.ts → calcular1RM (shared/lib/brzycki)
  excelExport.ts → DEFAULT_MUSCLE_GROUP (shared/constants)
  excelImport.ts → DayOfWeek, Routine, DayRoutine types (routine/stores/routineStore)
  fatigueAnalysis.ts → DEFAULT_MUSCLE_GROUP (shared/constants)
  historyHelpers.ts → Routine, RoutineExercise, DayOfWeek types (routine/stores/routineStore), WorkoutWithSets type (shared/lib/types)
  kpiCalculations.ts → WorkoutWithSets type (shared/lib/types)
  muscleDistribution.ts → toLocalDateKey (shared/lib/dateKeys)
  periodComparison.ts → toLocalDateKey (shared/lib/dateKeys)
  progressionMetrics.ts → calcular1RM (shared/lib/brzycki)
  statsData.ts → DEFAULT_MUSCLE_GROUP (shared/constants)
  volumeProjection.ts → sin imports externos
  tips.ts → sin imports externos significativos

constants.ts → sin imports
```

#### `coach/` — AI Coach

```
pages/
  CoachPage.tsx
    imports:
      auth: useAuthStore
      shared: Button, SectionHeader (components/ui), devError (lib)
      app: Layout
    exports: CoachPage (named)

  CoachMemoryPage.tsx
    imports:
      auth: useAuthStore
      shared: SectionHeader (components/ui)
      app: Layout
    exports: CoachMemoryPage (named)

components/
  CoachConsentModal.tsx → Modal, Button (shared/components/ui)
  CoachSettingsSection.tsx → useAuthStore, useCoachStore, CoachConsentModal, SectionHeader, SettingRow, Toggle
  CoachSuggestionBanner.tsx → readSuggestionFromState (coach/utils/suggestionTarget)

stores/
  coachStore.ts
    imports: fetchCoachConsent, grantCoachConsent, revokeCoachConsent (coach/api/coach)
    state: enabled (boolean), syncing (boolean)
    actions: sync(), enable(), disable()
    persist: SI (localStorage, key: "gymlog-coach")

api/
  coach.ts → supabase, SB_URL (shared/lib/supabase), CoachError, CoachErrorCode, CoachMode, CoachOutput, CoachMemoryFact types

types/
  index.ts → CoachSuggestion, SuggestionKind, CoachError, CoachErrorCode, CoachMode, CoachOutput, CoachMemoryFact

utils/
  suggestionTarget.ts → CoachSuggestion, SuggestionKind types (coach/types)
```

#### `routine/` — Rutinas semanales

```
pages/
  RoutinePage.tsx
    imports:
      auth: useAuthStore
      coach: CoachSuggestionBanner
      shared: fetchExercises (api/queries), Exercise type (lib/types),
              Chip, SectionHeader, BottomSheet (components/ui),
              ExerciseSelector (shared/components)
      app: Layout
    exports: RoutinePage (named)

components/
  RoutineSession.tsx → useRoutineSessionStore, useWeight, haptics, celebrate, Exercise type
  SortableExerciseList.tsx → RoutineExercise type (routine/stores/routineStore)

stores/
  routineStore.ts
    imports: supabase (shared/lib), devError, devLog (shared/lib/devtools)
    state: routines[Routine[]], activeRoutineId, lastBackup, loading
    actions: setRoutines, addRoutine, updateRoutine, deleteRoutine, cloneRoutine,
             setActiveRoutine, getActiveRoutine, getTodayRoutine, getDayName,
             saveToDb, loadFromDb, checkAndBackup
    persist: SI (localStorage, key: "gymlog-routines")

  routineSessionStore.ts
    imports:
      shared: DEFAULT_MUSCLE_GROUP (constants), supabase (lib), devError (lib),
              enqueueWorkout, isNetworkError, OutboxSet (lib/workoutOutbox),
              resolveOrCreateExercise (lib), useOutboxStore (stores/outboxStore)
      routine: DayOfWeek, DayRoutine, Routine types (routine/stores/routineStore)
    state: routineId, routineName, dayName, day, startedAt, exercises[SessionExercise[]], saving
    actions: isActive, start, addSet, updateSet, removeSet, discard, finish
    persist: SI (localStorage, key: "gymlog-routine-session")

hooks/
  useWorkoutReminder.ts → useAuthStore, useRoutineStore, notify, getRoutineReminderCopy (shared/lib/notifications), reconcileReminders, hasTrainedToday (shared/lib/reminderReconcile)
```

#### `wearables/` — Wearables (Health Connect / HealthKit)

```
pages/
  WearablesPage.tsx
    imports:
      auth: useAuthStore
      shared: useSettingsStore
      app: Layout
    exports: WearablesPage (named)

components/
  ConnectionCard.tsx → Button (shared/components/ui)
  HealthMetricsCard.tsx → WearableDaily, WearableSleep types (wearables/types)
  WearablesSummary.tsx → HealthMetricsCard, useWearableDaily, useWearableSleep, pickDaily, pickSleepFor

stores/
  wearableStore.ts
    state: isSyncing, lastSyncAt, lastError, strength
    actions: setSyncing, setSynced, setError
    persist: SI (localStorage, key: "gymlog-wearables")

api/
  healthAggregator.ts → HealthBridge (shared/lib/healthBridge), supabase (shared/lib), devError (shared/lib), WearableProvider, WearableSyncResult types
  wearablesQueries.ts → supabase (shared/lib), HealthSession, WearableConnection, WearableDaily, WearableSleep types

hooks/
  useWearableConnections.ts → useAuthStore
  useWearableSync.ts → useAuthStore, isAggregatorAvailable, syncAggregator, useWearableStore, useWearableConnections, WearableSyncResult type, useSettingsStore, devError

utils/
  pickDaily.ts → sin imports externos significativos
  readiness.ts → sin imports externos significativos

types/
  index.ts → WearableProvider, WearableSyncResult, HealthSession, WearableConnection, WearableDaily, WearableSleep
```

#### `fitbody/` — Showcase de diseño

```
pages/
  FitBodyShowcasePage.tsx
    imports:
      shared: Button, Chip, SegmentedControl, StatNumber, Badge (components/ui),
              WeeklyChallengeBanner, LevelChips, ExerciseCard (components/fitbody)
      app: Layout
    exports: FitBodyShowcasePage (named)
```

#### `guide/` — Guía de uso

```
pages/
  GuidePage.tsx
    imports:
      shared: Button, SectionHeader (components/ui), useSettingsStore
      app: Layout
    exports: GuidePage (named)
```

---

### 1.3 `src/app/` — Capa de aplicación

```
components/
  Layout.tsx
    imports:
      auth: useAuthStore, useProfile
      workout: useWorkoutStore, useRestAlarm, RestAlarmBanner
      cardio: useCardioStore
      wearables: useWearableSync
      shared: fetchWorkoutsAndSets, fetchWorkouts, fetchRecentSets (api/queries),
              IconHome, IconDumbbell, IconShoe, IconHistory, IconGear,
              IconSearch, IconUser (components/icons),
              useOutboxStore, useNotificationsStore, selectUnreadCount,
              ExerciseSearchSheet (components)
      app: queryClient
    exports: Layout (named)
    función: Header + BottomNav (5 tabs) + Drawer + OfflineBanner + SyncBanner

  AppDrawer.tsx
    imports: IconSearch, IconHistory, IconBook, IconRuler, IconWatch, IconGear, IconStar (shared/components/icons)

  PermissionRequests.tsx
    imports: requestPermission (shared/lib/notifications)

providers.tsx
  imports: queryClient (./queryClient), idbPersister (./queryPersister), PersistGate (./persistGate),
           isNative, initNotifications (shared/lib/notifications), useSettingsStore (shared/stores),
           i18n side-effect import (shared/lib/i18n)

sessionTasks.ts
  imports: registerSignOutTask (shared/lib/sessionLifecycle),
           useRoutineStore (routine/stores), useWorkoutStore (workout/stores)
  registra: pre-signout → routineStore.saveToDb()
             cleanup → workoutStore.clearPersistedState()

queryClient.ts → TanStack Query client
queryPersister.ts → IndexedDB persister para React Query
persistGate.tsx → Hydratación de Zustand persist desde localStorage
```

---

### 1.4 `src/shared/` — Capa compartida (TODOS los archivos)

```
api/
  queries.ts
    imports: supabase (shared/lib/supabase), devError, devWarn (shared/lib/devtools),
             WorkoutWithSets, WorkoutSetWithDetails, PersonalRecord, Exercise, ExerciseNote types,
             groupSetsBySession (./sessionGrouping)
    exports: fetchWorkouts, fetchWorkoutsAndSets, fetchRecentSets, fetchExercises,
             fetchExerciseLibrary, fetchLastExerciseSets, fetchExerciseSessions,
             fetchBodyMeasurements, upsertTodayWeight, fetchPersonalRecords

  exerciseMutations.ts
    imports: supabase (shared/lib/supabase), LoadType, LOAD_TYPES (shared/lib/loadType)
    exports: createCustomExercise, updateExerciseLoadType, fetchExerciseMusclesMap, ExerciseMuscle

  sessionGrouping.ts
    exports: groupSetsBySession(), ExerciseSessionSets type

components/
  CardioIcons.tsx
    imports: CardioType (features/cardio/stores/cardioStore) ← EXCEPCIÓN ARQUITECTÓNICA
    exports: CardioTypeIcon, MuscleGroupIcon

  EmptyStates.tsx → sin imports externos significativos
  ErrorBoundary.tsx → React ErrorBoundary
  ExerciseSearchSheet.tsx
    imports: useAuthStore (features/auth/stores/authStore) ← EXCEPCIÓN
             useWorkoutStore (features/workout/stores/workoutStore) ← EXCEPCIÓN
             MUSCLE_COLORS (shared/constants), Chip, Icons
  ExerciseSelector.tsx → useExerciseSearch (shared/hooks), Button, MuscleGroupIcon, supabase, DEFAULT_MUSCLE_GROUP
  SwipeToDelete.tsx → sin imports externos significativos

  fitbody/
    ExerciseCard.tsx → sin imports externos
    LevelChips.tsx → sin imports externos
    WeeklyChallengeBanner.tsx → sin imports externos

  icons/
    EquipmentIcons.tsx → sin imports externos
    GymIcons.tsx → sin imports externos
    index.ts → re-export de todos los iconos

  ui/
    index.ts → re-export de todos los componentes
    Badge.tsx, BottomSheet.tsx, Button.tsx, Chip.tsx, FAB.tsx,
    GymLogLogo.tsx, Input.tsx, Modal.tsx, SectionHeader.tsx,
    SegmentedControl.tsx, SettingRow.tsx, Skeleton.tsx, StatNumber.tsx, Toggle.tsx
    ← TODOS sin imports de features, solo React + framer-motion + Tailwind

constants/
  accents.ts → ACCENT_PRESETS, getAccentPreset, DEFAULT_ACCENT, AccentId
  links.ts → APK_DOWNLOAD_URL, etc.
  muscleColors.ts → MUSCLE_COLORS
  muscleGroups.ts → DEFAULT_MUSCLE_GROUP, muscle group names

hooks/
  useBackgroundNotifications.ts
    imports: useAuthStore (features/auth/stores/authStore) ← EXCEPCIÓN
             checkStreakAtRisk, checkWeeklySummary, isNative, scheduleWeeklySummaryReminder,
             canNotifyAsync, reconcileReminders, devError, devLog, supabase, registerPushNotifications,
             useSettingsStore
  useExerciseSearch.ts → fetchExercises (shared/api)
  useWeight.ts → useSettingsStore (shared/stores)
  useRateLimit.ts → sin imports externos significativos
  useVisibilityPausedInterval.ts → sin imports externos significativos

lib/
  achievements.ts → sin imports externos significativos
  alarm.ts → sin imports externos (plugins nativos)
  appIcon.ts → ACCENT_PRESETS (shared/constants/accents)
  authErrors.ts → sin imports externos significativos
  biometric.ts → plugin nativo
  brzycki.ts → calcular1RM (fórmula matemática)
  celebration.ts → sin imports (confetti + haptics)
  dateKeys.ts → toLocalDateKey, fromLocalDateKey
  devtools.ts → devLog, devError, devWarn
  duration.ts → formatSeconds, formatDuration
  formatDate.ts → formatDisplayDate
  haptics.ts → impact, notificationHaptic, ImpactStyle, NotificationType (plugin nativo)
  healthBridge.ts → definición del plugin Capacitor
  i18n.ts → configuración i18next
  i18n/resources.ts → traducciones ES/EN
  loadType.ts → LOAD_TYPES, LoadType, isBodyweightLoad, loadTypeFromEquipment
  motionFeatures.ts → lazy import de framer-motion
  notifications.ts
    imports: devError, devLog (shared/lib/devtools), useNotificationsStore (shared/stores)
  passwordStrength.ts → checkPasswordStrength
  plates.ts → calcularDiscos, DEFAULT_BAR_KG
  progression.ts
    imports: useSettingsStore (shared/stores), toLocalDateKey (shared/lib/dateKeys), devError
    exports: suggestProgression
  push.ts
    imports: supabase (shared/lib), isNotificationsDisabled (shared/lib/notifications), devError, devLog
  reminderReconcile.ts
    imports: useSettingsStore (shared/stores), devError (shared/lib/devtools)
  resolveOrCreateExercise.ts → sin imports externos significativos
  sessionLifecycle.ts → registerSignOutTask, runSignOutPhase
  shareImage.ts → devError, devWarn (shared/lib)
  streakChecker.ts → supabase, toLocalDateKey
  supabase.ts → devWarn (shared/lib/devtools), SB_URL, SB_KEY, supabase client
  throttledStorage.ts → createThrottledLocalStorage (factory)
  types.ts → Database (types/database.types)
  weeklySummary.ts → sin imports externos significativos
  weight.ts → convertKgToLb, convertLbToKg, etc.
  widget.ts → devError (shared/lib)
  workoutOutbox.ts → supabase, devError, devLog, resolveOrCreateExercise

stores/
  notificationsStore.ts
    state: items[NotificationItem[]]
    actions: add, markAllRead, clear
    persist: SI (localStorage, key: "gymlog-notifications")

  outboxStore.ts
    imports: countPendingWorkouts (shared/lib/workoutOutbox), devError
    state: pending (number)
    actions: refresh()
    persist: NO

  settingsStore.ts
    imports: DEFAULT_ACCENT, getAccentPreset, AccentId (shared/constants/accents)
    state: 15 campos (biometricEnabled, notificationsEnabled, trainingReminders, sound,
           language, theme, unitSystem, showWarmupSets, restAutoStart, restDuration,
           restByExercise, wearablesSyncOnOpen, guideSeen, accentColor, appIcon)
    actions: setters para cada campo + applyTheme
    persist: SI (localStorage, key: "gymlog-settings")

styles/
  tokens.css → CSS custom properties para temas
```

---

### 1.5 `src/types/`

```
database.types.ts → Database (tipos generados de Supabase)
global.d.ts → declaraciones globales
```

---

## 2. MATRIZ DE DEPENDENCIAS ENTRE FEATURES

### 2.1 Matriz de adyacencia

```
Feature        → auth  workout  cardio  stats  coach  routine  wearables  fitbody  guide  shared  app
auth              -      NO      NO      NO     NO      NO       NO         NO       NO     SÍ     SÍ
workout          SÍ      -       NO      SÍ    SÍ       SÍ       SÍ         NO       NO     SÍ     SÍ
cardio           SÍ      NO       -      NO     NO      NO       NO         NO       NO     SÍ     SÍ
stats            SÍ     SÍ       SÍ       -     NO      SÍ       SÍ         NO       NO     SÍ     SÍ
coach            SÍ      NO       NO      NO     -       NO       NO         NO       NO     SÍ     SÍ
routine          SÍ      NO       NO      NO    SÍ       -        NO         NO       NO     SÍ     SÍ
wearables        SÍ      NO       NO      NO     NO      NO        -         NO       NO     SÍ     SÍ
fitbody           NO      NO       NO      NO     NO      NO        NO         -       NO     SÍ     SÍ
guide             NO      NO       NO      NO     NO      NO        NO         NO       -     SÍ     SÍ
shared           SÍ*    SÍ*       SÍ*     NO     NO      NO        NO         NO       NO      -     NO
app              SÍ     SÍ       SÍ       NO    SÍ*     SÍ        SÍ         NO       NO     SÍ      -

SÍ* = excepción arquitectónica (shared → feature, solo 3 archivos)
SÍ* = CoachSettingsSection se inyecta como prop en SettingsPage
```

### 2.2 Ranking de acoplamiento

```
Feature        Consume de   Es consumido por   Total conexiones
stats          5 features   0 features          5
workout        5 features   2 features          7
routine        2 features   3 features          5
cardio         1 feature    2 features          3
coach          1 feature    3 features          4
wearables      1 feature    3 features          4
auth           0 features   7 features          7 ← feature más consumida
fitbody        0 features   0 features          0 ← feature hoja
guide          0 features   0 features          0 ← feature hoja
```

---

## 3. MAPA COMPLETO DE STORES (ZUSTAND)

### 3.1 Resumen de las 11 stores

```
┌─────────────────────┬──────────┬────────────────────────┬────────────────────┐
│ Store               │ Feature  │ Persistencia           │ Clave localStorage │
├─────────────────────┼──────────┼────────────────────────┼────────────────────┤
│ authStore           │ auth     │ No persistida          │ —                  │
│ workoutStore        │ workout  │ Throttled localStorage │ gymlog-workout     │
│ restTimerStore      │ workout  │ localStorage           │ gymlog-rest-timer  │
│ cardioStore         │ cardio   │ Throttled localStorage │ gymlog-cardio      │
│ routineStore        │ routine  │ localStorage           │ gymlog-routines    │
│ routineSessionStore │ routine  │ localStorage           │ gymlog-routine-session
│ coachStore          │ coach    │ localStorage           │ gymlog-coach       │
│ wearableStore       │ wearables│ localStorage           │ gymlog-wearables   │
│ settingsStore       │ shared   │ localStorage           │ gymlog-settings    │
│ notificationsStore  │ shared   │ localStorage           │ gymlog-notifications
│ outboxStore         │ shared   │ No persistida          │ —                  │
└─────────────────────┴──────────┴────────────────────────┴────────────────────┘
```

### 3.2 Dependencias entre stores (runtime)

```
useRestTimerStore → useSettingsStore          [lee .sound al completar timer]
useWorkoutStore   → useOutboxStore            [llama .refresh() tras saveWorkout offline]
useRoutineSessionStore → useOutboxStore       [llama .refresh() tras finish offline]
useNotificationsLib (shared/lib/notifications.ts) → useNotificationsStore [llama .add()]
useReminderReconcile (shared/lib/reminderReconcile.ts) → useSettingsStore [lee settings]
useWorkoutStore   → reminderReconcile          [post-save, reconcilia reminders]
authStore          → sessionLifecycle          [indirecto: sessionTasks.ts registra callbacks]
sessionTasks       → useRoutineStore           [pre-signout: saveToDb()]
sessionTasks       → useWorkoutStore           [cleanup: clearPersistedState()]
```

### 3.3 Stores independientes (sin dependencias de otras stores)

- useCardioStore
- useCoachStore
- useRoutineStore
- useWearableStore
- useNotificationsStore
- useOutboxStore
- useSettingsStore

---

## 4. MAPA DE RUTAS

```
PATH                     COMPONENTE            FEATURE       LAZY?   AUTH?
────────────────────────────────────────────────────────────────────────────
/login                   AuthPage              auth          sí      no
/auth/callback           AuthCallback          auth          sí      no
/                        WorkoutPage           workout       sí      sí
/routines                RoutinePage           routine       sí      sí
/stats                   StatsPage             stats         sí      sí
/history                 HistoryPage           stats         sí      sí
/settings                SettingsPage          auth          sí      sí
/cardio                  CardioPage            cardio        sí      sí
/user-stats              UserStatsPage         stats         sí      sí
/exercises               ExerciseLibraryPage   workout       sí      sí
/wearables               WearablesPage         wearables     sí      sí
/notifications           NotificationsPage     auth          sí      sí
/guide                   GuidePage             guide         sí      sí
/coach                   CoachPage             coach         sí      sí
/coach/memory            CoachMemoryPage       coach         sí      sí
/fitbody                 FitBodyShowcasePage   fitbody       sí      sí
*                        → redirect /         —             —       —
```

---

## 5. MAPA DE FLUJO DE DATOS

### 5.1 Flujo de escritura (workout)

```
Usuario → WorkoutPage → workoutStore (local) → [online?]
  ├─ Sí → RPC save_workout_with_sets() → Supabase PostgreSQL
  └─ No → enqueueWorkout() → IndexedDB (outbox) → outboxStore.refresh()
          → al reconectar: flushWorkoutOutbox() → Supabase
```

### 5.2 Flujo de escritura (cardio)

```
Usuario → CardioPage → cardioStore (local) → [online?]
  ├─ Sí → supabase insert → DB
  └─ No → pendingSync flag → al reconectar: syncFromRemote()
```

### 5.3 Flujo de lectura

```
Componente → useQuery (React Query) → shared/api/queries.ts → supabase → DB
                                                            └→ cache en IndexedDB (persister)
Componente → useStore (Zustand) → store (memoria) → localStorage (hidratado en PersistGate)
```

### 5.4 Flujo de auth

```
AuthPage → signIn/signUp/signInWithGoogle → supabase.auth
  → onAuthStateChange → authStore.init() → ProtectedRoute decide acceso
  → signOut → runSignOutPhase('pre-signout') → routineStore.saveToDb()
           → supabase.auth.signOut()
           → queryClient.clear()
           → runSignOutPhase('cleanup') → workoutStore.clearPersistedState()
```

---

## 6. EXCEPCIONES ARQUITECTÓNICAS (shared → features)

Estos archivos rompen la regla de que `shared/` no debe importar de `features/`:

```
shared/components/CardioIcons.tsx
  → import { CardioType } from '@features/cardio/stores/cardioStore'
  Motivo: los iconos de cardio necesitan el enum de tipos de cardio

shared/hooks/useBackgroundNotifications.ts
  → import { useAuthStore } from '@features/auth/stores/authStore'
  Motivo: necesita saber si el usuario está autenticado para programar notificaciones

shared/components/ExerciseSearchSheet.tsx
  → import { useAuthStore } from '@features/auth/stores/authStore'
  → import { useWorkoutStore } from '@features/workout/stores/workoutStore'
  Motivo: necesita cambiar el ejercicio activo y verificar auth
```

---

## 7. MAPA DE TESTS (375 tests, 43 archivos)

```
FEATURE       ARCHIVO                          TESTS
──────────────────────────────────────────────────────────────
auth          authStore.test.ts                unitarios
cardio        cardioStore.test.ts              unitarios
coach         coachStore.test.ts               unitarios
coach         CoachSuggestionBanner.test.tsx   unitarios
coach         suggestionTarget.test.ts         unitarios
routine       routineSessionStore.test.ts      unitarios
workout       workoutStore.test.ts             unitarios
workout       WorkoutSetList.test.tsx          unitarios
stats         autoregulation.test.ts           unitarios
stats         excelImport.test.ts              unitarios
stats         exportImport.test.ts             unitarios
stats         fatigueAnalysis.test.ts          unitarios
stats         historyHelpers.test.ts           unitarios
stats         kpiCalculations.test.ts          unitarios
stats         muscleDistribution.test.ts       unitarios
stats         periodComparison.test.ts         unitarios
stats         statsData.test.ts                unitarios
stats         volumeProjection.test.ts         unitarios
shared/api    groupSetsBySession.test.ts       unitarios
shared/lib    achievements.test.ts             unitarios
shared/lib    authErrors.test.ts               unitarios
shared/lib    brzycki.test.ts                  unitarios
shared/lib    dateKeys.test.ts                 unitarios
shared/lib    duration.test.ts                 unitarios
shared/lib    formatDate.test.ts               unitarios
shared/lib    i18n.test.ts                     unitarios
shared/lib    loadType.test.ts                 unitarios
shared/lib    passwordStrength.test.ts         unitarios
shared/lib    plates.test.ts                   unitarios
shared/lib    progression.test.ts              unitarios
shared/lib    resolveOrCreateExercise.test.ts  unitarios
shared/lib    streakChecker.test.ts            unitarios
shared/lib    throttledStorage.test.ts         unitarios
shared/lib    weight.test.ts                   unitarios
shared/lib    workoutOutbox.test.ts            unitarios
shared/ui     Button.test.tsx                  unitarios
shared/ui     StitchPrimitives.test.tsx         unitarios
wearables     readiness.test.ts                unitarios
workout       bodyweight.test.ts               unitarios
workout       mapExercise.test.ts              unitarios
stats         (workout/utils)                  —
—             E2E (Playwright)                 e2e/
```

---

## 8. LEVANTAR EL PROYECTO (scripts)

```
Comando               Descripción
──────────────────────────────────────────────────────────────
npm run dev           Servidor Vite (localhost:5173)
npm run build         tsc + vite build → dist/
npm run test          Vitest (375 tests)
npm run test:watch    Vitest en modo watch
npm run test:coverage Vitest con cobertura
npm run lint          ESLint
npm run build:android Capacitor build Android
npm run build:ios     Capacitor build iOS
npm run apk           Genera APK
npm run gen:types     Regenera tipos Supabase
npm run check:secrets Escanea secretos en bundle
npm run commit        Commitizen (conventional commits)
```
