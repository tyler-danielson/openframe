import Foundation

final class NewsRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func getHeadlines(limit: Int? = 20) async throws -> [NewsHeadline] {
        try await apiClient.request(.getNewsHeadlines(limit: limit))
    }
}
