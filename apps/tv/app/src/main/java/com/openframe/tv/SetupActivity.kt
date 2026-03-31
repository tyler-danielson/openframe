package com.openframe.tv

import android.content.Context
import android.graphics.Bitmap
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import android.widget.ViewFlipper
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.Executors

class SetupActivity : AppCompatActivity() {

    companion object {
        private const val STEP_CLOUD = 0
        private const val STEP_URL = 1
        private const val STEP_QR = 2
        private const val STEP_MANUAL = 3
        private const val POLL_INTERVAL_MS = 5000L
        private const val CLOUD_URL = "https://openframe.us"
        private const val CLOUD_POLL_INTERVAL_MS = 3000L
        private const val CLOUD_TTL_SECONDS = 15 * 60 // 15 minutes
    }

    // Views — Step 0 (Cloud QR)
    private lateinit var cloudStatusText: TextView
    private lateinit var cloudQrContainer: FrameLayout
    private lateinit var cloudQrCodeImage: ImageView
    private lateinit var cloudCodeText: TextView
    private lateinit var cloudTimerText: TextView
    private lateinit var cloudRetryButton: Button
    private lateinit var enterUrlLink: TextView

    // Views — Step 1
    private lateinit var viewFlipper: ViewFlipper
    private lateinit var instructionsText: TextView
    private lateinit var serverUrlInput: EditText
    private lateinit var connectButton: Button
    private lateinit var manualSetupLink: TextView

    // Views — Step 2 (QR)
    private lateinit var statusText: TextView
    private lateinit var qrContainer: FrameLayout
    private lateinit var qrCodeImage: ImageView
    private lateinit var qrLoading: ProgressBar
    private lateinit var userCodeText: TextView
    private lateinit var timerText: TextView
    private lateinit var stepInstructions: TextView
    private lateinit var retryButton: Button
    private lateinit var backToUrlLink: TextView

    // Views — Step 3 (Manual)
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

    private var serverUrl = ""
    private var deviceCode = ""
    private var secondsRemaining = 0
    private var polling = false
    private var qrBitmap: Bitmap? = null

