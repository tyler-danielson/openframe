import Foundation

struct Kiosk: Identifiable, Codable {
    let id: String
    var name: String
    var isActive: Bool?
    var displayMode: String?
    var displayType: String?
    var colorScheme: String?
    var screensaverEnabled: Bool?
    var lastAccessedAt: String?
    var dashboards: [KioskDashboard]?
    var enabledFeatures: KioskEnabledFeatures?
}

struct KioskDashboard: Identifiable, Codable {
    let id: String
    var name: String?
    var type: String?
    var sortOrder: Int?
}

struct KioskEnabledFeatures: Codable {
    var calendar: Bool?
    var dashboard: Bool?
    var tasks: Bool?
    var routines: Bool?
    var photos: Bool?
    var spotify: Bool?
    var iptv: Bool?
    var youtube: Bool?
    var cameras: Bool?
    var multiview: Bool?
    var homeassistant: Bool?
    var map: Bool?
    var kitchen: Bool?
    var chat: Bool?
    var screensaver: Bool?
    var cardview: Bool?
}

struct KioskSavedFile: Identifiable, Codable {
    let id: String
    var name: String?
    var url: String?
    var type: String?
}
