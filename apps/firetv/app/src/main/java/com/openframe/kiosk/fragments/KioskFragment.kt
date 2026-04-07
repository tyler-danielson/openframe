package com.openframe.kiosk.fragments

import android.annotation.SuppressLint
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.webkit.*
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.openframe.kiosk.AppState
import com.openframe.kiosk.HttpHelper
import com.openframe.kiosk.KeyEventHandler
import com.openframe.kiosk.MainActivity
import com.openframe.kiosk.R
import kotlinx.coroutines.launch

class KioskFragment : Fragment(), KeyEventHandler {

    private lateinit var webView: WebView
    private lateinit var loadingOverlay: View
    private lateinit var errorOverlay: View
    private lateinit var tvErrorMsg: TextView
    private lateinit var settingsOverlay: LinearLayout

    private var retryCount = 0
    private val maxRetries = 3
    private var lastBackPress = 0L
    private var settingsVisible = false

    private val mainHandler = Handler(Looper.getMainLooper())
    private var loadTimeoutRunnable: Runnable? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View? = inflater.inflate(R.layout.fragment_kiosk, container, false)

    @SuppressLint("SetJavaScriptEnabled")
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val activity = requireActivity() as MainActivity

        webView         = view.findViewById(R.id.webview)
        loadingOverlay  = view.findViewById(R.id.loading_overlay)
        errorOverlay    = view.findViewById(R.id.error_overlay)
        tvErrorMsg      = view.findViewById(R.id.tv_error_msg)
        settingsOverlay = view.findViewById(R.id.settings_overlay)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            @Suppress("DEPRECATION")
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            loadsImagesAutomatically = true
            setSupportMultipleWindows(false)
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(wv: WebView?, url: String?) {
                clearLoadTimeout()
                loadingOverlay.visibility = View.GONE
                errorOverlay.visibility   = View.GONE
                retryCount = 0
            }

            override fun onReceivedError(
                wv: WebView?, request: WebResourceRequest?, error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    clearLoadTimeout()
                    handleLoadError("Connection error: ${error?.description}")
                }
            }
        }

        // Settings overlay buttons
        view.findViewById<Button>(R.id.btn_retry).setOnClickListener {
            hideSettings()
            startLoad()
        }
        view.findViewById<Button>(R.id.btn_change_url).setOnClickListener {
            hideSettings()
            activity.navigateTo(AppState.SETUP)
        }
        view.findViewById<Button>(R.id.btn_close_settings).setOnClickListener {
            hideSettings()
        }

        // Show server info in settings
        view.findViewById<TextView>(R.id.tv_settings_server).text =
            "Server: ${activity.storage.serverUrl}"

        startLoad()
    }

    private fun startLoad() {
        val activity   = requireActivity() as MainActivity
        val serverUrl  = activity.storage.serverUrl  ?: return
        val kioskToken = activity.storage.kioskToken ?: return

        retryCount = 0
        loadingOverlay.visibility = View.VISIBLE
        errorOverlay.visibility   = View.GONE

        lifecycleScope.launch {
            val healthy = HttpHelper.healthCheck(serverUrl)
            if (!isAdded) return@launch
            if (healthy) {
                webView.loadUrl("$serverUrl/kiosk/$kioskToken")
                startLoadTimeout()
            } else {
                handleLoadError("Cannot reach server:\n$serverUrl")
            }
        }
    }

    private fun startLoadTimeout() {
        clearLoadTimeout()
        loadTimeoutRunnable = Runnable {
            if (isAdded) handleLoadError("Page load timed out")
        }
        mainHandler.postDelayed(loadTimeoutRunnable!!, 20_000)
    }

    private fun clearLoadTimeout() {
        loadTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        loadTimeoutRunnable = null
    }

    private fun handleLoadError(msg: String) {
        if (!isAdded) return
        retryCount++
        errorOverlay.visibility   = View.VISIBLE
        loadingOverlay.visibility = View.GONE
        if (retryCount < maxRetries) {
            tvErrorMsg.text = "$msg\n\nRetrying in 5s… (attempt $retryCount/$maxRetries)"
            mainHandler.postDelayed({ if (isAdded) startLoad() }, 5_000)
        } else {
            tvErrorMsg.text = "$msg\n\nAll retries failed."
            showSettings()
        }
    }

    private fun showSettings() {
        settingsVisible = true
        settingsOverlay.visibility = View.VISIBLE
    }

    private fun hideSettings() {
        settingsVisible = false
        settingsOverlay.visibility = View.GONE
    }

    private fun jsPostMessage(page: String) {
        webView.evaluateJavascript(
            "window.postMessage({type:'navigate',page:'$page'},'*')", null
        )
    }

    override fun handleKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        val activity = requireActivity() as MainActivity

        // Settings overlay open — intercept all nav keys
        if (settingsVisible) {
            if (keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_MENU) {
                hideSettings()
                return true
            }
            return false
        }

        return when (keyCode) {
            KeyEvent.KEYCODE_MENU -> {
                showSettings()
                true
            }

            KeyEvent.KEYCODE_BACK -> {
                val now = System.currentTimeMillis()
                if (now - lastBackPress < 2_000) {
                    activity.navigateTo(AppState.SETUP)
                } else {
                    lastBackPress = now
                    jsPostMessage("action:back")
                    Toast.makeText(activity, "Press Back again for Settings", Toast.LENGTH_SHORT).show()
                }
                true
            }

            KeyEvent.KEYCODE_DPAD_UP    -> { webView.evaluateJavascript("window.scrollBy(0,-200)", null); true }
            KeyEvent.KEYCODE_DPAD_DOWN  -> { webView.evaluateJavascript("window.scrollBy(0,200)", null);  true }
            KeyEvent.KEYCODE_DPAD_LEFT  -> { jsPostMessage("scroll:left");   true }
            KeyEvent.KEYCODE_DPAD_RIGHT -> { jsPostMessage("scroll:right");  true }

            KeyEvent.KEYCODE_DPAD_CENTER,
            KeyEvent.KEYCODE_ENTER -> { jsPostMessage("action:select"); true }

            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> { webView.reload(); true }

            KeyEvent.KEYCODE_CHANNEL_UP   -> { jsPostMessage("next"); true }
            KeyEvent.KEYCODE_CHANNEL_DOWN -> { jsPostMessage("prev"); true }

            // Number keys: 0=home, 1=calendar, 2=dashboard, 3=ha, 4=photos,
            //              5=weather, 6=tasks, 7=notes, 8=media, 9=screensaver
            in KeyEvent.KEYCODE_0..KeyEvent.KEYCODE_9 -> {
                val pages = listOf(
                    "home", "calendar", "dashboard", "ha",
                    "photos", "weather", "tasks", "notes", "media", "screensaver"
                )
                val page = pages.getOrElse(keyCode - KeyEvent.KEYCODE_0) { "home" }
                jsPostMessage(page)
                true
            }

            else -> false
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        clearLoadTimeout()
        webView.destroy()
    }
}
