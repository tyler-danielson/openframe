package com.openframe.kiosk.fragments

import android.os.Bundle
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.openframe.kiosk.*
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.UUID

class CloudSetupFragment : Fragment(), KeyEventHandler {

    private var pollJob: Job? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View? = inflater.inflate(R.layout.fragment_cloud_setup, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val activity = requireActivity() as MainActivity

        val ivQr     = view.findViewById<ImageView>(R.id.iv_qr_code)
        val tvStatus = view.findViewById<TextView>(R.id.tv_status)
        val tvUrl    = view.findViewById<TextView>(R.id.tv_url)

        // Stable UUID — persists across re-renders, cleared on success
        val code = activity.storage.cloudSetupCode ?: run {
            val newCode = UUID.randomUUID().toString()
            activity.storage.cloudSetupCode = newCode
            newCode
        }

        val qrUrl = "https://openframe.us/tv-setup/$code"
        tvUrl.text = "openframe.us/tv-setup"
        tvStatus.text = "Scan with your phone to set up this device"

        lifecycleScope.launch {
            val bitmap = QrCodeHelper.generate(qrUrl, 380)
            if (isAdded) ivQr.setImageBitmap(bitmap)
        }

        view.findViewById<View>(R.id.btn_manual_setup)?.setOnClickListener {
            activity.navigateTo(AppState.SETUP)
        }

        // Poll cloud API
        pollJob = lifecycleScope.launch {
            var elapsed = 0
            val timeout = 900 // 15 minutes

            while (isActive && elapsed < timeout) {
                delay(3_000)
                elapsed += 3

                val mins = (timeout - elapsed) / 60
                val secs = (timeout - elapsed) % 60
                tvStatus.text = "Waiting for pairing… ${mins}m ${secs}s remaining"

                val result = HttpHelper.get("https://openframe.us/api/tv-setup?code=$code")
                result.onSuccess { json ->
                    if (json.optString("status") == "completed") {
                        val serverUrl   = json.optString("serverUrl")
                        val kioskToken  = json.optString("kioskToken")
                        if (serverUrl.isNotBlank() && kioskToken.isNotBlank()) {
                            activity.storage.serverUrl      = serverUrl
                            activity.storage.kioskToken     = kioskToken
                            activity.storage.cloudSetupCode = null
                            activity.navigateTo(AppState.KIOSK)
                            return@launch
                        }
                    }
                }
            }

            tvStatus.text = "QR code expired. Press Back to configure manually."
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        pollJob?.cancel()
    }

    override fun handleKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        val activity = requireActivity() as MainActivity
        return when (keyCode) {
            KeyEvent.KEYCODE_BACK,
            KeyEvent.KEYCODE_DPAD_CENTER,
            KeyEvent.KEYCODE_ENTER -> {
                activity.navigateTo(AppState.SETUP)
                true
            }
            else -> false
        }
    }
}
