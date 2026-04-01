import Foundation

extension Date {
    var startOfDay: Date {
        Calendar.current.startOfDay(for: self)
    }

    var endOfDay: Date {
        Calendar.current.date(bySettingHour: 23, minute: 59, second: 59, of: self) ?? self
    }

    var startOfMonth: Date {
        let cal = Calendar.current
        let components = cal.dateComponents([.year, .month], from: self)
        return cal.date(from: components) ?? self
    }

    var endOfMonth: Date {
        let cal = Calendar.current
        guard let start = cal.date(from: cal.dateComponents([.year, .month], from: self)),
              let end = cal.date(byAdding: DateComponents(month: 1, day: -1), to: start) else { return self }
        return end.endOfDay
    }

    func adding(days: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: days, to: self) ?? self
    }

    func adding(months: Int) -> Date {
        Calendar.current.date(byAdding: .month, value: months, to: self) ?? self
    }

    var isToday: Bool { Calendar.current.isDateInToday(self) }
    var isTomorrow: Bool { Calendar.current.isDateInTomorrow(self) }
    var isPast: Bool { self < Date() }

    var timeString: String {
        let fmt = DateFormatter()
        fmt.timeStyle = .short
        return fmt.string(from: self)
    }

    var shortDateString: String {
        let fmt = DateFormatter()
        fmt.dateStyle = .medium
        return fmt.string(from: self)
    }

    var dayOfWeek: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "EEEE"
        return fmt.string(from: self)
    }

    var dayNumber: Int {
        Calendar.current.component(.day, from: self)
    }

    func isSameDay(as other: Date) -> Bool {
        Calendar.current.isDate(self, inSameDayAs: other)
    }

    static func fromISO(_ string: String) -> Date? {
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fmt.date(from: string) ?? ISO8601DateFormatter().date(from: string)
    }

    var relativeString: String {
        if isToday { return "Today" }
        if isTomorrow { return "Tomorrow" }
        if Calendar.current.isDate(self, equalTo: Date().adding(days: -1), toGranularity: .day) { return "Yesterday" }
        let fmt = DateFormatter()
        fmt.dateStyle = .medium
        return fmt.string(from: self)
    }
}
