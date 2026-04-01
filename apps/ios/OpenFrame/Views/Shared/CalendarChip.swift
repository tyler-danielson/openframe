import SwiftUI

struct CalendarChip: View {
    let calendar: OFCalendar
    let isSelected: Bool
    let palette: ThemePalette
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Circle()
                    .fill(calendarColor)
                    .frame(width: 8, height: 8)

                Text(calendar.displayName ?? calendar.name)
                    .font(.caption)
                    .lineLimit(1)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isSelected ? palette.primary.opacity(0.15) : palette.secondary)
            .foregroundStyle(isSelected ? palette.primary : palette.foreground)
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(isSelected ? palette.primary.opacity(0.4) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var calendarColor: Color {
        if let hex = calendar.color {
            return Color(hex: hex)
        }
        return palette.primary
    }
}
