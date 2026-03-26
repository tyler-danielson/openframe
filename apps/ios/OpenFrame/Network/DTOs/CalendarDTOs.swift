import Foundation

struct CalendarDTO: Decodable {
    let id: String
    let externalId: String?
    let provider: String?
    let name: String
    let displayName: String?
    let color: String?
    let isVisible: Bool
    let isPrimary: Bool
    let isFavorite: Bool
    let isReadOnly: Bool
    let syncEnabled: Bool
    let showOnDashboard: Bool?

    func toDomain() -> OFCalendar {
        OFCalendar(
            id: id, provider: provider, name: name, displayName: displayName,
            color: color, isVisible: isVisible, isPrimary: isPrimary,
            isFavorite: isFavorite, isReadOnly: isReadOnly, syncEnabled: syncEnabled
        )
    }
}

struct CalendarInfoDTO: Decodable {
    let id: String
    let name: String
    let color: String?
}

struct CalendarEventDTO: Decodable {
    let id: String
    let calendarId: String
    let title: String?
    let description: String?
    let location: String?
    let startTime: String
    let endTime: String
    let isAllDay: Bool
    let status: String?
    let recurrenceRule: String?
    let calendar: CalendarInfoDTO?
    let color: String?

    func toDomain() -> CalendarEvent {
        CalendarEvent(
            id: id, calendarId: calendarId, title: title, description: description,
            location: location, startTime: startTime, endTime: endTime,
            isAllDay: isAllDay, status: status, recurrenceRule: recurrenceRule,
            calendarName: calendar?.name, calendarColor: calendar?.color, color: color
        )
    }
}

struct CreateEventRequest: Encodable {
    let calendarId: String
    let title: String
    let startTime: String
    let endTime: String
    let description: String?
    let location: String?
    let isAllDay: Bool?
}

struct QuickEventRequest: Encodable {
    let text: String
    let calendarId: String?
}

struct UpdateEventRequest: Encodable {
    let title: String?
    let description: String?
    let location: String?
    let startTime: String?
    let endTime: String?
    let isAllDay: Bool?
}

struct UpdateCalendarRequest: Encodable {
    let color: String?
    let isVisible: Bool?
    let syncEnabled: Bool?
    let isPrimary: Bool?
    let isFavorite: Bool?
    let showOnDashboard: Bool?
}
