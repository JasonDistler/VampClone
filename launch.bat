@echo off
REM ===========================================================================
REM   Sir Velorian's Last Stand - launch.bat
REM ===========================================================================
REM
REM   Double-click to play. The launcher:
REM     1. Checks that Node.js is on your PATH.
REM     2. Hands off to server.js, which probes ports 8765-8775 (and
REM        falls back to an OS-picked ephemeral port if every preferred
REM        port is busy), then opens the game in your default browser.
REM
REM   Stop the server with Ctrl-C, or just close this window.
REM ===========================================================================

setlocal
REM `cd /d "%~dp0"` makes the .bat's own folder the current directory,
REM so server.js resolves index.html relative to the project root even
REM when this file is launched from a shortcut elsewhere.
cd /d "%~dp0"

REM ----- Step 1: verify Node is available ---------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo   ERROR: Node.js was not found on your PATH.
    echo.
    echo   Install Node.js LTS from https://nodejs.org/ then run this
    echo   launcher again. Most users want the "LTS" Windows installer.
    echo.
    echo   Press any key to close this window . . .
    pause >nul
    endlocal
    exit /b 1
)

REM ----- Step 2: launch the server ----------------------------------------
REM server.js prints the URL it picked (incl. LAN IPs for phones/tablets
REM on the same Wi-Fi) and pops the default browser at it. The port
REM probe happens inside that script, so we don't duplicate the logic
REM here - the .bat just keeps the process alive in this window.
echo.
echo   Starting Sir Velorian's Last Stand...
echo   (port probe + browser launch handled by server.js)
echo.

node server.js
set "SRV_EXIT=%ERRORLEVEL%"

REM ----- Step 3: pause on exit so errors are readable ---------------------
echo.
if not "%SRV_EXIT%" == "0" (
    echo   Server exited with code %SRV_EXIT%.
) else (
    echo   Server stopped.
)
echo   Press any key to close this window . . .
pause >nul

endlocal
exit /b %SRV_EXIT%
