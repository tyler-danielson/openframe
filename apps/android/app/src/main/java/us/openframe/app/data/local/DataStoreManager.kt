package us.openframe.app.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "openframe_prefs")

@Singleton
class DataStoreManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val store get() = context.dataStore

    // ── Color scheme ───────────────────────────────────────

    val colorScheme: Flow<String> = store.data.map { prefs ->
        prefs[KEY_COLOR_SCHEME] ?: "default"
    }

    suspend fun setColorScheme(scheme: String) {
        store.edit { it[KEY_COLOR_SCHEME] = scheme }
    }

    // ── Selected calendar IDs (comma-separated) ────────────

    val visibleCalendarIds: Flow<Set<String>> = store.data.map { prefs ->
        prefs[KEY_VISIBLE_CALENDARS]?.split(",")?.filter { it.isNotBlank() }?.toSet() ?: emptySet()
    }

    suspend fun setVisibleCalendarIds(ids: Set<String>) {
        store.edit { it[KEY_VISIBLE_CALENDARS] = ids.joinToString(",") }
    }

    // ── Last selected task list ────────────────────────────

    val selectedTaskListId: Flow<String?> = store.data.map { prefs ->
        prefs[KEY_SELECTED_TASK_LIST]
    }

    suspend fun setSelectedTaskListId(id: String?) {
        store.edit {
            if (id != null) it[KEY_SELECTED_TASK_LIST] = id
            else it.remove(KEY_SELECTED_TASK_LIST)
        }
    }

    // ── Pinned toolbar tabs (device-specific) ────────────

    val pinnedTabs: Flow<List<String>> = store.data.map { prefs ->
        prefs[KEY_PINNED_TABS]?.split(",")?.filter { it.isNotBlank() }
            ?: listOf("today", "calendar", "photos", "kiosk")
    }

    suspend fun setPinnedTabs(tabs: List<String>) {
        store.edit { it[KEY_PINNED_TABS] = tabs.joinToString(",") }
    }

    companion object {
        private val KEY_COLOR_SCHEME = stringPreferencesKey("color_scheme")
        private val KEY_VISIBLE_CALENDARS = stringPreferencesKey("visible_calendars")
        private val KEY_SELECTED_TASK_LIST = stringPreferencesKey("selected_task_list")
        private val KEY_PINNED_TABS = stringPreferencesKey("pinned_tabs")
    }
}
