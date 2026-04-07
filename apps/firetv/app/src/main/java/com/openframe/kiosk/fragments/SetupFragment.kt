package com.openframe.kiosk.fragments

import android.os.Bundle
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.fragment.app.Fragment
import com.openframe.kiosk.AppState
import com.openframe.kiosk.KeyEventHandler
import com.openframe.kiosk.MainActivity
import com.openframe.kiosk.R

class SetupFragment : Fragment(), KeyEventHandler {

    private lateinit var etServerUrl: EditText
    private lateinit var etToken: EditText
    private lateinit var tvStatus: TextView

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View? = inflater.inflate(R.layout.fragment_setup, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val activity = requireActivity() as MainActivity

        etServerUrl = view.findViewById(R.id.et_server_url)
        etToken     = view.findViewById(R.id.et_token)
        tvStatus    = view.findViewById(R.id.tv_status)

        // Pre-fill from storage
        activity.storage.serverUrl?.let  { etServerUrl.setText(it) }
        activity.storage.kioskToken?.let { etToken.setText(it) }

        view.findViewById<Button>(R.id.btn_connect).setOnClickListener { connect() }

        view.findViewById<Button>(R.id.btn_qr_login).setOnClickListener {
            saveServerUrl()
            activity.navigateTo(AppState.QR_LOGIN)
        }

        view.findViewById<Button>(R.id.btn_remote_push).setOnClickListener {
            saveServerUrl()
            activity.navigateTo(AppState.REMOTE_PUSH)
        }

        view.findViewById<Button>(R.id.btn_clear).setOnClickListener {
            activity.storage.clear()
            etServerUrl.setText("")
            etToken.setText("")
            tvStatus.text = "Configuration cleared"
        }

        // Focus server URL field on open
        etServerUrl.requestFocus()
    }

    private fun saveServerUrl() {
        val url = etServerUrl.text.toString().trim()
        if (url.isNotBlank()) {
            activity?.let { (it as MainActivity).storage.serverUrl = normalizeUrl(url) }
        }
    }

    private fun connect() {
        val activity = requireActivity() as MainActivity
        val url   = etServerUrl.text.toString().trim()
        val token = etToken.text.toString().trim()

        if (url.isBlank()) { tvStatus.text = "Please enter a server URL"; return }
        if (token.isBlank()) { tvStatus.text = "Please enter a kiosk token"; return }

        activity.storage.serverUrl  = normalizeUrl(url)
        activity.storage.kioskToken = token
        activity.navigateTo(AppState.KIOSK)
    }

    private fun normalizeUrl(url: String) =
        if (url.startsWith("http")) url else "https://$url"

    override fun handleKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            (requireActivity() as MainActivity).navigateTo(AppState.CLOUD_SETUP)
            return true
        }
        return false
    }
}
