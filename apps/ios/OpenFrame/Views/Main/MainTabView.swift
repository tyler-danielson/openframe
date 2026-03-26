import SwiftUI

enum AppTab: String, CaseIterable {
    case today, calendar, tasks, photos, kiosk, settings

    var label: String {
        switch self {
        case .today: return "Today"
        case .calendar: return "Calendar"
        case .tasks: return "Tasks"
        case .photos: return "Photos"
        case .kiosk: return "Kiosks"
        case .settings: return "Settings"
        }
    }

    var icon: String {
        switch self {
        case .today: return "calendar.day.timeline.left"
        case .calendar: return "calendar"
        case .tasks: return "checklist"
        case .photos: return "photo.on.rectangle"
        case .kiosk: return "tv"
        case .settings: return "gearshape"
        }
    }
}

struct MainTabView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab: AppTab = .today
    @State private var navigationPath = NavigationPath()

    var body: some View {
        NavigationStack(path: $navigationPath) {
            TabView(selection: $selectedTab) {
                TodayView(onNavigateToEvent: navigateToEvent, onNavigateToNewEvent: navigateToNewEvent)
                    .tabItem { Label(AppTab.today.label, systemImage: AppTab.today.icon) }
                    .tag(AppTab.today)

                CalendarTabView(onNavigateToEvent: navigateToEvent, onNavigateToNewEvent: navigateToNewEvent)
                    .tabItem { Label(AppTab.calendar.label, systemImage: AppTab.calendar.icon) }
                    .tag(AppTab.calendar)

                TasksView()
                    .tabItem { Label(AppTab.tasks.label, systemImage: AppTab.tasks.icon) }
                    .tag(AppTab.tasks)

                PhotosView(onNavigateToAlbum: navigateToAlbum)
                    .tabItem { Label(AppTab.photos.label, systemImage: AppTab.photos.icon) }
                    .tag(AppTab.photos)

                KioskListView(onNavigateToKiosk: navigateToKiosk)
                    .tabItem { Label(AppTab.kiosk.label, systemImage: AppTab.kiosk.icon) }
                    .tag(AppTab.kiosk)

                SettingsView()
                    .tabItem { Label(AppTab.settings.label, systemImage: AppTab.settings.icon) }
                    .tag(AppTab.settings)
            }
            .navigationDestination(for: AppRoute.self) { route in
                switch route {
                case .eventDetail(let id):
                    EventDetailView(eventId: id)
                case .newEvent:
                    NewEventView()
                case .albumDetail(let id):
                    AlbumDetailView(albumId: id)
                case .kioskControl(let id):
                    KioskControlView(kioskId: id)
                }
            }
        }
    }

    private func navigateToEvent(_ id: String) {
        navigationPath.append(AppRoute.eventDetail(id))
    }

    private func navigateToNewEvent() {
        navigationPath.append(AppRoute.newEvent)
    }

    private func navigateToAlbum(_ id: String) {
        navigationPath.append(AppRoute.albumDetail(id))
    }

    private func navigateToKiosk(_ id: String) {
        navigationPath.append(AppRoute.kioskControl(id))
    }
}

enum AppRoute: Hashable {
    case eventDetail(String)
    case newEvent
    case albumDetail(String)
    case kioskControl(String)
}
