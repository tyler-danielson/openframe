import SwiftUI

struct WeatherView: View {
    @EnvironmentObject var container: DIContainer
    @State private var current: WeatherData?
    @State private var forecast: [WeatherForecast] = []
    @State private var isLoading = true

    var body: some View {
        let palette = container.themeManager.palette
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if let current {
                    // Current conditions
                    VStack(spacing: 8) {
                        if let icon = current.icon {
                            Image(systemName: weatherIcon(icon))
                                .font(.system(size: 48))
                                .foregroundStyle(palette.primary)
                        }
                        if let temp = current.temp {
                            Text("\(Int(temp))°")
                                .font(.system(size: 56, weight: .bold))
                                .foregroundStyle(palette.foreground)
                        }
                        if let desc = current.description {
                            Text(desc.capitalized)
                                .font(.title3)
                                .foregroundStyle(palette.mutedForeground)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)

                    // Details grid
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        if let feels = current.feelsLike {
                            WeatherDetail(icon: "thermometer", label: "Feels Like", value: "\(Int(feels))°", palette: palette)
                        }
                        if let humidity = current.humidity {
                            WeatherDetail(icon: "humidity", label: "Humidity", value: "\(Int(humidity))%", palette: palette)
                        }
                        if let wind = current.windSpeed {
                            WeatherDetail(icon: "wind", label: "Wind", value: "\(Int(wind)) mph", palette: palette)
                        }
                        if let hi = current.tempMax, let lo = current.tempMin {
                            WeatherDetail(icon: "arrow.up.arrow.down", label: "Hi / Lo", value: "\(Int(hi))° / \(Int(lo))°", palette: palette)
                        }
                    }
                }

                // Forecast
                if !forecast.isEmpty {
                    Text("5-Day Forecast")
                        .font(.headline)
                        .foregroundStyle(palette.foreground)
                        .padding(.top, 8)

                    ForEach(forecast) { day in
                        HStack {
                            Text(dayName(day.date))
                                .font(.subheadline)
                                .foregroundStyle(palette.foreground)
                                .frame(width: 80, alignment: .leading)

                            if let icon = day.icon {
                                Image(systemName: weatherIcon(icon))
                                    .foregroundStyle(palette.primary)
                                    .frame(width: 30)
                            }

                            Spacer()

                            Text("\(Int(day.maxTemp))°")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(palette.foreground)
                                .frame(width: 36, alignment: .trailing)

                            Text("\(Int(day.minTemp))°")
                                .font(.subheadline)
                                .foregroundStyle(palette.mutedForeground)
                                .frame(width: 36, alignment: .trailing)
                        }
                        .padding(.vertical, 8)
                        .padding(.horizontal)
                        .background(palette.secondary)
                        .cornerRadius(10)
                    }
                }
            }
            .padding()
        }
        .background(palette.background.ignoresSafeArea())
        .navigationTitle("Weather")
        .task { await loadWeather() }
        .refreshable { await loadWeather() }
    }

    private func loadWeather() async {
        isLoading = true
        async let currentResult = container.weatherRepository.getCurrentWeather()
        async let forecastResult = container.weatherRepository.getForecast()
        current = try? await currentResult
        forecast = (try? await forecastResult) ?? []
        isLoading = false
    }

    private func dayName(_ dateString: String) -> String {
        guard let date = Date.fromISO(dateString) else { return dateString }
        if date.isToday { return "Today" }
        let fmt = DateFormatter()
        fmt.dateFormat = "EEE"
        return fmt.string(from: date)
    }

    private func weatherIcon(_ icon: String) -> String {
        switch icon {
        case "01d": return "sun.max.fill"
        case "01n": return "moon.fill"
        case "02d": return "cloud.sun.fill"
        case "02n": return "cloud.moon.fill"
        case "03d", "03n": return "cloud.fill"
        case "04d", "04n": return "smoke.fill"
        case "09d", "09n": return "cloud.drizzle.fill"
        case "10d": return "cloud.sun.rain.fill"
        case "10n": return "cloud.moon.rain.fill"
        case "11d", "11n": return "cloud.bolt.fill"
        case "13d", "13n": return "snow"
        case "50d", "50n": return "cloud.fog.fill"
        default: return "cloud.fill"
        }
    }
}

private struct WeatherDetail: View {
    let icon: String
    let label: String
    let value: String
    let palette: ThemePalette

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .foregroundStyle(palette.primary)
            Text(value)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(palette.foreground)
            Text(label)
                .font(.caption)
                .foregroundStyle(palette.mutedForeground)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(palette.secondary)
        .cornerRadius(12)
    }
}
