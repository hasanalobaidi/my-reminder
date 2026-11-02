# MyReminder — Codex Notes (`docs/REMINDER-SUITE-CODEX.md`)

See `docs/REMINDER-SUITE.md` for architecture details and `Codex.md` / `AGENTS.md` for project rules.
- Every `.js` file in `src/`, `public/js/`, and `tests/` obeys the strict **one function per file** rule (`node scripts/rules/check-single-function-file.js`).
- Single local version on `http://127.0.0.1:5252` (no 3-version `local`/`beta`/`stable` system).
- Always run tests with `MYREMINDER_HEADLESS_TEST=1` (`npm test`) so macOS `say` and native full-screen windows never interrupt Hasan during automated checks.
