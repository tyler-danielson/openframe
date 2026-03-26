import Foundation

struct KioskDTO: Decodable {
    let id: String
    let name: String
    let isActive: Bool
    let displayMode: String?
    let displayType: String?
    let colorScheme: String?
    let homePage: String?
    let screensaverEnabled: Bool
    let dashboards: [KioskDashboardDTO]?
    let lastAccessedAt: String?
    let createdAt: String?

    func toDomain() -> Kiosk {
        Kiosk(
            id: id, name: name, isActive: isActive,
            displayMode: displayMode, displayType: displayType,
            colorScheme: colorScheme, screensaverEnabled: screensaverEnabled,
            dashboards: dashboards?.map { $0.toDomain() } ?? [],
            lastAccessedAt: lastAccessedAt
        )
    }
}

struct KioskDashboardDTO: Decodable {
    let id: String
    let type: String
    let name: String
    let icon: String?
    let pinned: Bool

    func toDomain() -> KioskDashboard {
        KioskDashboard(id: id, type: type, name: name, icon: icon, pinned: pinned)
    }
}

struct KioskCommandRequest: Encodable {
    let type: String
    let payload: [String: String]?
}

struct KioskSavedFileDTO: Decodable {
    let id: String
    let name: String
    let fileType: String
    let mimeType: String?
    let pageCount: Int?
    let fileSize: Int?
    let createdAt: String?

    func toDomain() -> KioskSavedFile {
        KioskSavedFile(
            id: id, name: name, fileType: fileType, mimeType: mimeType,
            pageCount: pageCount, fileSize: fileSize, createdAt: createdAt
        )
    }
}

struct KioskSavedFileUploadResponse: Decodable {
    let id: String
    let name: String
    let fileType: String
    let mimeType: String?
    let pageCount: Int?
    let fileSize: Int?
}

struct FileShareUploadResponse: Decodable {
    let shareId: String
    let fileType: String
    let pageCount: Int?
    let mimeType: String?
    let originalName: String?
}
