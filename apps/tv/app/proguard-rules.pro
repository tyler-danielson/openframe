# Keep WebView JavaScript interface
-keepclassmembers class com.openframe.tv.KioskActivity$WebAppInterface {
    public *;
}

# Keep Kotlin metadata
-keep class kotlin.Metadata { *; }
