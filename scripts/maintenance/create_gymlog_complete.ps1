# create_gymlog.py - Ejecutar con: python create_gymlog.py
import os, sys, base64, textwrap

ROOT = r"C:\Users\franc\proyectos\apps\gymlog"
os.chdir(ROOT)

def write_file(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ {path}")

print("🚀 Creando GYMLOG COMPLETO...")

# ===== 1. DIRECTORIOS =====
dirs = [
    r"android\wear\src\main\java\com\franvi\gymlog\wear\ui",
    r"android\wear\src\main\java\com\franvi\gymlog\wear\data",
    r"android\wear\src\main\java\com\franvi\gymlog\wear\complication",
    r"android\wear\src\main\java\com\franvi\gymlog\wear\tiles",
    r"android\wear\src\main\java\com\franvi\gymlog\wear\watchface",
    r"android\wear\src\main\res\xml",
    r"android\wear\src\main\res\values",
    r"android\wear\src\main\res\drawable",
    r"src\features\workout\stores",
    r"src\hooks",
    r"src\utils",
    r"src\features\workout\components",
    r"src\features\workout\pages",
]
for d in dirs:
    os.makedirs(os.path.join(ROOT, d), exist_ok=True)
print("✅ Directorios creados")

# ===== FUNCIÓN PARA ESCRIBIR ARCHIVOS KOTLIN/TS =====
def write_kotlin(path, content):
    write_file(path, content)

# ===== 1. WEAR OS BASE =====
write_file(r"android\wear\build.gradle.kts", '''plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp")
}

android {
    namespace = "com.franvi.gymlog.wear"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.franvi.gymlog.wear"
        minSdk = 30
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions { jvmTarget = "1.8" }
    buildFeatures { compose = true }
    composeOptions { kotlinCompilerExtensionVersion = "1.5.14" }
    packagingOptions {
        resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.06.00")
    implementation(composeBom)
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.wear.compose:compose-material:1.3.1")
    implementation("androidx.wear.compose:compose-material-core:1.3.1")
    implementation("androidx.wear.compose:compose-foundation:1.3.1")
    implementation("androidx.wear.compose:compose-navigation:1.3.1")
    implementation("androidx.wear:wear-complications-data-source:1.2.1")
    implementation("androidx.wear:wear-tiles:1.3.0")
    implementation("androidx.wear:wear-tiles-renderer:1.3.0")
    implementation("androidx.wear:wear-tiles-material:1.3.0")
    implementation("androidx.wear:wear-watchface:1.3.0")
    implementation("androidx.wear:wear-watchface-complications-rendering:1.3.0")
    implementation("androidx.wear:wear-watchface-data:1.3.0")
    implementation("androidx.wear:wear-watchface-editor:1.3.0")
    implementation("androidx.wear:wear-watchface-style:1.3.0")
    implementation("androidx.wear:wear-watchface-client:1.3.0")
    implementation("androidx.wear:wear-watchface-client-guava:1.3.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.0")
    implementation("androidx.navigation:navigation-compose:2.7.7")
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")
    implementation("androidx.wear:wear-watchface-complications-data:1.3.0")
    implementation("com.google.horologist:horologist-complication:1.1.0")
    implementation("com.google.horologist:horologist-tiling:1.1.0")
}
''')

write_file(r"android\wear\src\main\AndroidManifest.xml", '''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <uses-feature android:name="android.hardware.type.watch" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:name=".WearApplication"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.GymLogWear"
        tools:targetApi="31">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:label="@string/app_name"
            android:theme="@style/Theme.GymLogWear">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".complication.StopwatchComplicationService"
            android:exported="true"
            android:permission="com.google.android.wearable.permission.BIND_COMPLICATION_PROVIDER">
            <intent-filter>
                <action android:name="android.support.wearable.complications.ACTION_COMPLICATION_UPDATE_REQUEST" />
            </intent-filter>
            <meta-data
                android:name="android.support.wearable.complications.SUPPORTED_TYPES"
                android:resource="@xml/supported_complication_types" />
            <meta-data
                android:name="android.support.wearable.complications.UPDATE_PERIOD_SECONDS"
                android:value="1" />
        </service>

        <service
            android:name=".tiles.StopwatchTileService"
            android:exported="true"
            android:label="@string/tile_label"
            android:permission="com.google.android.wearable.permission.BIND_TILE_PROVIDER">
            <intent-filter>
                <action android:name="androidx.wear.tiles.action.BIND_TILE_PROVIDER" />
            </intent-filter>
            <meta-data
                android:name="androidx.wear.tiles.PREVIEW_IMAGE"
                android:resource="@drawable/tile_preview" />
        </service>

        <service
            android:name=".watchface.GymLogWatchFaceService"
            android:exported="true"
            android:label="@string/watchface_name"
            android:permission="android.permission.BIND_WALLPAPER">
            <intent-filter>
                <action android:name="androidx.wear.watchface.action.BIND_WATCH_FACE" />
            </intent-filter>
        </service>
    </application>

    <uses-feature android:name="android.hardware.type.watch" android:required="true" />
</manifest>
''')

# settings.gradle.kts
settings_path = os.path.join(ROOT, "android", "settings.gradle.kts")
if os.path.exists(settings_path):
    with open(settings_path, "r", encoding="utf-8") as f:
        content = f.read()
    if 'include(":wear")' not in content:
        with open(settings_path, "a", encoding="utf-8") as f:
            f.write('\ninclude(":wear")\n')

print("✅ Wear OS base creado")

# ===== KOTLIN FILES =====
write_file(r"android\wear\src\main\java\com\franvi\gymlog\wear\WearApplication.kt", '''package com.franvi.gymlog.wear

import android.app.Application
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.room.Room
import androidx.datastore.preferences.preferencesDataStore
import com.franvi.gymlog.wear.data.StopwatchDatabase
import com.franvi.gymlog.wear.data.StopwatchRepository

class WearApplication : Application() {
    val dataStore = preferencesDataStore(name = "gymlog_wear_prefs")
    lateinit var stopwatchDatabase: StopwatchDatabase
    lateinit var stopwatchRepository: StopwatchRepository

    override fun onCreate() {
        super.onCreate()
        stopwatchDatabase = Room.databaseBuilder(
            this, StopwatchDatabase::class.java, "gymlog_wear.db"
        ).setJournalMode(RoomDatabase.JournalMode.TRUNCATE).build()
        stopwatchRepository = StopwatchRepository(stopwatchDatabase, dataStore)
        ProcessLifecycleOwner.get().lifecycle.addObserver(AppLifecycleObserver())
    }
}

class AppLifecycleObserver : androidx.lifecycle.DefaultLifecycleObserver {
    override fun onStart(owner: androidx.lifecycle.LifecycleOwner) { }
    override fun onStop(owner: androidx.lifecycle.LifecycleOwner) { }
}
''')

write_file(r"android\wear\src\main\java\com\franvi\gymlog\wear\MainActivity.kt", '''package com.franvi.gymlog.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.window.setStatusBarColor
import androidx.wear.compose.material3.Scaffold
import androidx.wear.compose.material3.ScalingLazyColumn
import androidx.wear.compose.material3.ScalingLazyListState
import androidx.wear.compose.material3.ScalingLazyListScope
import androidx.wear.compose.material3.TimeText
import androidx.wear.compose.material3.Vignette
import androidx.wear.compose.navigation.NavController
import androidx.wear.compose.navigation.rememberNavController
import androidx.wear.compose.navigation.wearComposeNavigator
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.franvi.gymlog.wear.ui.StopwatchScreen
import com.franvi.gymlog.wear.ui.RestTimerScreen
import com.franvi.gymlog.wear.ui.SettingsScreen
import com.franvi.gymlog.wear.ui.theme.Theme
import kotlinx.coroutines.flow.collectAsStateWithLifecycle

class MainActivity : ComponentActivity() {
    private val navController: NavController = rememberNavController()
    private val scalingLazyListState = rememberScalingLazyListState()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            Theme {
                setStatusBarColor(color = androidx.compose.ui.graphics.Color.Transparent)
                Scaffold(
                    timeText = { TimeText() },
                    vignette = { Vignette(vignettePosition = 0.5f) },
                    positionIndicator = { }
                ) { innerPadding ->
                    NavHost(navController, "stopwatch") {
                        composable("stopwatch") {
                            StopwatchScreen(onNavigateToRestTimer = { navController.navigate("rest_timer") })
                        }
                        composable("rest_timer") {
                            RestTimerScreen(onNavigateToStopwatch = { navController.navigate("stopwatch") })
                        }
                        composable("settings") {
                            SettingsScreen()
                        }
                    }
                }
            }
        }
    }
}
''')

# StopwatchScreen.kt
write_file(r"android\wear\src\main\java\com\franvi\gymlog\wear\ui\StopwatchScreen.kt", '''package com.franvi.gymlog.wear.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.ButtonDefaults
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.CircularProgressIndicator
import androidx.wear.compose.material3.ScalingLazyColumn
import androidx.wear.compose.material3.ScalingLazyListScope
import androidx.wear.compose.material3.ScalingLazyListState
import androidx.wear.compose.material3.Scaffold
import androidx.wear.compose.material3.TimeText
import androidx.wear.compose.material3.Vignette
import androidx.wear.compose.material3.ToggleButton
import androidx.wear.compose.material3.ToggleChip
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.IconDefaults
import androidx.wear.compose.material3.ChipDefaults
import androidx.wear.compose.material3.CurvedText
import androidx.wear.compose.material3.CurvedRow
import androidx.wear.compose.material3.CurvedComposable
import androidx.wear.compose.material3.CurvedLayout
import androidx.wear.compose.material3.CurvedModifier
import androidx.wear.compose.material3.CurvedAlignment
import androidx.wear.compose.material3.CurvedSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.MutableState
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.TimeUnit
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.animation.animateFloatAsState
import androidx.compose.animation.spring
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.em

@Composable
fun StopwatchScreen(
    onNavigateToRestTimer: () -> Unit,
    viewModel: StopwatchViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val scalingLazyListState = rememberScalingLazyListState()
    val scale by remember { mutableStateOf(1f) }
    val animatedScale by animateFloatAsState(targetValue = scale, animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow))

    Scaffold(
        timeText = { TimeText() },
        vignette = { Vignette(vignettePosition = 0.5f) },
        positionIndicator = { }
    ) { innerPadding ->
        ScalingLazyColumn(
            modifier = Modifier.fillMaxSize(),
            state = scalingLazyListState,
            autoCentering = ScalingLazyColumn.AutoCenteringParams(itemIndex = 0),
            contentPadding = innerPadding,
            verticalArrangement = Arrangement.Center
        ) { listScope: ScalingLazyListScope ->
            listScope.item {
                Text(
                    text = formatTime(state.elapsedMs),
                    fontSize = 48.sp,
                    fontWeight = FontWeight.Light,
                    fontFamily = FontFamily.Monospace,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .graphicsLayer { scaleX = animatedScale; scaleY = animatedScale }
                        .fillMaxWidth()
                )
            }
            listScope.item {
                if (!state.isRunning && state.elapsedMs == 0L) {
                    Chip(
                        onClick = { viewModel.start() },
                        label = { Text("Iniciar", fontSize = 24.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ChipDefaults.primaryChipColors(containerColor = androidx.compose.ui.graphics.Color.Green)
                    )
                } else if (!state.isRunning && state.elapsedMs > 0) {
                    androidx.wear.compose.material3.Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Chip(
                            onClick = { viewModel.start() },
                            label = { Text("Continuar", fontSize = 20.sp) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ChipDefaults.primaryChipColors(containerColor = androidx.compose.ui.graphics.Color.Green)
                        )
                        Chip(
                            onClick = { viewModel.reset() },
                            label = { Text("Reiniciar", fontSize = 20.sp) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ChipDefaults.secondaryChipColors()
                        )
                    }
                } else {
                    androidx.wear.compose.material3.Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Chip(
                            onClick = { viewModel.lap() },
                            label = { Text("Vuelta", fontSize = 20.sp) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ChipDefaults.primaryChipColors(containerColor = androidx.compose.ui.graphics.Color.Blue)
                        )
                        Chip(
                            onClick = { viewModel.pause() },
                            label = { Text("Pausa", fontSize = 20.sp) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ChipDefaults.secondaryChipColors()
                        )
                    }
                }
            }
            listScope.item {
                Chip(
                    onClick = onNavigateToRestTimer,
                    label = { Text("Temporizador de descanso", fontSize = 18.sp) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ChipDefaults.tertiaryChipColors()
                )
            }
            listScope.item {
                if (state.laps.isNotEmpty()) {
                    androidx.wear.compose.material3.Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        state.laps.reversed().forEachIndexed { index, lap ->
                            Text(
                                text = "V${state.laps.size - index}  ${formatTime(lap.duration)}  ${formatTime(lap.totalAtLap)}",
                                fontSize = 14.sp,
                                fontFamily = FontFamily.Monospace,
                                color = androidx.compose.ui.graphics.Color.Green
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun formatTime(ms: Long): String {
    val total = ms / 1000
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    val cs = (ms % 1000) / 10
    return if (h > 0) "%02d:%02d:%02d.%02d".format(h, m, s, cs / 10)
    else "%02d:%02d.%02d".format(m, s, cs / 10)
}

class StopwatchViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(StopwatchUiState())
    val uiState = _uiState.asStateFlow()

    fun start() = _uiState.update { it.copy(isRunning = true, startedAt = System.currentTimeMillis() - it.accumulatedMs) }
    fun pause() = _uiState.update { it.copy(isRunning = false, accumulatedMs = System.currentTimeMillis() - (it.startedAt ?: 0), startedAt = 0) }
    fun reset() = _uiState.update { StopwatchUiState() }
    fun lap() = _uiState.update { 
        val now = System.currentTimeMillis()
        val total = now - (it.startedAt ?: 0)
        val lapDuration = total - it.lastLapAt
        it.laps.add(Lap(it.laps.size + 1, lapDuration, total, System.currentTimeMillis()))
        it.lastLapAt = total
    }
}

data class StopwatchUiState(
    val elapsedMs: Long = 0,
    val isRunning: Boolean = false,
    val startedAt: Long = 0,
    val accumulatedMs: Long = 0,
    val laps: MutableList<Lap> = mutableListOf(),
    val lastLapAt: Long = 0
)

data class Lap(
    val number: Int,
    val duration: Long,
    val totalAtLap: Long,
    val timestamp: Long
)
''')

# RestTimerScreen.kt
write_file(r"android\wear\src\main\java\com\franvi\gymlog\wear\ui\RestTimerScreen.kt", '''package com.franvi.gymlog.wear.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Chip
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.ChipDefaults
import androidx.wear.compose.material3.ScalingLazyColumn
import androidx.wear.compose.material3.ScalingLazyListScope
import androidx.wear.compose.material3.ScalingLazyListState
import androidx.wear.compose.material3.Scaffold
import androidx.wear.compose.material3.TimeText
import androidx.wear.compose.material3.Vignette
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.ViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.TimeUnit
import androidx.compose.runtime.derivedStateOf
import androidx.compose.animation.animateFloatAsState
import androidx.compose.animation.spring
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun RestTimerScreen(
    onNavigateToStopwatch: () -> Unit,
    viewModel: RestTimerViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val animatedProgress by animateFloatAsState(targetValue = state.progress, animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow))

    Scaffold(
        timeText = { TimeText() },
        vignette = { Vignette(vignettePosition = 0.5f) },
        positionIndicator = { }
    ) { innerPadding ->
        androidx.wear.compose.material3.ScalingLazyColumn(
            modifier = Modifier.fillMaxSize(),
            state = rememberScalingLazyListState(),
            autoCentering = androidx.wear.compose.material3.ScalingLazyColumn.AutoCenteringParams(itemIndex = 0),
            contentPadding = innerPadding,
            verticalArrangement = Arrangement.Center
        ) { listScope ->
            listScope.item {
                androidx.compose.foundation.layout.Box(
                    modifier = Modifier.size(180.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(
                        progress = animatedProgress,
                        strokeWidth = 12.dp,
                        color = Color.Green,
                        trackColor = Color.Gray.copy(alpha = 0.3f),
                        modifier = Modifier.size(180.dp)
                    )
                    Text(
                        text = "${state.remainingSeconds}s",
                        fontSize = 48.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = Color.White
                    )
                }
            }
            listScope.item {
                if (!state.isRunning && state.totalDuration == 0L) {
                    androidx.wear.compose.material3.Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Chip(
                            onClick = { viewModel.setDuration(30000) },
                            label = { Text("30s", fontSize = 20.sp) },
                            modifier = Modifier.fillMaxWidth()
                        )
                        Chip(
                            onClick = { viewModel.setDuration(60000) },
                            label = { Text("60s", fontSize = 20.sp) },
                            modifier = Modifier.fillMaxWidth()
                        )
                        Chip(
                            onClick = { viewModel.setDuration(120000) },
                            label = { Text("2m", fontSize = 20.sp) },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                } else if (!state.isRunning && state.totalDuration > 0) {
                    androidx.wear.compose.material3.Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Chip(
                            onClick = { viewModel.start() },
                            label = { Text("Iniciar descanso", fontSize = 20.sp) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ChipDefaults.primaryChipColors(containerColor = androidx.compose.ui.graphics.Color.Green)
                        )
                        Chip(
                            onClick = { viewModel.reset() },
                            label = { Text("Reset", fontSize = 20.sp) },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                } else {
                    androidx.wear.compose.material3.Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Chip(
                            onClick = { viewModel.addTime(30000) },
                            label = { Text("+30s", fontSize = 20.sp) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ChipDefaults.primaryChipColors(containerColor = androidx.compose.ui.graphics.Color.Green)
                        )
                        Chip(
                            onClick = { viewModel.pause() },
                            label = { Text("Pausa", fontSize = 20.sp) },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
            listScope.item {
                Chip(
                    onClick = onNavigateToStopwatch,
                    label = { Text("Volver al cronómetro", fontSize = 18.sp) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ChipDefaults.tertiaryChipColors()
                )
            }
        }
    }
}

class RestTimerViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(RestTimerUiState())
    val uiState = _uiState.asStateFlow()

    fun setDuration(ms: Long) = _uiState.update { it.copy(totalDuration = ms, remainingMs = ms, progress = 0f) }
    fun start() = _uiState.update { it.copy(isRunning = true, endTime = System.currentTimeMillis() + it.remainingMs) }
    fun pause() = _uiState.update { it.copy(isRunning = false, remainingMs = (it.endTime ?: 0) - System.currentTimeMillis(), endTime = 0) }
    fun addTime(ms: Long) = _uiState.update { it.copy(remainingMs = it.remainingMs + ms, endTime = (it.endTime ?: 0) + ms, totalDuration = it.totalDuration + ms) }
    fun reset() = _uiState.update { RestTimerUiState() }
}

data class RestTimerUiState(
    val totalDuration: Long = 0,
    val remainingMs: Long = 0,
    val endTime: Long = 0,
    val isRunning: Boolean = false
) {
    val remainingSeconds: Int get() = maxOf(0, (remainingMs / 1000).toInt())
    val progress: Float get() = if (totalDuration > 0) 1f - (remainingMs.toFloat() / totalDuration) else 0f
}
''')

# SettingsScreen.kt
write_file(r"android\wear\src\main\java\com\franvi\gymlog\wear\ui\SettingsScreen.kt", '''package com.franvi.gymlog.wear.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.ScalingLazyColumn
import androidx.wear.compose.material3.ScalingLazyListScope
import androidx.wear.compose.material3.Scaffold
import androidx.wear.compose.material3.TimeText
import androidx.wear.compose.material3.Vignette
import androidx.wear.compose.material3.ToggleChip

@Composable
fun SettingsScreen() {
    Scaffold(
        timeText = { TimeText() },
        vignette = { Vignette(vignettePosition = 0.5f) },
        positionIndicator = { }
    ) { innerPadding ->
        ScalingLazyColumn(
            modifier = Modifier.fillMaxSize(),
            state = rememberScalingLazyListState(),
            contentPadding = innerPadding,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) { listScope ->
            listScope.item {
                Text("Ajustes", fontSize = 24.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(16.dp))
            }
            listScope.item {
                ToggleChip(
                    text = { Text("Sonido de alerta") },
                    checked = true,
                    onCheckedChange = { },
                    modifier = Modifier.fillMaxWidth()
                )
            }
            listScope.item {
                ToggleChip(
                    text = { Text("Vibración") },
                    checked = true,
                    onCheckedChange = { },
                    modifier = Modifier.fillMaxWidth()
                )
            }
            listScope.item {
                ToggleChip(
                    text = { Text("Mantener pantalla encendida") },
                    checked = false,
                    onCheckedChange = { },
                    modifier = Modifier.fillMaxWidth()
                )
            }
            listScope.item {
                Chip(
                    onClick = { },
                    label = { Text("Sincronizar con móvil") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
            listScope.item {
                Chip(
                    onClick = { },
                    label = { Text("Acerca de") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}
''')

# StopwatchDatabase.kt
write_file(r"android\wear\src\main\java\com\franvi\gymlog\wear\data\StopwatchDatabase.kt", '''package com.franvi.gymlog.wear.data

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters

@Database(entities = [StopwatchSession::class, LapEntity::class], version = 1, exportSchema = false)
@TypeConverters(Converters::class)
abstract class StopwatchDatabase : RoomDatabase() {
    abstract fun stopwatchSessionDao(): StopwatchSessionDao
    abstract fun lapDao(): LapDao
}

@Entity(tableName = "stopwatch_sessions")
data class StopwatchSession(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val startTime: Long,
    val endTime: Long,
    val totalElapsedMs: Long,
    val lapCount: Int,
    val exerciseName: String? = null
)

@Entity(tableName = "laps", indices = [Index(value = ["sessionId"])])
data class LapEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val sessionId: Long,
    val lapNumber: Int,
    val durationMs: Long,
    val totalAtLapMs: Long,
    val timestamp: Long
)

@Dao
interface StopwatchSessionDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(session: StopwatchSession): Long

    @Query("SELECT * FROM stopwatch_sessions ORDER BY startTime DESC LIMIT 100")
    suspend fun getRecentSessions(): List<StopwatchSession>

    @Query("DELETE FROM stopwatch_sessions WHERE startTime < :cutoff")
    suspend fun deleteOldSessions(cutoff: Long)
}

@Dao
interface LapDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(laps: List<LapEntity>)

    @Query("SELECT * FROM laps WHERE sessionId = :sessionId ORDER BY lapNumber ASC")
    suspend fun getLapsForSession(sessionId: Long): List<LapEntity>
}

class Converters {
    @TypeConverter
    fun fromTimestamp(value: Long?): java.util.Date? = value?.let { java.util.Date(it) }

    @TypeConverter
    fun toTimestamp(date: java.util.Date?): Long? = date?.time
}
''')

# StopwatchRepository.kt
write_file(r"android\wear\src\main\java\com\franvi\gymlog\wear\data\StopwatchRepository.kt", '''package com.franvi.gymlog.wear.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import androidx.datastore.preferences.longPreferencesKey
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await

class StopwatchRepository(
    private val database: StopwatchDatabase,
    private val dataStore: androidx.datastore.preferences.DataStore<androidx.datastore.preferences.Preferences>
) {
    private val lastSessionIdKey = longPreferencesKey("last_session_id")
    private val autoStartKey = longPreferencesKey("auto_start_timestamp")

    suspend fun saveSession(session: StopwatchSession, laps: List<LapEntity>) {
        val sessionId = database.stopwatchSessionDao().insert(session)
        val lapsWithSession = laps.map { it.copy(sessionId = sessionId) }
        database.lapDao().insertAll(lapsWithSession)
        dataStore.edit { it[lastSessionIdKey] = sessionId }
    }

    suspend fun getRecentSessions(): List<StopwatchSession> = database.stopwatchSessionDao().getRecentSessions()

    suspend fun getLapsForSession(sessionId: Long): List<LapEntity> = database.lapDao().getLapsForSession(sessionId)

    suspend fun getLastSessionId(): Long? = dataStore.data.map { it[lastSessionIdKey] }.first()

    suspend fun saveAutoStartTimestamp(ts: Long) = dataStore.edit { it[autoStartKey] = ts }.await()

    suspend fun getAutoStartTimestamp(): Long? = dataStore.data.map { it[autoStartKey] }.first()

    fun observeAutoStartTimestamp() = dataStore.data.map { it[autoStartKey] ?: 0L }
}
''')

print("✅ PARTE 2 COMPLETADA")

# ===== PARTE 3 - COMPLICATION, TILE, WATCHFACE =====
print("📝 Creando Complication, Tile, WatchFace...")

write_file(r"android\wear\src\main\java\com\franvi\gymlog\wear\complication\StopwatchComplicationService.kt", '''package com.franvi.gymlog.wear.complication

import android.content.Context
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationText
import androidx.wear.watchface.complications.data.RangedValueComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceService
import androidx.wear.watchface.complications.data.ComplicationDataSourceUpdateRequester
import com.franvi.gymlog.wear.data.StopwatchRepository
import com.franvi.gymlog.wear.WearApplication
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class StopwatchComplicationService : ComplicationDataSourceService() {
    private val scope = CoroutineScope(Dispatchers.IO)
    private lateinit var repository: StopwatchRepository
    private lateinit var updateRequester: ComplicationDataSourceUpdateRequester

    override fun onCreate() {
        super.onCreate()
        val app = applicationContext as WearApplication
        repository = app.stopwatchRepository
        updateRequester = ComplicationDataSourceUpdateRequester.create(this)
    }

    override fun onComplicationUpdate(
        complicationId: Int,
        dataType: Int,
        complicationManager: ComplicationManager
    ) {
        scope.launch {
            val state = repository.observeAutoStartTimestamp().first()
            val data = when (dataType) {
                ComplicationData.TYPE_RANGED_VALUE -> buildRangedValue(state)
                ComplicationData.TYPE_SHORT_TEXT -> buildShortText(state)
                else -> buildShortText(state)
            }
            complicationManager.updateComplicationData(complicationId, data)
        }
    }

    private fun buildRangedValue(autoStartTs: Long): ComplicationData {
        val now = System.currentTimeMillis()
        val elapsed = if (autoStartTs > 0) now - autoStartTs else 0L
        val total = 3600_000L
        return RangedValueComplicationData.Builder()
            .setValue(elapsed.toFloat())
            .setMin(0f)
            .setMax(total.toFloat())
            .setShortText(ComplicationText.plainText(formatTime(elapsed)))
            .build()
    }

    private fun buildShortText(autoStartTs: Long): ComplicationData {
        val now = System.currentTimeMillis()
        val elapsed = if (autoStartTs > 0) now - autoStartTs else 0L
        return androidx.wear.watchface.complications.data.ComplicationData.Builder(
            androidx.wear.watchface.complications.data.ComplicationData.TYPE_SHORT_TEXT
        ).setShortText(ComplicationText.plainText(formatTime(elapsed))).build()
    }

    private fun formatTime(ms: Long): String {
        val total = ms / 1000
        val h = total / 3600
        val m = (total % 3600) / 60
        val s = total % 60
        return if (h > 0) "%02d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
    }
}
''')

write_file(r"android\wear\src\main\java\com\franvi\gymlog\wear\tiles\StopwatchTileService.kt", '''package com.franvi.gymlog.wear.tiles

import android.content.Context
import androidx.wear.tiles.Tile
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import androidx.wear.tiles.timeline.Timeline
import androidx.wear.tiles.timeline.TimelineBuilders
import com.franvi.gymlog.wear.data.StopwatchRepository
import com.franvi.gymlog.wear.WearApplication
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class StopwatchTileService : TileService() {
    private lateinit var repository: StopwatchRepository

    override fun onCreate() {
        super.onCreate()
        val app = applicationContext as WearApplication
        repository = app.stopwatchRepository
    }

    override fun onTileRequest(requestParams: TileBuilders.TileRequest): Tile {
        val state = repository.observeAutoStartTimestamp().first()
        val now = System.currentTimeMillis()
        val elapsed = if (state > 0) now - state else 0L
        val running = state > 0

        return Tile.Builder()
            .setResourcesVersion("1")
            .setFreshnessIntervalMillis(1000)
            .setTileTimeline(
                Timeline.Builder()
                    .addTimelineEntry(
                        TimelineBuilders.TimelineEntry.Builder()
                            .setLayout(buildTileLayout(elapsed, running))
                            .build()
                    )
                    .build()
            )
            .build()
    }

    private fun buildTileLayout(elapsed: Long, running: Boolean): TileBuilders.LayoutElementBuilders.LayoutElement {
        return TileBuilders.LayoutElementBuilders.Box.Builder()
            .setWidth(TileBuilders.DimensionBuilders.Weight.Builder().setWeight(1f).build())
            .setHeight(TileBuilders.DimensionBuilders.Weight.Builder().setWeight(1f).build())
            .setVerticalAlignment(TileBuilders.LayoutElementBuilders.Box.Builder.VERTICAL_ALIGN_CENTER)
            .setHorizontalAlignment(TileBuilders.LayoutElementBuilders.Box.Builder.HORIZONTAL_ALIGN_CENTER)
            .addContent(
                TileBuilders.LayoutElementBuilders.Text.Builder()
                    .setText(formatTime(elapsed))
                    .setFontSize(48f)
                    .setColor(TileBuilders.ColorBuilders.argb(255, 255, 255, 255))
                    .setFontFamily(TileBuilders.TextBuilders.FONT_FAMILY_MONOSPACE)
                    .build()
            )
            .addContent(
                TileBuilders.LayoutElementBuilders.Text.Builder()
                    .setText(if (running) "● EN MARCHA" else "⏸ PAUSADO")
                    .setFontSize(14f)
                    .setColor(TileBuilders.ColorBuilders.argb(255, 0, 255, 0))
                    .build()
            )
            .build()
    }

    private fun formatTime(ms: Long): String {
        val total = ms / 1000
        val h = total / 3600
        val m = (total % 3600) / 60
        val s = total % 60
        return if (h > 0) "%02d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
    }
}
''')

write_file(r"android\wear\src\main\java\com\franvi\gymlog\wear\watchface\GymLogWatchFaceService.kt", '''package com.franvi.gymlog.wear.watchface

import android.content.Context
import androidx.wear.watchface.WatchFaceService
import androidx.wear.watchface.renderer.CanvasRenderer
import androidx.wear.watchface.renderer.Renderer
import androidx.wear.watchface.style.UserStyleSchema
import androidx.wear.watchface.style.UserStyleSetting
import androidx.wear.watchface.style.BooleanUserStyleSetting
import androidx.wear.watchface.style.ListUserStyleSetting
import androidx.wear.watchface.complications.data.ComplicationDataSource
import androidx.wear.watchface.complications.rendering.ComplicationRenderer
import com.franvi.gymlog.wear.data.StopwatchRepository
import com.franvi.gymlog.wear.WearApplication
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class GymLogWatchFaceService : WatchFaceService() {
    private lateinit var repository: StopwatchRepository

    override fun onCreate() {
        super.onCreate()
        val app = applicationContext as WearApplication
        repository = app.stopwatchRepository
    }

    override fun createUserStyleSchema(): UserStyleSchema = UserStyleSchema(
        listOf(
            BooleanUserStyleSetting(
                userStyleSettingId = "show_seconds",
                title = "Mostrar segundos",
                defaultValue = true
            ),
            ListUserStyleSetting(
                userStyleSettingId = "color_theme",
                title = "Tema de color",
                defaultValue = 0,
                options = listOf("Verde", "Azul", "Naranja", "Rojo")
            )
        )
    )

    override fun createComplicationSlotsManager(currentUserStyle: androidx.wear.watchface.style.UserStyle): ComplicationSlotsManager = 
        DefaultComplicationSlotsManager.create(
            complications = listOf(
                ComplicationSlot.createRoundRectComplicationSlotBuilder()
                    .setDefaultDataSourcePolicy(
                        DefaultComplicationDataSourcePolicy.Builder()
                            .setComplicationType(ComplicationData.TYPE_RANGED_VALUE)
                            .build()
                    )
                    .setBounds(androidx.wear.watchface.complications.rendering.ComplicationBounds(
                        left = 10, top = 10, right = 100, bottom = 100
                    ))
                    .build()
            ),
            currentUserStyle = currentUserStyle
        )

    override fun createRenderer(
        watchState: WatchState,
        complicationState: ComplicationState,
        userStyle: androidx.wear.watchface.style.UserStyle
    ): Renderer = CanvasRenderer(
        renderer = StopwatchWatchFaceRenderer(
            context = this,
            repository = repository,
            userStyle = userStyle
        )
    )
}

class StopwatchWatchFaceRenderer(
    context: Context,
    repository: StopwatchRepository,
    userStyle: androidx.wear.watchface.style.UserStyle
) : CanvasRenderer.Renderer {
    override fun render(canvas: android.graphics.Canvas, bounds: android.graphics.Rect, zonedDateTime: java.time.ZonedDateTime) {
        val state = repository.observeAutoStartTimestamp().first()
        val elapsed = if (state > 0) System.currentTimeMillis() - state else 0L
        
        canvas.drawColor(android.graphics.Color.BLACK)
        
        val paint = android.graphics.Paint().apply {
            color = android.graphics.Color.WHITE
            textSize = 80f
            isAntiAlias = true
            typeface = android.graphics.Typeface.MONOSPACE
            textAlign = android.graphics.Paint.Align.CENTER
        }
        
        val timeText = formatTime(elapsed)
        canvas.drawText(timeText, bounds.centerX().toFloat(), bounds.centerY().toFloat() + 30f, paint)
        
        val statusPaint = android.graphics.Paint().apply {
            color = if (state > 0) android.graphics.Color.GREEN else android.graphics.Color.GRAY
            textSize = 24f
            isAntiAlias = true
            textAlign = android.graphics.Paint.Align.CENTER
        }
        canvas.drawText(if (state > 0) "● EN MARCHA" else "⏸ PAUSADO", bounds.centerX().toFloat(), bounds.centerY().toFloat() + 80f, statusPaint)
        
        invalidate()
    }

    private fun formatTime(ms: Long): String {
        val total = ms / 1000
        val h = total / 3600
        val m = (total % 3600) / 60
        val s = total % 60
        return if (h > 0) "%02d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
    }
}
''')

# Recursos XML
write_file(r"android\wear\src\main\res\xml\supported_complication_types.xml", '''<?xml version="1.0" encoding="utf-8"?>
<complication-types xmlns:android="http://schemas.android.com/apk/res/android">
    <type android:name="SHORT_TEXT" />
    <type android:name="LONG_TEXT" />
    <type android:name="RANGED_VALUE" />
    <type android:name="GOAL_PROGRESS" />
</complication-types>
''')

write_file(r"android\wear\src\main\res\values\strings.xml", '''<resources>
    <string name="app_name">GymLog Wear</string>
    <string name="tile_label">Cronómetro GymLog</string>
    <string name="watchface_name">GymLog Watch Face</string>
    <string name="complication_stopwatch">Cronómetro</string>
</resources>
''')

write_file(r"android\wear\src\main\res\drawable\tile_preview.xml", '''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="200dp"
    android:height="200dp"
    android:viewportWidth="200"
    android:viewportHeight="200">
    <path
        android:fillColor="#1F2937"
        android:pathData="M0,0h200v200h-200z" />
    <text
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_gravity="center"
        android:text="00:00"
        android:textColor="#FFFFFF"
        android:textSize="48sp"
        android:fontFamily="monospace" />
</vector>
''')

print("✅ PARTE 3 COMPLETADA")

# ===== PARTE 4 - WEB/TYPESCRIPT =====
print("📝 Creando Web/TypeScript...")

write_file(r"src\features\workout\stores\workTimerStore.ts", '''import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface Lap {
  id: string;
  number: number;
  duration: number;
  totalAtLap: number;
  timestamp: number;
}

interface WorkTimerState {
  elapsedMs: number;
  isRunning: boolean;
  startedAt: number | null;
  accumulatedMs: number;
  laps: Lap[];
  lastLapAt: number;
  
  start: () => void;
  pause: () => void;
  reset: () => void;
  lap: () => void;
  addLap: (lap: Omit<Lap, 'id'>) => void;
  removeLap: (id: string) => void;
  clearLaps: () => void;
  setElapsedMs: (ms: number) => void;
  
  getLapTime: (index: number) => number;
  getTotalLaps: () => number;
}

export const useWorkoutTimerStore = create<WorkTimerState>()(
  persist(
    immer((set, get) => ({
      elapsedMs: 0,
      isRunning: false,
      startedAt: null,
      accumulatedMs: 0,
      laps: [],
      lastLapAt: 0,
      
      start: () => set((state) => {
        if (state.isRunning) return;
        const now = Date.now();
        state.isRunning = true;
        state.startedAt = now - state.accumulatedMs;
      }),
      
      pause: () => set((state) => {
        if (!state.isRunning) return;
        const now = Date.now();
        state.accumulatedMs = now - (state.startedAt ?? now);
        state.isRunning = false;
        state.startedAt = null;
      }),
      
      reset: () => set((state) => {
        state.elapsedMs = 0;
        state.isRunning = false;
        state.startedAt = null;
        state.accumulatedMs = 0;
        state.laps = [];
        state.lastLapAt = 0;
      }),
      
      lap: () => set((state) => {
        if (!state.isRunning) return;
        const now = Date.now();
        const totalElapsed = now - (state.startedAt ?? now);
        const lapDuration = totalElapsed - state.lastLapAt;
        
        const newLap: Lap = {
          id: crypto.randomUUID(),
          number: state.laps.length + 1,
          duration: lapDuration,
          totalAtLap: totalElapsed,
          timestamp: now,
        };
        
        state.laps.push(newLap);
        state.lastLapAt = totalElapsed;
        state.elapsedMs = totalElapsed;
      }),
      
      addLap: (lapData) => set((state) => {
        state.laps.push({ ...lapData, id: crypto.randomUUID() });
      }),
      
      removeLap: (id) => set((state) => {
        state.laps = state.laps.filter(l => l.id !== id);
      }),
      
      clearLaps: () => set((state) => {
        state.laps = [];
        state.lastLapAt = 0;
      }),
      
      setElapsedMs: (ms) => set((state) => {
        state.elapsedMs = ms;
      }),
      
      getLapTime: (index) => {
        const { laps } = get();
        if (index < 0 || index >= laps.length) return 0;
        return laps[index].duration;
      },
      
      getTotalLaps: () => get().laps.length,
    })),
    {
      name: 'gymlog-work-timer',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accumulatedMs: state.accumulatedMs,
        isRunning: state.isRunning,
        laps: state.laps,
        lastLapAt: state.lastLapAt,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.isRunning && state.startedAt) {
          const now = Date.now();
          state.accumulatedMs = now - state.startedAt;
          state.startedAt = now - state.accumulatedMs;
        }
      },
    }
  )
);

export function useElapsedMs(): number {
  const { elapsedMs, isRunning, accumulatedMs, startedAt } = useWorkoutTimerStore();
  
  if (isRunning && startedAt) {
    return Date.now() - startedAt;
  }
  return accumulatedMs;
}
''')

write_file(r"src\hooks\useOrientation.ts", '''import { useState, useEffect } from 'react';

export type Orientation = 'portrait' | 'landscape';

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(() => {
    if (typeof window === 'undefined') return 'portrait';
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  });

  useEffect(() => {
    const handleResize = () => {
      setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return orientation;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  
  return matches;
}
''')

write_file(r"src\utils\formatTime.ts", '''export function formatTime(ms: number): string {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600).toString().padStart(2, '0');
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  const cs = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
  return h > '00' ? `${h}:${m}:${s}.${cs}` : `${m}:${s}.${cs}`;
}

export function formatLap(ms: number): string {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  const cs = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
  return `${m}:${s}.${cs}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}
''')

write_file(r"src\features\workout\components\WorkTimerImproved.tsx", '''import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useWorkoutTimerStore, useElapsedMs } from '../../stores/workTimerStore';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTime, formatLap } from '../../utils/formatTime';

interface WorkTimerImprovedProps {
  exerciseName?: string;
  showLaps?: boolean;
  onLap?: (lap: { number: number; duration: number; total: number }) => void;
  onComplete?: (totalMs: number, laps: any[]) => void;
  className?: string;
}

export function WorkTimerImproved({
  exerciseName,
  showLaps = true,
  onLap,
  onComplete,
  className = ''
}: WorkTimerImprovedProps) {
  const {
    isRunning,
    laps,
    start,
    pause,
    reset,
    lap,
    clearLaps,
    lastLapAt,
  } = useWorkoutTimerStore();
  
  const elapsedMs = useElapsedMs();
  const [showLapsPanel, setShowLapsPanel] = useState(true);
  const intervalRef = useRef<number>();
  
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {}, 50);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);
  
  const displayTime = useMemo(() => formatTime(elapsedMs), [elapsedMs]);
  const displayLaps = useMemo(() => 
    laps.map(l => ({
      ...l,
      formattedDuration: formatLap(l.duration),
      formattedTotal: formatTime(l.totalAtLap)
    })
  ), [laps]);

  const handleStart = useCallback(() => start(), [start]);
  const handlePause = useCallback(() => pause(), [pause]);
  const handleLap = useCallback(() => {
    lap();
    const newLap = laps[laps.length - 1];
    if (newLap && onLap) {
      onLap({ number: newLap.number, duration: newLap.duration, total: newLap.totalAtLap });
    }
  }, [lap, laps.length, onLap]);
  
  const handleReset = useCallback(() => {
    clearLaps();
    reset();
    if (onComplete) onComplete(elapsedMs, laps);
  }, [clearLaps, reset, elapsedMs, laps, onComplete]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        isRunning ? handlePause() : handleStart();
        break;
      case 'KeyL':
        if (isRunning) handleLap();
        break;
      case 'Escape':
        handleReset();
        break;
    }
  }, [isRunning, handleStart, handlePause, handleLap, handleReset]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={`bg-gray-900 text-white rounded-2xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{exerciseName || 'Cronómetro'}</h2>
        <button
          onClick={() => setShowLapsPanel(!showLapsPanel)}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"
          aria-label={showLapsPanel ? 'Ocultar vueltas' : 'Mostrar vueltas'}
        >
          {showLapsPanel ? '📋' : '📋'}
        </button>
      </div>

      <motion.div
        key={isRunning}
        animate={{ scale: isRunning ? 1.01 : 1 }}
        transition={{ duration: 0.15 }}
        className="text-6xl font-mono font-light tabular-nums select-none text-center my-4"
      >
        {displayTime}
      </motion.div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {!isRunning && elapsedMs > 0 ? (
          <>
            <button onClick={handleStart} className="col-span-2 py-4 bg-green-600 hover:bg-green-700 text-xl font-semibold rounded-xl transition-colors">Continuar</button>
            <button onClick={handleReset} className="py-4 bg-gray-700 hover:bg-gray-600 text-xl font-semibold rounded-xl transition-colors">Reset</button>
          </>
        ) : isRunning ? (
          <>
            <button onClick={handleLap} className="col-span-2 py-4 bg-blue-600 hover:bg-blue-700 text-xl font-semibold rounded-xl transition-colors">Vuelta (L)</button>
            <button onClick={handlePause} className="py-4 bg-yellow-600 hover:bg-yellow-700 text-xl font-semibold rounded-xl transition-colors">Pausa</button>
          </>
        ) : (
          <button onClick={handleStart} className="col-span-3 py-4 bg-green-600 hover:bg-green-700 text-2xl font-bold rounded-xl transition-colors">Iniciar</button>
        )}
      </div>

      <AnimatePresence>
        {showLapsPanel && laps.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm text-gray-400 font-medium">VUELTAS ({laps.length})</h3>
              {laps.length > 0 && <button onClick={clearLaps} className="text-xs text-gray-500 hover:text-gray-300">Limpiar</button>}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {laps.slice().reverse().map((lap, i) => (
                <motion.div key={lap.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex justify-between items-center px-3 py-2 bg-gray-800 rounded-lg text-sm">
                  <span className="text-gray-400">Vuelta {laps.length - i}</span>
                  <div className="flex items-center gap-4 text-right">
                    <span className="font-mono tabular-nums text-green-400">{formatLap(lap.duration)}</span>
                    <span className="text-gray-500 font-mono tabular-nums text-xs">{formatTime(lap.totalAtLap)}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 pt-4 border-t border-gray-800 text-xs text-gray-500 flex justify-center gap-6">
        <kbd className="px-2 py-1 bg-gray-800 rounded">Espacio</kbd> Iniciar/Pausa
        <kbd className="px-2 py-1 bg-gray-800 rounded">L</kbd> Vuelta
        <kbd className="px-2 py-1 bg-gray-800 rounded">Esc</kbd> Reset
      </div>
    </div>
  );
}
''')

write_file(r"src\features\workout\components\StopwatchLandscape.tsx", '''import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useWorkoutTimerStore } from '../../stores/workTimerStore';
import { useRestTimerStore } from '../../stores/restTimerStore';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTime, formatLap } from '../../utils/formatTime';

interface StopwatchLandscapeProps {
  exerciseName?: string;
  onClose?: () => void;
}

export function StopwatchLandscape({ exerciseName, onClose }: StopwatchLandscapeProps) {
  const isLandscape = useMediaQuery('(orientation: landscape)');
  
  const { elapsedMs, isRunning, laps, start, pause, reset, lap } = useWorkoutTimerStore();
  const { remaining, isRunning: isRestRunning, start: startRest, pause: pauseRest, reset: resetRest, setDuration, addTime: addRestTime } = useRestTimerStore();

  const formatTime = useCallback((ms: number) => {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600).toString().padStart(2, '0');
    const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    const cs = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    return h > '00' ? `${h}:${m}:${s}.${cs}` : `${m}:${s}.${cs}`;
  }, []);

  const formatLap = useCallback((ms: number) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    const cs = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    return `${m}:${s}.${cs}`;
  }, []);

  if (isLandscape) {
    return (
      <div className="h-screen w-screen flex bg-gray-900 text-white overflow-hidden">
        <div className="flex-3 flex flex-col min-w-0 p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold">{exerciseName || 'Cronómetro'}</h1>
            <button onClick={onClose} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700">✕</button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <motion.div key={isRunning} animate={{ scale: isRunning ? 1.02 : 1 }} transition={{ duration: 0.2 }} className="text-8xl font-mono font-light tabular-nums select-none">{formatTime(elapsedMs)}</motion.div>
            <div className="mt-4 flex gap-3">
              {!isRunning && elapsedMs > 0 ? (
                <>
                  <button onClick={start} className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-xl font-semibold rounded-xl">Continuar</button>
                  <button onClick={reset} className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 text-xl font-semibold rounded-xl">Reiniciar</button>
                </>
              ) : isRunning ? (
                <>
                  <button onClick={lap} className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-xl font-semibold rounded-xl">Vuelta</button>
                  <button onClick={pause} className="flex-1 py-4 bg-yellow-600 hover:bg-yellow-700 text-xl font-semibold rounded-xl">Pausa</button>
                </>
              ) : (
                <button onClick={start} className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-2xl font-bold rounded-xl">Iniciar</button>
              )}
            </div>
            {laps.length > 0 && (
              <AnimatePresence>
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-4 max-h-40 overflow-y-auto">
                  <div className="text-sm text-gray-400 mb-2">VUELTAS</div>
                  <div className="space-y-1">
                    {laps.slice().reverse().map((lap, i) => (
                      <div key={lap.id} className="flex justify-between text-sm px-2 py-1 bg-gray-800 rounded">
                        <span>Vuelta {laps.length - i}</span>
                        <span className="font-mono tabular-nums text-green-400">{formatLap(lap.duration)}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
        <div className="w-px bg-gray-700" />
        <div className="flex-2 flex flex-col min-w-0 p-4 border-l border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Temporizador de Descanso</h2>
          <div className="flex-1 flex flex-col items-center justify-center">
            <motion.div key={isRestRunning} animate={{ scale: isRestRunning ? 1.02 : 1, backgroundColor: isRestRunning ? '#166534' : 'transparent' }} transition={{ duration: 0.2 }} className="w-48 h-48 rounded-full flex items-center justify-center border-4 border-green-600 relative">
              <motion.text key={remaining} animate={{ rotate: isRestRunning ? 360 : 0 }} transition={{ duration: 1, repeat: isRestRunning ? Infinity : 0, ease: 'linear' }} className="text-4xl font-mono font-bold tabular-nums">{Math.ceil(remaining / 1000)}s</motion.text>
            </motion.div>
            <div className="mt-4 flex gap-2 w-full">
              <button onClick={() => { setDuration(30000); startRest(30000); }} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm">30s</button>
              <button onClick={() => { setDuration(60000); startRest(60000); }} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm">60s</button>
              <button onClick={() => { setDuration(120000); startRest(120000); }} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm">2m</button>
            </div>
            <div className="mt-3 flex gap-2 w-full">
              {isRestRunning ? (
                <>
                  <button onClick={() => addRestTime(30000)} className="flex-1 py-3 bg-green-600 hover:bg-green-700 rounded-xl text-sm">+30s</button>
                  <button onClick={pauseRest} className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-xl text-sm">Pausa</button>
                </>
              ) : (
                <button onClick={resetRest} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm">Reset</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-white p-4">
      <p className="text-center text-gray-400 mt-20">Gira el dispositivo para modo cronómetro horizontal</p>
    </div>
  );
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
}
''')

print("✅ TODOS LOS ARCHIVOS CREADOS")
print("\n🎉 EJECUTA AHORA:")
print("cd C:\\Users\\franc\\proyectos\\apps\\gymlog")
print("npm run build")
print("npx cap sync android")
print("cd android")
print(".\\gradlew.bat :app:assembleDebug :wear:assembleDebug")
print("adb install -r app\\build\\outputs\\apk\\debug\\app-debug.apk")
print("adb -s emulator-5556 install -r wear\\build\\outputs\\apk\\debug\\wear-debug.apk")
'''

print("✅ Script Python creado. Ejecuta ahora:")
print("python create_gymlog.py")
EOF
</parameter>
</function>
</tool_call>