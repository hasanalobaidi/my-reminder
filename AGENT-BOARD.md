# MyReminder — Shared Agent Board (`AGENT-BOARD.md`)

Rules: see `AGENTS.md` (symlink to `/Users/Hasan/Desktop/QNA work/AGENTS.md`). Note: `MyReminder` uses a single local version (`http://127.0.0.1:5252`), without the 3-version (`local` / `beta` / `stable`) branch system.

## Now working on
- *(none)*

## Commit & Release Log (Newest at top · Qatar Time `+03:00`)
- **2026-11-03 10:46 (+03:00) · Gemini · v1.00.02 · `main` (Local)**
  - **Files**: `scripts/macos-desktop-app.swift`, `bin/MyReminderDesktopApp`, `scripts/macos-fullscreen-overlay.swift`, `bin/MyReminderFullscreenOverlay`, `src/send-macos-system-notification.js`, `src/tick-reminder-scheduler.js`, `src/handle-reminder-http-request.js`, `public/manifest.webmanifest`, `public/sw.js`, `public/js/register-pwa-and-notifications.js`, `public/icons/*.png`, `public/index.html`, `public/js/init-reminder-dashboard.js`, `MyReminder Control.app`, `tests/verify-reminder-suite.js`, `version.json`, `CHANGELOG.md`, `CLAUDE.md`, `GEMINI.md`, `Codex.md`, `docs/REMINDER-SUITE*.md`.
  - **What & Why**: Upgraded `MyReminder Control.app` (installed in `/Applications/MyReminder Control.app` and `/Users/Hasan/Desktop/MyReminder Control.app`) to launch a native standalone macOS Desktop App window (`bin/MyReminderDesktopApp`) instead of a Chrome tab, added real macOS Notification Center banners with sound (`src/send-macos-system-notification.js`), upgraded the native full-screen alert overlay (`bin/MyReminderFullscreenOverlay`), and added PWA installability (`/manifest.webmanifest`, `/sw.js`).
- **2026-11-03 01:48 (+03:00) · Gemini · v1.00.01 · `main` (Local)**
  - **Files**: `scripts/generate-myreminder-icon.swift`, `MyReminder Control.app/Contents/MacOS/launcher`, `MyReminder Control.app/Contents/Resources/AppIcon.icns`, `version.json`, `CHANGELOG.md`, `CLAUDE.md`, `GEMINI.md`, `Codex.md`.
  - **What & Why**: Generated a custom MyReminder Desktop icon (teal/royal-blue/Anabi gradient squircle with twin golden alarm bells, 11:00/3:00 clock face, and emerald checkmark badge) and fixed `/Users/Hasan/.local/node/bin/node` path + installed persistent macOS LaunchAgent (`qa.org.qna.myreminder.plist`) so `http://127.0.0.1:5252` stays online 24/7.
- **2026-11-03 01:08 (+03:00) · Gemini · v1.00.00 · `main` (Local)**
  - **Files**: `src/*.js`, `public/index.html`, `public/fullscreen.html`, `public/css/styles.css`, `public/js/*.js`, `scripts/rules/*.js`, `tests/*.js`, `MyReminder Control.app`, `version.json`, `CHANGELOG.md`, `CLAUDE.md`, `GEMINI.md`, `Codex.md`, `docs/REMINDER-SUITE*.md`.
  - **What & Why**: Initial build of the MyReminder full-screen notification & web control suite with multi-day/multi-time scheduling, natural language parser, notes, recorded voice notes, STT, TTS, native macOS full-screen alert window, and Desktop `.app` shortcut.
