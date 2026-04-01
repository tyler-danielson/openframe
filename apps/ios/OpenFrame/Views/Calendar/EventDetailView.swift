import SwiftUI

struct EventDetailView: View {
    let event: CalendarEvent
    @EnvironmentObject var container: DIContainer
    @Environment(\.presentationMode) var presentationMode
    @State private var showDeleteConfirm = false

    var body: some View {
        let palette = container.themeManager.palette
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Color bar + title
                HStack(spacing: 12) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.from(css: event.calendarColor) ?? palette.primary)
                        .frame(width: 6)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(event.title)
                            .font(.title2.bold())
                            .foregroundStyle(palette.foreground)

                        if event.isAllDay {
                            Text("All day")
                                .font(.subheadline)
                                .foregroundStyle(palette.mutedForeground)
                        } else if let start = Date.fromISO(event.startTime),
                                  let end = Date.fromISO(event.endTime) {
                            Text("\(start.shortDateString)")
                                .font(.subheadline)
                                .foregroundStyle(palette.mutedForeground)
                            Text("\(start.timeString) – \(end.timeString)")
                                .font(.subheadline)
                                .foregroundStyle(palette.mutedForeground)
                        }
                    }
                }
                .frame(minHeight: 60)

                // Location
                if let location = event.location, !location.isEmpty {
                    DetailRow(icon: "mappin", title: "Location", value: location)
                }

                // Description
                if let desc = event.description, !desc.isEmpty {
                    DetailRow(icon: "text.alignleft", title: "Description", value: desc)
                }

                // Delete button
                if container.canEditCalendar {
                    Button {
                        showDeleteConfirm = true
                    } label: {
                        HStack {
                            Image(systemName: "trash")
                            Text("Delete Event")
                        }
                        .foregroundStyle(palette.destructive)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(palette.destructive.opacity(0.1))
                        .cornerRadius(12)
                    }
                    .padding(.top, 20)
                }
            }
            .padding()
        }
        .background(palette.background.ignoresSafeArea())
        .navigationTitle("Event")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Delete Event", isPresented: $showDeleteConfirm) {
            Button("Delete", role: .destructive) { deleteEvent() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to delete this event?")
        }
    }

    private func deleteEvent() {
        Task {
            try? await container.calendarRepository.deleteEvent(id: event.id)
            presentationMode.wrappedValue.dismiss()
        }
    }
}

private struct DetailRow: View {
    let icon: String
    let title: String
    let value: String
    @EnvironmentObject var container: DIContainer

    var body: some View {
        let palette = container.themeManager.palette
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(palette.primary)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(palette.mutedForeground)
                Text(value)
                    .font(.subheadline)
                    .foregroundStyle(palette.foreground)
            }
        }
    }
}
