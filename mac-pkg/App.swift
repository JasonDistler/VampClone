/*
 * Sir Velorian's Last Stand - macOS shell.
 *
 * Tiny native AppKit + WKWebView wrapper. No Electron / Node runtime is
 * shipped; the system WebKit renders the game directly from the bundled
 * resources. The build script (build.sh) writes the game files to
 * Contents/Resources/web/ inside the .app bundle.
 *
 * Why a custom URL scheme instead of file://?
 *   WKWebView refuses to load ES modules from file:// (cross-origin error
 *   even with allowingReadAccessTo). We register an `appgame://` scheme
 *   handler that maps appgame://app/<path> -> Resources/web/<path> and
 *   serves files with proper MIME types, so the WebView treats them as a
 *   real same-origin app and modules / fetch / etc. all work.
 *
 * Why a custom WKWebView app instead of embedding Electron?
 *   - Bundle size ~ 200 KB instead of ~ 150 MB
 *   - Uses the host OS's WebKit, no auto-update concerns
 *   - Boots in under a second on Apple Silicon
 *   - No Node toolchain required to build
 */

import Cocoa
import WebKit

// MARK: - Custom URL scheme handler --------------------------------------

/*
 * Serves files out of Contents/Resources/web/ over a synthetic
 * `appgame://app/...` URL. Setting Content-Type explicitly is what makes
 * <script type="module"> work - WKWebView refuses to execute modules
 * served as application/octet-stream, and file:// loads always end up
 * that way.
 *
 * Path traversal: we reject any URL whose resolved path leaves the
 * webRoot directory.
 */
final class GameSchemeHandler: NSObject, WKURLSchemeHandler {
    private let webRoot: URL

    init(webRoot: URL) {
        self.webRoot = webRoot.standardizedFileURL
        super.init()
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else {
            task.didFailWithError(NSError(domain: "appgame", code: -1, userInfo: [NSLocalizedDescriptionKey: "missing url"]))
            return
        }

        // Strip leading slash and treat empty paths as index.html
        var rel = url.path
        if rel.hasPrefix("/") { rel.removeFirst() }
        if rel.isEmpty { rel = "index.html" }

        let candidate = webRoot.appendingPathComponent(rel).standardizedFileURL
        guard candidate.path.hasPrefix(webRoot.path) else {
            task.didFailWithError(NSError(domain: "appgame", code: 403, userInfo: [NSLocalizedDescriptionKey: "path traversal blocked"]))
            return
        }

        do {
            let data = try Data(contentsOf: candidate)
            let mime = Self.mimeType(forPath: rel)
            let response = HTTPURLResponse(
                url: url,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: [
                    "Content-Type": mime,
                    "Content-Length": "\(data.count)",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-cache"
                ]
            )!
            task.didReceive(response)
            task.didReceive(data)
            task.didFinish()
        } catch {
            // 404 with a tiny body so the WebView doesn't hang waiting.
            let body = "Not found: \(rel)".data(using: .utf8) ?? Data()
            let resp = HTTPURLResponse(
                url: url,
                statusCode: 404,
                httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "text/plain; charset=utf-8"]
            )!
            task.didReceive(resp)
            task.didReceive(body)
            task.didFinish()
        }
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        /* Nothing to cancel - reads are synchronous and immediate. */
    }

    /*
     * Minimal extension -> MIME map covering everything the game serves
     * (HTML, ES modules, CSS, fonts, audio, images). Defaulting to
     * application/octet-stream would silently break <script type="module">.
     */
    static func mimeType(forPath path: String) -> String {
        let ext = (path as NSString).pathExtension.lowercased()
        switch ext {
        case "html", "htm":     return "text/html; charset=utf-8"
        case "js", "mjs":       return "application/javascript; charset=utf-8"
        case "css":             return "text/css; charset=utf-8"
        case "json":            return "application/json; charset=utf-8"
        case "svg":             return "image/svg+xml"
        case "png":             return "image/png"
        case "jpg", "jpeg":     return "image/jpeg"
        case "gif":             return "image/gif"
        case "webp":            return "image/webp"
        case "ico":             return "image/x-icon"
        case "wav":             return "audio/wav"
        case "mp3":             return "audio/mpeg"
        case "ogg":             return "audio/ogg"
        case "m4a":             return "audio/mp4"
        case "ttf":             return "font/ttf"
        case "otf":             return "font/otf"
        case "woff":            return "font/woff"
        case "woff2":           return "font/woff2"
        case "txt":             return "text/plain; charset=utf-8"
        default:                return "application/octet-stream"
        }
    }
}

