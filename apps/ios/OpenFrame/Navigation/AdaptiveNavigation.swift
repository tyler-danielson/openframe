import SwiftUI

struct AdaptiveNavigation: View {
    @EnvironmentObject var container: DIContainer
    @Environment(\.horizontalSizeClass) var sizeClass

    var body: some View {
        if sizeClass == .regular {
            iPadSidebar
        } else {
            iPhoneTabBar
        }
    }

    // MARK: - iPhone Tab Bar

    private var iPhoneTabBar: some View {
        TabView {
            if container.canViewCalendar || container.canViewWeather {
                NavigationView { DashboardView() }
                    .navigationViewStyle(.stack)
                    .tabItem {
                        Label("Home", systemImage: "house.fill")
                    }
            }

            if container.canViewCalendar {
                NavigationView { CalendarView() }
                    .navigationViewStyle(.stack)
                    .tabItem {
                        Label("Calendar", systemImage: "calendar")
                    }
            }

            if container.canViewTasks {
                NavigationView { TasksView() }
                    .navigationViewStyle(.stack)
                    .tabItem {
                        Label("Tasks", systemImage: "checklist")
                    }
            }

            if container.canViewKiosks {
                NavigationView { KioskListView() }
                    .navigationViewStyle(.stack)
                    .tabItem {
                        Label("Kiosks", systemImage: "tv")
                    }
            }

            NavigationView { MoreMenuView() }
                .navigationViewStyle(.stack)
                .tabItem {
                    Label("More", systemImage: "ellipsis")
                }
        }
        .accentColor(container.themeManager.palette.primary)
    }

    // MARK: - iPad Sidebar

    private var iPadSidebar: some View {
        let palette = container.themeManager.palette
        return NavigationView {
            List {
                Section("Home") {
                    NavigationLink(destination: DashboardView()) {
                        Label("Dashboard", systemImage: "house.fill")
                    }
                }

                if container.canViewCalendar || container.canViewTasks {
                    Section("Schedule") {
                        if container.canViewCalendar {
                            NavigationLink(destination: CalendarView()) {
                                Label("Calendar", systemImage: "calendar")
                            }
                        }
                        if container.canViewTasks {
                            NavigationLink(destination: TasksView()) {
                                Label("Tasks", systemImage: "checklist")
                            }
                        }
                    }
                }

                if container.canViewPhotos || container.canViewRecipes || container.canViewIptv {
                    Section("Media") {
                        if container.canViewPhotos {
                            NavigationLink(destination: PhotosView()) {
                                Label("Photos", systemImage: "photo.on.rectangle")
                            }
                        }
                        if container.canViewRecipes {
                            NavigationLink(destination: RecipesView()) {
                                Label("Recipes", systemImage: "book.closed")
                            }
                        }
                        if container.canViewIptv {
                            NavigationLink(destination: IptvView()) {
                                Label("IPTV", systemImage: "play.tv")
                            }
                        }
                    }
                }

                if container.canViewHA {
                    Section("Smart Home") {
                        NavigationLink(destination: HAEntitiesView()) {
                            Label("Home Assistant", systemImage: "bolt.fill")
                        }
                    }
                }

                if container.canViewKiosks {
                    Section("Displays") {
                        NavigationLink(destination: KioskListView()) {
                            Label("Kiosks", systemImage: "tv")
                        }
                    }
                }

                if container.canViewNews || container.canViewWeather {
                    Section("Information") {
                        if container.canViewNews {
                            NavigationLink(destination: NewsView()) {
                                Label("News", systemImage: "newspaper")
                            }
                        }
                        if container.canViewWeather {
                            NavigationLink(destination: WeatherView()) {
                                Label("Weather", systemImage: "cloud.sun")
                            }
                        }
                    }
                }

                Section {
                    NavigationLink(destination: SettingsView()) {
                        Label("Settings", systemImage: "gearshape")
                    }
                }
            }
            .listStyle(.sidebar)
            .navigationTitle("OpenFrame")
            .accentColor(palette.primary)

            // Default detail
            DashboardView()
        }
        .navigationViewStyle(.columns)
        .accentColor(palette.primary)
    }
}

// MARK: - More Menu (iPhone)

struct MoreMenuView: View {
    @EnvironmentObject var container: DIContainer

    var body: some View {
        let palette = container.themeManager.palette
        List {
            if container.canViewPhotos {
                NavigationLink(destination: PhotosView()) {
                    Label("Photos", systemImage: "photo.on.rectangle")
                }
            }
            if container.canViewRecipes {
                NavigationLink(destination: RecipesView()) {
                    Label("Recipes", systemImage: "book.closed")
                }
            }
            if container.canViewHA {
                NavigationLink(destination: HAEntitiesView()) {
                    Label("Home Assistant", systemImage: "bolt.fill")
                }
            }
            if container.canViewIptv {
                NavigationLink(destination: IptvView()) {
                    Label("IPTV", systemImage: "play.tv")
                }
            }
            if container.canViewNews {
                NavigationLink(destination: NewsView()) {
                    Label("News", systemImage: "newspaper")
                }
            }
            if container.canViewWeather {
                NavigationLink(destination: WeatherView()) {
                    Label("Weather", systemImage: "cloud.sun")
                }
            }

            Section {
                NavigationLink(destination: SettingsView()) {
                    Label("Settings", systemImage: "gearshape")
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("More")
        .accentColor(palette.primary)
    }
}
