import SwiftUI

struct EventDetailView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    let eventId: String
    @State private var viewModel: EventViewModel?
    @State private var showDeleteConfirm = false

    var body: some View {
        Group {
            if let vm = viewModel {
                EventDetailContentView(viewModel: vm, appState: appState)
            } else {
                LoadingView()
            }
        }
        .navigationTitle("Event")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .destructiveAction) {
                Button(role: .destructive) {
                    showDeleteConfirm = true
                } label: {
                    Image(systemName: "trash")
                }
            }
        }
        .task {
            let vm = EventViewModel(calendarRepository: appState.calendarRepository)
            viewModel = vm
            await vm.loadEvent(id: eventId)
        }
        .alert("Delete Event", isPresented: $showDeleteConfirm) {
            Button("Delete", role: .destructive) {
                Task {
                    if let vm = viewModel, await vm.deleteEvent(id: eventId) {
                        dismiss()
                    }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to delete this event?")
        }
    }
}

private struct EventDetailContentView: View {
    @ObservedObject var viewModel: EventViewModel
    let appState: AppState

    var body: some View {
        let palette = appState.themeManager.palette
        if viewModel.isLoading {
            LoadingView()
        } else if let event = viewModel.event {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Title
                    Text(event.title ?? "Untitled")
                        .font(Font.title2.bold())

                    // Calendar name
                    if let calName = event.calendarName {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(event.effectiveColor?.toColor() ?? palette.primary)
                                .frame(width: 10, height: 10)
                            Text(calName)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Divider()

                    // Time
                    HStack(spacing: 12) {
                        Image(systemName: "clock")
                            .foregroundStyle(palette.primary)
                        VStack(alignment: .leading, spacing: 2) {
                            if let start = event.startTime.toDate() {
                                Text(start.formatDateFull())
                                    .font(.subheadline)
                            }
                            if event.isAllDay {
                                Text("All day")
                                    .font(.caption).foregroundStyle(.secondary)
                            } else if let start = event.startTime.toDate(),
                                      let end = event.endTime.toDate() {
                                Text("\(start.formatTime()) - \(end.formatTime())")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }

                    // Location
                    if let location = event.location, !location.isEmpty {
                        HStack(spacing: 12) {
                            Image(systemName: "mappin.and.ellipse")
                                .foregroundStyle(palette.primary)
                            Text(location).font(.subheadline)
                        }
                    }

                    // Description
                    if let desc = event.description, !desc.isEmpty {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: "doc.text")
                                .foregroundStyle(palette.primary)
                            Text(desc).font(.subheadline)
                        }
                    }
                }
                .padding()
            }
        } else if let error = viewModel.errorMessage {
            ErrorView(message: error)
        }
    }
}
