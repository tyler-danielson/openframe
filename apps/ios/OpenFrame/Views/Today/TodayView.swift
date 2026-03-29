import SwiftUI

struct TodayView: View {
    @EnvironmentObject private var appState: AppState
    @State private var viewModel: TodayViewModel?

    var onNavigateToEvent: (String) -> Void
    var onNavigateToNewEvent: () -> Void

    var body: some View {
        Group {
            if let vm = viewModel {
                TodayContentView(viewModel: vm, appState: appState, onNavigateToEvent: onNavigateToEvent)
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
}

private struct TodayContentView: View {
    @ObservedObject var viewModel: TodayViewModel
    let appState: AppState
    var onNavigateToEvent: (String) -> Void

    var body: some View {
        if viewModel.isLoading && viewModel.groupedEvents.isEmpty {
            LoadingView()
        } else if let error = viewModel.errorMessage, viewModel.groupedEvents.isEmpty {
            ErrorView(message: error) { Task { await viewModel.loadEvents() } }
        } else if viewModel.groupedEvents.isEmpty {
            EmptyStateView(icon: "calendar", title: "No upcoming events", subtitle: "Events for the next 7 days will appear here")
        } else {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    ForEach(viewModel.groupedEvents, id: \.0) { dateLabel, events in
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
            .refreshable { await viewModel.loadEvents() }
        }
    }
}
