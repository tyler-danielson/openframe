@rem ##########################################################################
@rem
@rem  Gradle startup script for Windows
@rem
@rem ##########################################################################

@if "%DEBUG%"=="" @echo off
setlocal

set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.

@rem Determine Java command
if defined JAVA_HOME (
    set JAVACMD=%JAVA_HOME%\bin\java.exe
) else (
    set JAVACMD=java.exe
)

@rem Download wrapper jar if missing
set WRAPPER_JAR=%DIRNAME%gradle\wrapper\gradle-wrapper.jar
if not exist "%WRAPPER_JAR%" (
    echo Downloading Gradle Wrapper...
    if not exist "%DIRNAME%gradle\wrapper" mkdir "%DIRNAME%gradle\wrapper"
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/gradle/gradle/v8.2.0/gradle/wrapper/gradle-wrapper.jar' -OutFile '%WRAPPER_JAR%'}"
)

"%JAVACMD%" -jar "%WRAPPER_JAR%" %*

:end
endlocal
