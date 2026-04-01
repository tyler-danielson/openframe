import SwiftUI

struct TaskRow: View {
    let task: OFTask
    var onToggle: (() -> Void)?
    @EnvironmentObject var container: DIContainer

    var body: some View {
        let palette = container.themeManager.palette
        HStack(spacing: 12) {
            Button {
                HapticService.impact(.light)
                onToggle?()
            } label: {
                Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(task.isCompleted ? palette.primary : palette.mutedForeground)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .font(.subheadline)
                    .foregroundStyle(task.isCompleted ? palette.mutedForeground : palette.foreground)
                    .strikethrough(task.isCompleted, color: nil)

                if let dueDate = task.dueDateParsed {
                    Text(dueDate.relativeString)
                        .font(.caption)
                        .foregroundStyle(dueDate.isPast && !task.isCompleted ? palette.destructive : palette.mutedForeground)
                }
            }

            Spacer()
        }
        .padding(.vertical, 4)
    }
}
