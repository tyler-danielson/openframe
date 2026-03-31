sub init()
    m.serverValue = m.top.findNode("serverValue")
    m.tokenValue = m.top.findNode("tokenValue")
    m.buttonGroup = m.top.findNode("buttonGroup")

    m.buttonGroup.observeField("buttonSelected", "onButtonSelected")
end sub

sub onInfoChanged()
    if m.top.serverUrl <> invalid and m.top.serverUrl <> ""
        m.serverValue.text = m.top.serverUrl
    end if
    if m.top.kioskToken <> invalid and m.top.kioskToken <> ""
        m.tokenValue.text = Left(m.top.kioskToken, 8) + "..."
    end if

    m.buttonGroup.setFocus(true)
end sub

sub onButtonSelected(event as object)
    idx = event.getData()
    if idx = 0
        m.top.action = "retry"
    else if idx = 1
        m.top.action = "changeServer"
    else if idx = 2
        m.top.action = "close"
    end if
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false

    if key = "back" or key = "options"
        m.top.action = "close"
        return true
    end if

    return false
end function
