import Foundation

struct WeatherData: Codable {
    var temp: Double?
    var tempMin: Double?
    var tempMax: Double?
    var feelsLike: Double?
    var humidity: Double?
    var windSpeed: Double?
    var windDirection: Double?
    var pressure: Double?
    var visibility: Double?
    var cloudiness: Double?
    var description: String?
    var icon: String?
    var sunrise: String?
    var sunset: String?

    enum CodingKeys: String, CodingKey {
        case temp, humidity, pressure, visibility, cloudiness, description, icon, sunrise, sunset
        case tempMin = "temp_min"
        case tempMax = "temp_max"
        case feelsLike = "feels_like"
        case windSpeed = "wind_speed"
        case windDirection = "wind_direction"
    }
}

struct WeatherForecast: Codable, Identifiable {
    var id: String { date }
    let date: String
    let minTemp: Double
    let maxTemp: Double
    let description: String
    var icon: String?
    var precipitation: Double?
    var windSpeed: Double?

    enum CodingKeys: String, CodingKey {
        case date, description, icon, precipitation
        case minTemp = "min_temp"
        case maxTemp = "max_temp"
        case windSpeed = "wind_speed"
    }
}
