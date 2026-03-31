package us.openframe.app.data.repository

import us.openframe.app.data.remote.api.KioskApi
import us.openframe.app.data.remote.dto.KioskCommandRequest
import us.openframe.app.data.remote.dto.KioskDashboardDto
import us.openframe.app.data.remote.dto.KioskDto
import us.openframe.app.domain.model.Kiosk
import us.openframe.app.domain.model.KioskDashboard
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class KioskRepository @Inject constructor(
    private val kioskApi: KioskApi,
) {
    suspend fun getKiosks(): Result<List<Kiosk>> {
        return try {
            val response = kioskApi.getKiosks()
            if (response.isSuccessful) {
                val kiosks = (response.body()?.data ?: emptyList()).map { it.toDomain() }
                Result.success(kiosks)
            } else {
                Result.failure(Exception("Failed to fetch kiosks"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getKiosk(id: String): Result<Kiosk> {
        return try {
            val response = kioskApi.getKiosk(id)
            if (response.isSuccessful) {
                val kiosk = response.body()?.data?.toDomain() ?: return Result.failure(Exception("No data"))
                Result.success(kiosk)
            } else {
                Result.failure(Exception("Failed to fetch kiosk"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun sendCommand(kioskId: String, type: String, payload: Map<String, Any>? = null): Result<Unit> {
        return try {
            val response = kioskApi.sendCommand(kioskId, KioskCommandRequest(type, payload))
            if (response.isSuccessful) Result.success(Unit)
            else Result.failure(Exception("Command failed"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun refreshKiosk(kioskId: String): Result<Unit> {
        return try {
            val response = kioskApi.refreshKiosk(kioskId)
            if (response.isSuccessful) Result.success(Unit)
            else Result.failure(Exception("Refresh failed"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

private fun KioskDto.toDomain() = Kiosk(
    id = id, name = name, isActive = isActive, displayMode = displayMode,
    displayType = displayType, colorScheme = colorScheme,
    screensaverEnabled = screensaverEnabled,
    dashboards = dashboards?.map { it.toDomain() } ?: emptyList(),
    lastAccessedAt = lastAccessedAt,
)

private fun KioskDashboardDto.toDomain() = KioskDashboard(
    id = id, type = type, name = name, icon = icon, pinned = pinned,
)
