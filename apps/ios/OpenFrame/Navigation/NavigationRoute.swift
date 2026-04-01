import SwiftUI

enum NavigationRoute: Hashable {
    // Dashboard
    case dashboard

    // Calendar
    case calendar
    case eventDetail(id: String)
    case newEvent(date: Date?)

    // Tasks
    case tasks
    case taskDetail(id: String)

    // Photos
    case photos
    case albumDetail(id: String, title: String)

    // Recipes
    case recipes
    case recipeDetail(id: String)
    case addRecipe
    case scanRecipe

    // Kiosks
    case kiosks
    case kioskControl(id: String)

    // Home Assistant
    case homeAssistant

    // IPTV
    case iptv

    // News
    case news

    // Weather
    case weather

    // Settings
    case settings
    case companionInvites

    // Auth
    case qrConnect
}

// MARK: - Destination View Builder

struct NavigationDestination: View {
    let route: NavigationRoute
    @EnvironmentObject var container: DIContainer

    var body: some View {
        switch route {
        case .dashboard:
            DashboardView()
        case .calendar:
            CalendarView()
        case .eventDetail(let id):
            EventDetailView(eventId: id)
        case .newEvent:
            NewEventView()
        case .tasks:
            TasksView()
        case .taskDetail:
            TasksView() // task detail handled inline
        case .photos:
            PhotosView()
        case .albumDetail(let id, let title):
            AlbumDetailView(albumId: id, albumTitle: title)
        case .recipes:
            RecipesView()
        case .recipeDetail(let id):
            RecipeDetailView(recipeId: id)
        case .addRecipe:
            AddRecipeView()
        case .scanRecipe:
            ScanRecipeView()
        case .kiosks:
            KioskListView()
        case .kioskControl(let id):
            KioskControlView(kioskId: id)
        case .homeAssistant:
            HAEntitiesView()
        case .iptv:
            IptvView()
        case .news:
            NewsView()
        case .weather:
            WeatherView()
        case .settings:
            SettingsView()
        case .companionInvites:
            JoinRequestsView()
        case .qrConnect:
            QRConnectView()
        }
    }
}
