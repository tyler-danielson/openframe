import SwiftUI

struct TodayView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel: TodayViewModel?

    var onNavigateToEvent: (String) -> Void
    var onNavigateToNewEvent: () -> Void

    var body: some View {
        Group {
            if let vm = viewModel {
                todayContent(vm)
            } else {
                LoadingView()
            }
        }
        .navigationTitle("Today")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: onNavigateToNewEvent) {
                    Image(systemName: "plus")
                }
            }
        }
        .task {
            let vm = TodayViewModel(calendarRepository: appState.calendarRepository)
            viewModel = vm
            await vm.loadEvents()
        }
    }

    @ViewBuilder
    private func todayContent(_ vm: TodayViewModel) -> some View {
        if vm.isLoading && vm.groupedEvents.isEmpty {
            LoadingView()
        } else if let error = vm.errorMessage, vm.groupedEvents.isEmpty {
            ErrorView(message: error) { Task { await vm.loadEvents() } }
        } else if vm.groupedEvents.isEmpty {
            EmptyStateView(icon: "calendar", title: "No upcoming events", subtitle: "Events for the next 7 days will appear here")
        } else {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    ForEach(vm.groupedEvents, id: \.0) { dateLabel, events in
                        Text(dateLabel)
                            .font(.headline)
                            .foregroundStyle(appState.themeManager.palette.primary)
                            .padding(.top, 12)
                            .padding(.horizontal)

                        ForEach(events) { event in
                            EventCard(event: event) {
                                onNavigateToEvent(event.id)
                            }
                            .padding(.horizontal)
                        }
                    }
                }
                .padding(.vertical)
            }
            .refreshable { await vm.loadEvents() }
        }
    }
}
