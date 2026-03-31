package com.openframe.createboard

import android.content.Context
import android.graphics.Bitmap
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import android.widget.ViewFlipper
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class SetupActivity : AppCompatActivity() {

    companion object {
        private const val STEP_CLOUD_QR = 0
        private const val STEP_MANUAL = 1
        private const val CLOUD_BASE_URL = "https://openframe.us"
        private const val POLL_INTERVAL_MS = 3000L
        private const val CODE_TTL_SECONDS = 15 * 60 // 15 minutes
    }

    // Views - Step 0 (Cloud QR)
    private lateinit var viewFlipper: ViewFlipper
    private lateinit var instructionsText: TextView
    private lateinit var statusText: TextView
    private lateinit var qrContainer: FrameLayout
    private lateinit var qrCodeImage: ImageView
    private lateinit var qrLoading: ProgressBar
    private lateinit var timerText: TextView
    private lateinit var stepInstructions: TextView
    private lateinit var retryButton: Button
    private lateinit var manualSetupLink: TextView

    // Views - Step 1 (Manual)
    private lateinit var manualServerUrlInput: EditText
    private lateinit var kioskTokenInput: EditText
    private lateinit var saveManualButton: Button
    private lateinit var backToQrLink: TextView

    // State
    private val prefs by lazy {
        getSharedPreferences(KioskActivity.PREFS_NAME, Context.MODE_PRIVATE)
    }
    private val handler = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()

    private var setupCode = ""
    private var secondsRemaining = 0
    private var polling = false
    private var qrBitmap: Bitmap? = null

    private val countdownRunnable = object : Runnable {
        override fun run() {
            secondsRemaining--
            if (secondsRemaining <= 0) {
                showExpired()
                return
            }
            updateTimerDisplay()
            handler.postDelayed(this, 1000)
        }
    }

    private val pollRunnable = object : Runnable {
        override fun run() {
            if (!polling) return
            pollCloudSetup()
            handler.postDelayed(this, POLL_INTERVAL_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        bindViews()
        setupListeners()

        // Start cloud QR flow immediately
        showStep(STEP_CLOUD_QR)
        startCloudSetup()
    }

    private fun bindViews() {
        viewFlipper = findViewById(R.id.viewFlipper)
        instructionsText = findViewById(R.id.instructionsText)

        // Cloud QR step
        statusText = findViewById(R.id.statusText)
        qrContainer = findViewById(R.id.qrContainer)
        qrCodeImage = findViewById(R.id.qrCodeImage)
        qrLoading = findViewById(R.id.qrLoading)
        timerText = findViewById(R.id.timerText)
        stepInstructions = findViewById(R.id.stepInstructions)
        retryButton = findViewById(R.id.retryButton)
        manualSetupLink = findViewById(R.id.manualSetupLink)

        // Manual step
        manualServerUrlInput = findViewById(R.id.manualServerUrlInput)
        kioskTokenInput = findViewById(R.id.kioskTokenInput)
        saveManualButton = findViewById(R.id.saveManualButton)
        backToQrLink = findViewById(R.id.backToQrLink)
    }

    private fun setupListeners() {
        retryButton.setOnClickListener { startCloudSetup() }
        manualSetupLink.setOnClickListener {
            stopPolling()
            showStep(STEP_MANUAL)
        }

        saveManualButton.setOnClickListener { saveManualSettings() }
        kioskTokenInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                saveManualSettings()
                true
            } else false
        }
        backToQrLink.setOnClickListener {
            showStep(STEP_CLOUD_QR)
            startCloudSetup()
        }
    }

    private fun showStep(step: Int) {
        viewFlipper.displayedChild = step
        updateInstructions(step)
    }

    private fun updateInstructions(step: Int) {
        instructionsText.text = when (step) {
            STEP_CLOUD_QR -> """
                OpenFrame CreateBoard Setup

                1. Scan the QR code with your phone

                2. Enter your OpenFrame server URL or select your server

                3. Choose a kiosk to display

                The display will connect automatically once setup is complete.
            """.trimIndent()
            STEP_MANUAL -> """
                Manual Setup

                1. Open your OpenFrame web app
                2. Go to Settings > Kiosks
                3. Copy the server URL and kiosk token
                4. Paste them here

                Tip: Touch the screen with 3 fingers for 2 seconds to return to setup from kiosk mode.
            """.trimIndent()
            else -> ""
        }
    }

    // ── Cloud QR Setup ──────────────────────────────────────────────

    private fun startCloudSetup() {
        // Generate a unique code
        setupCode = java.util.UUID.randomUUID().toString()
        secondsRemaining = CODE_TTL_SECONDS

        // Generate QR pointing to cloud setup page
        val qrUrl = "$CLOUD_BASE_URL/tv-setup/$setupCode"

        statusText.text = "Scan to set up your display"
        statusText.setTextColor(getColor(R.color.text_primary))

        qrLoading.visibility = View.GONE
        qrContainer.visibility = View.VISIBLE
        retryButton.visibility = View.GONE

        // Generate QR code off-thread
        executor.execute {
            val bitmap = QRCodeGenerator.generate(qrUrl)
            handler.post {
                qrBitmap?.recycle()
                qrBitmap = bitmap
                qrCodeImage.visibility = View.VISIBLE
                qrCodeImage.setImageBitmap(bitmap)
            }
        }

        timerText.visibility = View.VISIBLE
        updateTimerDisplay()

        stepInstructions.visibility = View.VISIBLE
        stepInstructions.text = "Or visit $CLOUD_BASE_URL/tv-setup/$setupCode"

        // Start countdown
        handler.removeCallbacks(countdownRunnable)
        handler.postDelayed(countdownRunnable, 1000)

        // First poll registers the code on the cloud, then keep polling
        startPolling()
    }

    private fun pollCloudSetup() {
        executor.execute {
            try {
                val url = URL("$CLOUD_BASE_URL/api/tv-setup?code=$setupCode")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.connectTimeout = 10000
                conn.readTimeout = 10000

                val responseCode = conn.responseCode
                if (responseCode == 200) {
                    val reader = BufferedReader(InputStreamReader(conn.inputStream))
                    val body = reader.readText()
                    reader.close()

                    val json = JSONObject(body)
                    val status = json.getString("status")

                    if (status == "completed") {
                        val serverUrl = json.getString("serverUrl")
                        val kioskToken = json.optString("kioskToken", "")
                        handler.post { onCloudSetupCompleted(serverUrl, kioskToken) }
                    }
                    // "pending" — keep polling
                }
                conn.disconnect()
            } catch (_: Exception) {
                // Silent failure — will retry on next poll
            }
        }
    }

    private fun onCloudSetupCompleted(serverUrl: String, kioskToken: String) {
        stopPolling()
        handler.removeCallbacks(countdownRunnable)

        statusText.text = "Setup Complete!"
        statusText.setTextColor(getColor(R.color.success))
        qrCodeImage.visibility = View.GONE
        qrContainer.visibility = View.GONE
        timerText.visibility = View.GONE
        stepInstructions.visibility = View.VISIBLE
        stepInstructions.text = "Connecting to $serverUrl..."
        stepInstructions.setTextColor(getColor(R.color.text_secondary))
        retryButton.visibility = View.GONE
        manualSetupLink.visibility = View.GONE

        // Save settings
        prefs.edit()
            .putString(KioskActivity.PREF_KIOSK_URL, serverUrl)
            .putString(KioskActivity.PREF_KIOSK_TOKEN, kioskToken)
            .apply()

        handler.postDelayed({
            finish()
        }, 1500)
    }

    private fun showExpired() {
        stopPolling()
        handler.removeCallbacks(countdownRunnable)

        statusText.text = "Code Expired"
        statusText.setTextColor(getColor(R.color.warning))
        qrCodeImage.visibility = View.GONE
        timerText.visibility = View.GONE
        stepInstructions.visibility = View.VISIBLE
        stepInstructions.text = "The setup code has expired.\nGenerate a new one to continue."
        retryButton.visibility = View.VISIBLE
        retryButton.text = "Generate New Code"
    }

    private fun updateTimerDisplay() {
        val min = secondsRemaining / 60
        val sec = secondsRemaining % 60
        timerText.text = "Expires in ${min}:%02d".format(sec)

        if (secondsRemaining < 60) {
            timerText.setTextColor(getColor(R.color.warning))
        } else {
            timerText.setTextColor(getColor(R.color.text_secondary))
        }
    }

    private fun startPolling() {
        polling = true
        handler.postDelayed(pollRunnable, POLL_INTERVAL_MS)
    }

    private fun stopPolling() {
        polling = false
        handler.removeCallbacks(pollRunnable)
    }

    // ── Manual Setup ────────────────────────────────────────────────

    private fun saveManualSettings() {
        val rawUrl = manualServerUrlInput.text.toString().trim()
        if (rawUrl.isBlank()) {
            Toast.makeText(this, "Please enter a server URL", Toast.LENGTH_SHORT).show()
            manualServerUrlInput.requestFocus()
            return
        }

        val token = kioskTokenInput.text.toString().trim()

        prefs.edit()
            .putString(KioskActivity.PREF_KIOSK_URL, cleanUrl(rawUrl))
            .putString(KioskActivity.PREF_KIOSK_TOKEN, token)
            .apply()

        Toast.makeText(this, "Settings saved", Toast.LENGTH_SHORT).show()
        finish()
    }

    private fun cleanUrl(raw: String): String {
        var url = raw
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://$url"
        }
        return url.trimEnd('/')
    }

    // ── Lifecycle ───────────────────────────────────────────────────

    override fun onDestroy() {
        super.onDestroy()
        stopPolling()
        handler.removeCallbacks(countdownRunnable)
        qrBitmap?.recycle()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            when (viewFlipper.displayedChild) {
                STEP_MANUAL -> {
                    showStep(STEP_CLOUD_QR)
                    startCloudSetup()
                    return true
                }
                STEP_CLOUD_QR -> {
                    val hasUrl = !prefs.getString(KioskActivity.PREF_KIOSK_URL, null).isNullOrBlank()
                    if (!hasUrl) {
                        Toast.makeText(this, "Please complete setup first", Toast.LENGTH_SHORT).show()
                        return true
                    }
                }
            }
        }
        return super.onKeyDown(keyCode, event)
    }
}
