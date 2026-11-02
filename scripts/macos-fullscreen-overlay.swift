import Cocoa
import WebKit

final class OverlayAppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    let targetUrlString: String

    init(urlString: String) {
        self.targetUrlString = urlString
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let screenFrame = NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)

        window = NSWindow(
            contentRect: screenFrame,
            styleMask: [.borderless, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.isOpaque = true
        window.backgroundColor = NSColor(calibratedRed: 0.16, green: 0.02, blue: 0.07, alpha: 1.0)

        let config = WKWebViewConfiguration()
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        webView = WKWebView(frame: screenFrame, configuration: config)
        webView.uiDelegate = self
        webView.navigationDelegate = self
        webView.autoresizingMask = [.width, .height]

        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        if let url = URL(string: targetUrlString) {
            webView.load(URLRequest(url: url))
        }

        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            if event.keyCode == 53 { // Escape key
                NSApp.terminate(nil)
                return nil
            }
            return event
        }
    }

    func webViewDidClose(_ webView: WKWebView) {
        NSApp.terminate(nil)
    }
}

let args = CommandLine.arguments
let urlArg = args.count > 1 ? args[1] : "http://127.0.0.1:5252/fullscreen.html"

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = OverlayAppDelegate(urlString: urlArg)
app.delegate = delegate
app.run()
