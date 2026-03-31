package us.openframe.app.data.repository

import us.openframe.app.data.remote.api.CalendarApi
import us.openframe.app.data.remote.dto.*
import us.openframe.app.domain.model.Calendar
import us.openframe.app.domain.model.CalendarEvent
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CalendarRepository @Inject constructor(
    private val calendarApi: CalendarApi,
) {
    suspend fun getCalendars(): Result<List<Calendar>> {
        return try {
            val response = calendarApi.getCalendars()
            if (response.isSuccessful) {
                val calendars = (response.body()?.data ?: emptyList()).map { it.toDomain() }
                Result.success(calendars)
            } else {
                Result.failure(Exception("Failed to fetch calendars"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateCalendar(id: String, isVisible: Boolean? = null, color: String? = null): Result<Calendar> {
        return try {
            val response = calendarApi.updateCalendar(id, UpdateCalendarRequest(isVisible = isVisible, color = color))
            if (response.isSuccessful) {
                val cal = response.body()?.data?.toDomain() ?: return Result.failure(Exception("No data"))
                Result.success(cal)
            } else {
                Result.failure(Exception("Failed to update calendar"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun syncAllCalendars(): Result<Unit> {
        return try {
            val response = calendarApi.syncAllCalendars()
            if (response.isSuccessful) Result.success(Unit)
            else Result.failure(Exception("Sync failed"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

@Singleton
class EventRepository @Inject constructor(
    private val calendarApi: CalendarApi,
) {
    suspend fun getEvents(start: String, end: String, calendarIds: List<String>? = null): Result<List<CalendarEvent>> {
        return try {
            val ids = calendarIds?.joinToString(",")
            val response = calendarApi.getEvents(start, end, ids)
            if (response.isSuccessful) {
                val events = (response.body()?.data ?: emptyList()).map { it.toDomain() }
                Result.success(events)
            } else {
                Result.failure(Exception("Failed to fetch events"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getEvent(id: String): Result<CalendarEvent> {
        return try {
            val response = calendarApi.getEvent(id)
            if (response.isSuccessful) {
                val event = response.body()?.data?.toDomain() ?: return Result.failure(Exception("No data"))
                Result.success(event)
            } else {
                Result.failure(Exception("Failed to fetch event"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createEvent(request: CreateEventRequest): Result<CalendarEvent> {
        return try {
            val response = calendarApi.createEvent(request)
            if (response.isSuccessful) {
                val event = response.body()?.data?.toDomain() ?: return Result.failure(Exception("No data"))
                Result.success(event)
            } else {
                Result.failure(Exception("Failed to create event"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createQuickEvent(text: String, calendarId: String? = null): Result<CalendarEvent> {
        return try {
            val response = calendarApi.createQuickEvent(QuickEventRequest(text, calendarId))
            if (response.isSuccessful) {
                val event = response.body()?.data?.toDomain() ?: return Result.failure(Exception("No data"))
                Result.success(event)
            } else {
                Result.failure(Exception("Failed to create event"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateEvent(id: String, request: UpdateEventRequest): Result<CalendarEvent> {
        return try {
            val response = calendarApi.updateEvent(id, request)
            if (response.isSuccessful) {
                val event = response.body()?.data?.toDomain() ?: return Result.failure(Exception("No data"))
                Result.success(event)
            } else {
                Result.failure(Exception("Failed to update event"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteEvent(id: String): Result<Unit> {
        return try {
            val response = calendarApi.deleteEvent(id)
            if (response.isSuccessful) Result.success(Unit)
            else Result.failure(Exception("Failed to delete event"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

// ── DTO to Domain mappers ─────────────────────────────────

private fun CalendarDto.toDomain() = Calendar(
    id = id, provider = provider, name = name, displayName = displayName,
    color = color, isVisible = isVisible, isPrimary = isPrimary,
    isFavorite = isFavorite, isReadOnly = isReadOnly, syncEnabled = syncEnabled,
)

private fun CalendarEventDto.toDomain() = CalendarEvent(
    id = id, calendarId = calendarId, title = title, description = description,
    location = location, startTime = startTime, endTime = endTime,
    isAllDay = isAllDay, status = status, recurrenceRule = recurrenceRule,
    calendarName = calendar?.name, calendarColor = calendar?.color, color = color,
)
