sub init()
    m.urlLabel = m.top.findNode("urlLabel")
    m.userCodeLabel = m.top.findNode("userCodeLabel")
    m.statusLabel = m.top.findNode("statusLabel")
    m.countdownLabel = m.top.findNode("countdownLabel")
    m.qrImage = m.top.findNode("qrImage")
    m.buttonGroup = m.top.findNode("buttonGroup")

    m.authTask = m.top.findNode("authTask")
    m.authTask.observeField("response", "onAuthResponse")

    m.pollTimer = m.top.findNode("pollTimer")
    m.pollTimer.observeField("fire", "onPollTimer")

    m.countdownTimer = m.top.findNode("countdownTimer")
    m.countdownTimer.observeField("fire", "onCountdownTimer")

    m.deviceCode = ""
    m.userCode = ""
    m.verificationUrl = ""
    m.expiresIn = 0
    m.secondsRemaining = 0
    m.state = "loading" ' loading | displaying | approved | expired | error

    m.top.observeField("serverUrl", "onServerUrlChanged")
end sub

sub onServerUrlChanged()
    if m.top.serverUrl <> "" and m.top.serverUrl <> invalid
        requestDeviceCode()
    end if
end sub

sub requestDeviceCode()
    m.state = "loading"
    m.statusLabel.text = "Requesting device code..."

    m.authTask.serverUrl = m.top.serverUrl
    m.authTask.request = {
        endpoint: "/api/v1/auth/device-code",
        method: "POST",
        body: {},
        requestId: "device_code"
    }
    m.authTask.control = "RUN"
end sub

sub onAuthResponse(event as object)
    response = event.getData()
    if response = invalid then return

    if response.requestId = "device_code"
        handleDeviceCodeResponse(response)
    else if response.requestId = "device_poll"
        handlePollResponse(response)
    end if
end sub

sub handleDeviceCodeResponse(response as object)
    if not response.success
        m.state = "error"
        m.statusLabel.text = "Failed to get device code. Check server URL."
        m.statusLabel.color = "0xef4444FF"
        m.buttonGroup.visible = true
        m.buttonGroup.buttons = ["Retry", "Back"]
        m.buttonGroup.setFocus(true)
        return
    end if

    data = response.data
    m.deviceCode = data.deviceCode
    m.userCode = data.userCode
    m.verificationUrl = data.verificationUrl
    m.expiresIn = data.expiresIn
    m.secondsRemaining = m.expiresIn

    ' Format user code with dash for readability
    if Len(m.userCode) = 6
        formattedCode = Left(m.userCode, 3) + "-" + Right(m.userCode, 3)
    else
        formattedCode = m.userCode
    end if

    m.urlLabel.text = m.verificationUrl
    m.userCodeLabel.text = formattedCode
    m.statusLabel.text = "Waiting for authorization..."
    m.statusLabel.color = "0x94a3b8FF"

    ' Generate QR code image via external service
    qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=" + m.verificationUrl
    m.qrImage.uri = qrUrl

    m.state = "displaying"
    m.pollTimer.control = "start"
    m.countdownTimer.control = "start"
end sub

sub onPollTimer()
    if m.state <> "displaying" then return

    m.authTask.request = {
        endpoint: "/api/v1/auth/device-code/poll",
        method: "POST",
        body: { deviceCode: m.deviceCode },
        requestId: "device_poll"
    }
end sub

sub handlePollResponse(response as object)
    if not response.success then return
    data = response.data
    if data = invalid then return

    if data.status = "approved" and data.kioskToken <> invalid
        m.state = "approved"
        m.pollTimer.control = "stop"
        m.countdownTimer.control = "stop"
        m.statusLabel.text = "Device approved! Connecting..."
        m.statusLabel.color = "0x22c55eFF"
        m.userCodeLabel.color = "0x22c55eFF"

        saveConfig(m.top.serverUrl, data.kioskToken)
        m.top.configReady = { serverUrl: m.top.serverUrl, kioskToken: data.kioskToken }
    else if data.status = "expired"
        m.state = "expired"
        m.pollTimer.control = "stop"
        m.countdownTimer.control = "stop"
        m.statusLabel.text = "Code expired"
        m.statusLabel.color = "0xef4444FF"
        m.buttonGroup.visible = true
        m.buttonGroup.buttons = ["Generate New Code", "Back"]
        m.buttonGroup.setFocus(true)
    else if data.status = "denied"
        m.state = "error"
        m.pollTimer.control = "stop"
        m.countdownTimer.control = "stop"
        m.statusLabel.text = "Access denied"
        m.statusLabel.color = "0xef4444FF"
        m.buttonGroup.visible = true
        m.buttonGroup.buttons = ["Try Again", "Back"]
        m.buttonGroup.setFocus(true)
    end if
end sub

sub onCountdownTimer()
    m.secondsRemaining = m.secondsRemaining - 1
    if m.secondsRemaining <= 0
        m.state = "expired"
        m.pollTimer.control = "stop"
        m.countdownTimer.control = "stop"
        m.statusLabel.text = "Code expired"
        m.statusLabel.color = "0xef4444FF"
        m.buttonGroup.visible = true
        m.buttonGroup.buttons = ["Generate New Code", "Back"]
        m.buttonGroup.setFocus(true)
        return
    end if

    minutes = Int(m.secondsRemaining / 60)
    seconds = m.secondsRemaining mod 60
    secStr = seconds.ToStr()
    if seconds < 10 then secStr = "0" + secStr
    m.countdownLabel.text = "Expires in " + minutes.ToStr() + ":" + secStr
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false

    if key = "back"
        m.pollTimer.control = "stop"
        m.countdownTimer.control = "stop"
        m.top.goBack = true
        return true
    end if

    if key = "OK" and m.buttonGroup.hasFocus()
        idx = m.buttonGroup.focusedChild
        ' Handle button actions
        if m.state = "expired" or m.state = "error"
            if m.buttonGroup.buttonSelected = 0
                ' Retry / Generate New Code
                m.buttonGroup.visible = false
                m.top.setFocus(true)
                requestDeviceCode()
            else
                ' Back
                m.pollTimer.control = "stop"
                m.countdownTimer.control = "stop"
                m.top.goBack = true
            end if
            return true
        end if
    end if

    return false
end function
