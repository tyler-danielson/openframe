import Foundation

final class CompanionRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func getContext() async throws -> CompanionContext {
        try await apiClient.request(.getCompanionContext)
    }

    func getInvites() async throws -> [CompanionInvite] {
        try await apiClient.request(.getCompanionInvites)
    }

    func createInvite(label: String? = nil) async throws -> CompanionInvite {
        try await apiClient.request(.createCompanionInvite(label: label))
    }

    func deleteInvite(id: String) async throws {
        try await apiClient.requestVoid(.deleteCompanionInvite(id: id))
    }
}

struct CompanionInvite: Identifiable, Codable {
    let id: String
    var token: String?
    var label: String?
    var expiresAt: String?
    var createdAt: String?
}
