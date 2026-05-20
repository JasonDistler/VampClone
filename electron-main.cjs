/*
 * Electron main process for Sir Velorian's Last Stand.
 *
 * This file is .cjs (CommonJS) on purpose: the project's package.json
 * sets `"type": "module"` for the browser-side ES modules under src/.
 * Electron's main process needs CommonJS unless we go to the trouble
 * of opting into ESM main mode (Electron 28+, still experimental for
 * some APIs). Using .cjs side-steps the entire issue.
 *
 * Responsibilities:
 *   - Create a single fullscreen-capable BrowserWindow at the game's
 *     native logical resolution (480x270) but scaled up at launch so
 *     pixel-art still snaps to integer multiples on common monitors.
 *   - Load index.html via file:// (not http://) so no local server is
 *     needed. Phaser + ES modules + canvas all work fine over file://
 *     in modern Chromium.
 *   - Strip the default menu bar so the game gets a clean frame, but
 *     keep F11 = fullscreen and Cmd/Ctrl+Q = quit working.
 *   - Disable nodeIntegration / enable sandboxing on the renderer so
 *     a malicious asset can't reach Node APIs. The game is purely a
 *     rendering target - it doesn't need the Node side.
 */

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        // 480x270 is the native logical pixel-art resolution. We scale
        // up by 4x at launch (1920x1080) so the game has plenty of
        // room without feeling cramped. Phaser FIT mode adapts to any
        // window size from there, including fullscreen.
        width: 1920,
        height: 1080,
        minWidth: 640,
        minHeight: 360,
        backgroundColor: '#0a0814',
        title: "Sir Velorian's Last Stand",
        autoHideMenuBar: true,
        // Use a transparent-style frame on Win/Linux. macOS gets the
        // standard traffic-light buttons via the default frame.
        webPreferences: {
            // Renderer is a pure web app - no Node access needed.
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            // Pixel-art rendering relies on disabling image smoothing
            // at the canvas level (Phaser handles it). The webgl /
            // 2d contexts are the same as in a normal browser.
            webgl: true
        }
    });

    /*
     * Load the bundled index.html relative to the app root. When
     * electron-packager builds the Windows distribution it copies
     * index.html, src/, vendor/, and style.css alongside this main
     * process file under resources/app/, so __dirname resolves to
     * the same place the source tree lives.
     */
    const indexPath = path.join(__dirname, 'index.html');
    mainWindow.loadFile(indexPath);

    /*
     * Strip the default app menu globally. F11 fullscreen + Cmd-Q
     * still work because Electron handles those at the OS level
     * even without a Menu instance.
     */
    Menu.setApplicationMenu(null);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(createWindow);

/*
 * macOS keeps the app process alive when all windows close (the dock
 * icon is still there). Re-create the window when the dock icon is
 * clicked. Windows + Linux quit when the last window closes.
 */
app.on('activate', () => {
    if (mainWindow === null) createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
