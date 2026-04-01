import Foundation

final class CalendarRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func getCalendars() async throws -> [OFCalendar] {
        try await apiClient.request(.getCalendars)
    }

    func getEvents(start: Date, end: Date, calendarIds: [String]? = nil) async throws -> [CalendarEvent] {
        let fmt = ISO8601DateFormatter()
        return try await apiClient.request(
            .getEvents(start: fmt.string(from: start), end: fmt.string(from: end), calendarIds: calendarIds)
        )
    }

    func getEvent(id: String) async throws -> CalendarEvent {
        try await apiClient.request(.getEvent(id: id))
    }

    func createEvent(calendarId: String, title: String, start: Date, end: Date,
                     isAllDay: Bool = false, description: String? = nil, location: String? = nil) async throws -> CalendarEvent {
        let fmt = ISO8601DateFormatter()
        var body: [String: Any] = [
            "calendarId": calendarId,
            "title": title,
            "startTime": fmt.string(from: start),
            "endTime": fmt.string(from: end),
            "isAllDay": isAllDay,
        ]
        if let description { body["description"] = description }
        if let location { body["location"] = location }
        return try await apiClient.request(.createEvent(body: body))
    }

    func updateEvent(id: String, updates: [String: Any]) async throws -> CalendarEvent {
        try await apiClient.request(.updateEvent(id: id, body: updates))
    }

    func deleteEvent(id: String) async throws {
        try await apiClient.requestVoid(.deleteEvent(id: id))
    }
}
