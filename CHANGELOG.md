# MyReminder — Changelog (`CHANGELOG.md`)

All release notes and dated work notes live here (newest at top; Qatar time `+03:00`). Single local version (no 3-version `local`/`beta`/`stable` system).

## v1.00.02 — 2026-11-03 (Qatar `+03:00`) · Gemini
- **Installed Native macOS Desktop App Window (`scripts/macos-desktop-app.swift` → `bin/MyReminderDesktopApp`, `MyReminder Control.app`)**:
  - Upgraded `MyReminder Control.app` so launching it opens a **dedicated standalone macOS Desktop App window** (`NSWindow` + `WKWebView` with native macOS menu bar, `Cmd+C`/`Cmd+V`/`Cmd+A`/`Cmd+R`/`Cmd+Q` shortcuts, microphone permission grant for voice notes, and custom Dock icon) instead of opening a Chrome browser tab.
  - Installed `MyReminder Control.app` to both `/Applications/MyReminder Control.app` and `/Users/Hasan/Desktop/MyReminder Control.app`.
- **Real macOS System Notifications — Not Chrome-Page-Only (`src/send-macos-system-notification.js`, `src/tick-reminder-scheduler.js`, `src/handle-reminder-http-request.js`)**:
  - Added `src/send-macos-system-notification.js` to dispatch real macOS Notification Center system banners with sound (`"Crystal"`) via `/usr/bin/osascript` whenever any scheduled reminder fires or when tested via `POST /api/notifications/test` (`🔔 Test Mac Notification` button in header) — even if all browser tabs and app windows are closed.
  - Upgraded `scripts/macos-fullscreen-overlay.swift` (`bin/MyReminderFullscreenOverlay`) to use `.statusBar` window level above all macOS windows and automatically close the native full-screen window as soon as Dismiss, Snooze, or Mark Ready is clicked.
- **Installable Web App (PWA) & OS Web Notifications (`public/manifest.webmanifest`, `public/sw.js`, `public/js/register-pwa-and-notifications.js`, `public/icons/`)**:
  - Added standalone Web App Manifest (`/manifest.webmanifest`), `192×192` & `512×512` PNG icons, Service Worker (`/sw.js`), and `window.QNA.registerPwaAndNotifications` so the web app can also be installed as a standalone PWA and trigger native OS notifications.

## v1.00.01 — 2026-11-03 (Qatar `+03:00`) · Gemini
- **Custom MyReminder Desktop Icon (`scripts/generate-myreminder-icon.swift`, `MyReminder Control.app/Contents/Resources/AppIcon.icns`)**:
  - Replaced the placeholder icon with a custom-rendered **MyReminder** icon (vibrant teal-to-royal-blue and QNA Anabi `#8A1538` squircle, twin golden ringing alarm bells with sound waves, crisp white clock face set to `11:00` and `3:00`, and an emerald checkmark badge), compiled into all standard macOS `.icns` sizes (`16x16` through `1024x1024`) and applied directly to `/Users/Hasan/Desktop/MyReminder Control.app` via `NSWorkspace.shared.setIcon` so Finder updates immediately.
- **Persistent Online Daemon & Desktop Launcher Fix (`MyReminder Control.app/Contents/MacOS/launcher`, `~/Library/LaunchAgents/qa.org.qna.myreminder.plist`)**:
  - Fixed `nohup: node: No such file or directory` when launching from macOS Finder by adding `/Users/Hasan/.local/node/bin` to `PATH` and resolving `/Users/Hasan/.local/node/bin/node` explicitly.
  - Installed and loaded a persistent macOS `LaunchAgent` (`qa.org.qna.myreminder`) with `RunAtLoad` and `KeepAlive` so `http://127.0.0.1:5252` stays online continuously in the background.

## v1.00.00 — 2026-11-03 (Qatar `+03:00`) · Gemini
- **Initial Release (Local `http://127.0.0.1:5252`)**:
  - **Smart Natural Language Command Bar & Parser (`src/parse-natural-reminder-text.js`)**: Parses multi-day, multi-time, and deadline instructions (including common typos) such as `"set remonder, on tuesdsday, wednesday, to prepare the 3 weekly templates, to be ready on thursady on QNA post editor, remond me at 11 am, 3 pm"` into structured days (`Tuesday`, `Wednesday`), multiple alarm times (`11:00`, `15:00`), deadline (`Thursday`), project (`QNA post editor`), and numbered subtask checklist items.
  - **Full-Screen Notifications (`public/fullscreen.html`, `src/launch-native-fullscreen-alert.js`, `public/js/render-fullscreen-alert.js`)**: Dual-layer full-screen notification system combining a native macOS always-on-top full-screen overlay window (`bin/MyReminderFullscreenOverlay`) and instant browser top-layer `<dialog>` modal via SSE (`/api/events`), with Snooze (`5m`, `15m`, `30m`, `1h`), Dismiss, Complete, and TTS voice readout.
  - **Notes, Recorded Voice Notes, STT & TTS**:
    - Rich notes and interactive subtask checklist per job.
    - Microphone audio voice note recorder (`public/js/manage-voice-note-recorder.js`) stored in `data/voice-notes/` with `?v=<savedFilename>` cache-busted playback.
    - Voice-to-Text (STT) dictation (`public/js/start-voice-dictation.js`) supporting English (`en-US`) and Arabic (`ar-QA`) for both the Smart Command Bar and Notes editor.
    - Text-to-Voice (TTS) via both browser `speechSynthesis` (`public/js/speak-browser-tts.js`) and macOS background `/usr/bin/say` (`src/speak-reminder-tts.js`).
  - **Desktop Shortcut (`MyReminder Control.app`)**: Installed in `/Users/Hasan/Desktop/MyReminder Control.app` and `/Users/Hasan/Desktop/Hasan/MyReminder/MyReminder Control.app` with QNA Anabi (`#8A1538`) icon and automatic background daemon startup.
  - **QNA Code & Documentation Rules**: Enforced strict one-function-per-file across all `.js` files (`scripts/rules/check-single-function-file.js`), 30-day Trash preservation, automatic JSON store backup before writes, and full headless test suite (`npm test`).
