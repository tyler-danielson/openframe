sub init()
    m.top.functionName = "taskLoop"
end sub

sub taskLoop()
    m.port = CreateObject("roMessagePort")
    m.top.observeFieldScoped("request", m.port)

    while true
        msg = wait(0, m.port)
        if type(msg) = "roSGNodeEvent" and msg.getField() = "request"
            executeRequest(msg.getData())
        end if
    end while
end sub

sub executeRequest(req as object)
    if req = invalid or req.endpoint = invalid then return

    url = m.top.serverUrl + req.endpoint
    method = "GET"
    if req.method <> invalid
        method = UCase(req.method)
    end if

    requestId = ""
    if req.requestId <> invalid
        requestId = req.requestId
    end if

    transfer = CreateObject("roUrlTransfer")
    port = CreateObject("roMessagePort")
    transfer.setMessagePort(port)
    transfer.SetUrl(url)

    ' Set up HTTPS
    if Left(url, 5) = "https"
        transfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
        transfer.AddHeader("X-Roku-Reserved-Dev-Id", "")
        transfer.InitClientCertificates()
    end if

    ' Set auth header
    if m.top.kioskToken <> invalid and m.top.kioskToken <> ""
        transfer.AddHeader("X-API-Key", "kiosk_" + m.top.kioskToken)
    end if

    transfer.AddHeader("Content-Type", "application/json")
    transfer.AddHeader("Accept", "application/json")

    ' Set timeout (10 seconds)
    transfer.SetReadTimeout(10000)
    transfer.SetConnectionTimeout(5000)

    ' Execute request
    if method = "POST"
        body = ""
        if req.body <> invalid
            body = FormatJson(req.body)
        end if
        ok = transfer.AsyncPostFromString(body)
    else if method = "HEAD"
        transfer.SetRequest("HEAD")
        ok = transfer.AsyncGetToString()
    else
        ok = transfer.AsyncGetToString()
    end if

    if not ok
        m.top.response = {
            requestId: requestId,
            success: false,
            statusCode: -1,
            data: invalid,
            error: "Failed to start request"
        }
        return
    end if

    ' Wait for response
    responseMsg = wait(15000, port)

    if responseMsg = invalid
        m.top.response = {
            requestId: requestId,
            success: false,
            statusCode: -1,
            data: invalid,
            error: "Request timed out"
        }
        return
    end if

    if type(responseMsg) = "roUrlEvent"
        code = responseMsg.GetResponseCode()
        body = responseMsg.GetString()

        if code >= 200 and code < 300
            data = invalid
            if body <> invalid and body <> ""
                data = ParseJson(body)
            end if
            m.top.response = {
                requestId: requestId,
                success: true,
                statusCode: code,
                data: data,
                error: ""
            }
        else
            m.top.response = {
                requestId: requestId,
                success: false,
                statusCode: code,
                data: invalid,
                error: "HTTP " + code.ToStr()
            }
        end if
    else
        m.top.response = {
            requestId: requestId,
            success: false,
            statusCode: -1,
            data: invalid,
            error: "Unexpected response type"
        }
    end if
end sub
