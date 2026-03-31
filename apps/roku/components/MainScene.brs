sub init()
    ' Screen references
    m.setupScreen = m.top.findNode("setupScreen")
    m.qrSetupScreen = m.top.findNode("qrSetupScreen")
    m.photoScreen = m.top.findNode("photoScreen")
    m.calendarScreen = m.top.findNode("calendarScreen")
    m.weatherScreen = m.top.findNode("weatherScreen")
    m.clockScreen = m.top.findNode("clockScreen")
    m.errorScreen = m.top.findNode("errorScreen")
    m.settingsOverlay = m.top.findNode("settingsOverlay")
    m.statusIndicator = m.top.findNode("statusIndicator")
    m.pausedIndicator = m.top.findNode("pausedIndicator")

    ' API tasks
    m.healthTask = m.top.findNode("healthTask")
    m.weatherTask = m.top.findNode("weatherTask")
    m.calendarTask = m.top.findNode("calendarTask")
    m.photoTask = m.top.findNode("photoTask")

    m.healthTask.observeField("response", "onHealthResponse")
    m.weatherTask.observeField("response", "onWeatherResponse")
    m.calendarTask.observeField("response", "onCalendarResponse")
    m.photoTask.observeField("response", "onPhotoResponse")

    ' Timers
    m.rotationTimer = m.top.findNode("rotationTimer")
    m.rotationTimer.observeField("fire", "onRotationTimer")

    m.weatherRefreshTimer = m.top.findNode("weatherRefreshTimer")
    m.weatherRefreshTimer.observeField("fire", "onWeatherRefreshTimer")

    m.calendarRefreshTimer = m.top.findNode("calendarRefreshTimer")
    m.calendarRefreshTimer.observeField("fire", "onCalendarRefreshTimer")

    ' Setup screen observers
    m.setupScreen.observeField("configReady", "onConfigReady")
    m.setupScreen.observeField("startQRSetup", "onStartQRSetup")
    m.qrSetupScreen.observeField("configReady", "onConfigReady")
    m.qrSetupScreen.observeField("goBack", "onQRGoBack")

    ' Error screen observers
    m.errorScreen.observeField("retryRequested", "onRetryRequested")
    m.errorScreen.observeField("settingsRequested", "onSettingsRequested")

    ' Settings overlay observers
    m.settingsOverlay.observeField("action", "onSettingsAction")

    ' State
    m.serverUrl = ""
    m.kioskToken = ""
    m.appState = "loading" ' loading | setup | qrSetup | display | error
    m.screens = ["photo", "calendar", "weather", "clock"]
    m.currentScreenIndex = 0
    m.rotationPaused = false
    m.showingSettings = false
    m.photoList = []
    m.photoIndex = 0

    ' Check for saved config
    config = getConfig()
    if config <> invalid
        m.serverUrl = config.serverUrl
        m.kioskToken = config.kioskToken
        configureApiTasks()
        performHealthCheck()
    else
        showSetupScreen()
    end if

    m.top.setFocus(true)
end sub

sub onExitChannel()
    if m.top.exitChannel
        m.top.close = true
    end if
end sub

' ==================== CONFIG ====================

sub configureApiTasks()
    m.healthTask.serverUrl = m.serverUrl
    m.healthTask.kioskToken = m.kioskToken
    m.weatherTask.serverUrl = m.serverUrl
    m.weatherTask.kioskToken = m.kioskToken
    m.calendarTask.serverUrl = m.serverUrl
    m.calendarTask.kioskToken = m.kioskToken
    m.photoTask.serverUrl = m.serverUrl
    m.photoTask.kioskToken = m.kioskToken
end sub

sub onConfigReady(event as object)
    config = event.getData()
    if config = invalid then return

    m.serverUrl = config.serverUrl
    m.kioskToken = config.kioskToken
    configureApiTasks()
    performHealthCheck()
end sub

' ==================== SCREEN MANAGEMENT ====================

sub hideAllScreens()
    m.setupScreen.visible = false
    m.qrSetupScreen.visible = false
    m.photoScreen.visible = false
    m.calendarScreen.visible = false
    m.weatherScreen.visible = false
    m.clockScreen.visible = false
    m.errorScreen.visible = false
end sub

sub showSetupScreen()
    m.appState = "setup"
    hideAllScreens()
    m.setupScreen.visible = true
    m.setupScreen.setFocus(true)
    m.rotationTimer.control = "stop"
    m.weatherRefreshTimer.control = "stop"
    m.calendarRefreshTimer.control = "stop"
    m.statusIndicator.visible = false
