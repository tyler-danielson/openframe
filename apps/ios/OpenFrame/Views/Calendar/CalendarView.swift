import SwiftUI

struct CalendarTabView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel: CalendarViewModel?

    var onNavigateToEvent: (String) -> Void
    var onNavigateToNewEvent: () -> Void

    var body: some View {
        Group {
            if let vm = viewModel {
                calendarContent(vm)
            } else {
                LoadingView()
            }
        }
        .navigationTitle("Calendar")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: onNavigateToNewEvent) {
                    Image(systemName: "plus")
                }
            }
        }
        .task {
            let vm = CalendarViewModel(calendarRepository: appState.calendarRepository)
            viewModel = vm
            await vm.loadMonth()
        }
    }

    @ViewBuilder
    private func calendarContent(_ vm: CalendarViewModel) -> some View {
        let palette = appState.themeManager.palette
        ScrollView {
            VStack(spacing: 0) {
                // Month navigation
                HStack {
                    Button { vm.navigateMonth(forward: false) } label: {
                        Image(systemName: "chevron.left")
                    }
                    Spacer()
                    Text(monthYearString(vm.currentMonth))
                        .font(.headline)
                    Spacer()
                    Button { vm.navigateMonth(forward: true) } label: {
                        Image(systemName: "chevron.right")
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 12)

                // Day-of-week headers
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 0) {
                    ForEach(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], id: \.self) { day in
                        Text(day)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .frame(height: 30)
                    }
                }
                .padding(.horizontal)

                // Calendar grid
                let days = calendarDays(for: vm.currentMonth)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 4) {
                    ForEach(days, id: \.self) { date in
                        if let date {
                            CalendarDayCell(
                                date: date,
                                isSelected: Calendar.current.isDate(date, inSameDayAs: vm.selectedDate),
                                isToday: date.isToday,
                                hasEvents: vm.daysWithEvents.contains(Calendar.current.component(.day, from: date)),
                                primaryColor: palette.primary
                            ) {
                                vm.selectDate(date)
                            }
                        } else {
                            Color.clear.frame(height: 40)
                        }
                    }
                }
                .padding(.horizontal)

                Divider().padding(.vertical, 8)

                // Events for selected day
                if vm.eventsForSelectedDate.isEmpty {
                    Text("No events")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .padding()
                } else {
                    LazyVStack(spacing: 6) {
                        ForEach(vm.eventsForSelectedDate) { event in
                            EventCard(event: event) { onNavigateToEvent(event.id) }
                                .padding(.horizontal)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }

    private func monthYearString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: date)
    }

    private func calendarDays(for month: Date) -> [Date?] {
        let cal = Calendar.current
        let start = month.startOfMonth()
        let weekday = cal.component(.weekday, from: start)
        let daysInMonth = cal.range(of: .day, in: .month, for: start)!.count

        var days: [Date?] = Array(repeating: nil, count: weekday - 1)
        for day in 1...daysInMonth {
            if let date = cal.date(bySetting: .day, value: day, of: start) {
                days.append(date)
            }
        }
        // Pad to fill grid
        while days.count % 7 != 0 { days.append(nil) }
        return days
    }
}

private struct CalendarDayCell: View {
    let date: Date
    let isSelected: Bool
    let isToday: Bool
    let hasEvents: Bool
    let primaryColor: Color
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 2) {
                Text("\(Calendar.current.component(.day, from: date))")
                    .font(.subheadline)
                    .foregroundStyle(isSelected ? .white : .primary)
                    .frame(width: 34, height: 34)
                    .background(
                        Circle().fill(
                            isSelected ? primaryColor :
                            isToday ? primaryColor.opacity(0.2) : .clear
                        )
                    )

                Circle()
                    .fill(hasEvents ? primaryColor : .clear)
                    .frame(width: 4, height: 4)
            }
        }
        .buttonStyle(.plain)
        .frame(height: 44)
    }
}
