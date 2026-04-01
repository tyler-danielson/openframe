import Foundation

final class KioskRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func getKiosks() async throws -> [Kiosk] {
        try await apiClient.request(.getKiosks)
    }

    func getKiosk(id: String) async throws -> Kiosk {
        try await apiClient.request(.getKiosk(id: id))
    }

    func sendCommand(kioskId: String, type: String, payload: [String: String]? = nil) async throws {
        try await apiClient.requestVoid(.sendKioskCommand(kioskId: kioskId, type: type, payload: payload))
    }

    func getFiles(kioskId: String) async throws -> [KioskSavedFile] {
        try await apiClient.request(.getKioskFiles(kioskId: kioskId))
    }

    func deleteFile(kioskId: String, fileId: String) async throws {
        try await apiClient.requestVoid(.deleteKioskFile(kioskId: kioskId, fileId: fileId))
    }
}
