import SwiftUI

struct EventCard: View {
    let event: CalendarEvent
    @EnvironmentObject var container: DIContainer

    var body: some View {
        let palette = container.themeManager.palette
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 2)
                .fill(Color.from(css: event.calendarColor) ?? palette.primary)
                .frame(width: 4)

            VStack(alignment: .leading, spacing: 4) {
                Text(event.title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(palette.foreground)
                    .lineLimit(1)

                if event.isAllDay {
                    Text("All day")
                        .font(.caption)
                        .foregroundStyle(palette.mutedForeground)
                } else if let start = Date.fromISO(event.startTime),
                          let end = Date.fromISO(event.endTime) {
                    Text("\(start.timeString) – \(end.timeString)")
                        .font(.caption)
                        .foregroundStyle(palette.mutedForeground)
                }

                if let location = event.location, !location.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin")
                            .font(.caption2)
                        Text(location)
                            .font(.caption)
                            .lineLimit(1)
                    }
                    .foregroundStyle(palette.mutedForeground)
                }
            }
            Spacer()
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(palette.secondary)
        .cornerRadius(10)
    }
}
