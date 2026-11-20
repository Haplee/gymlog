# GymLog Android Native Architecture

## Overview

This document describes the hybrid Android architecture for GymLog, integrating React/TypeScript with native Kotlin capabilities via Capacitor, focusing on Health Connect integration and wearables data synchronization.

## Architecture Decision

**Target Architecture:**

- **React 19 + TypeScript**: Main application and cross-platform experience
- **Capacitor 8**: Bridge between JavaScript and Android native code
- **Kotlin**: Native Android functionality
- **Health Connect**: Authorized health data access
- **Jetpack Compose**: Native Android UI when adding value (not a React replacement)
- **Supabase**: Persistence and synchronization per existing model
- **Scoring Engine**: Metrics processing and recovery computation

**Constraints:**

- No full rewrite in Kotlin
- No duplication of TypeScript algorithms without technical justification
- Compose as additional capability for native screens

## Current Android Project State

### Gradle Configuration

- **Gradle Wrapper**: 9.3.1
- **AGP**: 9.1.1
- **Kotlin**: 2.1.10
- **compileSdk**: 36
- **targetSdk**: 36
- **minSdk**: 24 (Health Connect requires 26, handled at runtime)
- **Java**: 21 compatibility

### Key Dependencies (variables.gradle)

```gradle
androidxCoreVersion = '1.17.0'
androidxWorkVersion = '2.9.1'
healthConnectVersion = '1.1.0-rc03'  // NOTE: Release candidate
kotlinxCoroutinesVersion = '1.8.1'
```

### Project Structure

```
android/
├── app/
│   ├── src/main/
│   │   ├── java/com/franvi/gymlog/
│   │   │   ├── MainActivity.kt
│   │   │   ├── HealthBridgePlugin.kt     ← EXISTING Health Connect bridge
│   │   │   ├── BiometricPlugin.kt
│   │   │   ├── WidgetBridgePlugin.kt
│   │   │   ├── AppIconPlugin.kt
│   │   │   ├── ThemeBridgePlugin.kt
│   │   │   ├── StreakWidgetProvider.kt
│   │   │   └── TodayWidgetProvider.kt
│   │   ├── AndroidManifest.xml
│   │   └── res/
│   ├── build.gradle
│   └── capacitor.build.gradle
├── capacitor-cordova-android-plugins/
├── build.gradle
├── settings.gradle
├── variables.gradle
├── gradle.properties
└── capacitor.settings.gradle
```

### Capacitor Plugins Registered

1. `BiometricPlugin` - Biometric authentication
2. `WidgetBridgePlugin` - Widget communication
3. `HealthBridgePlugin` - **Existing Health Connect integration**
4. `AppIconPlugin` - Dynamic app icons
5. `ThemeBridgePlugin` - Theme management

### AndroidManifest Key Points

- Health Connect permissions already declared (READ_STEPS, READ_HEART_RATE, READ_RESTING_HEART_RATE, READ_SLEEP, READ_EXERCISE, READ_HEALTH_DATA_IN_BACKGROUND)
- Permission rationale activity for Android 13-
- ViewPermissionUsageActivity for Android 14+
- Package visibility for Health Connect
- minSdk override for Health Connect library

### Existing HealthBridgePlugin.kt Capabilities

- `isAvailable()` - Checks Health Connect SDK status
- `hasPermissions()` - Checks granted permissions
- `requestAuthorization()` - Requests permissions via ActivityResult
- `readAll(startDate, endDate)` - Reads daily aggregates, sleep, workouts, strength sessions
- Uses pagination for records (MAX_RECORDS = 20000)
- Aggregation for daily metrics (steps, distance, calories, HR)
- Sleep stage parsing (deep, light, rem, awake)
- Workout classification (cardio vs strength)
- External ID format: `hc:${rec.metadata.id}`

## Phase A Summary: Android Project Discovery ✅

**Status**: Project is correctly prepared for Kotlin plugins

- Capacitor 8 with modern AGP 9.1.1
- Kotlin 2.1.10 configured
- Health Connect SDK 1.1.0-rc03 already included
- Plugin registration pattern established in MainActivity
- Permissions declared in manifest
- Java 21 compatibility configured

**Note**: Health Connect version is a release candidate. Should verify stable version before production.
