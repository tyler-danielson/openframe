package com.openframe.tablet

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.BatteryManager
import android.provider.Settings
import android.util.Log

class KioskLockManager(private val activity: Activity) {

    private val dpm = activity.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    private val componentName = DeviceAdminReceiver.getComponentName(activity)
    private val prefs = activity.getSharedPreferences(KioskActivity.PREFS_NAME, Context.MODE_PRIVATE)

    fun isDeviceOwner(): Boolean = dpm.isDeviceOwnerApp(activity.packageName)

    fun isKioskLockEnabled(): Boolean = prefs.getBoolean(PREF_KIOSK_LOCK, false)

    fun setKioskLockEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(PREF_KIOSK_LOCK, enabled).apply()
    }

    /**
     * Start lock task mode. If device owner, enters silently with full lockdown.
     * Otherwise, falls back to screen pinning (shows confirmation dialog).
     */
    fun startLockTask() {
        if (!isKioskLockEnabled()) return

        try {
            if (isDeviceOwner()) {
                // Whitelist this app for lock task mode
                dpm.setLockTaskPackages(componentName, arrayOf(activity.packageName))

                // Disable all lock task features (home, overview, notifications, etc.)
                dpm.setLockTaskFeatures(
                    componentName,
                    DevicePolicyManager.LOCK_TASK_FEATURE_NONE
                )

                activity.startLockTask()
                Log.i(TAG, "Started lock task mode (device owner)")
            } else {
                // Fallback: request screen pinning (user must confirm)
                activity.startLockTask()
                Log.i(TAG, "Started screen pinning (non-device-owner)")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start lock task: ${e.message}")
        }
    }

    /**
     * Stop lock task mode to allow admin access (e.g., opening settings).
     */
    fun stopLockTask() {
        try {
            activity.stopLockTask()
            Log.i(TAG, "Stopped lock task mode")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop lock task: ${e.message}")
        }
    }

    /**
     * Apply device owner policies for full kiosk lockdown.
     * Call once after device owner is provisioned.
     */
    fun setKioskPolicies() {
        if (!isDeviceOwner()) return

        try {
            // Disable keyguard (lock screen)
            dpm.setKeyguardDisabled(componentName, true)

            // Disable status bar
            dpm.setStatusBarDisabled(componentName, true)

            // Keep screen on while plugged in (AC, USB, wireless)
            dpm.setGlobalSetting(
                componentName,
                Settings.Global.STAY_ON_WHILE_PLUGGED_IN,
                (BatteryManager.BATTERY_PLUGGED_AC or
                    BatteryManager.BATTERY_PLUGGED_USB or
                    BatteryManager.BATTERY_PLUGGED_WIRELESS).toString()
            )

            Log.i(TAG, "Kiosk policies applied")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set kiosk policies: ${e.message}")
        }
    }

    /**
     * Clear kiosk policies (restore normal device behavior).
     */
    fun clearKioskPolicies() {
        if (!isDeviceOwner()) return

        try {
            dpm.setKeyguardDisabled(componentName, false)
            dpm.setStatusBarDisabled(componentName, false)
            Log.i(TAG, "Kiosk policies cleared")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to clear kiosk policies: ${e.message}")
        }
    }

    companion object {
        private const val TAG = "KioskLock"
        const val PREF_KIOSK_LOCK = "kiosk_lock_enabled"
    }
}
