# MyReminder — Changelog (`CHANGELOG.md`)

All release notes and dated work notes live here (newest at top; Qatar time `+03:00`). Single local version (no 3-version `local`/`beta`/`stable` system).

## v1.00.03 — 2026-11-03 (Qatar `+03:00`) · Gemini
- **Native Android App (`android-app/` → `public/download/MyReminder.apk` & `/Users/Hasan/Desktop/MyReminder.apk`)**:
  - Built and signed the native Android application (`qa.org.qna.myreminder`, SDK 34) with `MainActivity`, `FullScreenAlertActivity`, `AlarmReceiver`, `BootReceiver`, and `AlarmScheduler`.
  - Schedules exact native Android `AlarmManager` (`setExactAndAllowWhileIdle`) alarms in `Asia/Qatar` time so reminders wake the phone screen over the lock screen (`setShowWhenLocked(true)`, `setTurnScreenOn(true)`), vibrate, play the alarm tone, and read the reminder aloud via native Android `TextToSpeech` — even when offline or away from the Mac.
  - Reschedules all saved reminders automatically on Android device reboot (`BOOT_COMPLETED`).
- **Two-Way Mac ↔ Android Sync (Wi-Fi LAN + 4G/5G Remote Tunnel + Offline-First)**:
  - Bound the Mac control server (`src/start-reminder-server.js`) to `0.0.0.0:5252` so Android devices on the same Wi-Fi (`http://192.168.0.128:5252`) connect directly, plus added an automatic background 4G/5G SSH reverse tunnel (`src/manage-remote-tunnel.js`) for remote syncing outside the office/home.
  - Added two-way delta/timestamp merge endpoint (`POST /api/sync` in `src/handle-reminder-http-request.js`) and client multi-host + offline-first wrapper (`public/js/init-android-sync-and-ota.js`) so changes made offline on Android automatically sync back to the Mac when reconnected.
  - Added QR Code pairing & APK download modal (`📱 Android App & GitHub Auto-Update` in `public/index.html`) powered by a pure-JS ISO 18004 QR SVG generator (`src/generate-qr-svg.js`, `/api/qr.svg`) and RFC 5545 `.ics` calendar/alarm export (`src/generate-ics-calendar-feed.js`, `/api/reminders.ics`).
- **Zero-Reinstall GitHub Live Auto-Update (OTA)**:
  - Added `src/build-ota-update-bundle.js` and `src/publish-github-ota-update.js` (`GET /api/ota/bundle`, `POST /api/ota/publish-github`) to package all web/UI/JS/CSS assets with SHA-256 verification into `public/ota-bundle.json` and push directly to GitHub (`hasanalobaidi/my-reminder`).
  - Both the native Android APK (`MainActivity.downloadAndApplyBundle` + `@JavascriptInterface MyReminderAndroid.applyOtaBundleFromUrl`) and PWA check GitHub (`https://raw.githubusercontent.com/hasanalobaidi/my-reminder/main/version.json`) and the linked Mac on startup, every 15 minutes, and on manual click — downloading `ota-bundle.json` into internal storage (`filesDir/ota_bundle/`) and hot-reloading the new version **with zero `.apk` reinstall ever needed**.

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
