#!/bin/bash
# Deploy OpenFrame CreateBoard kiosk app to LG CreateBoard
# Usage: ./deploy.sh [ip:port]

set -e

DEVICE="${1:-192.168.1.95:5555}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APK="$SCRIPT_DIR/app/build/outputs/apk/debug/app-debug.apk"
PACKAGE="com.openframe.createboard"
ACTIVITY="$PACKAGE/.KioskActivity"

export JAVA_HOME="/c/Program Files/Microsoft/jdk-17.0.18.8-hotspot"
export ANDROID_HOME="/c/android-sdk"
export PATH="$ANDROID_HOME/platform-tools:$JAVA_HOME/bin:$PATH"

echo "Building APK..."
cd "$SCRIPT_DIR"
./gradlew assembleDebug

echo "Connecting to $DEVICE..."
adb connect "$DEVICE"

echo "Installing APK..."
adb -s "$DEVICE" install -r "$APK"

echo "Launching kiosk..."
adb -s "$DEVICE" shell am start -n "$ACTIVITY"

echo "Done! OpenFrame CreateBoard kiosk deployed."
