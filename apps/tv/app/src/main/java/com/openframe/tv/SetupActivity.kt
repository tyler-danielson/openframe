package com.openframe.tv

import android.content.Context
import android.os.Bundle
import android.view.KeyEvent
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class SetupActivity : AppCompatActivity() {

    private lateinit var serverUrlInput: EditText
    private lateinit var kioskTokenInput: EditText
    private lateinit var saveButton: Button
    private lateinit var instructionsText: TextView

    private val prefs by lazy {
        getSharedPreferences(KioskActivity.PREFS_NAME, Context.MODE_PRIVATE)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        serverUrlInput = findViewById(R.id.serverUrlInput)
        kioskTokenInput = findViewById(R.id.kioskTokenInput)
        saveButton = findViewById(R.id.saveButton)
        instructionsText = findViewById(R.id.instructionsText)

        // Load existing values
        serverUrlInput.setText(prefs.getString(KioskActivity.PREF_KIOSK_URL, ""))
        kioskTokenInput.setText(prefs.getString(KioskActivity.PREF_KIOSK_TOKEN, ""))

        saveButton.setOnClickListener {
            saveSettings()
        }

        // Handle enter key on token input
        kioskTokenInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                saveSettings()
                true
            } else {
                false
            }
        }

        instructionsText.text = """
            OpenFrame TV Kiosk Setup

            1. Enter your OpenFrame server URL
               (e.g., https://openframe.example.com)

            2. Optionally enter a kiosk token
               (from Settings → Kiosks in web app)

            3. Press Save to start the kiosk

            Remote Controls:
            • Menu/Settings: Open this setup
            • Play/Pause: Refresh the display
            • Back: Go back / Open setup
        """.trimIndent()
    }

    private fun saveSettings() {
        val serverUrl = serverUrlInput.text.toString().trim()

        if (serverUrl.isBlank()) {
            Toast.makeText(this, "Please enter a server URL", Toast.LENGTH_SHORT).show()
            serverUrlInput.requestFocus()
            return
        }

        // Clean up URL
        var cleanUrl = serverUrl
        if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
            cleanUrl = "https://$cleanUrl"
        }
        cleanUrl = cleanUrl.trimEnd('/')

        val kioskToken = kioskTokenInput.text.toString().trim()

        prefs.edit()
            .putString(KioskActivity.PREF_KIOSK_URL, cleanUrl)
            .putString(KioskActivity.PREF_KIOSK_TOKEN, kioskToken)
            .apply()

        Toast.makeText(this, "Settings saved", Toast.LENGTH_SHORT).show()
        finish()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            // Only allow back if we have a URL configured
            val hasUrl = !prefs.getString(KioskActivity.PREF_KIOSK_URL, null).isNullOrBlank()
            if (!hasUrl) {
                Toast.makeText(this, "Please configure a server URL first", Toast.LENGTH_SHORT).show()
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }
}
