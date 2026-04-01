import Foundation

struct OFCalendar: Identifiable, Codable {
    let id: String
    let provider: String?
    let name: String
    var displayName: String?
    var color: String?
    var isVisible: Bool?
    var isPrimary: Bool?
    var isFavorite: Bool?
    var syncEnabled: Bool?
    var showOnDashboard: Bool?
    var kioskEnabled: Bool?
}

struct CalendarEvent: Identifiable, Codable {
    let id: String
    let calendarId: String
    var title: String
    var description: String?
    var location: String?
    var startTime: String
    var endTime: String
    var isAllDay: Bool
    var calendarColor: String?
    var recurrenceRule: String?
    var status: String?

    var startDate: Date? { ISO8601DateFormatter().date(from: startTime) }
    var endDate: Date? { ISO8601DateFormatter().date(from: endTime) }
}
