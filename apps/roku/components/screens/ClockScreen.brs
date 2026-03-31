sub init()
    m.timeLabel = m.top.findNode("timeLabel")
    m.dateLabel = m.top.findNode("dateLabel")
    m.secondsLabel = m.top.findNode("secondsLabel")

    ' Set very large font for time
    timeFont = CreateObject("roSGNode", "Font")
    timeFont.size = 180
    timeFont.uri = "font:LargeBoldSystemFont"
    m.timeLabel.font = timeFont

    m.clockTimer = m.top.findNode("clockTimer")
    m.clockTimer.observeField("fire", "onClockTick")
    m.clockTimer.control = "start"

    updateClock()
end sub

sub onClockTick()
    updateClock()
end sub

sub updateClock()
    dt = CreateObject("roDateTime")
    dt.ToLocalTime()

    ' Format time
    m.timeLabel.text = formatTime12(dt)

    ' Format date
    m.dateLabel.text = formatDate(dt)

    ' Seconds
    sec = dt.GetSeconds()
    m.secondsLabel.text = ":" + zeroPad(sec)
end sub
