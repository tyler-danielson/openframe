import Foundation

extension String {
    /// Parse ISO 8601 date string to Date
    func toDate() -> Date? {
        let formatters: [ISO8601DateFormatter] = {
            let full = ISO8601DateFormatter()
            full.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

            let standard = ISO8601DateFormatter()
            standard.formatOptions = [.withInternetDateTime]

            return [full, standard]
        }()

        for formatter in formatters {
            if let date = formatter.date(from: self) { return date }
        }

        // Fallback: try DateFormatter for other formats
        let fallback = DateFormatter()
        fallback.locale = Locale(identifier: "en_US_POSIX")
        for format in ["yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd"] {
            fallback.dateFormat = format
            if let date = fallback.date(from: self) { return date }
        }

        return nil
    }
}

extension Date {
    var isToday: Bool { Calendar.current.isDateInToday(self) }
    var isTomorrow: Bool { Calendar.current.isDateInTomorrow(self) }

    func friendlyDateName() -> String {
        if isToday { return "Today" }
        if isTomorrow { return "Tomorrow" }

        let calendar = Calendar.current
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: .now), to: calendar.startOfDay(for: self)).day ?? 0
        if days >= 2 && days <= 6 {
            return "In \(days) days"
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMM d"
        return formatter.string(from: self)
    }

    func formatTime() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: self)
    }

    func formatDate() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d, yyyy"
        return formatter.string(from: self)
    }

    func formatDateFull() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d, yyyy"
        return formatter.string(from: self)
    }

    func startOfDay() -> Date {
        Calendar.current.startOfDay(for: self)
    }

    func toISO8601() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.string(from: self)
    }

    func startOfMonth() -> Date {
        let cal = Calendar.current
        let comps = cal.dateComponents([.year, .month], from: self)
        return cal.date(from: comps) ?? self
    }

    func endOfMonth() -> Date {
        let cal = Calendar.current
        guard let nextMonth = cal.date(byAdding: .month, value: 1, to: startOfMonth()) else { return self }
        return cal.date(byAdding: .second, value: -1, to: nextMonth) ?? self
    }
}
