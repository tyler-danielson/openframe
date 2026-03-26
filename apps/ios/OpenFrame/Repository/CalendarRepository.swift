import Foundation

final class CalendarRepository: Sendable {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    // MARK: - Calendars

    func getCalendars() async -> Result<[OFCalendar], Error> {
        do {
            let dtos: [CalendarDTO] = try await apiClient.requestData(.get, path: "/api/v1/calendars", query: ["includeHidden": "true"])
            return .success(dtos.map { $0.toDomain() })
        } catch {
            return .failure(error)
        }
    }

    func updateCalendar(id: String, request: UpdateCalendarRequest) async -> Result<OFCalendar, Error> {
        do {
            let dto: CalendarDTO = try await apiClient.requestData(.patch, path: "/api/v1/calendars/\(id)", body: request)
            return .success(dto.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func syncCalendar(id: String) async -> Result<Void, Error> {
        do {
            try await apiClient.requestVoid(.post, path: "/api/v1/calendars/\(id)/sync")
            return .success(())
        } catch {
            return .failure(error)
        }
    }

    func syncAllCalendars() async -> Result<Void, Error> {
        do {
            try await apiClient.requestVoid(.post, path: "/api/v1/calendars/sync-all")
            return .success(())
        } catch {
            return .failure(error)
        }
    }

    // MARK: - Events

    func getEvents(start: String, end: String, calendarIds: String? = nil) async -> Result<[CalendarEvent], Error> {
        do {
            var query = ["start": start, "end": end]
            if let ids = calendarIds { query["calendarIds"] = ids }
            let dtos: [CalendarEventDTO] = try await apiClient.requestData(.get, path: "/api/v1/events", query: query)
            return .success(dtos.map { $0.toDomain() })
        } catch {
            return .failure(error)
        }
    }

    func getEvent(id: String) async -> Result<CalendarEvent, Error> {
        do {
            let dto: CalendarEventDTO = try await apiClient.requestData(.get, path: "/api/v1/events/\(id)")
            return .success(dto.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func createEvent(_ request: CreateEventRequest) async -> Result<CalendarEvent, Error> {
        do {
            let dto: CalendarEventDTO = try await apiClient.requestData(.post, path: "/api/v1/events", body: request)
            return .success(dto.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func createQuickEvent(text: String, calendarId: String? = nil) async -> Result<CalendarEvent, Error> {
        do {
            let body = QuickEventRequest(text: text, calendarId: calendarId)
            let dto: CalendarEventDTO = try await apiClient.requestData(.post, path: "/api/v1/events/quick", body: body)
            return .success(dto.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func updateEvent(id: String, request: UpdateEventRequest) async -> Result<CalendarEvent, Error> {
        do {
            let dto: CalendarEventDTO = try await apiClient.requestData(.patch, path: "/api/v1/events/\(id)", body: request)
            return .success(dto.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func deleteEvent(id: String) async -> Result<Void, Error> {
        do {
            try await apiClient.requestVoid(.delete, path: "/api/v1/events/\(id)")
            return .success(())
        } catch {
            return .failure(error)
        }
    }
}
