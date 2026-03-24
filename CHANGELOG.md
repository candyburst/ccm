# Changelog

All notable changes to CCM are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org). Dates are UTC.

---

## [Unreleased]

---

## [1.0.0] — 2026-03-22

### Added
- Full multi-account Claude Code management with automatic session resume
- Smart resume: session JSONL transferred between accounts on credit limit switch
- Auto-switch: credit limit detection via stderr pattern matching; exhaustion loop terminates cleanly
- `ccm account` command with `disable`, `enable`, and `update` subcommands
- TUI: 9 screens (Dashboard, Run, Add Account, Projects, Sessions, Sync, Settings, Onboard, Branches)
- Electron app: 8 pages with full GUI for all features; auto-update via electron-updater
- CLI: 22 commands
- Git checkpoints: `git add -A && git commit` before every account switch
- GitHub sync: project push on switch; private JSONL backup repo; `--resume` restore
- Hooks: register `ccm checkpoint` / `ccm sync push` in `~/.claude/settings.json`
- Web dashboard: `ccm serve` — read-only, SSE, 128-bit token auth, `127.0.0.1` only
- Remote agent: `ccm agent` — HMAC-signed, `timingSafeEqual`, 192-bit token
- Plugins: `~/.ccm/plugins/*.js`, 4 lifecycle events, crash-isolated
- Export/import: AES-256-GCM passphrase re-encryption for cross-machine portability
- Watch mode: `--watch` with exponential backoff, 5-failure threshold
- Burn rate predictor: weighted average token/sec with graceful null on missing data
- Context injection: file paths + git:log/status/diff, configurable token limit
- Context compression: opt-in Anthropic API summarisation (requires `compressionEnabled: true`)
- Session branching: fork from any checkpoint JSONL
- Task queue: unattended overnight task execution with `--message` flag
- Parallel workers: named worker processes with file-based account locking
- Team mode: shared account pool via private git repo with per-account lock files
- Prompt library: named templates with `{{project}}` `{{account}}` `{{date}}` `{{gitBranch}}`
- Account cost optimizer: `round-robin` / `cheapest` / `fastest` / `reserved` / `random` strategies
- 14 unit test files; vitest config with 80% coverage thresholds
- CI: lint, test matrix (Node 18/20/22), build, format check on every push
- Release workflow: signed macOS/Windows/Linux builds + npm publish on version tag
- VitePress docs site with 15 pages

### Fixed
- `crypto.js` — encryption key now derived from a random persisted secret (~/.ccm/.key) instead of predictable $HOME
- `crypto.js` — `decrypt()` returns `null` on failure instead of throwing, preventing crashes on key mismatch
- `accounts.js` — `addApiKeyAccount` is async and validates the key against Anthropic before saving
- `accounts.js` — atomic writes prevent data corruption on concurrent saves
- `runner.js` — `buildEnv()` strips `CCM_SECRET` and `CCM_DEBUG` before passing env to Claude subprocess
- `runner.js` — account rotation respects `disabled` flag and `priority` ordering
- `projects.js` — project name uses `path.basename()` instead of `split('/')` — Windows compatible
- `checkpoint.js` — `pushSessionBackup` uses `copyDirSync` from `fs-utils.js`; correct on Windows
- `isolation.js` — detects whether installed Claude Code respects `CLAUDE_CONFIG_DIR`; falls back to symlinking ~/.claude if not
- `agent-server.js` — HMAC and token comparisons use `timingSafeEqual`
- `compress.js` — `compressionEnabled: false` config gate added; must be explicitly enabled
- `getCoreOnce()` caching in Electron main process — eliminates ~20ms re-import per IPC call
- `try/catch` wrapper on all Electron IPC handlers — main process no longer crashes on handler errors
- `app.requestSingleInstanceLock()` — second launch focuses existing window instead of opening duplicate
- `shell:open` IPC validates URL scheme (https/http only)

### Security
- AES-256-GCM with 12-byte random IV per encryption; auth tag verified on every decrypt
- `accounts.json` and `.key` created with mode `0600`
- `CCM_SECRET` and `CCM_DEBUG` stripped from subprocess env on every spawn
- HMAC comparison uses `crypto.timingSafeEqual` in remote agent
- Context compression is opt-in; disabled by default (`compressionEnabled: false`)
- `team.js` stages only `locks/` directory — not `git add -A`
- Electron: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`

### Known limitations
- `ccm queue` requires Claude Code `--message` flag (>= 1.0.0) — unverified on older versions
- Burn rate time-remaining display requires per-account token quota tracking (not yet implemented)
- `ccm compress` dry-run is safe; live run sends session transcript to Anthropic API — enable explicitly
- Remote agent HMAC comparison is constant-time but JS timing precision limits absolute guarantees
