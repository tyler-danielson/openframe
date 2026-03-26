import Foundation

@Observable
final class TodayViewModel {
    var groupedEvents: [(String, [CalendarEvent])] = []
    var isLoading = false
    var errorMessage: String?

    private let calendarRepository: CalendarRepository

    init(calendarRepository: CalendarRepository) {
        self.calendarRepository = calendarRepository
    }

    func loadEvents() async {
        isLoading = true
        errorMessage = nil

        let today = Date()
        let endDate = Calendar.current.date(byAdding: .day, value: 7, to: today)!

        let result = await calendarRepository.getEvents(
            start: today.startOfDay().toISO8601(),
            end: endDate.toISO8601()
        )

        switch result {
        case .success(let events):
            groupedEvents = groupByDate(events)
        case .failure(let error):
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func groupByDate(_ events: [CalendarEvent]) -> [(String, [CalendarEvent])] {
        let cal = Calendar.current
        var groups: [String: [CalendarEvent]] = [:]
        var dateOrder: [String: Date] = [:]

        for event in events {
            guard let date = event.startTime.toDate() else { continue }
            let dayStart = cal.startOfDay(for: date)
            let key = dayStart.friendlyDateName()
            groups[key, default: []].append(event)
            if dateOrder[key] == nil { dateOrder[key] = dayStart }
        }

        return groups.sorted { (dateOrder[$0.key] ?? .distantPast) < (dateOrder[$1.key] ?? .distantPast) }
    }
}
