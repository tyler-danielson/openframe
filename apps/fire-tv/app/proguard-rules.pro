# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
# Keep ZXing
-keep class com.google.zxing.** { *; }
