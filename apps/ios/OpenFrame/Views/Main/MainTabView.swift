import SwiftUI

enum AppTab: String, CaseIterable {
    case today, calendar, tasks, recipes, photos, kiosk, settings

    var label: String {
        switch self {
        case .today: return "Today"
        case .calendar: return "Calendar"
        case .tasks: return "Tasks"
        case .recipes: return "Recipes"
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
        case .recipes: return "book.closed"
        case .photos: return "photo.on.rectangle"
        case .kiosk: return "tv"
        case .settings: return "gearshape"
        }
    }
}

struct MainTabView: View {
    @EnvironmentObject private var appState: AppState
    @State private var selectedTab: AppTab = .today
    @State private var activeRoute: AppRoute?

    var body: some View {
        NavigationView {
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

                RecipesView(
                    onNavigateToRecipe: navigateToRecipe,
                    onNavigateToAddRecipe: navigateToAddRecipe,
                    onNavigateToScanRecipe: navigateToScanRecipe
                )
                    .tabItem { Label(AppTab.recipes.label, systemImage: AppTab.recipes.icon) }
                    .tag(AppTab.recipes)

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
            .background(
                Group {
                    NavigationLink(
                        destination: routeDestination,
                        isActive: Binding(
                            get: { activeRoute != nil },
                            set: { if !$0 { activeRoute = nil } }
                        )
                    ) {
                        EmptyView()
                    }
                    .hidden()
                }
            )
        }
        .navigationViewStyle(.stack)
    }

    @ViewBuilder
    private var routeDestination: some View {
        if let route = activeRoute {
            switch route {
            case .eventDetail(let id):
                EventDetailView(eventId: id)
            case .newEvent:
                NewEventView()
            case .albumDetail(let id):
                AlbumDetailView(albumId: id)
            case .kioskControl(let id):
                KioskControlView(kioskId: id)
            case .recipeDetail(let id):
                RecipeDetailView(recipeId: id)
            case .addRecipe:
                AddRecipeView()
            case .scanRecipe:
                ScanRecipeView()
            }
        } else {
            EmptyView()
        }
    }

    private func navigateToEvent(_ id: String) {
        activeRoute = .eventDetail(id)
    }

    private func navigateToNewEvent() {
        activeRoute = .newEvent
    }

    private func navigateToAlbum(_ id: String) {
        activeRoute = .albumDetail(id)
    }

    private func navigateToKiosk(_ id: String) {
        activeRoute = .kioskControl(id)
    }

    private func navigateToRecipe(_ id: String) {
        activeRoute = .recipeDetail(id)
    }

    private func navigateToAddRecipe() {
        activeRoute = .addRecipe
    }

    private func navigateToScanRecipe() {
        activeRoute = .scanRecipe
    }
}

enum AppRoute: Hashable {
    case eventDetail(String)
    case newEvent
    case albumDetail(String)
    case kioskControl(String)
    case recipeDetail(String)
    case addRecipe
    case scanRecipe
}
