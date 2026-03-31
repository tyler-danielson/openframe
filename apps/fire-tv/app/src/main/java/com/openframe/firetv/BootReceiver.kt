package com.openframe.firetv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            val prefs = context.getSharedPreferences(KioskActivity.PREFS_NAME, Context.MODE_PRIVATE)
            val kioskUrl = prefs.getString(KioskActivity.PREF_KIOSK_URL, null)

            if (!kioskUrl.isNullOrBlank()) {
                val launchIntent = Intent(context, KioskActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(launchIntent)
            }
        }
    }
}
