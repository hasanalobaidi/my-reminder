# MyReminder — Full-Screen Notification & Job Arrangement Suite (`docs/REMINDER-SUITE.md`)

## Overview
`MyReminder` (`v1.00.03`) is a local macOS Desktop + Native Android Companion App + installable web control application (`http://127.0.0.1:5252` & `http://192.168.0.128:5252`) for scheduling tasks, recurring multi-day/multi-time alarms, job deadlines, notes, recorded audio voice notes, Voice-to-Text (STT), Text-to-Voice (TTS), real macOS Notification Center alerts, native Android lock-screen alarms, and Zero-Reinstall GitHub Live Auto-Update (OTA).

## Architecture & Key Capabilities
1. **Natural Language Smart Parser (`src/parse-natural-reminder-text.js`)**:
   - Accepts free-form English/Arabic-mixed schedule prompts (with typo tolerance: `remonder`, `remond`, `tuesdsday`, `thursady`, `schadual`).
   - Example:
     `"set remonder, on tuesdsday, wednesday, to prepare the 3 weekly templates, to be ready on thursady on QNA post editor, remond me at 11 am, 3 pm"`
   - Output:
     - `title`: `"Prepare the 3 weekly templates"`
     - `project`: `"QNA post editor"`
     - `daysOfWeek`: `["tuesday", "wednesday"]`
     - `times`: `["11:00", "15:00"]`
     - `readyByDay`: `"thursday"`
     - `subtasks`: 3 checklist items (`Weekly template 1`, `Weekly template 2`, `Weekly template 3`)
2. **Full-Screen Notifications (`public/fullscreen.html`, `bin/MyReminderFullscreenOverlay`, `public/js/render-fullscreen-alert.js`)**:
   - **Native macOS Full-Screen Overlay**: Compiled AppKit + WebKit binary (`bin/MyReminderFullscreenOverlay`) opens an always-on-top full-screen alert window across the Mac screen when an alarm triggers.
   - **Web Control Page Modal**: Real-time Server-Sent Events (`/api/events`) open the top-layer `<dialog>` full-screen alert in any open browser tab.
   - **Actions**: Snooze (`5m`, `15m`, `30m`, `1h`), Dismiss current time slot, Mark Job Complete, or Replay TTS readout.
3. **Notes, Voice Notes, STT & TTS**:
   - **Voice-to-Text (STT)**: Browser `SpeechRecognition` / `webkitSpeechRecognition` dictation into the Smart Command Bar or Notes textarea (`en-US` and `ar-QA`).
   - **Text-to-Voice (TTS)**: Both browser `speechSynthesis` and macOS `/usr/bin/say` background readout.
   - **Recorded Voice Notes**: `MediaRecorder` microphone capture stored in `data/voice-notes/` and served with `?v=<savedFilename>` cache-busting.
4. **Installed Mac Desktop App & Real macOS System Notifications**:
   - **Native Mac App (`MyReminder Control.app` → `bin/MyReminderDesktopApp`)**: Installed in `/Applications/MyReminder Control.app` and `/Users/Hasan/Desktop/MyReminder Control.app`. Opens a standalone native macOS window (`NSWindow` + `WKWebView`) with custom Dock icon and menu bar instead of a Chrome browser tab.
   - **Real macOS System Notifications (`src/send-macos-system-notification.js`)**: Dispatches real macOS Notification Center banners with sound (`"Crystal"`) via `/usr/bin/osascript` even when all browser tabs and windows are closed.
   - **Installable PWA (`public/manifest.webmanifest`, `public/sw.js`, `public/js/register-pwa-and-notifications.js`)**: Full Web App Manifest, Service Worker, and OS Web Notification support.
5. **Native Android App (`MyReminder.apk`), Two-Way Mac Sync & Zero-Reinstall GitHub Auto-Update**:
   - **Native Android App (`android-app/` → `public/download/MyReminder.apk` & `/Users/Hasan/Desktop/MyReminder.apk`)**: Compiled and signed Android SDK 34 app (`qa.org.qna.myreminder`) with `MainActivity`, `FullScreenAlertActivity`, `AlarmReceiver`, `BootReceiver`, and `AlarmScheduler`. Schedules exact Android `AlarmManager` (`setExactAndAllowWhileIdle`) alarms in `Asia/Qatar` time that wake the lock screen, vibrate, play the alarm ringtone, and read the reminder aloud via native Android `TextToSpeech` even when offline.
   - **Two-Way Wi-Fi + 4G/5G + Offline Sync (`src/get-network-sync-info.js`, `src/manage-remote-tunnel.js`, `POST /api/sync`, `public/js/init-android-sync-and-ota.js`)**: Syncs automatically over local Wi-Fi (`http://192.168.0.128:5252`) and remote 4G/5G SSH tunnel (`localhost.run`), with offline-first local storage and QR Code pairing (`/api/qr.svg`) + `.ics` calendar export (`/api/reminders.ics`).
   - **Zero-Reinstall GitHub Live Auto-Update (`src/build-ota-update-bundle.js`, `src/publish-github-ota-update.js`, `public/ota-bundle.json`)**: Packages all web/UI/JS/CSS assets with SHA-256 verification into `public/ota-bundle.json` and publishes to GitHub (`hasanalobaidi/my-reminder`). The Android app downloads new OTA bundles into `filesDir/ota_bundle/` and hot-reloads on the fly without ever reinstalling the APK.
