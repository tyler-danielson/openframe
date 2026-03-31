# Keep WebView JavaScript interface
-keepclassmembers class com.openframe.tablet.KioskActivity$WebAppInterface {
    public *;
}

# Keep Kotlin metadata
-keep class kotlin.Metadata { *; }

# Keep DeviceAdminReceiver
-keep class com.openframe.tablet.DeviceAdminReceiver { *; }
