import SwiftUI

struct NewEventView: View {
    var onCreated: (() -> Void)?

    @EnvironmentObject var container: DIContainer
    @Environment(\.presentationMode) var presentationMode
    @State private var calendars: [OFCalendar]
    @State private var title = ""
    @State private var selectedCalendarId: String = ""
    @State private var startDate: Date
    @State private var endDate: Date
    @State private var isAllDay = false
    @State private var location = ""
    @State private var description = ""
    @State private var isSaving = false
    @State private var error: String?
    @State private var needsCalendarLoad: Bool

    init(calendars: [OFCalendar] = [], defaultDate: Date = Date(), onCreated: (() -> Void)? = nil) {
        self.onCreated = onCreated
        self._calendars = State(initialValue: calendars)
        self._needsCalendarLoad = State(initialValue: calendars.isEmpty)
        let start = Calendar.current.date(bySettingHour: Calendar.current.component(.hour, from: Date()) + 1, minute: 0, second: 0, of: defaultDate) ?? defaultDate
        _startDate = State(initialValue: start)
        _endDate = State(initialValue: start.addingTimeInterval(3600))
        _selectedCalendarId = State(initialValue: calendars.first?.id ?? "")
    }

    var body: some View {
        let palette = container.themeManager.palette
        Form {
            Section {
                TextField("Event title", text: $title)
            }

            if !calendars.isEmpty {
                Section {
                    Picker("Calendar", selection: $selectedCalendarId) {
                        ForEach(calendars) { cal in
                            Text(cal.displayName ?? cal.name).tag(cal.id)
                        }
                    }
                }
            }

            Section {
                Toggle("All Day", isOn: $isAllDay)

                DatePicker("Start", selection: $startDate, displayedComponents: isAllDay ? .date : [.date, .hourAndMinute])
                DatePicker("End", selection: $endDate, displayedComponents: isAllDay ? .date : [.date, .hourAndMinute])
            }

            Section {
                TextField("Location", text: $location)
                TextField("Description", text: $description, axis: .vertical)
                    .lineLimit(3...6)
            }

            if let error {
                Section {
                    Text(error).foregroundStyle(palette.destructive).font(.caption)
                }
            }
        }
        .navigationTitle("New Event")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(content: {
            ToolbarItem(placement: .navigationBarLeading) {
                Button("Cancel") { presentationMode.wrappedValue.dismiss() }
            }
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Save") { save() }
                    .disabled(title.isEmpty || isSaving)
            }
        })
        .task {
            if needsCalendarLoad {
                calendars = (try? await container.calendarRepository.getCalendars()) ?? []
                if selectedCalendarId.isEmpty {
                    selectedCalendarId = calendars.first?.id ?? ""
                }
            }
        }
    }

    private func save() {
        isSaving = true
        error = nil
        Task {
            do {
                _ = try await container.calendarRepository.createEvent(
                    calendarId: selectedCalendarId,
                    title: title,
                    start: startDate,
                    end: endDate,
                    isAllDay: isAllDay,
                    description: description.isEmpty ? nil : description,
                    location: location.isEmpty ? nil : location
                )
                onCreated?()
                presentationMode.wrappedValue.dismiss()
            } catch {
                self.error = error.localizedDescription
            }
            isSaving = false
        }
    }
}
