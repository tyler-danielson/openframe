package com.openframe.firetv

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class KioskActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var errorView: TextView
    private lateinit var container: FrameLayout

    private val prefs by lazy {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    // Triple-tap detection for admin settings access (touch devices like Echo Show)
    private val adminTapTimestamps = mutableListOf<Long>()
    private val adminZoneSizePx by lazy {
        TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, ADMIN_ZONE_SIZE_DP,
            resources.displayMetrics
        ).toInt()
    }

    // Menu key press detection for remote-based devices
    private var menuPressCount = 0
    private var lastMenuPressTime = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep screen on
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        setContentView(R.layout.activity_kiosk)

        hideSystemUI()

        container = findViewById(R.id.container)
        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)
        errorView = findViewById(R.id.errorView)

        setupWebView()

        // Handle back button
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                }
                // Don't exit app on back press
            }
        })

        loadKiosk()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
            cacheMode = WebSettings.LOAD_DEFAULT

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = false
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar.visibility = View.GONE
                errorView.visibility = View.GONE
                webView.visibility = View.VISIBLE
            }

            override fun onReceivedError(
                view: WebView?,
                errorCode: Int,
                description: String?,
                failingUrl: String?
            ) {
                showError("Connection Error: $description")
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
            }
        }

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
    }

    private fun loadKiosk() {
        val kioskUrl = prefs.getString(PREF_KIOSK_URL, null)
        val kioskToken = prefs.getString(PREF_KIOSK_TOKEN, null)

        if (kioskUrl.isNullOrBlank()) {
            openSetup()
            return
        }

        progressBar.visibility = View.VISIBLE
        errorView.visibility = View.GONE

        val fullUrl = if (kioskToken.isNullOrBlank()) {
            "$kioskUrl/kiosk"
        } else {
            "$kioskUrl/kiosk/$kioskToken"
        }

        webView.loadUrl(fullUrl)
    }

    private fun showError(message: String) {
        progressBar.visibility = View.GONE
        webView.visibility = View.GONE
        errorView.visibility = View.VISIBLE
        errorView.text = "$message\n\nTriple-tap top-right corner or press Menu 3x to open settings"
    }

    private fun openSetup() {
        val intent = Intent(this, SetupActivity::class.java)
        startActivity(intent)
    }

    override fun onResume() {
        super.onResume()
        hideSystemUI()

        // Reload if URL was updated in setup
        val currentUrl = prefs.getString(PREF_KIOSK_URL, null)
        if (currentUrl != null && webView.url?.startsWith(currentUrl) != true) {
            loadKiosk()
        }
    }

    /**
     * Handle remote control key events.
     * Triple-press Menu to open settings.
     */
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            val now = System.currentTimeMillis()
            if (now - lastMenuPressTime > ADMIN_TAP_WINDOW_MS) {
                menuPressCount = 0
            }
            menuPressCount++
            lastMenuPressTime = now

            if (menuPressCount >= ADMIN_TAP_COUNT) {
                menuPressCount = 0
                openSetup()
                return true
            }
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    /**
     * Detect triple-tap in the top-right corner to open admin settings.
     * Works on Echo Show and other touch-enabled Fire TV devices.
     */
    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        if (event.action == MotionEvent.ACTION_DOWN) {
            val screenWidth = resources.displayMetrics.widthPixels
            val x = event.rawX.toInt()
            val y = event.rawY.toInt()

            // Check if tap is in the top-right admin zone
            if (x >= screenWidth - adminZoneSizePx && y <= adminZoneSizePx) {
                val now = System.currentTimeMillis()
                adminTapTimestamps.add(now)

                // Remove taps older than the time window
                adminTapTimestamps.removeAll { now - it > ADMIN_TAP_WINDOW_MS }

                if (adminTapTimestamps.size >= ADMIN_TAP_COUNT) {
                    adminTapTimestamps.clear()
                    openSetup()
                    return true
                }
            } else {
                adminTapTimestamps.clear()
            }
        }
        return super.dispatchTouchEvent(event)
    }

    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                )
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUI()
        }
    }

    companion object {
        const val PREFS_NAME = "openframe_firetv"
        const val PREF_KIOSK_URL = "kiosk_url"
        const val PREF_KIOSK_TOKEN = "kiosk_token"

        // Admin access: top-right corner, 80dp square, 3 taps/presses within 2 seconds
        private const val ADMIN_ZONE_SIZE_DP = 80f
        private const val ADMIN_TAP_COUNT = 3
        private const val ADMIN_TAP_WINDOW_MS = 2000L
    }
}