    // Cloud QR state
    private var cloudCode = ""
    private var cloudQrBitmap: Bitmap? = null
    private var cloudSecondsRemaining = 0
    private var cloudPolling = false

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
            pollDeviceCode()
            handler.postDelayed(this, POLL_INTERVAL_MS)
        }
    }

    private val cloudCountdownRunnable = object : Runnable {
        override fun run() {
            cloudSecondsRemaining--
            if (cloudSecondsRemaining <= 0) {
                showCloudExpired()
                return
            }
            updateCloudTimerDisplay()
            handler.postDelayed(this, 1000)
        }
    }

    private val cloudPollRunnable = object : Runnable {
        override fun run() {
            if (!cloudPolling) return
            pollCloudSetup()
            handler.postDelayed(this, CLOUD_POLL_INTERVAL_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        bindViews()
        setupListeners()

        // Pre-fill URL from prefs
        val existingUrl = prefs.getString(KioskActivity.PREF_KIOSK_URL, "") ?: ""
        serverUrlInput.setText(existingUrl)
        manualServerUrlInput.setText(existingUrl)

        // Start with cloud QR code
        updateInstructions(STEP_CLOUD)
        startCloudSetup()
    }

    private fun bindViews() {
        viewFlipper = findViewById(R.id.viewFlipper)
        instructionsText = findViewById(R.id.instructionsText)

        // Step 0 (Cloud)
        cloudStatusText = findViewById(R.id.cloudStatusText)
        cloudQrContainer = findViewById(R.id.cloudQrContainer)
        cloudQrCodeImage = findViewById(R.id.cloudQrCodeImage)
        cloudCodeText = findViewById(R.id.cloudCodeText)
        cloudTimerText = findViewById(R.id.cloudTimerText)
        cloudRetryButton = findViewById(R.id.cloudRetryButton)
        enterUrlLink = findViewById(R.id.enterUrlLink)

        // Step 1
        serverUrlInput = findViewById(R.id.serverUrlInput)
        connectButton = findViewById(R.id.connectButton)
        manualSetupLink = findViewById(R.id.manualSetupLink)

        // Step 2
        statusText = findViewById(R.id.statusText)
        qrContainer = findViewById(R.id.qrContainer)
        qrCodeImage = findViewById(R.id.qrCodeImage)
        qrLoading = findViewById(R.id.qrLoading)
        userCodeText = findViewById(R.id.userCodeText)
        timerText = findViewById(R.id.timerText)
        stepInstructions = findViewById(R.id.stepInstructions)
        retryButton = findViewById(R.id.retryButton)
        backToUrlLink = findViewById(R.id.backToUrlLink)

        // Step 3
        manualServerUrlInput = findViewById(R.id.manualServerUrlInput)
        kioskTokenInput = findViewById(R.id.kioskTokenInput)
        saveManualButton = findViewById(R.id.saveManualButton)
        backToQrLink = findViewById(R.id.backToQrLink)
    }

    private fun setupListeners() {
        // Step 0: Cloud
        enterUrlLink.setOnClickListener {
            stopCloudPolling()
            showStep(STEP_URL)
        }
        cloudRetryButton.setOnClickListener { startCloudSetup() }

        // Step 1: Connect
        connectButton.setOnClickListener { onConnectClicked() }
        serverUrlInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                onConnectClicked()
                true
            } else false
        }
        manualSetupLink.setOnClickListener { showStep(STEP_MANUAL) }

        // Step 2: QR
        retryButton.setOnClickListener { requestDeviceCode() }
        backToUrlLink.setOnClickListener {
            stopPolling()
            showStep(STEP_URL)
        }

        // Step 3: Manual
        saveManualButton.setOnClickListener { saveManualSettings() }
        kioskTokenInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                saveManualSettings()
                true
            } else false
        }
        backToQrLink.setOnClickListener { showStep(STEP_URL) }
    }

    // ── Navigation ──────────────────────────────────────────────

    private fun showStep(step: Int) {
        viewFlipper.displayedChild = step
        updateInstructions(step)

        // Sync URL between the two input fields
        if (step == STEP_MANUAL) {
            manualServerUrlInput.setText(serverUrlInput.text.toString())
        } else if (step == STEP_URL) {
            val manualUrl = manualServerUrlInput.text.toString()
            if (manualUrl.isNotBlank()) {
                serverUrlInput.setText(manualUrl)
            }
        }
    }

    private fun updateInstructions(step: Int) {
        instructionsText.text = when (step) {
            STEP_CLOUD -> """
                OpenFrame TV Setup

                Scan the QR code with your phone to pair this TV with your OpenFrame account.

                1. Scan the QR code with your phone's camera
                2. Select your OpenFrame server
                3. Choose a kiosk to assign

                The TV will connect automatically once paired.
            """.trimIndent()
            STEP_QR -> """
                QR Code Pairing

                1. Scan the QR code with your phone's camera

                2. Log in to your OpenFrame account

                3. Name this kiosk and approve

                The TV will connect automatically once approved.

                You can also enter the code manually at the URL shown on screen.
            """.trimIndent()
            STEP_MANUAL -> """
                Manual Setup

                1. Open your OpenFrame web app
                2. Go to Settings → Kiosks
                3. Copy the kiosk token
                4. Paste it here

                Remote Controls:
                • Menu/Settings: Open this setup
                • Play/Pause: Refresh the display
                • Back: Go back / Open setup
            """.trimIndent()
            else -> """
                Server URL Setup

                Enter your OpenFrame server URL, then pair via QR code.

                Remote Controls:
                • Menu/Settings: Open this setup
                • Play/Pause: Refresh the display
                • Back: Go back / Open setup
            """.trimIndent()
        }
    }

    // ── Step 0: Cloud Setup ─────────────────────────────────────

    private fun startCloudSetup() {
        cloudCode = UUID.randomUUID().toString()
        cloudSecondsRemaining = CLOUD_TTL_SECONDS

        // Generate QR code pointing to cloud setup URL
        val qrUrl = "$CLOUD_URL/tv-setup/$cloudCode"
        executor.execute {
            val bitmap = QRCodeGenerator.generate(qrUrl)
            handler.post {
                cloudQrBitmap?.recycle()
                cloudQrBitmap = bitmap
                cloudQrCodeImage.setImageBitmap(bitmap)

                // Show short code (first 8 chars)
                cloudCodeText.text = cloudCode.substring(0, 8).uppercase()
                cloudCodeText.visibility = View.VISIBLE

                cloudStatusText.text = "Scan with your phone to pair"
                cloudStatusText.setTextColor(getColor(R.color.text_secondary))
                cloudTimerText.visibility = View.VISIBLE
                cloudRetryButton.visibility = View.GONE
                updateCloudTimerDisplay()

                // Start countdown and polling
                handler.removeCallbacks(cloudCountdownRunnable)
                handler.postDelayed(cloudCountdownRunnable, 1000)
                startCloudPolling()
            }
        }
    }

    private fun startCloudPolling() {
        cloudPolling = true
        handler.postDelayed(cloudPollRunnable, CLOUD_POLL_INTERVAL_MS)
    }

    private fun stopCloudPolling() {
        cloudPolling = false
        handler.removeCallbacks(cloudPollRunnable)
        handler.removeCallbacks(cloudCountdownRunnable)
    }

    private fun pollCloudSetup() {
        executor.execute {
            try {
                val url = URL("$CLOUD_URL/api/tv-setup?code=$cloudCode")
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
                    val status = json.optString("status", "pending")

                    if (status == "completed") {
                        val receivedServerUrl = json.getString("serverUrl")
                        val kioskToken = json.optString("kioskToken", "")
                        handler.post { onCloudApproved(receivedServerUrl, kioskToken) }
                    }
                    // "pending" — keep polling
                }
                conn.disconnect()
            } catch (_: Exception) {
                // Silent failure — will retry on next poll
            }
        }
    }

    private fun onCloudApproved(receivedServerUrl: String, kioskToken: String) {
        stopCloudPolling()

        cloudStatusText.text = "Device Paired!"
        cloudStatusText.setTextColor(getColor(R.color.success))
        cloudCodeText.visibility = View.GONE
        cloudTimerText.visibility = View.GONE
        cloudRetryButton.visibility = View.GONE
        enterUrlLink.visibility = View.GONE

        // Save to prefs
        prefs.edit()
            .putString(KioskActivity.PREF_KIOSK_URL, receivedServerUrl)
            .putString(KioskActivity.PREF_KIOSK_TOKEN, kioskToken)
            .apply()

        handler.postDelayed({ finish() }, 1500)
    }

    private fun showCloudExpired() {
        stopCloudPolling()
        cloudStatusText.text = "Code Expired"
        cloudStatusText.setTextColor(getColor(R.color.warning))
        cloudCodeText.visibility = View.GONE
        cloudTimerText.visibility = View.GONE
        cloudRetryButton.visibility = View.VISIBLE
        cloudRetryButton.requestFocus()
    }

    private fun updateCloudTimerDisplay() {
        val min = cloudSecondsRemaining / 60
        val sec = cloudSecondsRemaining % 60
        cloudTimerText.text = "Expires in ${min}:%02d".format(sec)
        if (cloudSecondsRemaining < 60) {
            cloudTimerText.setTextColor(getColor(R.color.warning))
        } else {
            cloudTimerText.setTextColor(getColor(R.color.text_secondary))
        }
    }

    // ── Step 1: Connect ─────────────────────────────────────────

    private fun onConnectClicked() {
        val rawUrl = serverUrlInput.text.toString().trim()
        if (rawUrl.isBlank()) {
            Toast.makeText(this, "Please enter a server URL", Toast.LENGTH_SHORT).show()
            serverUrlInput.requestFocus()
            return
        }

        serverUrl = cleanUrl(rawUrl)
        showStep(STEP_QR)
        requestDeviceCode()
    }

    // ── Step 2: Device Code Flow ────────────────────────────────

    private fun requestDeviceCode() {
        // Show loading state
        statusText.text = "Connecting..."
        qrCodeImage.visibility = View.GONE
        qrLoading.visibility = View.VISIBLE
        userCodeText.visibility = View.GONE
        timerText.visibility = View.GONE
        stepInstructions.visibility = View.GONE
        retryButton.visibility = View.GONE

        executor.execute {
            try {
                val url = URL("$serverUrl/api/v1/auth/device-code")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                conn.connectTimeout = 10000
                conn.readTimeout = 10000

                // Send empty JSON body
                val writer = OutputStreamWriter(conn.outputStream)
                writer.write("{}")
                writer.flush()
                writer.close()

                val responseCode = conn.responseCode
                if (responseCode == 200) {
                    val reader = BufferedReader(InputStreamReader(conn.inputStream))
                    val body = reader.readText()
                    reader.close()

                    val json = JSONObject(body)
                    val data = json.getJSONObject("data")
                    val newDeviceCode = data.getString("deviceCode")
                    val userCode = data.getString("userCode")
                    val verificationUrl = data.getString("verificationUrl")
                    val expiresIn = data.getInt("expiresIn")

                    // Generate QR bitmap off main thread
                    val bitmap = QRCodeGenerator.generate(verificationUrl)

                    handler.post {
                        onDeviceCodeReceived(newDeviceCode, userCode, verificationUrl, expiresIn, bitmap)
                    }
                } else {
                    val errorStream = conn.errorStream ?: conn.inputStream
                    val reader = BufferedReader(InputStreamReader(errorStream))
                    val body = reader.readText()
                    reader.close()
                    handler.post { onDeviceCodeError("Server returned $responseCode: $body") }
                }
                conn.disconnect()
            } catch (e: Exception) {
                handler.post { onDeviceCodeError("Connection failed: ${e.message}") }
            }
        }
    }

    private fun onDeviceCodeReceived(
        newDeviceCode: String,
        userCode: String,
        verificationUrl: String,
        expiresIn: Int,
        bitmap: Bitmap
    ) {
        deviceCode = newDeviceCode
        secondsRemaining = expiresIn
        qrBitmap = bitmap

        // Format user code as XXX-XXX
        val formatted = if (userCode.length == 6) {
            "${userCode.substring(0, 3)}-${userCode.substring(3)}"
        } else {
            userCode
        }

        statusText.text = "Scan to pair your device"
        statusText.setTextColor(getColor(R.color.text_primary))

        qrLoading.visibility = View.GONE
        qrCodeImage.visibility = View.VISIBLE
        qrCodeImage.setImageBitmap(bitmap)

        userCodeText.visibility = View.VISIBLE
        userCodeText.text = formatted

        timerText.visibility = View.VISIBLE
        updateTimerDisplay()

        stepInstructions.visibility = View.VISIBLE
        stepInstructions.text = "Or visit $verificationUrl\nand enter the code above"

        retryButton.visibility = View.GONE

        // Start countdown
        handler.removeCallbacks(countdownRunnable)
        handler.postDelayed(countdownRunnable, 1000)

        // Start polling
        startPolling()
    }

    private fun onDeviceCodeError(message: String) {
        statusText.text = "Connection Error"
        statusText.setTextColor(getColor(R.color.warning))
        qrLoading.visibility = View.GONE
        qrCodeImage.visibility = View.GONE
        userCodeText.visibility = View.GONE
        timerText.visibility = View.GONE
        stepInstructions.visibility = View.VISIBLE
        stepInstructions.text = message
        retryButton.visibility = View.VISIBLE
        retryButton.text = "Try Again"
        retryButton.requestFocus()
    }

    private fun showExpired() {
        stopPolling()
        handler.removeCallbacks(countdownRunnable)

        statusText.text = "Code Expired"
        statusText.setTextColor(getColor(R.color.warning))
        qrCodeImage.visibility = View.GONE
        userCodeText.visibility = View.GONE
        timerText.visibility = View.GONE
        stepInstructions.visibility = View.VISIBLE
        stepInstructions.text = "The pairing code has expired.\nGenerate a new one to continue."
        retryButton.visibility = View.VISIBLE
        retryButton.text = "Generate New Code"
        retryButton.requestFocus()
    }

    private fun showApproved() {
        stopPolling()
        handler.removeCallbacks(countdownRunnable)

        statusText.text = "Device Approved!"
        statusText.setTextColor(getColor(R.color.success))
        qrCodeImage.visibility = View.GONE
        qrContainer.visibility = View.GONE
        userCodeText.visibility = View.GONE
        timerText.visibility = View.GONE
        stepInstructions.visibility = View.VISIBLE
        stepInstructions.text = "Connecting to your kiosk..."
        stepInstructions.setTextColor(getColor(R.color.text_secondary))
        retryButton.visibility = View.GONE
        backToUrlLink.visibility = View.GONE
    }

    private fun updateTimerDisplay() {
        val min = secondsRemaining / 60
        val sec = secondsRemaining % 60
        timerText.text = "Expires in ${min}:%02d".format(sec)

        // Change color when under 60 seconds
        if (secondsRemaining < 60) {
            timerText.setTextColor(getColor(R.color.warning))
        } else {
            timerText.setTextColor(getColor(R.color.text_secondary))
        }
    }

    // ── Polling ─────────────────────────────────────────────────

    private fun startPolling() {
        polling = true
        handler.postDelayed(pollRunnable, POLL_INTERVAL_MS)
    }

    private fun stopPolling() {
        polling = false
        handler.removeCallbacks(pollRunnable)
    }

    private fun pollDeviceCode() {
        executor.execute {
            try {
                val url = URL("$serverUrl/api/v1/auth/device-code/poll")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                conn.connectTimeout = 10000
                conn.readTimeout = 10000

                val writer = OutputStreamWriter(conn.outputStream)
                writer.write(JSONObject().put("deviceCode", deviceCode).toString())
                writer.flush()
                writer.close()

                val responseCode = conn.responseCode
                if (responseCode == 200) {
                    val reader = BufferedReader(InputStreamReader(conn.inputStream))
                    val body = reader.readText()
                    reader.close()

                    val json = JSONObject(body)
                    val data = json.getJSONObject("data")
                    val status = data.getString("status")

                    handler.post {
                        when (status) {
                            "approved" -> {
                                val kioskToken = data.optString("kioskToken", "")
                                onApproved(kioskToken)
                            }
                            "expired" -> showExpired()
                            "denied" -> {
                                onDeviceCodeError("Device pairing was denied.")
                            }
                            // "pending" — do nothing, keep polling
                        }
                    }
                }
                conn.disconnect()
            } catch (_: Exception) {
                // Silent failure — will retry on next poll
            }
        }
    }

    private fun onApproved(kioskToken: String) {
        showApproved()

        // Save to prefs
        prefs.edit()
            .putString(KioskActivity.PREF_KIOSK_URL, serverUrl)
            .putString(KioskActivity.PREF_KIOSK_TOKEN, kioskToken)
            .apply()

        // Short delay then finish to show success state
        handler.postDelayed({
            finish()
        }, 1500)
    }

    // ── Step 3: Manual Setup ────────────────────────────────────

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

    // ── Utilities ───────────────────────────────────────────────

    private fun cleanUrl(raw: String): String {
        var url = raw
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://$url"
        }
        return url.trimEnd('/')
    }

    // ── Lifecycle & Key Handling ─────────────────────────────────

    override fun onDestroy() {
        super.onDestroy()
        stopPolling()
        stopCloudPolling()
        handler.removeCallbacks(countdownRunnable)
        qrBitmap?.recycle()
        cloudQrBitmap?.recycle()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            when (viewFlipper.displayedChild) {
                STEP_CLOUD -> {
                    val hasUrl = !prefs.getString(KioskActivity.PREF_KIOSK_URL, null).isNullOrBlank()
                    if (hasUrl) {
                        stopCloudPolling()
                        finish()
                        return true
                    }
                    Toast.makeText(this, "Please pair this device first", Toast.LENGTH_SHORT).show()
                    return true
                }
                STEP_QR -> {
                    stopPolling()
                    handler.removeCallbacks(countdownRunnable)
                    showStep(STEP_URL)
                    return true
                }
                STEP_MANUAL -> {
                    showStep(STEP_URL)
                    return true
                }
                STEP_URL -> {
                    // Go back to cloud setup
                    showStep(STEP_CLOUD)
                    startCloudSetup()
                    return true
                }
            }
        }
        return super.onKeyDown(keyCode, event)
    }
}
