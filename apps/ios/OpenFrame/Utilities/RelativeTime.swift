import Foundation

extension String {
    /// Convert ISO date string to relative time string (e.g., "5m ago", "2h ago")
    func toRelativeTime() -> String {
        guard let date = self.toDate() else { return self }
        let now = Date()
        let interval = now.timeIntervalSince(date)

        if interval < 0 {
            // Future date
            let absInterval = abs(interval)
            if absInterval < 60 { return "in \(Int(absInterval))s" }
            if absInterval < 3600 { return "in \(Int(absInterval / 60))m" }
            if absInterval < 86400 { return "in \(Int(absInterval / 3600))h" }
            return "in \(Int(absInterval / 86400))d"
        }

        if interval < 60 { return "Just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        if interval < 604800 { return "\(Int(interval / 86400))d ago" }

        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}
