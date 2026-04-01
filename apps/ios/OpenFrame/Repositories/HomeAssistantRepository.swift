import Foundation

final class HomeAssistantRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func getEntities(domain: String? = nil) async throws -> [HAEntity] {
        try await apiClient.request(.getHAEntities(domain: domain))
    }

    func getRooms() async throws -> [HARoom] {
        try await apiClient.request(.getHARooms)
    }

    func callService(domain: String, service: String, entityId: String? = nil, data: [String: Any]? = nil) async throws {
        try await apiClient.requestVoid(.callHAService(domain: domain, service: service, entityId: entityId, data: data))
    }

    func toggleEntity(entityId: String) async throws {
        let domain = String(entityId.prefix(while: { $0 != "." }))
        let service = "toggle"
        try await callService(domain: domain, service: service, entityId: entityId)
    }
}
