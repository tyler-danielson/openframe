import Foundation

final class IptvRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func getChannels(group: String? = nil, search: String? = nil) async throws -> [IptvChannel] {
        try await apiClient.request(.getIptvChannels(group: group, search: search))
    }

    func getCategories() async throws -> [IptvCategory] {
        try await apiClient.request(.getIptvCategories)
    }

    func getFavorites() async throws -> [IptvChannel] {
        try await apiClient.request(.getIptvFavorites)
    }
}
