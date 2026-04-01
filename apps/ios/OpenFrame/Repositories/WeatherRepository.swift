import Foundation

final class WeatherRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func getCurrentWeather() async throws -> WeatherData {
        try await apiClient.request(.getCurrentWeather)
    }

    func getForecast() async throws -> [WeatherForecast] {
        try await apiClient.request(.getWeatherForecast)
    }
}
