# MyReminder — Full-Screen Notification & Job Arrangement Suite (`docs/REMINDER-SUITE.md`)

## Overview
`MyReminder` (`v1.00.00`) is a local macOS + web control application (`http://127.0.0.1:5252`) for scheduling tasks, recurring multi-day/multi-time alarms, job deadlines, notes, recorded audio voice notes, Voice-to-Text (STT), Text-to-Voice (TTS), and OS-level full-screen alert notifications.

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
4. **Desktop App Shortcut**:
   - `/Users/Hasan/Desktop/MyReminder Control.app` (and repo copy) starts the background daemon on port `5252` and opens the Web Control Dashboard.