// MARK: - Window lifecycle -----------------------------------------------

final class WindowDelegate: NSObject, NSWindowDelegate {
    func windowWillClose(_ notification: Notification) {
        NSApp.terminate(nil)
    }
}

// MARK: - Menu -----------------------------------------------------------

func buildMenu() {
    let mainMenu = NSMenu()

    let appMenuItem = NSMenuItem()
    let appMenu = NSMenu()
    let appName = "Sir Velorian's Last Stand"
    appMenu.addItem(withTitle: "About \(appName)", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
    appMenu.addItem(NSMenuItem.separator())
    appMenu.addItem(withTitle: "Hide \(appName)", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
    let hideOthers = NSMenuItem(title: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
    hideOthers.keyEquivalentModifierMask = [.command, .option]
    appMenu.addItem(hideOthers)
    appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
    appMenu.addItem(NSMenuItem.separator())
    appMenu.addItem(withTitle: "Quit \(appName)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    appMenuItem.submenu = appMenu
    mainMenu.addItem(appMenuItem)

    let editMenuItem = NSMenuItem()
    let editMenu = NSMenu(title: "Edit")
    editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
    editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
    editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
    editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
    editMenuItem.submenu = editMenu
    mainMenu.addItem(editMenuItem)

    let viewMenuItem = NSMenuItem()
    let viewMenu = NSMenu(title: "View")
    let fullScreenItem = NSMenuItem(title: "Enter Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
    fullScreenItem.keyEquivalentModifierMask = [.command, .control]
    viewMenu.addItem(fullScreenItem)
    viewMenuItem.submenu = viewMenu
    mainMenu.addItem(viewMenuItem)

    let windowMenuItem = NSMenuItem()
    let windowMenu = NSMenu(title: "Window")
    windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
    windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
    windowMenuItem.submenu = windowMenu
    mainMenu.addItem(windowMenuItem)

    NSApp.mainMenu = mainMenu
    NSApp.windowsMenu = windowMenu
}

// MARK: - Boot -----------------------------------------------------------

let app = NSApplication.shared
app.setActivationPolicy(.regular)
buildMenu()

// Resolve resource URL up-front so the scheme handler can capture it.
guard let resources = Bundle.main.resourceURL else {
    fatalError("Missing app bundle resource URL")
}
let webRoot = resources.appendingPathComponent("web")

let windowFrame = NSRect(x: 0, y: 0, width: 1280, height: 720)
let window = NSWindow(
    contentRect: windowFrame,
    styleMask: [.titled, .closable, .miniaturizable, .resizable],
    backing: .buffered,
    defer: false
)
window.title = "Sir Velorian's Last Stand"
window.center()
window.minSize = NSSize(width: 640, height: 360)
window.backgroundColor = NSColor(red: 8.0/255.0, green: 7.0/255.0, blue: 13.0/255.0, alpha: 1.0)

// Configuration must register the URL scheme handler BEFORE the WKWebView
// is constructed; you cannot attach handlers after the fact.
let config = WKWebViewConfiguration()
let prefs = WKPreferences()
prefs.javaScriptCanOpenWindowsAutomatically = false
config.preferences = prefs

// Enable the Web Inspector for ad-hoc debugging - reachable via Safari ->
// Develop -> the running app, when Safari Develop menu is enabled.
config.preferences.setValue(true, forKey: "developerExtrasEnabled")

config.websiteDataStore = WKWebsiteDataStore.default()

let schemeHandler = GameSchemeHandler(webRoot: webRoot)
config.setURLSchemeHandler(schemeHandler, forURLScheme: "appgame")

let webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
webView.autoresizingMask = [.width, .height]
webView.allowsBackForwardNavigationGestures = false
webView.setValue(false, forKey: "drawsBackground")

window.contentView = webView

// Final entry URL the WebView navigates to. The scheme handler maps it
// to Resources/web/index.html.
let entryURL = URL(string: "appgame://app/index.html")!
webView.load(URLRequest(url: entryURL))

let windowDelegate = WindowDelegate()
window.delegate = windowDelegate

window.makeKeyAndOrderFront(nil)
app.activate(ignoringOtherApps: true)
app.run()
