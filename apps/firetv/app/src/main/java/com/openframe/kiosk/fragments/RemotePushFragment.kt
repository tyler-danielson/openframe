package com.openframe.kiosk.fragments

import android.os.Bundle
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.openframe.kiosk.*
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject

class RemotePushFragment : Fragment(), KeyEventHandler {

    private var pollJob: Job? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View? = inflater.inflate(R.layout.fragment_remote_push, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val activity = requireActivity() as MainActivity

        val serverUrl = activity.storage.serverUrl?.trimEnd('/') ?: run {
            activity.navigateTo(AppState.SETUP)
            return
        }

        val tvStatus = view.findViewById<TextView>(R.id.tv_status)
        val tvRegId  = view.findViewById<TextView>(R.id.tv_registration_id)

        tvStatus.text = "Registering device…"

        pollJob = lifecycleScope.launch {
            val result = HttpHelper.post("$serverUrl/api/v1/auth/tv-connect/register")

            result.onFailure {
                tvStatus.text = "Registration failed. Press Back to return."
                return@launch
            }

            result.onSuccess { json ->
                val data           = json.optJSONObject("data") ?: json
                val registrationId = data.optString("registrationId")
                val expiresIn      = data.optInt("expiresIn", 300)

                if (!isAdded) return@onSuccess

                tvRegId.text  = "Device ID: $registrationId"
                tvStatus.text = "In the web app, go to\nSettings → Kiosks → Assign Device"

                val startTime = System.currentTimeMillis()
                while (isActive && (System.currentTimeMillis() - startTime) < expiresIn * 1000L) {
                    delay(5_000)
                    val pollResult = HttpHelper.post(
                        "$serverUrl/api/v1/auth/tv-connect/poll",
                        JSONObject().put("registrationId", registrationId)
                    )
                    pollResult.onSuccess { pollJson ->
                        val pollData   = pollJson.optJSONObject("data") ?: pollJson
                        val kioskToken = pollData.optString("kioskToken")
                        if (pollData.optString("status") == "assigned" && kioskToken.isNotBlank()) {
                            activity.storage.kioskToken = kioskToken
                            activity.navigateTo(AppState.KIOSK)
                            return@launch
                        }
                    }
                }

                if (isAdded) tvStatus.text = "Timed out. Press Back to return."
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
