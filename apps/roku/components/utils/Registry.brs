function registryRead(key as string) as dynamic
    sec = CreateObject("roRegistrySection", "openframe")
    if sec.Exists(key)
        return sec.Read(key)
    end if
    return invalid
end function

sub registryWrite(key as string, value as string)
    sec = CreateObject("roRegistrySection", "openframe")
    sec.Write(key, value)
    sec.Flush()
end sub

sub registryDelete(key as string)
    sec = CreateObject("roRegistrySection", "openframe")
    sec.Delete(key)
    sec.Flush()
end sub

function getConfig() as object
    serverUrl = registryRead("serverUrl")
    kioskToken = registryRead("kioskToken")
    if serverUrl <> invalid and kioskToken <> invalid
        return { serverUrl: serverUrl, kioskToken: kioskToken }
    end if
    return invalid
end function

sub saveConfig(serverUrl as string, kioskToken as string)
    registryWrite("serverUrl", serverUrl)
    registryWrite("kioskToken", kioskToken)
end sub

sub clearConfig()
    registryDelete("serverUrl")
    registryDelete("kioskToken")
end sub