end sub

sub onStartQRSetup()
    m.appState = "qrSetup"
    hideAllScreens()
    m.qrSetupScreen.visible = true
    m.qrSetupScreen.serverUrl = m.setupScreen.findNode("urlValue").text
    ' Try to use the server URL entered in setup
    if m.serverUrl <> "" and m.serverUrl <> invalid
        m.qrSetupScreen.serverUrl = m.serverUrl
    end if
    m.qrSetupScreen.setFocus(true)
end sub

sub onQRGoBack()
    showSetupScreen()
end sub

sub showDisplayScreen(screenName as string)
    m.appState = "display"
    hideAllScreens()

    if screenName = "photo"
        m.photoScreen.visible = true
    else if screenName = "calendar"
        m.calendarScreen.visible = true
    else if screenName = "weather"
        m.weatherScreen.visible = true
    else if screenName = "clock"
        m.clockScreen.visible = true
    end if

    m.statusIndicator.text = "Connected"
    m.statusIndicator.visible = true
    m.top.setFocus(true)
end sub

sub showErrorScreen(errorMsg as string)
    m.appState = "error"
    hideAllScreens()
    m.errorScreen.visible = true
    m.errorScreen.errorMessage = errorMsg
    m.errorScreen.setFocus(true)
    m.rotationTimer.control = "stop"
    m.statusIndicator.visible = false
end sub

' ==================== HEALTH CHECK ====================

sub performHealthCheck()
    m.healthTask.request = {
        endpoint: "/api/v1/health",
        method: "GET",
        requestId: "health"
    }
    m.healthTask.control = "RUN"
end sub

sub onHealthResponse(event as object)
    response = event.getData()
    if response = invalid then return
    if response.requestId <> "health" then return

    if response.success
        ' Connected! Start display mode
        enterDisplayMode()
    else
        showErrorScreen("Cannot reach server at " + m.serverUrl)
    end if
end sub

' ==================== DISPLAY MODE ====================

sub enterDisplayMode()
    m.currentScreenIndex = 0
    showDisplayScreen("photo")

    ' Start rotation and refresh timers
    m.rotationTimer.control = "start"
    m.weatherRefreshTimer.control = "start"
    m.calendarRefreshTimer.control = "start"

    ' Fetch initial data
    fetchWeather()
    fetchCalendar()
    fetchPhotos()
end sub

sub refreshAllData()
    fetchWeather()
    fetchCalendar()
    fetchPhotos()
end sub

' ==================== DATA FETCHING ====================

sub fetchWeather()
    m.weatherTask.request = {
        endpoint: "/api/v1/weather/current",
        method: "GET",
        requestId: "weather_current"
    }
    m.weatherTask.control = "RUN"
end sub

sub onWeatherResponse(event as object)
    response = event.getData()
    if response = invalid then return

    if response.requestId = "weather_current" and response.success
        if response.data <> invalid and response.data.data <> invalid
            m.weatherScreen.currentWeather = response.data.data
        end if
        ' Now fetch forecast
        m.weatherTask.request = {
            endpoint: "/api/v1/weather/forecast",
            method: "GET",
            requestId: "weather_forecast"
        }
    else if response.requestId = "weather_forecast" and response.success
        if response.data <> invalid and response.data.data <> invalid
            m.weatherScreen.forecastData = response.data.data
        end if
    end if
end sub

sub fetchCalendar()
    m.calendarTask.request = {
        endpoint: "/api/v1/bot/today",
        method: "GET",
        requestId: "calendar_today"
    }
    m.calendarTask.control = "RUN"
end sub

sub onCalendarResponse(event as object)
    response = event.getData()
    if response = invalid then return
    if response.requestId <> "calendar_today" then return

    if response.success and response.data <> invalid and response.data.data <> invalid
        m.calendarScreen.calendarData = response.data.data
    end if
end sub

sub fetchPhotos()
    ' Get albums first, then photos from first album
    m.photoTask.request = {
        endpoint: "/api/v1/photos/albums",
        method: "GET",
        requestId: "photo_albums"
    }
    m.photoTask.control = "RUN"
end sub

