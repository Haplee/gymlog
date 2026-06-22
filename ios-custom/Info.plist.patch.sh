#!/usr/bin/env bash
# Idempotent PlistBuddy patch for the generated iOS app Info.plist.
# Adds:
#   - NSFaceIDUsageDescription (required, or the app crashes on Face ID use)
#   - CFBundleURLTypes with custom scheme com.franvi.gymlog (OAuth callback + deep links,
#     parity with the Android intent-filter)
#
# Usage: bash ios-custom/Info.plist.patch.sh [path/to/Info.plist]
# Default path is the Capacitor-generated location.
set -euo pipefail

PLIST="${1:-ios/App/App/Info.plist}"
PB=/usr/libexec/PlistBuddy
SCHEME="com.franvi.gymlog"

if [ ! -f "$PLIST" ]; then
  echo "Info.plist not found at $PLIST" >&2
  exit 1
fi

# --- Face ID usage description ---
"$PB" -c "Delete :NSFaceIDUsageDescription" "$PLIST" 2>/dev/null || true
"$PB" -c "Add :NSFaceIDUsageDescription string 'GymLog usa Face ID para proteger tu acceso.'" "$PLIST"

# --- HealthKit usage descriptions (requeridas o crash al pedir permisos) ---
"$PB" -c "Delete :NSHealthShareUsageDescription" "$PLIST" 2>/dev/null || true
"$PB" -c "Add :NSHealthShareUsageDescription string 'GymLog lee tus datos de salud (pasos, frecuencia cardiaca, sueño y entrenamientos) para mostrar tu progreso.'" "$PLIST"
"$PB" -c "Delete :NSHealthUpdateUsageDescription" "$PLIST" 2>/dev/null || true
"$PB" -c "Add :NSHealthUpdateUsageDescription string 'GymLog no escribe datos en Salud; solo los lee.'" "$PLIST"

# --- Custom URL scheme (rebuilt from scratch for idempotency) ---
"$PB" -c "Delete :CFBundleURLTypes" "$PLIST" 2>/dev/null || true
"$PB" -c "Add :CFBundleURLTypes array" "$PLIST"
"$PB" -c "Add :CFBundleURLTypes:0 dict" "$PLIST"
"$PB" -c "Add :CFBundleURLTypes:0:CFBundleURLName string $SCHEME" "$PLIST"
"$PB" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$PLIST"
"$PB" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string $SCHEME" "$PLIST"

echo "Patched $PLIST (NSFaceIDUsageDescription + CFBundleURLTypes=$SCHEME)"
