import SwiftUI

struct CalendarView: View {
    @EnvironmentObject var container: DIContainer
    @State private var selectedDate = Date()
    @State private var events: [CalendarEvent] = []
    @State private var calendars: [OFCalendar] = []
    @State private var eventDates: Set<String> = []
    @State private var isLoading = false
    @State private var showNewEvent = false

    var body: some View {
        let palette = container.themeManager.palette
        VStack(spacing: 0) {
            // Month calendar grid
            MonthCalendarGrid(
                selectedDate: $selectedDate,
                eventDates: eventDates,
                palette: palette
            )
            .padding(.horizontal)
            .onChange(of: selectedDate) { _ in
                Task { await loadEventsForDay() }
            }

            Divider().background(palette.border)

            // Events for selected day
            ScrollView {
                LazyVStack(spacing: 8) {
                    if dayEvents.isEmpty {
                        EmptyStateView(
                            icon: "calendar.badge.exclamationmark",
                            title: "No Events",
                            message: "Nothing scheduled for \(selectedDate.relativeString)"
                        )
                        .frame(height: 200)
                    } else {
                        ForEach(dayEvents) { event in
                            NavigationLink(destination: EventDetailView(event: event)) {
                                EventCard(event: event)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding()
            }
        }
        .background(palette.background.ignoresSafeArea())
        .navigationTitle("Calendar")
        .toolbar {
            if container.canEditCalendar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { showNewEvent = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
        }
        .sheet(isPresented: $showNewEvent) {
            NavigationView {
                NewEventView(calendars: calendars, defaultDate: selectedDate) {
                    Task { await loadMonthEvents() }
                }
            }
        }
        .task {
            await loadCalendars()
            await loadMonthEvents()
        }
    }

    private var dayEvents: [CalendarEvent] {
        events.filter { event in
            guard let start = Date.fromISO(event.startTime) else { return false }
            return start.isSameDay(as: selectedDate)
        }
        .sorted { a, b in
            (a.isAllDay ? 0 : 1) < (b.isAllDay ? 0 : 1) ||
            (a.startTime < b.startTime)
        }
    }

    private func loadCalendars() async {
        calendars = (try? await container.calendarRepository.getCalendars()) ?? []
    }

    private func loadMonthEvents() async {
        isLoading = true
        let start = selectedDate.startOfMonth.adding(days: -7)
        let end = selectedDate.endOfMonth.adding(days: 7)
        events = (try? await container.calendarRepository.getEvents(start: start, end: end)) ?? []
        updateEventDates()
        isLoading = false
    }

    private func loadEventsForDay() async {
        // Events already loaded for the month; just filter
    }

    private func updateEventDates() {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        eventDates = Set(events.compactMap { event in
            guard let date = Date.fromISO(event.startTime) else { return nil }
            return fmt.string(from: date)
        })
    }
}

// MARK: - Month Calendar Grid

struct MonthCalendarGrid: View {
    @Binding var selectedDate: Date
    let eventDates: Set<String>
    let palette: ThemePalette

    private let calendar = Calendar.current
    private let weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    var body: some View {
        VStack(spacing: 8) {
            // Month/year header with arrows
            HStack {
                Button { selectedDate = selectedDate.adding(months: -1) } label: {
                    Image(systemName: "chevron.left")
                        .foregroundStyle(palette.primary)
                }
                Spacer()
                Text(monthYearString)
                    .font(.headline)
                    .foregroundStyle(palette.foreground)
                Spacer()
                Button { selectedDate = selectedDate.adding(months: 1) } label: {
                    Image(systemName: "chevron.right")
                        .foregroundStyle(palette.primary)
                }
            }
            .padding(.vertical, 8)

            // Weekday headers
            HStack {
                ForEach(weekdays, id: \.self) { day in
                    Text(day)
                        .font(.caption2)
                        .foregroundStyle(palette.mutedForeground)
                        .frame(maxWidth: .infinity)
                }
            }

            // Days grid
            let days = daysInMonth
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 4) {
                ForEach(days, id: \.self) { date in
                    DayCell(
                        date: date,
                        isSelected: date.isSameDay(as: selectedDate),
                        isToday: date.isToday,
                        isCurrentMonth: calendar.isDate(date, equalTo: selectedDate, toGranularity: .month),
                        hasEvents: hasEvents(on: date),
                        palette: palette
                    )
                    .onTapGesture { selectedDate = date }
                }
            }
        }
        .padding(.vertical, 8)
    }

    private var monthYearString: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "MMMM yyyy"
        return fmt.string(from: selectedDate)
    }

    private var daysInMonth: [Date] {
        let start = selectedDate.startOfMonth
        let weekday = calendar.component(.weekday, from: start) - 1
        let firstDay = start.adding(days: -weekday)
        return (0..<42).map { firstDay.adding(days: $0) }
    }

    private func hasEvents(on date: Date) -> Bool {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        return eventDates.contains(fmt.string(from: date))
    }
}

private struct DayCell: View {
    let date: Date
    let isSelected: Bool
    let isToday: Bool
    let isCurrentMonth: Bool
    let hasEvents: Bool
    let palette: ThemePalette

    var body: some View {
        VStack(spacing: 2) {
            Text("\(date.dayNumber)")
                .font(.subheadline)
                .foregroundStyle(foregroundColor)

            Circle()
                .fill(hasEvents ? palette.primary : .clear)
                .frame(width: 4, height: 4)
        }
        .frame(height: 36)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(isSelected ? palette.primary.opacity(0.2) : .clear)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(isToday ? palette.primary : .clear, lineWidth: 1)
        )
    }

    private var foregroundColor: Color {
        if isSelected { return palette.primary }
        if !isCurrentMonth { return palette.mutedForeground.opacity(0.4) }
        return palette.foreground
    }
}
