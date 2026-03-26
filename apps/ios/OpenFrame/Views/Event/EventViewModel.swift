import Foundation

@Observable
final class EventViewModel {
    var event: CalendarEvent?
    var calendars: [OFCalendar] = []
    var isLoading = false
    var errorMessage: String?
    var didDelete = false

    private let calendarRepository: CalendarRepository

    init(calendarRepository: CalendarRepository) {
        self.calendarRepository = calendarRepository
    }

    func loadEvent(id: String) async {
        isLoading = true
        let result = await calendarRepository.getEvent(id: id)
        switch result {
        case .success(let loaded):
            event = loaded
        case .failure(let error):
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func loadCalendars() async {
        let result = await calendarRepository.getCalendars()
        if case .success(let cals) = result {
            calendars = cals.filter { !$0.isReadOnly }
        }
    }

    func deleteEvent(id: String) async -> Bool {
        let result = await calendarRepository.deleteEvent(id: id)
        if case .success = result {
            didDelete = true
            return true
        }
        return false
    }

    func createEvent(_ request: CreateEventRequest) async -> CalendarEvent? {
        let result = await calendarRepository.createEvent(request)
        if case .success(let event) = result { return event }
        return nil
    }

    func createQuickEvent(text: String, calendarId: String?) async -> CalendarEvent? {
        let result = await calendarRepository.createQuickEvent(text: text, calendarId: calendarId)
        if case .success(let event) = result { return event }
        return nil
    }
}
