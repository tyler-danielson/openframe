# OpenFrame Kiosk — Fire TV App

Native Android/Kotlin kiosk client for Fire TV sticks and boxes.
Mirrors the Tizen TV app feature-for-feature.

## Features

- **Cloud QR pairing** — scan with phone at `openframe.us/tv-setup` (no manual typing)
- **Manual config** — enter server URL + kiosk token directly
- **QR Login** — device-code OAuth flow
- **Admin Assign** — admin pushes config from the web app
- **Full-screen WebView** — loads `${serverUrl}/kiosk/${kioskToken}`
- **Auto health check + 3 retries** with 5-second delays before giving up
- **Double-Back to Settings** — press Back twice within 2 s to escape the kiosk
- **Remote control** — all Fire TV remote keys mapped (number keys, channel, play/pause, etc.)
- **Settings overlay** — press Menu at any time during kiosk to retry/change URL

## Remote key mapping (kiosk mode)

| Key | Action |
|-----|--------|
| D-pad Up / Down | Scroll page |
| D-pad Left / Right | `scroll:left` / `scroll:right` to iframe |
| Center / Enter | `action:select` to iframe |
| Back (×1) | `action:back` to iframe + hint |
| Back (×2 within 2 s) | Go to Setup screen |
| Menu | Open Settings overlay |
| Play/Pause | Reload WebView |
| Channel Up / Down | `next` / `prev` (cycle pages) |
| 0–9 | Jump to page: home/calendar/dashboard/ha/photos/weather/tasks/notes/media/screensaver |

---

## Build prerequisites

- **Android Studio** Hedgehog (2023.1.1) or newer
- **JDK 17** (bundled with Android Studio)
- **Android SDK** platform 34 + build tools

> The Gradle wrapper (`gradlew`) binary is not committed. Run once after cloning:
> ```
> gradle wrapper --gradle-version 8.4
> ```
> Or open the project in Android Studio and it will download the wrapper automatically.

---

## Build & install

### Debug APK (for testing via ADB)

```bash
cd openframe/apps/firetv
./gradlew assembleDebug
```

APK output: `app/build/outputs/apk/debug/app-debug.apk`

### Release APK

1. Create a keystore (one-time):
   ```bash
   keytool -genkey -v -keystore openframe-kiosk.jks \
     -alias openframe -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Add signing config to `app/build.gradle.kts`:
   ```kotlin
   signingConfigs {
       create("release") {
           storeFile = file("../../openframe-kiosk.jks")
           storePassword = System.getenv("KS_PASS")
           keyAlias = "openframe"
           keyPassword = System.getenv("KEY_PASS")
       }
   }
   buildTypes {
       release {
           signingConfig = signingConfigs.getByName("release")
           // ...
       }
   }
   ```

3. Build:
   ```bash
   KS_PASS=... KEY_PASS=... ./gradlew assembleRelease
   ```

---

## Deploy to Fire TV via ADB

### Enable ADB on Fire TV
1. Settings → My Fire TV → About → click Build Number 7× (enables developer options)
2. Settings → My Fire TV → Developer Options → ADB Debugging: ON
3. Settings → My Fire TV → Developer Options → Apps from Unknown Sources: ON

### Find Fire TV IP
Settings → My Fire TV → About → Network → note the IP address

### Install

```bash
# Connect
adb connect 192.168.1.XXX:5555

# Install
adb install app/build/outputs/apk/debug/app-debug.apk

# Launch
adb shell am start -n com.openframe.kiosk/.MainActivity
```

### Sideload update (reinstall)

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

## Auto-launch on boot (optional)

To make the kiosk launch automatically when the Fire TV starts, add a `BOOT_COMPLETED` receiver in `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<receiver android:name=".BootReceiver" android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED" />
    </intent-filter>
</receiver>
```

```kotlin
// BootReceiver.kt
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val launch = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(launch)
        }
    }
}
```

---

## Project structure

```
firetv/
├── app/
│   ├── build.gradle.kts
│   ├── proguard-rules.pro
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/openframe/kiosk/
│       │   ├── MainActivity.kt          # App entry, state machine, key routing
│       │   ├── StorageHelper.kt         # SharedPreferences wrapper
│       │   ├── QrCodeHelper.kt          # ZXing QR bitmap generator
│       │   ├── HttpHelper.kt            # OkHttp + coroutines helpers
│       │   └── fragments/
│       │       ├── LoadingFragment.kt   # Spinner while checking saved config
│       │       ├── CloudSetupFragment.kt# QR pairing (default entry point)
│       │       ├── SetupFragment.kt     # Manual URL + token form
│       │       ├── QRLoginFragment.kt   # Device-code OAuth
│       │       ├── RemotePushFragment.kt# Admin assignment flow
│       │       └── KioskFragment.kt     # Full-screen WebView + remote handling
│       └── res/
│           ├── layout/                  # 7 layout XML files
│           ├── values/                  # colors, strings, themes
│           └── drawable/                # bg_panel, bg_badge, launcher icon
├── build.gradle.kts
└── settings.gradle.kts
```

---

## Differences from the Tizen app

| Feature | Tizen | Fire TV |
|---------|-------|---------|
| Language | React/TypeScript | Kotlin |
| Packaging | `.wgt` | `.apk` |
| Remote API | `window.tizen.tvinputdevice` | Android `KeyEvent` |
| Storage | `localStorage` | `SharedPreferences` |
| Screen always-on | Tizen power API | Android `FLAG_KEEP_SCREEN_ON` (add to MainActivity if needed) |
| Color buttons (Red/Green/Yellow/Blue) | Yes | Not available on Fire TV remote |
| Deploy | Tizen Studio + sdb | ADB |
