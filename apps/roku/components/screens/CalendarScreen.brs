sub init()
    m.dateLabel = m.top.findNode("dateLabel")
    m.summaryLabel = m.top.findNode("summaryLabel")
    m.eventsList = m.top.findNode("eventsList")
    m.emptyLabel = m.top.findNode("emptyLabel")
end sub

sub onDataChanged()
    data = m.top.calendarData
    if data = invalid then return

    ' Set date
    if data.date <> invalid
        m.dateLabel.text = data.date
    end if

    ' Set summary
    if data.summary <> invalid
        m.summaryLabel.text = data.summary
    end if

    ' Clear existing event items
    m.eventsList.removeChildrenIndex(m.eventsList.getChildCount(), 0)

    events = data.events
    if events = invalid or events.Count() = 0
        m.emptyLabel.visible = true
        m.eventsList.visible = false
        return
    end if

    m.emptyLabel.visible = false
    m.eventsList.visible = true

    ' Create event rows
    for i = 0 to events.Count() - 1
        evt = events[i]
        row = createEventRow(evt)
        m.eventsList.appendChild(row)
    end for
end sub

function createEventRow(evt as object) as object
    row = CreateObject("roSGNode", "LayoutGroup")
    row.layoutDirection = "horiz"
    row.itemSpacings = [20]

    ' Time label
    timeLabel = CreateObject("roSGNode", "Label")
    timeLabel.text = evt.time
    timeLabel.width = 280
    timeLabel.font = CreateObject("roSGNode", "Font")
    timeLabel.font.size = 28
    timeLabel.font.uri = "font:MediumBoldSystemFont"
    timeLabel.color = "0xfbbf24FF"

    ' Title label
    titleLabel = CreateObject("roSGNode", "Label")
    titleLabel.text = evt.title
    titleLabel.width = 1000
    titleLabel.font = CreateObject("roSGNode", "Font")
    titleLabel.font.size = 28
    titleLabel.font.uri = "font:MediumSystemFont"
    titleLabel.color = "0xf8fafcFF"

    ' Calendar name label
    calLabel = CreateObject("roSGNode", "Label")
    calLabel.text = evt.calendar
    calLabel.width = 350
    calLabel.horizAlign = "right"
    calLabel.font = CreateObject("roSGNode", "Font")
    calLabel.font.size = 22
    calLabel.font.uri = "font:SmallSystemFont"
    calLabel.color = "0x64748bFF"

    row.appendChild(timeLabel)
    row.appendChild(titleLabel)
    row.appendChild(calLabel)

    return row
end function
