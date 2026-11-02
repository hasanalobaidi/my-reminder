# MyReminder — Agent Context (`Codex.md`)

**Latest release: v1.00.01 (2026-11-03) — see `CHANGELOG.md`.** (Update this one line on every release; release notes go only in `CHANGELOG.md`.)

**Full rules: `AGENTS.md` (symlink to `/Users/Hasan/Desktop/QNA work/AGENTS.md`) — read it before any code change.** This project follows the QNA Post Editor rules **except the 3-version (`local` / `beta` / `stable`) system**: `MyReminder` has a **single local version** running on `http://127.0.0.1:5252`.

## Complete Rules List for MyReminder
1. **One function per file (A1)**: Every `.js`/`.jsx` file declares at most **one** top-level function (`node scripts/rules/check-single-function-file.js`). Never put two top-level functions in one file.
2. **Add, don't edit (A1)**: Build new features in new files. Do not edit existing functions to host new behaviour; only wiring (script tag, `require`, event hook-up) or bug fixes inside an existing function may be touched.
3. **Refactor only when asked (A1)**: Rewriting or restructuring existing code requires Hasan's request or approval first.
4. **Single local version (No 3-version system)**: Unlike QNA Post Editor (`local` / `beta` / `stable`), `MyReminder` runs as a single local version on Hasan's Mac (`http://127.0.0.1:5252`). Raise `version.json` by `+0.01` on each update (`1.00.00` → `1.00.01`).
5. **Secrets stay out of shared/committed files (A1)**: Keep tokens, keys, and passwords in `.env` or git-ignored `*.local` files.
6. **Multi-agent coordination & board (A1, C2)**: Check `git status`, `git log --oneline -5`, and `AGENT-BOARD.md` before starting. Claim files in `AGENT-BOARD.md` before editing; log every commit with Qatar time (`+03:00`), agent, version, files, and summary. Never overwrite another agent's uncommitted work.
7. **Work and test headless — no visible Chrome tabs (A1, B3)**: Run all verification, API checks, and UI tests headless in the background (`MYREMINDER_HEADLESS_TEST=1`, no `open` during automated tests) so Hasan's screen and browser are never interrupted.
8. **Never get stuck waiting on background tasks (A1)**: Always close `stdin` (`< /dev/null`) on non-interactive commands; kill any unexpectedly backgrounded quick command in the same turn; set a 30-second wakeup timer if a real long task runs in the background.
9. **Every update must include (A2, B5)**:
   - **Backups** in `backups/<date>-v<version>-<slug>/` (git-ignored) before modifying files.
   - **`version.json`** with `version`, exact Qatar `updatedAt` (`+03:00`), and matching `note<version_with_underscores>`.
   - **`CHANGELOG.md`**: newest entry at the top with date and version.
   - **Root agent context files**: `CLAUDE.md`, `GEMINI.md`, `Codex.md` (update only the «Latest release» line unless rules/map change; keep under ~2,000 tokens; no `AGENTS.md`/`CLAUDE.md`/`GEMINI.md`/`Codex.md` in subfolders — use `*-NOTES.md` there).
   - **Feature docs** in `docs/`: `<FEATURE>.md`, `<FEATURE>-CLAUDE.md`, `<FEATURE>-GEMINI.md`, `<FEATURE>-CODEX.md`.
10. **Code & Quality Standards (B1, C6)**:
    - Register browser modules on `window.QNA`; no un-namespaced globals.
    - Keep calculation (natural language schedule parsing, next-fire timestamps) separate from DOM/IO code.
    - Check inputs and DOM elements before use (`if (!el) { console.warn('[MyReminder] … missing'); return; }`).
    - Never invent data; preserve user data (card Delete moves to 30-day Trash; backup store before writes).
    - Key replacement media/audio previews to `?v=<savedFilename>` and reload only when changed.
    - Handle every terminal state in status/poll loops; tests must compute date expectations dynamically or freeze the clock.
11. **Brand color (A5)**: Default QNA Anabi color is `#8A1538` (RGB 138, 21, 56). Never use `#831034`.
12. **Language (A4) & Questions (A6)**: Reply in the language of Hasan's sentence (Arabic terms inside an English prompt keep the reply English). Ask one question at a time with 2–4 options (Recommended first) + custom answer.
13. **Self-review before finishing (A3)**: Review own work, list risky edge cases, and state honestly what was and was not tested.

## Project Map
- `src/cli-start-server.js` / `src/start-reminder-server.js` — Local control server (`http://127.0.0.1:5252`) + background scheduler daemon.
- `src/parse-natural-reminder-text.js` / `src/compute-next-trigger-at.js` — Pure calculation modules for natural language multi-day/multi-time schedules and next-alarm timestamps.
- `src/get-default-reminder-config.js` / `src/read-reminder-config.js` / `src/save-reminder-config.js` — App configuration (`data/reminder-config.json`).
- `src/get-seed-reminders.js` / `src/read-reminders-store.js` / `src/save-reminders-store.js` — Task, schedule, notes & voice-note storage with automatic backup (`data/reminders.json`).
- `src/speak-reminder-tts.js` / `src/launch-native-fullscreen-alert.js` / `src/tick-reminder-scheduler.js` — macOS `say` TTS, native always-on-top macOS full-screen alert window (`bin/MyReminderFullscreenOverlay`), and 5s alarm tick.
- `src/handle-reminder-http-request.js` — REST + SSE (`/api/events`) + voice-note upload API.
- `public/index.html`, `public/fullscreen.html`, `public/css/styles.css`, `public/js/*.js` — Web Control Dashboard & Full-Screen Notification UI (`window.QNA`, one function per file).
- `MyReminder Control.app` (and `/Users/Hasan/Desktop/MyReminder Control.app`) — macOS Desktop app shortcut.
- `tests/verify-natural-parser.js`, `tests/verify-reminder-suite.js`, `scripts/rules/*.js` — Automated headless verification and rule checks.

## Pointers
- Release history → `CHANGELOG.md`
- Feature documentation → `docs/REMINDER-SUITE.md`, `docs/REMINDER-SUITE-CODEX.md`
- Multi-agent coordination log → `AGENT-BOARD.md`
