import Foundation

@Observable
final class CalendarViewModel {
    var currentMonth = Date()
    var selectedDate = Date()
    var monthEvents: [CalendarEvent] = []
    var isLoading = false
    var errorMessage: String?

    private let calendarRepository: CalendarRepository

    init(calendarRepository: CalendarRepository) {
        self.calendarRepository = calendarRepository
    }

    var eventsForSelectedDate: [CalendarEvent] {
        let cal = Calendar.current
        return monthEvents.filter { event in
            guard let eventDate = event.startTime.toDate() else { return false }
            return cal.isDate(eventDate, inSameDayAs: selectedDate)
        }
    }

    var daysWithEvents: Set<Int> {
        let cal = Calendar.current
        var days = Set<Int>()
        for event in monthEvents {
            if let date = event.startTime.toDate(),
               cal.isDate(date, equalTo: currentMonth, toGranularity: .month) {
                days.insert(cal.component(.day, from: date))
            }
        }
        return days
    }

    func loadMonth() async {
        isLoading = true
        let start = currentMonth.startOfMonth()
        let end = currentMonth.endOfMonth()

        let result = await calendarRepository.getEvents(
            start: start.toISO8601(),
            end: end.toISO8601()
        )

        switch result {
        case .success(let events):
            monthEvents = events
        case .failure(let error):
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func navigateMonth(forward: Bool) {
        let cal = Calendar.current
        if let newMonth = cal.date(byAdding: .month, value: forward ? 1 : -1, to: currentMonth) {
            currentMonth = newMonth
            Task { await loadMonth() }
        }
    }

    func selectDate(_ date: Date) {
        selectedDate = date
    }
}
