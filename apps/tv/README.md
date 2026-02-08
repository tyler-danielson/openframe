# OpenFrame TV

Android TV kiosk app for displaying OpenFrame on Fire TV, Google TV, and other Android TV devices.

## Features

- **Fullscreen WebView Kiosk** - Loads your OpenFrame kiosk view
- **Auto-start on Boot** - Automatically launches when device starts
- **Remote Control Support** - Navigate with TV remote
- **Easy Setup** - Configure server URL via on-screen form

## Remote Control

| Button | Action |
|--------|--------|
| Menu / Settings | Open setup screen |
| Play/Pause | Refresh display |
| Back | Go back / Open setup |
| D-pad Up/Down | Scroll content |

## Building

### Prerequisites

- Android Studio (or command line with Android SDK)
- JDK 17+

### Build APK

```bash
cd apps/tv

# Debug APK
./gradlew assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk

# Release APK
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release-unsigned.apk
```

### Build with Android Studio

1. Open `apps/tv` folder in Android Studio
2. Build → Build Bundle(s) / APK(s) → Build APK(s)

## Installation

### Fire TV

1. Enable Developer Options and ADB on Fire TV
2. Install via ADB:
   ```bash
   adb connect <fire-tv-ip>
   adb install app-debug.apk
   ```

### Google TV / Android TV

1. Enable Developer Options
2. Sideload via ADB or use "Send Files to TV" app

## Setup

1. Launch OpenFrame from the app launcher
2. Enter your OpenFrame server URL
3. (Optional) Enter a kiosk token for specific kiosk config
4. Press "Save & Start Kiosk"

## Configuration

The app stores settings in SharedPreferences:
- `kiosk_url` - Your OpenFrame server URL
- `kiosk_token` - Optional kiosk token for multi-kiosk setups

## Customization

### App Icon

Replace the launcher icons in:
- `app/src/main/res/mipmap-hdpi/ic_launcher.xml`
- `app/src/main/res/mipmap-xhdpi/ic_launcher.xml`

For proper icons, create PNG files:
- `ic_launcher.png` (48x48, 72x72, 96x96, 144x144, 192x192)

### Banner (Android TV)

The banner shown in Android TV launcher is defined in:
- `app/src/main/res/drawable/banner.xml`

For a proper banner, create a 320x180 PNG.

## Signing for Release

For production releases, sign the APK:

```bash
# Generate keystore (one time)
keytool -genkey -v -keystore openframe-tv.keystore -alias openframe -keyalg RSA -keysize 2048 -validity 10000

# Sign APK
jarsigner -verbose -keystore openframe-tv.keystore app-release-unsigned.apk openframe

# Align APK
zipalign -v 4 app-release-unsigned.apk openframe-tv.apk
```

Or configure signing in `app/build.gradle.kts`.
