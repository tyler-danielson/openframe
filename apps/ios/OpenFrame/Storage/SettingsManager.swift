import Foundation

final class SettingsManager: ObservableObject {
    private let defaults = UserDefaults.standard

    static let colorSchemeKey = "openframe_color_scheme"
    static let visibleCalendarsKey = "openframe_visible_calendars"
    static let selectedTaskListKey = "openframe_selected_task_list"

    var colorScheme: String {
        get { defaults.string(forKey: Self.colorSchemeKey) ?? "default" }
        set { defaults.set(newValue, forKey: Self.colorSchemeKey) }
    }

    var visibleCalendarIds: Set<String> {
        get {
            guard let raw = defaults.string(forKey: Self.visibleCalendarsKey), !raw.isEmpty else {
                return []
            }
            return Set(raw.components(separatedBy: ","))
        }
        set {
            defaults.set(newValue.joined(separator: ","), forKey: Self.visibleCalendarsKey)
        }
    }

    var selectedTaskListId: String? {
        get { defaults.string(forKey: Self.selectedTaskListKey) }
        set { defaults.set(newValue, forKey: Self.selectedTaskListKey) }
    }
}
