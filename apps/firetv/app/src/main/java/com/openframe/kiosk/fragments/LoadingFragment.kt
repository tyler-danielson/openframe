package com.openframe.kiosk.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.openframe.kiosk.AppState
import com.openframe.kiosk.MainActivity
import com.openframe.kiosk.R
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class LoadingFragment : Fragment() {

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View? = inflater.inflate(R.layout.fragment_loading, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val activity = requireActivity() as MainActivity

        lifecycleScope.launch {
            delay(600)
            if (!isAdded) return@launch
            if (activity.storage.hasConfig()) {
                activity.navigateTo(AppState.KIOSK)
            } else {
                activity.navigateTo(AppState.CLOUD_SETUP)
            }
        }
    }
}
