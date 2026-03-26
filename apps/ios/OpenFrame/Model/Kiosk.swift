import Foundation

struct Kiosk: Identifiable, Codable, Sendable, Equatable {
    let id: String
    let name: String
    let isActive: Bool
    let displayMode: String?
    let displayType: String?
    let colorScheme: String?
    let screensaverEnabled: Bool
    let dashboards: [KioskDashboard]
    let lastAccessedAt: String?
}

struct KioskDashboard: Identifiable, Codable, Sendable, Equatable {
    let id: String
    let type: String
    let name: String
    let icon: String?
    let pinned: Bool
}

struct KioskSavedFile: Identifiable, Codable, Sendable, Equatable {
    let id: String
    let name: String
    let fileType: String
    let mimeType: String?
    let pageCount: Int?
    let fileSize: Int?
    let createdAt: String?
}
