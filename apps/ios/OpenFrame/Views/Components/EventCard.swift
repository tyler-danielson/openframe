import SwiftUI

struct EventCard: View {
    let event: CalendarEvent
    var onTap: (() -> Void)?

    private var eventColor: Color {
        event.effectiveColor?.toColor() ?? .blue
    }

    var body: some View {
        Button(action: { onTap?() }) {
            HStack(spacing: 0) {
                // Color stripe
                RoundedRectangle(cornerRadius: 2)
                    .fill(eventColor)
                    .frame(width: 4)
                    .padding(.vertical, 4)

                HStack(spacing: 12) {
                    // Time column
                    if !event.isAllDay {
                        VStack(alignment: .leading) {
                            if let start = event.startTime.toDate() {
                                Text(start.formatTime())
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .frame(width: 60, alignment: .leading)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(event.title ?? "Untitled")
                            .font(.subheadline)
                            .lineLimit(1)

                        if event.isAllDay {
                            Text("All day")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }

                        if let location = event.location, !location.isEmpty {
                            HStack(spacing: 4) {
                                Image(systemName: "mappin")
                                    .font(.system(size: 9))
                                Text(location)
                                    .lineLimit(1)
                            }
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        }
                    }

                    Spacer()
                }
                .padding(.leading, 10)
                .padding(.vertical, 8)
                .padding(.trailing, 12)
            }
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }
}
