import Foundation

@MainActor
final class SettingsViewModel: ObservableObject {
    @Published var user: User?
    @Published var calendars: [OFCalendar] = []
    @Published var isSyncing = false
    @Published var isLoading = false

    private let authRepository: AuthRepository
    private let calendarRepository: CalendarRepository
    let settingsManager: SettingsManager

    init(authRepository: AuthRepository, calendarRepository: CalendarRepository, settingsManager: SettingsManager) {
        self.authRepository = authRepository
        self.calendarRepository = calendarRepository
        self.settingsManager = settingsManager
    }

    func load() async {
        isLoading = true
        async let userResult = authRepository.getCurrentUser()
        async let calResult = calendarRepository.getCalendars()

        if case .success(let u) = await userResult { user = u }
        if case .success(let c) = await calResult { calendars = c }
        isLoading = false
    }

    func syncAll() async {
        isSyncing = true
        _ = await calendarRepository.syncAllCalendars()
        // Reload calendars after sync
        if case .success(let c) = await calendarRepository.getCalendars() {
            calendars = c
        }
        isSyncing = false
    }

    func toggleCalendarVisibility(_ calendar: OFCalendar) async {
        let request = UpdateCalendarRequest(
            color: nil, isVisible: !calendar.isVisible, syncEnabled: nil,
            isPrimary: nil, isFavorite: nil, showOnDashboard: nil
        )
        if case .success(let updated) = await calendarRepository.updateCalendar(id: calendar.id, request: request) {
            if let idx = calendars.firstIndex(where: { $0.id == calendar.id }) {
                calendars[idx] = updated
            }
        }
    }
}
