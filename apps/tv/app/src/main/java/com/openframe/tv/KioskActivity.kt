package com.openframe.tv

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep screen on
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Hide system UI for fullscreen kiosk mode
        hideSystemUI()

        setContentView(R.layout.activity_kiosk)

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
                    // Show setup on long-press back or double-back
                    openSetup()
                }
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

            // Enable hardware acceleration
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

        // Enable remote debugging in debug builds
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

        // Build the full kiosk URL
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
        errorView.text = "$message\n\nPress OK to open settings"
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

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        when (keyCode) {
            // Menu/Settings button opens setup
            KeyEvent.KEYCODE_MENU,
            KeyEvent.KEYCODE_SETTINGS -> {
                openSetup()
                return true
            }
            // Refresh on play/pause button
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> {
                webView.reload()
                return true
            }
            // D-pad navigation for scrolling
            KeyEvent.KEYCODE_DPAD_UP -> {
                webView.scrollBy(0, -100)
                return true
            }
            KeyEvent.KEYCODE_DPAD_DOWN -> {
                webView.scrollBy(0, 100)
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

    companion object {
        const val PREFS_NAME = "openframe_tv"
        const val PREF_KIOSK_URL = "kiosk_url"
        const val PREF_KIOSK_TOKEN = "kiosk_token"
    }
}
