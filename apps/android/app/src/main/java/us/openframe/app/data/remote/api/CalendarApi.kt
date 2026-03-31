package us.openframe.app.data.remote.api

import retrofit2.Response
import retrofit2.http.*
import us.openframe.app.data.remote.dto.*

interface CalendarApi {

    @GET("/api/v1/calendars")
    suspend fun getCalendars(
        @Query("includeHidden") includeHidden: Boolean = true,
    ): Response<ApiWrapper<List<CalendarDto>>>

    @PATCH("/api/v1/calendars/{id}")
    suspend fun updateCalendar(
        @Path("id") id: String,
        @Body request: UpdateCalendarRequest,
    ): Response<ApiWrapper<CalendarDto>>

    @POST("/api/v1/calendars/{id}/sync")
    suspend fun syncCalendar(@Path("id") id: String): Response<Any>

    @POST("/api/v1/calendars/sync-all")
    suspend fun syncAllCalendars(): Response<Any>

    // Events

    @GET("/api/v1/events")
    suspend fun getEvents(
        @Query("start") start: String,
        @Query("end") end: String,
        @Query("calendarIds") calendarIds: String? = null,
    ): Response<ApiWrapper<List<CalendarEventDto>>>

    @GET("/api/v1/events/{id}")
    suspend fun getEvent(@Path("id") id: String): Response<ApiWrapper<CalendarEventDto>>

    @POST("/api/v1/events")
    suspend fun createEvent(@Body request: CreateEventRequest): Response<ApiWrapper<CalendarEventDto>>

    @POST("/api/v1/events/quick")
    suspend fun createQuickEvent(@Body request: QuickEventRequest): Response<ApiWrapper<CalendarEventDto>>

    @PATCH("/api/v1/events/{id}")
    suspend fun updateEvent(
        @Path("id") id: String,
        @Body request: UpdateEventRequest,
    ): Response<ApiWrapper<CalendarEventDto>>

    @DELETE("/api/v1/events/{id}")
    suspend fun deleteEvent(@Path("id") id: String): Response<Any>
}
