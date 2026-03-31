sub init()
    m.messageLabel = m.top.findNode("messageLabel")
    m.retryLabel = m.top.findNode("retryLabel")
    m.buttonGroup = m.top.findNode("buttonGroup")

    m.retryTimer = m.top.findNode("retryTimer")
    m.retryTimer.observeField("fire", "onRetryTimer")

    m.buttonGroup.observeField("buttonSelected", "onButtonSelected")

    m.retryCountdown = 0
    m.retryAttempts = 0

    m.countdownTimer = CreateObject("roSGNode", "Timer")
    m.countdownTimer.duration = 1
    m.countdownTimer.repeat = true
    m.countdownTimer.observeField("fire", "onCountdownTick")
    m.top.appendChild(m.countdownTimer)
end sub

sub onErrorChanged()
    msg = m.top.errorMessage
    if msg <> "" and msg <> invalid
        m.messageLabel.text = msg
    end if

    ' Start auto-retry countdown
    m.retryAttempts = m.retryAttempts + 1
    delay = 5
    if m.retryAttempts > 1 then delay = 10
    if m.retryAttempts > 3 then delay = 30
    if m.retryAttempts > 5 then delay = 60

    m.retryCountdown = delay
    m.retryLabel.text = "Auto-retry in " + m.retryCountdown.ToStr() + "s"
    m.countdownTimer.control = "start"

    m.buttonGroup.setFocus(true)
end sub

sub onCountdownTick()
    m.retryCountdown = m.retryCountdown - 1
    if m.retryCountdown <= 0
        m.countdownTimer.control = "stop"
        m.retryLabel.text = "Retrying..."
        m.top.retryRequested = true
    else
        m.retryLabel.text = "Auto-retry in " + m.retryCountdown.ToStr() + "s"
    end if
end sub

sub onRetryTimer()
    m.top.retryRequested = true
end sub

sub onButtonSelected(event as object)
    idx = event.getData()
    m.countdownTimer.control = "stop"

    if idx = 0
        ' Retry Now
        m.retryAttempts = 0
        m.top.retryRequested = true
    else if idx = 1
        ' Change Server
        m.retryAttempts = 0
        m.top.settingsRequested = true
    else if idx = 2
        ' Exit
        m.top.getScene().exitChannel = true
    end if
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false

    if key = "back"
        m.countdownTimer.control = "stop"
        m.retryAttempts = 0
        m.top.settingsRequested = true
        return true
    end if

    return false
end function
