# GymLog ProGuard Rules

# Capacitor Core
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep @com.getcapacitor.annotation.Permission class * { *; }
-keep @com.getcapacitor.annotation.PermissionGroup class * { *; }
-keepclassmembers class * {
  @com.getcapacitor.PluginMethod public void *(com.getcapacitor.PluginCall);
}

# AndroidX Biometric
-keep class androidx.biometric.** { *; }
-dontwarn androidx.biometric.**

# WorkManager
-keep class androidx.work.** { *; }
-dontwarn androidx.work.**

# Kotlin Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepnames class kotlinx.coroutines.android.AndroidExceptionPreHandler {}
-keepnames class kotlinx.coroutines.android.AndroidDispatcherFactory {}
-dontwarn kotlinx.coroutines.**

# Google Play Services (Auth/Supabase related)
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Preserve Line Numbers for Crashlytics/Debug
-keepattributes SourceFile,LineNumberTable
-keepattributes Signature
-keepattributes *Annotation*

