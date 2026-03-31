package us.openframe.app.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import us.openframe.app.data.local.DataStoreManager
import us.openframe.app.data.local.TokenManager
import us.openframe.app.data.remote.api.ModuleDto
import us.openframe.app.data.remote.api.SettingsApi
import us.openframe.app.data.remote.api.SettingCategoryDef
import us.openframe.app.data.remote.api.SystemSettingDto
import us.openframe.app.data.repository.AuthRepository
import us.openframe.app.data.repository.CalendarRepository
import us.openframe.app.domain.model.Calendar
import us.openframe.app.domain.model.User
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val calendarRepository: CalendarRepository,
    private val settingsApi: SettingsApi,
    private val dataStoreManager: DataStoreManager,
    private val tokenManager: TokenManager,
) : ViewModel() {

    private val _user = MutableStateFlow<User?>(null)
    val user: StateFlow<User?> = _user.asStateFlow()

    private val _calendars = MutableStateFlow<List<Calendar>>(emptyList())
    val calendars: StateFlow<List<Calendar>> = _calendars.asStateFlow()

    private val _colorScheme = MutableStateFlow("default")
    val colorScheme: StateFlow<String> = _colorScheme.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _definitions = MutableStateFlow<List<SettingCategoryDef>>(emptyList())
    val definitions: StateFlow<List<SettingCategoryDef>> = _definitions.asStateFlow()

    private val _settings = MutableStateFlow<Map<String, String?>>(emptyMap())
    val settings: StateFlow<Map<String, String?>> = _settings.asStateFlow()

    private val _modules = MutableStateFlow<List<ModuleDto>>(emptyList())
    val modules: StateFlow<List<ModuleDto>> = _modules.asStateFlow()

    private val _pinnedTabs = MutableStateFlow<List<String>>(emptyList())
    val pinnedTabs: StateFlow<List<String>> = _pinnedTabs.asStateFlow()

    private val _statusMessage = MutableStateFlow<String?>(null)
    val statusMessage: StateFlow<String?> = _statusMessage.asStateFlow()

    val serverUrl: String? get() = tokenManager.serverUrl

    init {
        loadUser()
        loadCalendars()
        loadSettings()
        loadModules()
        viewModelScope.launch {
            dataStoreManager.colorScheme.collect { _colorScheme.value = it }
        }
        viewModelScope.launch {
            dataStoreManager.pinnedTabs.collect { _pinnedTabs.value = it }
        }
    }

    private fun loadUser() {
        viewModelScope.launch {
            authRepository.getCurrentUser().onSuccess { _user.value = it }
        }
    }

    private fun loadCalendars() {
        viewModelScope.launch {
            calendarRepository.getCalendars().onSuccess { _calendars.value = it }
        }
    }

    private fun loadSettings() {
        viewModelScope.launch {
            try {
                val defResponse = settingsApi.getDefinitions()
                if (defResponse.isSuccessful) {
                    _definitions.value = defResponse.body()?.data ?: emptyList()
                }

                val settingsResponse = settingsApi.getAllSettings()
                if (settingsResponse.isSuccessful) {
                    val list = settingsResponse.body()?.data ?: emptyList()
                    _settings.value = list.associate { "${it.category}/${it.key}" to it.value }
                }
            } catch (_: Exception) {}
        }
    }

    private fun loadModules() {
        viewModelScope.launch {
            try {
                val response = settingsApi.getModules()
                if (response.isSuccessful) {
                    _modules.value = response.body()?.data ?: emptyList()
                }
            } catch (_: Exception) {}
        }
    }

    fun setColorScheme(scheme: String) {
        viewModelScope.launch {
            dataStoreManager.setColorScheme(scheme)
        }
    }

    fun toggleCalendarVisibility(calendar: Calendar) {
        viewModelScope.launch {
            calendarRepository.updateCalendar(calendar.id, isVisible = !calendar.isVisible)
            loadCalendars()
        }
    }

    fun syncAll() {
        viewModelScope.launch {
            _isSyncing.value = true
            calendarRepository.syncAllCalendars()
            _isSyncing.value = false
            loadCalendars()
        }
    }

    fun updateSetting(category: String, key: String, value: String?) {
        viewModelScope.launch {
            try {
                settingsApi.updateSetting(category, key, mapOf("value" to value))
                // Update local cache
                _settings.value = _settings.value.toMutableMap().apply {
                    put("$category/$key", value)
                }
                showStatus("Saved")
            } catch (e: Exception) {
                showStatus("Failed to save")
            }
        }
    }

    fun getSettingValue(category: String, key: String): String? {
        return _settings.value["$category/$key"]
    }

    fun togglePinnedTab(route: String) {
        val current = _pinnedTabs.value.toMutableList()
        if (current.contains(route)) {
            current.remove(route)
        } else {
            if (current.size >= 4) {
                showStatus("Max 4 pinned tabs. Unpin one first.")
                return
            }
            current.add(route)
        }
        _pinnedTabs.value = current
        viewModelScope.launch {
            dataStoreManager.setPinnedTabs(current)
        }
    }

    fun toggleModule(module: ModuleDto) {
        viewModelScope.launch {
            try {
                settingsApi.updateModule(module.id, mapOf("enabled" to !module.enabled))
                loadModules()
                showStatus(if (module.enabled) "Disabled ${module.name}" else "Enabled ${module.name}")
            } catch (_: Exception) {
                showStatus("Failed")
            }
        }
    }

    private fun showStatus(message: String) {
        viewModelScope.launch {
            _statusMessage.value = message
            kotlinx.coroutines.delay(2000)
            _statusMessage.value = null
        }
    }
}
