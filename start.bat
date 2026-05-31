@echo off
REM ===========================================================================
REM   Sir Velorian's Last Stand - Launcher (with public-tunnel option)
REM ===========================================================================
REM
REM   Front-door launcher. Presents a small menu so you can pick how the
REM   game is exposed:
REM
REM     1) Local only       127.0.0.1 only - just this PC
REM     2) LAN (default)    same Wi-Fi - phones / tablets / other PCs work
REM     3) Public Tunnel    anyone with the URL on the open internet,
REM                         tunneled via `npx localtunnel` (no install,
REM                         no signup, no auth token)
REM     Q) Quit
REM
REM   Tunnel mode notes:
REM     * Uses `npx --yes localtunnel --port 8765`. The first run downloads
REM       the package via npx (Node fetches it once and caches it).
REM     * The server is launched in a separate window pinned to port 8765
REM       so the tunnel always knows where to forward. If 8765 is already
REM       in use, the server window will print EADDRINUSE and close - free
REM       up the port (close whatever else is using it) and try again.
REM     * loca.lt shows a one-time "Click to Continue" warning page on
REM       first visit per browser. That's the service's anti-abuse gate,
REM       not an error.
REM
REM ===========================================================================

setlocal enabledelayedexpansion
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

REM npx ships with Node so if `where npx` fails we'll only flag it when
REM the user actually picks the tunnel option (no point gating LAN /
REM local modes behind an npx check).

:menu
cls
echo ============================================================
echo   Sir Velorian's Last Stand - Launcher
echo ============================================================
echo.
echo   1) Local only       just this PC ^(http://localhost:^<port^>/^)
echo   2) LAN ^(default^)    this PC + phones/tablets on Wi-Fi
echo   3) Public Tunnel    anyone with the URL ^(npx localtunnel^)
echo   Q) Quit
echo.
set "CHOICE="
set /p CHOICE="  Choose [1/2/3/Q]: "

if /i "!CHOICE!"=="1" goto local
if /i "!CHOICE!"=="2" goto lan
if /i "!CHOICE!"=="3" goto tunnel
if /i "!CHOICE!"=="Q" goto end
if not defined CHOICE goto lan
echo   "!CHOICE!" is not a valid choice.
timeout /t 1 >nul
goto menu

REM ===========================================================================
REM   Mode 1 - Local only
REM ===========================================================================
:local
echo.
echo   Starting in LOCAL ONLY mode...
echo   Press Ctrl-C to stop.
echo.
node server.js --localhost
set "SRV_EXIT=%ERRORLEVEL%"
goto post

REM ===========================================================================
REM   Mode 2 - LAN
REM ===========================================================================
:lan
echo.
echo   Starting in LAN mode...
echo   Press Ctrl-C to stop.
echo.
node server.js
set "SRV_EXIT=%ERRORLEVEL%"
goto post

REM ===========================================================================
REM   Mode 3 - Public Tunnel via npx localtunnel
REM ===========================================================================
REM
REM   Architecture:
REM     1. Spawn the local server in a NEW console window pinned to
REM        port 8765 and bound to 127.0.0.1 only (no LAN exposure -
REM        the tunnel is the only public entry point).
REM     2. Wait a couple of seconds for the server's listen() to settle
REM        so the tunnel doesn't try to forward before it's ready.
REM     3. Run `npx --yes localtunnel --port 8765` in THIS window. The
REM        public URL prints once the tunnel handshake completes; that's
REM        what you share. Closing this window or Ctrl-C drops the
REM        tunnel only - the server window keeps running until you
REM        close it (or we taskkill it on exit, see below).
REM
REM ===========================================================================
:tunnel
where npx >nul 2>nul
if errorlevel 1 (
    echo.
    echo   ERROR: `npx` was not found on your PATH.
    echo.
    echo   npx ships with Node.js, so this usually means your Node
    echo   install is older than 8.2 or the npx shim was excluded.
    echo   Reinstall the Node.js LTS from https://nodejs.org/ to fix it.
    echo.
    pause
    goto menu
)

echo.
echo   ============================================================
echo     PUBLIC TUNNEL MODE
echo   ============================================================
echo     1. Local server starts in a SEPARATE window on port 8765.
echo     2. npx localtunnel runs here and prints a public URL like
echo          https://something-random.loca.lt
echo     3. First-time visitors see a "Click to Continue" warning
echo        page from loca.lt. That's normal - have them click it.
echo.
echo     To STOP everything: close this window (the server window
echo     will be closed for you on exit).
echo   ============================================================
echo.

start "Sir Velorian Server" cmd /k "node server.js --localhost --port 8765 --no-open"

echo   Waiting 3 seconds for the server to come up...
timeout /t 3 /nobreak >nul

echo.
echo   Launching tunnel (first run downloads localtunnel via npx)...
echo.
call npx --yes localtunnel --port 8765
set "SRV_EXIT=%ERRORLEVEL%"

echo.
echo   Tunnel exited. Closing the server window...
taskkill /F /FI "WINDOWTITLE eq Sir Velorian Server*" >nul 2>nul

goto post

REM ===========================================================================
REM   Cleanup
REM ===========================================================================
:post
echo.
if not "%SRV_EXIT%" == "0" (
    echo   Process exited with code %SRV_EXIT%.
) else (
    echo   Stopped.
)
echo   Press any key to close this window . . .
pause >nul

:end
popd
endlocal
exit /b 0
