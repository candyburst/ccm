# CCM — Development Reference

Internal reference for contributors and maintainers. Covers architecture decisions, coding conventions, and things that are easy to break.

---

## Architecture

CCM is three packages sharing one core library:

```
@ccm/core   — all business logic, no UI, Node built-ins only
@ccm/tui    — Ink terminal UI + headless CLI
@ccm/app    — Electron + React + Vite desktop app
```

The rule is strict: if it touches a file, process, or network — it belongs in `core`. If it displays something — it belongs in `tui` or `app`. Core must never import from tui or app.

---

## Account types

Two auth types, both stored in `~/.ccm/accounts.json`:

- `api_key` — API key encrypted with AES-256-GCM, injected as `ANTHROPIC_API_KEY` at spawn time
- `email` — OAuth session stored in `~/.ccm/sessions/<name>/`, pointed to via `CLAUDE_CONFIG_DIR`

---

## Smart resume flow

This is the core feature. Do not break it.

```
Credit limit detected on Account A
  │
  ├─ 1. Mark A as exhausted in this rotation cycle
  ├─ 2. git add -A && git commit  (if gitCheckpoint: true)
  ├─ 3. Find ~/.claude/projects/<encodeCwd(cwd)>/<session-id>.jsonl
  │      Copy it to Account B's equivalent projects/ directory
  └─ 4. claude --resume <session-id>  with Account B's env
```

`encodeCwd(cwd)` replaces every non-alphanumeric character with `-`. This must match Claude Code's own encoding exactly. If it doesn't, `--resume` will not find the session file and will start fresh. Test this function any time you touch `session-transfer.js`.

---

## Encryption

Keys are encrypted with AES-256-GCM. The machine key lives in `~/.ccm/.key` (mode `0600`). It is generated randomly on first run. `CCM_SECRET` env var overrides it.

`decrypt()` returns `null` on any failure — it never throws. Callers must check for null.

When building the subprocess environment in `runner.js`:
- Start from `{ ...process.env }`
- Delete `CCM_SECRET` and `CCM_DEBUG` — these must never reach Claude
- Set only `ANTHROPIC_API_KEY` or `CLAUDE_CONFIG_DIR`, not both

---

## Electron IPC

All core logic runs in the main process via `ipcMain.handle()`. The renderer accesses everything through `window.ccm.*` exposed by `preload.js` via `contextBridge`.

Core is cached: `getCoreOnce()` returns the same import on every call. Never call `import()` directly inside an IPC handler — the ~20ms penalty adds up.

Every IPC handler is wrapped in the `handle()` helper which catches errors and returns `{ ok, data/error }`. The renderer must check `result.ok` before using `result.data`.

---

## File I/O rules

- All writes to `accounts.json` go through `save()` which writes to a `.tmp` file first, then renames atomically. Never use `writeFileSync` directly on `accounts.json`.
- All paths use `path.join()` — never string concatenation. Never hardcode `/` or `\`.
- Session log is capped at 500 entries in `saveLog()`. Do not remove this cap.

---

## Coding conventions

- ESM throughout. `electron/main.js` is the only CJS file (required by Electron).
- No classes — plain exported functions.
- No `console.log` in production paths. Use `process.stderr.write('[ccm] ...\n')` for user-visible output or `debug()` from `core/debug.js` for developer output gated on `CCM_DEBUG=1`.
- Error messages: short, specific, actionable. `"account "work" not found"` not `"The specified account could not be located in the system"`.
- `@ccm/core` has zero external dependencies — only Node built-ins. Do not add any.

---

## Current known gaps

See `ROADMAP.md` for the full feature roadmap.

Quick reference of highest-priority gaps:
- API key validation before save
- CLAUDE_CONFIG_DIR verification + symlink fallback
- Windows portable session backup — `fs.cpSync`
- First-run onboarding wizard
- Test suite — run `npm test`
