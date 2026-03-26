import SwiftUI

struct NewEventView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: EventViewModel?

    // Quick add
    @State private var quickText = ""

    // Detailed form
    @State private var showDetailedForm = false
    @State private var title = ""
    @State private var location = ""
    @State private var description = ""
    @State private var startDate = Date()
    @State private var endDate = Date().addingTimeInterval(3600)
    @State private var isAllDay = false
    @State private var selectedCalendarId: String?
    @State private var isSubmitting = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Quick add section
                VStack(alignment: .leading, spacing: 8) {
                    Text("Quick Add")
                        .font(.headline)
                    HStack {
                        TextField("e.g. Lunch tomorrow at noon", text: $quickText)
                            .textFieldStyle(.roundedBorder)
                        Button {
                            Task { await quickAdd() }
                        } label: {
                            Image(systemName: "paperplane.fill")
                                .foregroundStyle(appState.themeManager.palette.primary)
                        }
                        .disabled(quickText.isEmpty || isSubmitting)
                    }
                }

                Divider()

                // Toggle detailed form
                Button {
                    withAnimation { showDetailedForm.toggle() }
                    if showDetailedForm && viewModel?.calendars.isEmpty == true {
                        Task { await viewModel?.loadCalendars() }
                    }
                } label: {
                    HStack {
                        Text(showDetailedForm ? "Hide detailed form" : "Use detailed form")
                        Image(systemName: showDetailedForm ? "chevron.up" : "chevron.down")
                    }
                    .font(.subheadline)
                }

                if showDetailedForm {
                    VStack(spacing: 14) {
                        TextField("Title", text: $title)
                            .textFieldStyle(.roundedBorder)

                        // Calendar picker
                        if let calendars = viewModel?.calendars, !calendars.isEmpty {
                            Picker("Calendar", selection: $selectedCalendarId) {
                                ForEach(calendars) { cal in
                                    Text(cal.effectiveName).tag(cal.id as String?)
                                }
                            }
                            .pickerStyle(.menu)
                        }

                        Toggle("All Day", isOn: $isAllDay)

                        DatePicker("Start", selection: $startDate, displayedComponents: isAllDay ? .date : [.date, .hourAndMinute])
                        DatePicker("End", selection: $endDate, displayedComponents: isAllDay ? .date : [.date, .hourAndMinute])

                        TextField("Location", text: $location)
                            .textFieldStyle(.roundedBorder)

                        TextField("Description", text: $description, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(3...6)

                        Button {
                            Task { await createDetailedEvent() }
                        } label: {
                            HStack {
                                if isSubmitting { ProgressView().tint(.white) }
                                Text("Create Event")
                            }
                            .frame(maxWidth: .infinity).padding()
                            .background(appState.themeManager.palette.primary)
                            .foregroundStyle(appState.themeManager.palette.primaryForeground)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                        }
                        .disabled(title.isEmpty || selectedCalendarId == nil || isSubmitting)
                    }
                }
            }
            .padding()
        }
        .navigationTitle("New Event")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            let vm = EventViewModel(calendarRepository: appState.calendarRepository)
            viewModel = vm
        }
    }

    private func quickAdd() async {
        isSubmitting = true
        if let _ = await viewModel?.createQuickEvent(text: quickText, calendarId: nil) {
            dismiss()
        }
        isSubmitting = false
    }

    private func createDetailedEvent() async {
        guard let calId = selectedCalendarId else { return }
        isSubmitting = true
        let request = CreateEventRequest(
            calendarId: calId,
            title: title,
            startTime: startDate.toISO8601(),
            endTime: endDate.toISO8601(),
            description: description.isEmpty ? nil : description,
            location: location.isEmpty ? nil : location,
            isAllDay: isAllDay
        )
        if let _ = await viewModel?.createEvent(request) {
            dismiss()
        }
        isSubmitting = false
    }
}
