package com.openframe.kiosk

import android.os.Bundle
import android.view.KeyEvent
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.openframe.kiosk.databinding.ActivityMainBinding
import com.openframe.kiosk.fragments.*

enum class AppState {
    LOADING, CLOUD_SETUP, SETUP, QR_LOGIN, REMOTE_PUSH, KIOSK
}

interface KeyEventHandler {
    fun handleKeyDown(keyCode: Int, event: KeyEvent?): Boolean = false
}

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    val storage by lazy { StorageHelper(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (savedInstanceState == null) {
            navigateTo(AppState.LOADING)
        }
    }

    fun navigateTo(state: AppState, args: Bundle? = null) {
        val fragment: Fragment = when (state) {
            AppState.LOADING       -> LoadingFragment()
            AppState.CLOUD_SETUP   -> CloudSetupFragment()
            AppState.SETUP         -> SetupFragment()
            AppState.QR_LOGIN      -> QRLoginFragment()
            AppState.REMOTE_PUSH   -> RemotePushFragment()
            AppState.KIOSK         -> KioskFragment()
        }
        args?.let { fragment.arguments = it }
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commit()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        val fragment = supportFragmentManager.findFragmentById(R.id.fragment_container)
        if (fragment is KeyEventHandler && fragment.handleKeyDown(keyCode, event)) {
            return true
        }
        return super.onKeyDown(keyCode, event)
    }
}
