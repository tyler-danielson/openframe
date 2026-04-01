import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var container: DIContainer
    @State private var weather: WeatherData?
    @State private var events: [CalendarEvent] = []
    @State private var tasks: [OFTask] = []
    @State private var isLoading = true

    var body: some View {
        let palette = container.themeManager.palette
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Greeting
                VStack(alignment: .leading, spacing: 4) {
                    Text(greeting)
                        .font(.title2.bold())
                        .foregroundStyle(palette.foreground)
                    Text(Date().shortDateString)
                        .font(.subheadline)
                        .foregroundStyle(palette.mutedForeground)
                }

                // Weather card
                if container.canViewWeather, let weather {
                    WeatherCard(weather: weather)
                }

                // Upcoming events
                if container.canViewCalendar {
                    SectionHeader(title: "Upcoming Events", icon: "calendar")
                    if events.isEmpty {
                        Text("No upcoming events")
                            .font(.subheadline)
                            .foregroundStyle(palette.mutedForeground)
                            .padding(.vertical, 8)
                    } else {
                        ForEach(events.prefix(5)) { event in
                            EventCard(event: event)
                        }
                    }
                }

                // Today's tasks
                if container.canViewTasks {
                    SectionHeader(title: "Today's Tasks", icon: "checklist")
                    if tasks.isEmpty {
                        Text("No tasks for today")
                            .font(.subheadline)
                            .foregroundStyle(palette.mutedForeground)
                            .padding(.vertical, 8)
                    } else {
                        ForEach(tasks.prefix(5)) { task in
                            TaskRow(task: task) {
                                toggleTask(task)
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .background(palette.background.ignoresSafeArea())
        .navigationTitle("Home")
        .task { await loadData() }
        .refreshable { await loadData() }
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        let name = container.currentUser?.name?.components(separatedBy: " ").first ?? ""
        let prefix: String
        switch hour {
        case 0..<12: prefix = "Good morning"
        case 12..<17: prefix = "Good afternoon"
        default: prefix = "Good evening"
        }
        return name.isEmpty ? prefix : "\(prefix), \(name)"
    }

    private func loadData() async {
        isLoading = true
        async let weatherTask: () = loadWeather()
        async let eventsTask: () = loadEvents()
        async let tasksTask: () = loadTasks()
        _ = await (weatherTask, eventsTask, tasksTask)
        isLoading = false
    }

    private func loadWeather() async {
        guard container.canViewWeather else { return }
        weather = try? await container.weatherRepository.getCurrentWeather()
    }

    private func loadEvents() async {
        guard container.canViewCalendar else { return }
        let now = Date()
        events = (try? await container.calendarRepository.getEvents(start: now, end: now.endOfDay)) ?? []
    }

    private func loadTasks() async {
        guard container.canViewTasks else { return }
        tasks = ((try? await container.taskRepository.getTasks(status: "needsAction")) ?? [])
            .filter { task in
                guard let due = task.dueDateParsed else { return false }
                return Calendar.current.isDateInToday(due) || due.isPast
            }
    }

    private func toggleTask(_ task: OFTask) {
        Task {
            try? await container.taskRepository.updateTask(id: task.id, updates: ["status": task.isCompleted ? "needsAction" : "completed"])
            await loadTasks()
        }
    }
}

private struct WeatherCard: View {
    let weather: WeatherData
    @EnvironmentObject var container: DIContainer

    var body: some View {
        let palette = container.themeManager.palette
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                if let temp = weather.temp {
                    Text("\(Int(temp))°")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(palette.foreground)
                }
                if let desc = weather.description {
                    Text(desc.capitalized)
                        .font(.subheadline)
                        .foregroundStyle(palette.mutedForeground)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                if let hi = weather.tempMax, let lo = weather.tempMin {
                    Text("H: \(Int(hi))° L: \(Int(lo))°")
                        .font(.caption)
                        .foregroundStyle(palette.mutedForeground)
                }
                if let feels = weather.feelsLike {
                    Text("Feels like \(Int(feels))°")
                        .font(.caption)
                        .foregroundStyle(palette.mutedForeground)
                }
            }
        }
        .padding()
        .background(palette.secondary)
        .cornerRadius(12)
    }
}

private struct SectionHeader: View {
    let title: String
    let icon: String
    @EnvironmentObject var container: DIContainer

    var body: some View {
        let palette = container.themeManager.palette
        HStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundStyle(palette.primary)
            Text(title)
                .font(.headline)
                .foregroundStyle(palette.foreground)
        }
        .padding(.top, 8)
    }
}
