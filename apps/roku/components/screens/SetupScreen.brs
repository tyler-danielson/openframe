sub init()
    m.urlValue = m.top.findNode("urlValue")
    m.tokenValue = m.top.findNode("tokenValue")
    m.buttonGroup = m.top.findNode("buttonGroup")
    m.errorLabel = m.top.findNode("errorLabel")
    m.urlKeyboard = m.top.findNode("urlKeyboard")

    m.serverUrl = ""
    m.kioskToken = ""
    m.focusTarget = "url" ' "url" | "token" | "buttons"
    m.editingUrl = false
    m.editingToken = false

    m.buttonGroup.observeField("buttonSelected", "onButtonSelected")

    ' Load saved config if any
    config = getConfig()
    if config <> invalid
        m.serverUrl = config.serverUrl
        m.kioskToken = config.kioskToken
        m.urlValue.text = m.serverUrl
        m.urlValue.color = "0xf8fafcFF"
        m.tokenValue.text = Left(m.kioskToken, 8) + "..."
        m.tokenValue.color = "0xf8fafcFF"
    end if

    m.top.setFocus(true)
end sub

sub onErrorChanged()
    msg = m.top.errorMessage
    if msg <> "" and msg <> invalid
        m.errorLabel.text = msg
        m.errorLabel.visible = true
    else
        m.errorLabel.visible = false
    end if
end sub

sub onButtonSelected(event as object)
    idx = event.getData()
    if idx = 0
        ' Connect
        doConnect()
    else if idx = 1
        ' QR Code Setup
        m.top.startQRSetup = true
    end if
end sub

sub doConnect()
    if m.serverUrl = "" or m.serverUrl = invalid
        m.top.errorMessage = "Please enter a server URL"
        return
    end if
    if m.kioskToken = "" or m.kioskToken = invalid
        m.top.errorMessage = "Please enter a kiosk token"
        return
    end if

    ' Normalize URL
    url = m.serverUrl
    if Left(url, 4) <> "http"
        url = "https://" + url
    end if
    ' Strip trailing slashes
    while Right(url, 1) = "/"
        url = Left(url, Len(url) - 1)
    end while
    m.serverUrl = url

    saveConfig(m.serverUrl, m.kioskToken)
    m.top.configReady = { serverUrl: m.serverUrl, kioskToken: m.kioskToken }
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false

    if key = "OK"
        if m.focusTarget = "url"
            ' Show keyboard dialog for URL entry
            dialog = createObject("roSGNode", "StandardKeyboardDialog")
            dialog.title = "Enter Server URL"
            dialog.text = m.serverUrl
            dialog.buttons = ["OK", "Cancel"]
            dialog.observeField("buttonSelected", "onUrlDialogButton")
            m.urlDialog = dialog
            m.top.getScene().dialog = dialog
            return true
        else if m.focusTarget = "token"
            dialog = createObject("roSGNode", "StandardKeyboardDialog")
            dialog.title = "Enter Kiosk Token"
            dialog.text = m.kioskToken
            dialog.buttons = ["OK", "Cancel"]
            dialog.observeField("buttonSelected", "onTokenDialogButton")
            m.tokenDialog = dialog
            m.top.getScene().dialog = dialog
            return true
        end if
    else if key = "down"
        if m.focusTarget = "url"
            m.focusTarget = "token"
            highlightFocus()
            return true
        else if m.focusTarget = "token"
            m.focusTarget = "buttons"
            m.buttonGroup.setFocus(true)
            highlightFocus()
            return true
        end if
    else if key = "up"
        if m.focusTarget = "buttons"
            m.focusTarget = "token"
            m.top.setFocus(true)
            highlightFocus()
            return true
        else if m.focusTarget = "token"
            m.focusTarget = "url"
            highlightFocus()
            return true
        end if
    end if

    return false
end function

sub onUrlDialogButton(event as object)
    idx = event.getData()
    if idx = 0 ' OK
        m.serverUrl = m.urlDialog.text
        if m.serverUrl <> ""
            m.urlValue.text = m.serverUrl
            m.urlValue.color = "0xf8fafcFF"
        else
            m.urlValue.text = "Press OK to enter server URL"
            m.urlValue.color = "0x94a3b8FF"
        end if
    end if
    m.top.getScene().dialog = invalid
    m.top.setFocus(true)
end sub

sub onTokenDialogButton(event as object)
    idx = event.getData()
    if idx = 0 ' OK
        m.kioskToken = m.tokenDialog.text
        if m.kioskToken <> ""
            m.tokenValue.text = Left(m.kioskToken, 8) + "..."
            m.tokenValue.color = "0xf8fafcFF"
        else
            m.tokenValue.text = "Press OK to enter kiosk token"
            m.tokenValue.color = "0x94a3b8FF"
        end if
    end if
    m.top.getScene().dialog = invalid
    m.top.setFocus(true)
end sub

sub highlightFocus()
    m.urlValue.color = "0x94a3b8FF"
    m.tokenValue.color = "0x94a3b8FF"

    if m.focusTarget = "url"
        m.urlValue.color = "0x60a5faFF"
    else if m.focusTarget = "token"
        m.tokenValue.color = "0x60a5faFF"
    end if
end sub
