sub init()
    m.tempLabel = m.top.findNode("tempLabel")
    m.descLabel = m.top.findNode("descLabel")
    m.feelsLikeLabel = m.top.findNode("feelsLikeLabel")
    m.cityLabel = m.top.findNode("cityLabel")
    m.humidityLabel = m.top.findNode("humidityLabel")
    m.windLabel = m.top.findNode("windLabel")
    m.weatherIcon = m.top.findNode("weatherIcon")
    m.forecastRow = m.top.findNode("forecastRow")
    m.noDataLabel = m.top.findNode("noDataLabel")

    ' Set large temperature font
    tempFont = CreateObject("roSGNode", "Font")
    tempFont.size = 96
    tempFont.uri = "font:LargeBoldSystemFont"
    m.tempLabel.font = tempFont
end sub

sub onCurrentChanged()
    data = m.top.currentWeather
    if data = invalid
        m.noDataLabel.visible = true
        return
    end if
    m.noDataLabel.visible = false

    unitStr = "F"
    speedUnit = "mph"
    if data.units = "metric"
        unitStr = "C"
        speedUnit = "km/h"
    end if

    m.tempLabel.text = data.temp.ToStr() + Chr(176) + unitStr
    m.descLabel.text = UCase(Left(data.description, 1)) + Mid(data.description, 2)
    m.feelsLikeLabel.text = "Feels like " + data.feels_like.ToStr() + Chr(176) + unitStr
    m.cityLabel.text = data.city
    m.humidityLabel.text = "Humidity: " + data.humidity.ToStr() + "%"
    m.windLabel.text = "Wind: " + data.wind_speed.ToStr() + " " + speedUnit

    ' Load weather icon from OpenWeatherMap
    if data.icon <> invalid and data.icon <> ""
        m.weatherIcon.uri = "https://openweathermap.org/img/wn/" + data.icon + "@4x.png"
    end if
end sub

sub onForecastChanged()
    forecast = m.top.forecastData
    if forecast = invalid then return

    ' Clear existing forecast items
    m.forecastRow.removeChildrenIndex(m.forecastRow.getChildCount(), 0)

    for i = 0 to forecast.Count() - 1
        day = forecast[i]
        card = createForecastCard(day)
        m.forecastRow.appendChild(card)
    end for
end sub

function createForecastCard(day as object) as object
    card = CreateObject("roSGNode", "LayoutGroup")
    card.layoutDirection = "vert"
    card.horizAlignment = "center"
    card.itemSpacings = [8]

    ' Background
    bg = CreateObject("roSGNode", "Rectangle")
    bg.width = 260
    bg.height = 350
    bg.color = "0x1e293bFF"
    bg.cornerRadius = 12

    ' Day name
    dayLabel = CreateObject("roSGNode", "Label")
    dayLabel.text = day.date
    dayLabel.width = 260
    dayLabel.horizAlign = "center"
    dayLabel.color = "0xe2e8f0FF"
    dayFont = CreateObject("roSGNode", "Font")
    dayFont.size = 26
    dayFont.uri = "font:MediumBoldSystemFont"
    dayLabel.font = dayFont

    ' Icon
    icon = CreateObject("roSGNode", "Poster")
    icon.width = 80
    icon.height = 80
    if day.icon <> invalid and day.icon <> ""
        icon.uri = "https://openweathermap.org/img/wn/" + day.icon + "@2x.png"
    end if

    ' High temp
    highLabel = CreateObject("roSGNode", "Label")
    highLabel.text = day.temp_max.ToStr() + Chr(176)
    highLabel.width = 260
    highLabel.horizAlign = "center"
    highLabel.color = "0xf8fafcFF"
    highFont = CreateObject("roSGNode", "Font")
    highFont.size = 32
    highFont.uri = "font:MediumBoldSystemFont"
    highLabel.font = highFont

    ' Low temp
    lowLabel = CreateObject("roSGNode", "Label")
    lowLabel.text = day.temp_min.ToStr() + Chr(176)
    lowLabel.width = 260
    lowLabel.horizAlign = "center"
    lowLabel.color = "0x64748bFF"

    ' Description
    descLabel = CreateObject("roSGNode", "Label")
    descLabel.text = day.description
    descLabel.width = 240
    descLabel.horizAlign = "center"
    descLabel.color = "0x94a3b8FF"
    descFont = CreateObject("roSGNode", "Font")
    descFont.size = 20
    descFont.uri = "font:SmallSystemFont"
    descLabel.font = descFont

    card.appendChild(dayLabel)
    card.appendChild(icon)
    card.appendChild(highLabel)
    card.appendChild(lowLabel)
    card.appendChild(descLabel)

    return card
end function
