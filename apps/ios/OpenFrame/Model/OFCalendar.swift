import Foundation

struct OFCalendar: Identifiable, Codable, Sendable, Equatable {
    let id: String
    let provider: String?
    let name: String
    let displayName: String?
    let color: String?
    var isVisible: Bool
    let isPrimary: Bool
    let isFavorite: Bool
    let isReadOnly: Bool
    let syncEnabled: Bool

    var effectiveName: String {
        displayName ?? name
    }
}

struct CalendarEvent: Identifiable, Codable, Sendable, Equatable {
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
    let calendarName: String?
    let calendarColor: String?
    let color: String?

    var effectiveColor: String? {
        color ?? calendarColor
    }
}
