import Foundation

final class KioskRepository: Sendable {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func getKiosks() async -> Result<[Kiosk], Error> {
        do {
            let dtos: [KioskDTO] = try await apiClient.requestData(.get, path: "/api/v1/kiosks")
            return .success(dtos.map { $0.toDomain() })
        } catch {
            return .failure(error)
        }
    }

    func getKiosk(id: String) async -> Result<Kiosk, Error> {
        do {
            let dto: KioskDTO = try await apiClient.requestData(.get, path: "/api/v1/kiosks/\(id)")
            return .success(dto.toDomain())
        } catch {
            return .failure(error)
        }
    }

    func sendCommand(kioskId: String, type: String, payload: [String: String]? = nil) async -> Result<Void, Error> {
        do {
            let body = KioskCommandRequest(type: type, payload: payload)
            try await apiClient.requestVoid(.post, path: "/api/v1/kiosks/\(kioskId)/command", body: body)
            return .success(())
        } catch {
            return .failure(error)
        }
    }

    func refreshKiosk(id: String) async -> Result<Void, Error> {
        do {
            try await apiClient.requestVoid(.post, path: "/api/v1/kiosks/\(id)/refresh")
            return .success(())
        } catch {
            return .failure(error)
        }
    }

    func getSavedFiles(kioskId: String) async -> Result<[KioskSavedFile], Error> {
        do {
            let dtos: [KioskSavedFileDTO] = try await apiClient.requestData(.get, path: "/api/v1/kiosks/\(kioskId)/files")
            return .success(dtos.map { $0.toDomain() })
        } catch {
            return .failure(error)
        }
    }

    func deleteSavedFile(kioskId: String, fileId: String) async -> Result<Void, Error> {
        do {
            try await apiClient.requestVoid(.delete, path: "/api/v1/kiosks/\(kioskId)/files/\(fileId)")
            return .success(())
        } catch {
            return .failure(error)
        }
    }
}
