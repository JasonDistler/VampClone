@echo off
REM ===========================================================================
REM   Sir Velorian's Last Stand - Web Launcher
REM ===========================================================================
REM
REM   Starts a tiny Node.js static-file server in this folder and opens the
REM   game in your default browser. The server lives in server.js and:
REM
REM     1. Probes ports 8765-8775 for one that isn't already in use, falling
REM        back to an OS-picked ephemeral port if every preferred port is
REM        occupied. This guarantees the launcher won't collide with another
REM        dev server already running on your machine.
REM     2. Serves index.html and the rest of the project tree to localhost.
REM     3. Pops the URL in your default browser.
REM
REM   To stop the game:
REM     - Press Ctrl-C in this window, OR
REM     - Close this window (the server dies with it).
REM
REM   If you only want the server (no browser auto-open), run from a shell:
REM     node server.js --no-open
REM
REM ===========================================================================

setlocal

REM Make sure relative paths inside server.js resolve against the project
REM directory even when the user double-clicks this file from elsewhere.
pushd "%~dp0"

REM ----- Step 0: verify Node is available ---------------------------------
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
    popd
    endlocal
    exit /b 1
)

REM ----- Step 1: hand off to the Node server ------------------------------
REM server.js handles port-collision detection and browser launch itself,
REM so this batch file just needs to keep the process alive in this window.
node server.js
set "SRV_EXIT=%ERRORLEVEL%"

REM ----- Cleanup ----------------------------------------------------------
echo.
if not "%SRV_EXIT%" == "0" (
    echo   Server exited with code %SRV_EXIT%.
) else (
    echo   Server stopped.
)
echo   Press any key to close this window . . .
pause >nul

popd
endlocal
exit /b %SRV_EXIT%
