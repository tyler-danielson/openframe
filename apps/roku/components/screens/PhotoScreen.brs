sub init()
    m.posterA = m.top.findNode("posterA")
    m.posterB = m.top.findNode("posterB")
    m.crossfadeAtoB = m.top.findNode("crossfadeAtoB")
    m.crossfadeBtoA = m.top.findNode("crossfadeBtoA")

    m.currentPoster = "A" ' which poster is currently visible
    m.posterB.observeField("loadStatus", "onPosterBLoaded")
    m.posterA.observeField("loadStatus", "onPosterALoaded")
    m.pendingTransition = false
end sub

sub onPhotoUrlChanged()
    url = m.top.photoUrl
    if url = "" or url = invalid then return

    ' Load into the hidden poster
    if m.currentPoster = "A"
        m.posterB.uri = url
        m.pendingTransition = true
    else
        m.posterA.uri = url
        m.pendingTransition = true
    end if
end sub

sub onPosterBLoaded(event as object)
    status = event.getData()
    if status = "ready" and m.pendingTransition and m.currentPoster = "A"
        m.pendingTransition = false
        m.crossfadeAtoB.control = "start"
        m.currentPoster = "B"
    end if
end sub

sub onPosterALoaded(event as object)
    status = event.getData()
    if status = "ready" and m.pendingTransition and m.currentPoster = "B"
        m.pendingTransition = false
        m.crossfadeBtoA.control = "start"
        m.currentPoster = "A"
    end if
end sub
