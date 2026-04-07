package com.openframe.kiosk

import android.content.Context
import android.content.SharedPreferences

class StorageHelper(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("openframe_kiosk", Context.MODE_PRIVATE)

    var serverUrl: String?
        get() = prefs.getString("server_url", null)
        set(value) = prefs.edit().putString("server_url", value).apply()

    var kioskToken: String?
        get() = prefs.getString("kiosk_token", null)
        set(value) = prefs.edit().putString("kiosk_token", value).apply()

    var cloudSetupCode: String?
        get() = prefs.getString("cloud_setup_code", null)
        set(value) = prefs.edit().putString("cloud_setup_code", value).apply()

    fun hasConfig(): Boolean =
        !serverUrl.isNullOrBlank() && !kioskToken.isNullOrBlank()

    fun clear() {
        prefs.edit()
            .remove("server_url")
            .remove("kiosk_token")
            .apply()
    }
}
