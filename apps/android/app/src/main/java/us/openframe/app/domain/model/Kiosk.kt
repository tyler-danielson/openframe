package us.openframe.app.domain.model

data class Kiosk(
    val id: String,
    val name: String,
    val isActive: Boolean,
    val displayMode: String?,
    val displayType: String?,
    val colorScheme: String?,
    val screensaverEnabled: Boolean,
    val dashboards: List<KioskDashboard>,
    val lastAccessedAt: String?,
)

data class KioskDashboard(
    val id: String,
    val type: String,
    val name: String,
    val icon: String?,
    val pinned: Boolean,
)
