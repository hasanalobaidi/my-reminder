# MyReminder — Changelog (`CHANGELOG.md`)

All release notes and dated work notes live here (newest at top; Qatar time `+03:00`). Single local version (no 3-version `local`/`beta`/`stable` system).

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
