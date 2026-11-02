# MyReminder — Shared Agent Board (`AGENT-BOARD.md`)

Rules: see `AGENTS.md` (symlink to `/Users/Hasan/Desktop/QNA work/AGENTS.md`). Note: `MyReminder` uses a single local version (`http://127.0.0.1:5252`), without the 3-version (`local` / `beta` / `stable`) branch system.

## Now working on
- *(none — release v1.00.01 completed)*

## Commit & Release Log (Newest at top · Qatar Time `+03:00`)
- **2026-11-03 01:48 (+03:00) · Gemini · v1.00.01 · `main` (Local)**
  - **Files**: `scripts/generate-myreminder-icon.swift`, `MyReminder Control.app/Contents/MacOS/launcher`, `MyReminder Control.app/Contents/Resources/AppIcon.icns`, `version.json`, `CHANGELOG.md`, `CLAUDE.md`, `GEMINI.md`, `Codex.md`.
  - **What & Why**: Generated a custom MyReminder Desktop icon (teal/royal-blue/Anabi gradient squircle with twin golden alarm bells, 11:00/3:00 clock face, and emerald checkmark badge) and fixed `/Users/Hasan/.local/node/bin/node` path + installed persistent macOS LaunchAgent (`qa.org.qna.myreminder.plist`) so `http://127.0.0.1:5252` stays online 24/7.
- **2026-11-03 01:08 (+03:00) · Gemini · v1.00.00 · `main` (Local)**
  - **Files**: `src/*.js`, `public/index.html`, `public/fullscreen.html`, `public/css/styles.css`, `public/js/*.js`, `scripts/rules/*.js`, `tests/*.js`, `MyReminder Control.app`, `version.json`, `CHANGELOG.md`, `CLAUDE.md`, `GEMINI.md`, `Codex.md`, `docs/REMINDER-SUITE*.md`.
  - **What & Why**: Initial build of the MyReminder full-screen notification & web control suite with multi-day/multi-time scheduling, natural language parser, notes, recorded voice notes, STT, TTS, native macOS full-screen alert window, and Desktop `.app` shortcut.
