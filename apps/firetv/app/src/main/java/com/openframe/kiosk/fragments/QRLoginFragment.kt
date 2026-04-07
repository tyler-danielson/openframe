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
import org.json.JSONObject

class QRLoginFragment : Fragment(), KeyEventHandler {

    private var pollJob: Job? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View? = inflater.inflate(R.layout.fragment_qr_login, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val activity = requireActivity() as MainActivity

        val serverUrl = activity.storage.serverUrl?.trimEnd('/') ?: run {
            activity.navigateTo(AppState.SETUP)
            return
        }

        val ivQr       = view.findViewById<ImageView>(R.id.iv_qr_code)
        val tvUserCode = view.findViewById<TextView>(R.id.tv_user_code)
        val tvStatus   = view.findViewById<TextView>(R.id.tv_status)

        tvStatus.text = "Requesting device code…"

        pollJob = lifecycleScope.launch {
            val result = HttpHelper.post("$serverUrl/api/v1/auth/device-code")

            result.onFailure {
                tvStatus.text = "Failed to get device code. Press Back to return."
                return@launch
            }

            result.onSuccess { json ->
                val data         = json.optJSONObject("data") ?: json
                val deviceCode   = data.optString("deviceCode")
                val userCode     = data.optString("userCode")
                val verifyUrl    = data.optString("verificationUrl")
                val expiresIn    = data.optInt("expiresIn", 900)

                if (!isAdded) return@onSuccess

                tvUserCode.text = userCode
                tvStatus.text   = "Scan QR or visit:\n$verifyUrl"

                if (verifyUrl.isNotBlank()) {
                    val bitmap = QrCodeHelper.generate(verifyUrl)
                    if (isAdded) ivQr.setImageBitmap(bitmap)
                }

                // Poll for approval
                val startTime = System.currentTimeMillis()
                while (isActive && (System.currentTimeMillis() - startTime) < expiresIn * 1000L) {
                    delay(5_000)
                    val pollResult = HttpHelper.post(
                        "$serverUrl/api/v1/auth/device-code/poll",
                        JSONObject().put("deviceCode", deviceCode)
                    )
                    pollResult.onSuccess { pollJson ->
                        val pollData    = pollJson.optJSONObject("data") ?: pollJson
                        val kioskToken  = pollData.optString("kioskToken")
                        if (pollData.optString("status") == "approved" && kioskToken.isNotBlank()) {
                            activity.storage.kioskToken = kioskToken
                            activity.navigateTo(AppState.KIOSK)
                            return@launch
                        }
                    }
                }

                if (isAdded) tvStatus.text = "Code expired. Press Back to return."
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        pollJob?.cancel()
    }

    override fun handleKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            (requireActivity() as MainActivity).navigateTo(AppState.SETUP)
            return true
        }
        return false
    }
}