sub onPhotoResponse(event as object)
    response = event.getData()
    if response = invalid then return

    if response.requestId = "photo_albums" and response.success
        if response.data <> invalid and response.data.data <> invalid
            albums = response.data.data
            if albums.Count() > 0
                ' Get photos from first album
                albumId = albums[0].id
                m.photoTask.request = {
                    endpoint: "/api/v1/photos/albums/" + albumId + "/photos",
                    method: "GET",
                    requestId: "photo_list"
                }
            end if
        end if
    else if response.requestId = "photo_list" and response.success
        if response.data <> invalid and response.data.data <> invalid
            m.photoList = response.data.data
            m.photoIndex = 0
            ' Shuffle the list
            shufflePhotos()
            loadNextPhoto()
        end if
    end if
end sub

sub shufflePhotos()
    ' Fisher-Yates shuffle
    n = m.photoList.Count()
    for i = n - 1 to 1 step -1
        j = Int(Rnd(0) * (i + 1))
        temp = m.photoList[i]
        m.photoList[i] = m.photoList[j]
        m.photoList[j] = temp
    end for
end sub

sub loadNextPhoto()
    if m.photoList.Count() = 0 then return

    if m.photoIndex >= m.photoList.Count()
        m.photoIndex = 0
        shufflePhotos()
    end if

    photo = m.photoList[m.photoIndex]
    m.photoIndex = m.photoIndex + 1

    ' Use mediumUrl or originalUrl, with apiKey query param for auth
    photoPath = ""
    if photo.mediumUrl <> invalid and photo.mediumUrl <> ""
        photoPath = photo.mediumUrl
    else if photo.originalUrl <> invalid
        photoPath = photo.originalUrl
    end if

    if photoPath <> ""
        photoUrl = m.serverUrl + photoPath + "?apiKey=kiosk_" + m.kioskToken
        m.photoScreen.photoUrl = photoUrl
    end if
end sub

' ==================== TIMER HANDLERS ====================

sub onRotationTimer()
    if m.rotationPaused then return
    if m.appState <> "display" then return

    m.currentScreenIndex = (m.currentScreenIndex + 1) mod m.screens.Count()
    screenName = m.screens[m.currentScreenIndex]

    if screenName = "photo"
        loadNextPhoto()
    end if

    showDisplayScreen(screenName)
end sub

sub onWeatherRefreshTimer()
    if m.appState = "display"
        fetchWeather()
    end if
end sub

sub onCalendarRefreshTimer()
    if m.appState = "display"
        fetchCalendar()
    end if
end sub

' ==================== ERROR / SETTINGS ====================

sub onRetryRequested()
    performHealthCheck()
end sub

sub onSettingsRequested()
    clearConfig()
    showSetupScreen()
end sub

sub toggleSettings()
    if m.showingSettings
        m.settingsOverlay.visible = false
        m.showingSettings = false
        m.top.setFocus(true)
    else
        m.settingsOverlay.serverUrl = m.serverUrl
        m.settingsOverlay.kioskToken = m.kioskToken
        m.settingsOverlay.visible = true
        m.showingSettings = true
        m.settingsOverlay.setFocus(true)
    end if
end sub

sub onSettingsAction(event as object)
    action = event.getData()
    m.settingsOverlay.visible = false
    m.showingSettings = false

    if action = "retry"
        performHealthCheck()
    else if action = "changeServer"
        clearConfig()
        showSetupScreen()
    else if action = "close"
        m.top.setFocus(true)
    end if
end sub

' ==================== KEY HANDLING ====================

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false

    ' Settings overlay intercepts when showing
    if m.showingSettings then return false

    ' Global keys in display mode
    if m.appState = "display"
        if key = "OK"
            m.rotationPaused = not m.rotationPaused
            m.pausedIndicator.visible = m.rotationPaused
            return true

        else if key = "right"
            m.currentScreenIndex = (m.currentScreenIndex + 1) mod m.screens.Count()
            screenName = m.screens[m.currentScreenIndex]
            if screenName = "photo" then loadNextPhoto()
            showDisplayScreen(screenName)
            m.rotationTimer.control = "start" ' reset timer
            return true

        else if key = "left"
            m.currentScreenIndex = m.currentScreenIndex - 1
            if m.currentScreenIndex < 0 then m.currentScreenIndex = m.screens.Count() - 1
            screenName = m.screens[m.currentScreenIndex]
            if screenName = "photo" then loadNextPhoto()
            showDisplayScreen(screenName)
            m.rotationTimer.control = "start"
            return true

        else if key = "play"
            refreshAllData()
            return true

        else if key = "back" or key = "options"
            toggleSettings()
            return true
        end if
    end if

    return false
end function
