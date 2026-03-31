package com.openframe.createboard

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
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

    // Track 3-finger long-press to open setup
    private var threeFingerDownTime = 0L
    private val handler = Handler(Looper.getMainLooper())
    private val threeFingerRunnable = Runnable { openSetup() }

    // Periodic cache clearing to prevent memory buildup
    private val memoryClearRunnable = object : Runnable {
        override fun run() {
            try {
                webView.clearCache(false) // clear disk cache, keep memory cache
                Log.d(TAG, "Periodic cache clear completed")
            } catch (e: Exception) {
                Log.e(TAG, "Cache clear failed", e)
            }
            handler.postDelayed(this, CACHE_CLEAR_INTERVAL_MS)
        }
    }

    // Watchdog: reload if page becomes unresponsive
    private var lastPageLoadTime = 0L
    private val watchdogRunnable = object : Runnable {
        override fun run() {
            val now = System.currentTimeMillis()
            // If the page loaded more than 6 hours ago, do a fresh reload to reclaim memory
            if (lastPageLoadTime > 0 && (now - lastPageLoadTime) > PAGE_REFRESH_INTERVAL_MS) {
                Log.w(TAG, "Watchdog: refreshing page after ${(now - lastPageLoadTime) / 1000 / 60} minutes to reclaim memory")
                webView.clearCache(true)
                loadKiosk()
            }
            handler.postDelayed(this, WATCHDOG_INTERVAL_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep screen on
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        setContentView(R.layout.activity_kiosk)

        // Hide system UI for fullscreen kiosk mode
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
                } else {
                    openSetup()
                }
            }
        })

        loadKiosk()

        // Start periodic maintenance
        handler.postDelayed(memoryClearRunnable, CACHE_CLEAR_INTERVAL_MS)
        handler.postDelayed(watchdogRunnable, WATCHDOG_INTERVAL_MS)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        // Enable hardware acceleration for WebGL (needed for maps)
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            useWideViewPort = true
            loadWithOverviewMode = true
            cacheMode = WebSettings.LOAD_DEFAULT

            // Enable touch zoom controls
            builtInZoomControls = false
            displayZoomControls = false

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = false
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar.visibility = View.GONE
                errorView.visibility = View.GONE
                webView.visibility = View.VISIBLE
                lastPageLoadTime = System.currentTimeMillis()
                Log.d(TAG, "Page loaded: $url")
            }

            override fun onReceivedError(
                view: WebView?,
                errorCode: Int,
                description: String?,
                failingUrl: String?
            ) {
                Log.e(TAG, "WebView error ($errorCode): $description for $failingUrl")
                showError("Connection Error: $description")
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                // Only show error for main frame failures
                if (request?.isForMainFrame == true) {
                    val desc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        error?.description?.toString() ?: "Unknown error"
                    } else {
                        "Unknown error"
                    }
                    Log.e(TAG, "WebView main frame error: $desc for ${request.url}")
                    showError("Connection Error: $desc")
                }
            }

            override fun onRenderProcessGone(
                view: WebView?,
                detail: android.webkit.RenderProcessGoneDetail?
            ): Boolean {
                val didCrash = detail?.didCrash() ?: true
                Log.e(TAG, "Render process gone! didCrash=$didCrash")

                // Remove crashed WebView
                container.removeView(webView)

                // Recreate WebView
                webView = WebView(this@KioskActivity).apply {
                    layoutParams = FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    )
                }
                container.addView(webView, 0)

                // Re-setup and reload
                setupWebView()
                handler.postDelayed({
                    loadKiosk()
                }, 2000) // Brief delay before reloading

                return true // We handled it
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
            }

            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                consoleMessage?.let {
                    when (it.messageLevel()) {
                        ConsoleMessage.MessageLevel.ERROR ->
                            Log.e(TAG, "JS: ${it.message()} [${it.sourceId()}:${it.lineNumber()}]")
                        else -> {}
                    }
                }
                return true
            }
        }

        // Always enable remote debugging for kiosk diagnostics
        WebView.setWebContentsDebuggingEnabled(true)
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
        errorView.text = "$message\n\nTap with 3 fingers to open settings"

        // Auto-retry after 30 seconds
        handler.postDelayed({
            if (errorView.visibility == View.VISIBLE) {
                Log.d(TAG, "Auto-retrying after error...")
                loadKiosk()
            }
        }, 30_000)
    }

    private fun openSetup() {
        val intent = Intent(this, SetupActivity::class.java)
        startActivity(intent)
    }

    override fun onResume() {
        super.onResume()
        hideSystemUI()

        // Check if URL was updated in setup
        val currentUrl = prefs.getString(PREF_KIOSK_URL, null)
        if (currentUrl != null && webView.url?.startsWith(currentUrl) != true) {
            loadKiosk()
        }
    }

    // 3-finger long-press gesture to open setup (hold for 2 seconds)
    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        when (ev.actionMasked) {
            MotionEvent.ACTION_POINTER_DOWN -> {
                if (ev.pointerCount >= 3) {
                    threeFingerDownTime = System.currentTimeMillis()
                    handler.postDelayed(threeFingerRunnable, 2000)
                }
            }
            MotionEvent.ACTION_POINTER_UP, MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (ev.pointerCount <= 3) {
                    handler.removeCallbacks(threeFingerRunnable)
                }
            }
        }
        return super.dispatchTouchEvent(ev)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        when (keyCode) {
            KeyEvent.KEYCODE_MENU,
            KeyEvent.KEYCODE_SETTINGS -> {
                openSetup()
                return true
            }
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> {
                webView.reload()
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
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

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(threeFingerRunnable)
        handler.removeCallbacks(memoryClearRunnable)
        handler.removeCallbacks(watchdogRunnable)
        webView.destroy()
    }

    companion object {
        private const val TAG = "OpenFrameKiosk"
        const val PREFS_NAME = "openframe_createboard"
        const val PREF_KIOSK_URL = "kiosk_url"
        const val PREF_KIOSK_TOKEN = "kiosk_token"

        // Clear disk cache every 30 minutes
        private const val CACHE_CLEAR_INTERVAL_MS = 30 * 60 * 1000L
        // Check if page needs refresh every 5 minutes
        private const val WATCHDOG_INTERVAL_MS = 5 * 60 * 1000L
        // Force page refresh every 6 hours to reclaim memory
        private const val PAGE_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000L
    }
}
