import Foundation

final class PushRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func registerToken(token: String, deviceId: String, deviceName: String) async throws {
        try await apiClient.requestVoid(.registerPushToken(body: [
            "token": token,
            "deviceId": deviceId,
            "platform": "ios",
            "deviceName": deviceName,
        ]))
    }

    func unregisterToken(deviceId: String) async throws {
        try await apiClient.requestVoid(.unregisterPushToken(deviceId: deviceId))
    }
}
