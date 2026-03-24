# CCM Roadmap

**Goal:** Make CCM the definitive tool for anyone running Claude Code at scale — multiple accounts,
zero downtime, full session continuity, open source, and trusted by the community.

This roadmap is ordered deliberately. Each phase gates the next. Do not skip phases or reorder them —
the later phases depend on the quality delivered in the earlier ones.

---

## Principles

- **Core stays dependency-free.** `@ccm/core` uses only Node built-ins. No exceptions.
- **UI is a skin.** All logic lives in core. TUI and Electron are display layers only.
- **No silent failures.** Every error surfaces to the user with enough context to act on.
- **Security is not a phase.** Encryption, isolation, and safe defaults apply from day one.
- **Ship working software.** A smaller feature that works beats a larger one that doesn't.

---

## Phase overview

| Phase | Name | Duration | Gates |
|---|---|---|---|
| 1 | Stability & correctness | ✅ Complete | Required before any new features |
| 2 | User experience | 3–5 days | Requires Phase 1 complete |
| 3 | Power features | 1–2 weeks | Requires Phase 2 complete |
| 4 | Ecosystem | 2–4 weeks | Can start after Phase 3 |
| 5 | Distribution & open source | Ongoing | Can start after Phase 3 |
| 6 | Unique features | 4–8 weeks | Can overlap with Phase 4 & 5 |

---

## Phase 1 — Stability & correctness

**Why this phase exists:** CCM's core value proposition — seamless account rotation and session
resume — only works if the underlying machinery is correct. These are not cosmetic bugs. A broken
`encodeCwd()`, a crashing ESM import, or unverified `CLAUDE_CONFIG_DIR` support silently destroys
the main feature for users. Fix these before anything else.

**Exit criteria:** All four critical bugs resolved. Reliability features implemented. Zero known
crashes on all three platforms.

**Status:** Phase 1 is functionally complete. Icon and social preview assets are not yet final — placeholder icons are in place.

---

### P1.1 — Critical bug fixes

**~~API key validation before save~~** ✅ Complete
- `validate.js` pings `/v1/models`, returns typed errors with actionable hints
- `accounts.js` `addApiKeyAccount` is async and validates before encrypting
- TUI `AddAccount.js` and Electron `AddAccount.jsx` both show validating state

**~~Fix ESM/require mix in `checkpoint.js`~~** ✅ Already resolved
- `checkpoint.js` uses correct top-level ESM imports throughout — this bug does not exist in the codebase

**~~Verify `CLAUDE_CONFIG_DIR` support~~** ✅ Complete
- `isolation.js` detects the active isolation method by running a test spawn
- Falls back to symlinking `~/.claude` if env var is not respected
- `runner.js` calls `prepareIsolation()` before spawn and `cleanupIsolation()` on exit
- Debug logging via `CCM_DEBUG=1`

**~~Windows-portable session backup~~** ✅ Complete
- `fs-utils.js` wraps `fs.cpSync` with a manual recursive fallback
- `checkpoint.js` `pushSessionBackup` uses `copyDirSync` — no Unix-only syscalls remain

---

### P1.2 — Reliability improvements ✅ Complete

**~~Account `disabled` state~~** ✅
- `disabled: boolean` field in account schema; `getNextFreshAccount()` skips disabled accounts
- CLI: `ccm account disable <n>` / `ccm account enable <n>` — added to `cli.js` and `CLI_COMMANDS`
- TUI Dashboard: `d` key toggles disabled with visual indicator (✗ / dimmed name / `disabled` label)
- Electron Dashboard: disable/enable button on each account card with opacity + red border on disabled

**~~`ccm account update` command~~** ✅
- `ccm account update <n> --key sk-ant-new...` — validates new key before saving
- `ccm account update <n> --notes "text"` — updates display notes
- `updateAccount()` re-encrypts key atomically; `accounts.js` handles key rotation safely
- Wired into CLI, Electron preload (`accounts:update` IPC), and Electron Dashboard

**~~Call `cleanupOrphanedSessions()` before every spawn~~** ✅
- Called at the top of `runClaude()` in `runner.js` on every invocation

**~~Single Electron instance~~** ✅
- `app.requestSingleInstanceLock()` in `electron/main.js`
- Second launch focuses existing window via `second-instance` event

### P1.3 — Identity foundations ✅ Complete

Establish consistent naming, colour, and tone before anything ships publicly.

- Official name rules: CCM vs ccm vs Claude Code Manager, per context
- Tagline: *"Zero-downtime Claude Code sessions."*
- Voice: terse, direct, precise — no raw stack traces, no "successfully", no exposed API keys
- Colour palette sourced from `global.css`; monospace throughout the app, system sans-serif for docs
- `description` and `keywords` added to all `package.json` files
- Placeholder icons are in place — final design assets to follow

---

## Phase 2 — User experience

**Why this phase exists:** The core machinery works but the product is hard to start using. A new
user who opens an empty Dashboard with no guidance will leave. Fix the onboarding, fill the obvious
GUI gaps, and add notifications that make the auto-switch feature feel alive rather than silent.

**Exit criteria:** A new user can go from zero to running their first session in under 2 minutes
without reading documentation. All TUI screens have no dead-end keyboard states. OS notifications
fire correctly on macOS, Linux, and Windows.

---

### P2.1 — First-run onboarding ✅ Complete

**Onboarding wizard** (TUI and Electron)
- Trigger: zero accounts exist at launch
- Flow: auth type → credential entry → account name → optional project init in current dir
- TUI: multi-step Ink form, `Esc` goes back one step, auto-advance on valid input
- Electron: full-page wizard replaces the Dashboard when `accounts.length === 0`; inline validation
  with green/red feedback before advancing; animates between steps
- On completion: land on Dashboard with the new account active and a confirmation message

### P2.2 — Projects improvements ✅ Complete

**Init new project from Electron GUI**
- "New project" button on the Projects page toolbar
- Opens `dialog.showOpenDialog({ properties: ['openDirectory'] })` — native OS folder picker
- IPC handler: `projects:init` ✅ already in `main.js` and `preload.js`
- `dialog` ✅ already imported in `main.js`; folder picker opens when no `dir` is passed
- Remaining: wire the "New project" button in `Projects.jsx` — it just needs to call `window.ccm.projects.init(undefined, accountName)`
- On success: refresh list, highlight new entry, open its detail panel

**Configurable project scan roots**
- Replace hardcoded `homedir()` with a user-configurable list stored in `config.json` as `projectScanRoots: string[]`
- Settings page (Electron + TUI): add/remove root paths
- Default: `[homedir()]` — no change for existing users

**Auto-update `.gitignore` on project init**
- After `initProject()`, check whether `.gitignore` exists
- If `.ccm-project.json` is not listed, offer to add it
- CLI: `y/N` prompt · TUI: confirm dialog · Electron: checkbox in init flow
- Never modify silently — always ask first

### P2.3 — Notifications ✅ Complete

**OS notifications (Electron)**
- Session ended: `"Session ended — 23 min · personal"`
- Auto-switch: `"Credit limit hit — switched personal → work"`
- Checkpoint created: `"Checkpoint saved — abc1234"`
- All accounts exhausted: `"All accounts at credit limit — session stopped"`
- Implementation: Electron `Notification` API; check `Notification.isSupported()` first
- Settings toggle: `"Show desktop notifications"` (default: on)

### P2.4 — Session history improvements ✅ Complete

**Date and exit-reason filter**
- Electron Sessions page: date-range picker + exit-reason dropdown (all / normal / credit_limit / error / manual)
- TUI Sessions screen: `r` key cycles through reason filters; active filter shown in StatusBar
- Core: extend `getSessions()` to accept `{ from?: Date, to?: Date, exitReason?: string }`

**TUI Run screen**
- New `Run` screen that mirrors Electron's `RunSession` page
- Account selector → flags input → live streamed stdout/stderr
- Fallback: show a `"running — press q to detach"` indicator while Claude runs in the foreground

---

## Phase 3 — Power features

**Why this phase exists:** Power users need to manage accounts at scale, trust that sessions resume
reliably even on failure, and keep work safe in remote repositories. These features complete the core product.

**Exit criteria:** Account export/import round-trips cleanly across machines. Watch mode recovers from
10 consecutive network drops. GitHub sync is reliable enough to use as a real backup strategy.

---

### P3.1 — Account management ✅ Complete

**Account export / import**
```bash
ccm export > ccm-backup.json          # encrypted snapshot of all accounts
ccm import ccm-backup.json            # restore on a new machine
ccm export --plain > ccm-backup.json  # plaintext (warns loudly)
```
- Exported keys remain AES-256-GCM encrypted using source machine key OR a user passphrase (`--passphrase`)
- On import: if encrypted with a different machine key, prompt for the original passphrase; re-encrypt on write
- Session history and project bindings included in the export

**Account usage tracking**
- Parse token counts from Claude Code's stdout (now piped in `runner.js` via `TOKEN_PATTERN` regex)
- `sessions.js` `endSession()` already accepts a `tokens` field — store `{ input, output }` per session
- Remaining: aggregate per-account totals for Dashboard display and alert thresholds
- Electron Dashboard: per-account usage bar with lifetime total and 30-day average
- Alert when account exceeds configurable threshold (`usageWarnAt` in config)
- CLI: `ccm account stats` — tabular view of all accounts

**Account priority ordering**
- `priority` field ✅ already in account schema — set on creation, `getNextFreshAccount()` already sorts by it
- Remaining: expose reordering in the UI
- Electron Dashboard: drag-to-reorder cards (updates `priority` on each account)
- CLI: `ccm account move <n> up` / `ccm account move <n> down`

### P3.2 — Smart resume improvements ✅ Complete

**Resume verification**
- After transfer + relaunch, watch Claude's stdout for session-load confirmation
  (stdout is now piped in `runner.js` — this is architecturally possible)
- On silent failure: detect fresh-start behaviour and fall back automatically
- Fallback: extract the last N assistant messages from JSONL, format as a context summary, inject as first user message
- Log whether each switch was a verified resume or a fallback — visible in Sessions history

**Checkpoint diff view**
- Electron Sync page: click any checkpoint → detail panel shows git diff, message count, and "Restore" button
- TUI Sync screen: `Enter` on a checkpoint shows scrollable diff; `r` to restore

**Watch mode**
```bash
ccm run --watch
```
- Auto-restart on non-credit exits: network drops, crashes, OOM kills
- Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (cap)
- Stop after 5 consecutive non-credit failures within 2 minutes
- Always attempt `--resume` on restart

### P3.3 — GitHub sync improvements ✅ Complete

**Per-project remote override**
- `.ccm-project.json` can specify `"remote": "upstream"` to push to a non-origin remote
- Falls back to `origin` if the specified remote doesn't exist; warns but doesn't fail

**Sync status in Dashboard**
- Git status badge per project: `clean` / `N uncommitted` / `N unpushed`
- Badge colour: green / yellow / red
- "Push all" button: checkpoint + push all dirty projects in parallel

**Session backup restore**
- Browse JSONL backups from Electron Sync page → Backups tab
- `ccm sync restore <session-id>` — pull from backup repo, place in correct path for `--resume`

---

## Phase 4 — Ecosystem

**Why this phase exists:** CCM manages Claude Code accounts — all Anthropic. This phase
extends that with hooks (automate checkpoint calls), a local web dashboard (monitor sessions
remotely), and a plugin system (community extensions without waiting for official releases).
Provider support means Anthropic API key and Email OAuth — the only two Claude Code supports today,
ready to extend when Anthropic ships additional Claude Code backend support.

**Exit criteria:** Both verified providers (API key + Email) work across all platforms. Hooks
registration tested with Claude Code's actual hook runner. Plugin system ships with an example plugin.
Web dashboard accessible from a browser on the same network.

---

### P4.1 — Anthropic account types ✅ Complete

CCM supports the two auth methods that Claude Code supports today:

| Account type | Auth | Env var set by CCM |
|---|---|---|
| Anthropic API | API key from console.anthropic.com | `ANTHROPIC_API_KEY` |
| Email (Claude Max / Pro) | Browser OAuth via `claude auth login` | `CLAUDE_CONFIG_DIR` |

- `provider` field on account schema; `"anthropic"` is the default for all existing accounts
- `providers.js` — `buildProviderEnv()`, `providerIsSupported()`, `providerLabel()`, `providerAuthType()`
- `PROVIDERS` constant: `{ ANTHROPIC, EMAIL }` — only what Claude Code actually supports
- Non-Anthropic AI services are out of scope — CCM manages Claude Code accounts only
- Additional Anthropic account types can be added to `providers.js` when Claude Code supports them

### P4.2 — Claude Code hooks integration ✅ Complete

```json
{
  "hooks": {
    "SessionEnd":   [{ "command": "ccm checkpoint --silent" }],
    "PostToolCall": [{ "command": "ccm sync push --silent --if-dirty" }]
  }
}
```

- New `core/hooks.js`: `registerHooks()`, `unregisterHooks()`, `listRegisteredHooks()`
- Reads `~/.claude/settings.json`, merges CCM hooks, writes back atomically
- CLI: `ccm hooks on` / `ccm hooks off` / `ccm hooks status`
- Settings page (TUI + Electron): per-hook enable/disable
- On `ccm run`: verify hooks are registered if the setting is on — self-heal if missing

### P4.3 — Web dashboard ✅ Complete

```bash
ccm serve             # http://localhost:7837
ccm serve --port 9000
ccm serve --open      # opens in default browser
```

- Minimal HTML/JS page, no framework — plain fetch + DOM, SSE for live updates
- Read-only: active account, all accounts with status, running sessions, recent history
- Auth: random token printed on start, required as a query param
- Refreshes every 5 seconds

### P4.4 — Plugin system ✅ Complete

```js
// ~/.ccm/plugins/my-plugin.js
export function onSwitch({ from, to, sessionId, projectRoot }) { ... }
export function onCheckpoint({ commitHash, projectRoot, account }) { ... }
export function onSessionEnd({ account, durationSec, exitReason }) { ... }
export function onSessionStart({ account, projectRoot, flags }) { ... }
```

- Plugins loaded from `~/.ccm/plugins/*.js` at runner start
- Plugins run async, non-blocking — a plugin crash never kills the main session
- Plugin errors logged to `~/.ccm/plugin-errors.log` and shown in TUI StatusBar
- CLI: `ccm plugin list` / `ccm plugin disable <n>` / `ccm plugin enable <n>`
- Example plugin shipped in `examples/plugins/` — logs all session events to a JSON file

---

## Phase 5 — Distribution & open source

**Why this phase exists:** CCM needs to be installable in one command. This phase makes the project
publicly consumable — npm package, signed desktop app, CI pipeline, documentation site.

**Exit criteria:** `npm install -g ccm` works on a clean machine. Electron installers run on fresh
systems. CI passes on every push. Docs site is live.

---

### P5.1 — npm publish ✅ Complete

- Publish `@ccm/core` and `ccm` to the npm registry
- `npm install -g ccm` as the primary install path
- Semantic versioning, automated with `semantic-release`
- `"engines": { "node": ">=18.0.0" }` in all `package.json` files
- `"files"` field restricts publish to `src/`, `bin/`, `dist/` — never `node_modules`

### P5.2 — Electron app distribution ✅ Complete

- macOS: `.dmg` + `.zip` (portable) — universal binary (x64 + arm64), notarised
- Windows: NSIS `.exe` installer + portable `.exe` — x64 and arm64, EV signed
- Linux: `.AppImage` + `.deb` — x64 and arm64
- Auto-update via `electron-updater`: background download, prompt to install
- See `BUILD.md` section 5 for portable build targets and instructions

### P5.3 — CI/CD pipeline ✅ Complete

```yaml
# Every push and PR:
lint:     ESLint --max-warnings 0
test:     vitest (unit + integration)
build:    all three packages
typecheck: JSDoc validation

# On version tag (v*):
release:
  - macOS runner  → signed .dmg + .zip → attach to GitHub Release
  - Windows runner → signed .exe + portable → attach to GitHub Release
  - Linux runner  → .AppImage + .deb → attach to GitHub Release
  - Publish @ccm/core and ccm to npm
  - Auto-draft changelog
```

- Branch protection on `main`: CI green + 1 reviewer required
- Dependabot: weekly updates, auto-merge patch-level changes

### P5.4 — Documentation site ✅ Complete

Built with Vitepress, deployed to GitHub Pages:

| Page | Content |
|---|---|
| Getting started | Install, first account, first run — under 5 minutes |
| Configuration | All `config.json` keys, `.ccm-project.json` schema, env vars |
| CLI reference | Every command and flag — auto-generated from source |
| TUI guide | Screen-by-screen walkthrough with keyboard shortcut table |
| Electron guide | Feature tour with annotated screenshots |
| Smart resume | How session transfer works, failure modes, debugging |
| GitHub sync | Setup, backup repo, restore workflow |
| Security | Encryption model, file permissions, threat model |
| Troubleshooting | Top 15 issues with diagnostic steps |
| API reference | `@ccm/core` public API for plugin and script authors |

---

## Phase 6 — Unique features

**Why this phase exists:** These features have no equivalent in any other Claude Code tool. Each one
addresses a real pain that power users hit and currently work around manually or not at all. Together
they transform CCM from a useful utility into a platform.

**Exit criteria:** Each feature works end-to-end on all three platforms. CLI and Electron interfaces
both implemented. New core modules have unit test coverage.

**Sidebar note:** Each new Phase 6 page (`Queue.jsx`, `Workers.jsx`, `RemoteConnect.jsx`) must be
added to `Sidebar.jsx` NAV array and `App.jsx` pages map as it is built. Do this alongside the page,
not as a separate step.

**Build order:** P6.1 + P6.2 first (low effort, immediate daily value). Then P6.3 + P6.4 + P6.8.
Then P6.5 + P6.6 + P6.9 in parallel. P6.7 + P6.10 last (highest infrastructure cost).

---

### P6.1 — ✅ Credit burn rate predictor

**Problem:** Users have no warning before credits run out. The switch happens reactively.

- Parse token usage from `session-log.json` (tokens stored per session since runner.js stdout fix)
  — rolling burn curve per account
- Weighted average tokens/minute over last 5 sessions (recent sessions weighted higher)
- Estimate: `timeRemaining = remainingTokens / burnRate`
- Electron Dashboard: live countdown — *"work — ~2h 20m left at current rate"*
- TUI Dashboard: burn rate shown next to each account
- Warnings: 30 min remaining → yellow notification; 10 min → red notification + StatusBar alert
- Config: `burnWarnThresholds: [1800, 600]` (seconds)
- Degrades gracefully when token data unavailable — hides the estimate, never shows `NaN`
- New helper: `burnRate(accountName)` in `core/sessions.js`

### P6.2 — ✅ Auto context injection

**Problem:** Every session starts cold. Users paste the same README, git log, or task brief manually.

Configuration in `.ccm-project.json`:
```json
{
  "autoInject": [
    "README.md",
    ".ccm-context.md",
    { "source": "git:log", "lines": 10 },
    { "source": "git:status" },
    { "source": "git:diff" }
  ]
}
```

- Sources: any file path, `git:log`, `git:status`, `git:diff`
- Injected as the first `user` message; running prompt follows
- Max injection size: configurable (default: 8,000 tokens) — truncates oldest files first
- New module: `core/context-injector.js` — dependency-free, `fs` + `child_process` only
- Projects page (Electron + TUI): configure inject sources per project
- CLI: `ccm run --no-inject` to skip for a single session

### P6.3 — ✅ Context compression on resume

**Problem:** Long sessions accumulate JSONL files that exceed Claude's context window, causing
`--resume` to fail silently or produce degraded results.

- New function: `compressSession(jsonlPath, options)` in `@ccm/core`
- Algorithm:
  1. Count approximate tokens (chars ÷ 4)
  2. If under threshold (default: 120k tokens) — skip
  3. Call Anthropic API to summarise the oldest 60% of messages
  4. Replace with a single synthetic summary message
  5. Back up the original to `~/.ccm/checkpoints/` before overwriting
- Runs automatically on every account switch when `smartResume: true` and JSONL exceeds threshold
- CLI: `ccm sync compress` / `ccm sync compress --dry-run`
- Config: `compressionThreshold: 120000`, `compressionKeepRecent: 20`

### P6.4 — ✅ Session branching

**Problem:** There is no way to explore two approaches from the same point without losing one.

```bash
ccm branch create <checkpoint-id> --name "try-postgres"
ccm branch list
ccm branch switch "try-postgres"
ccm branch delete "try-postgres"
ccm branch diff "try-postgres" "try-redis"
```

- New module: `core/branches.js`
- Branch metadata in `~/.ccm/branches.json`: name, parent checkpoint, createdAt, account, projectRoot
- `branch create`: copies parent checkpoint's JSONL as new branch's starting JSONL
- Electron Sync page: tree visualisation — parent → children with message delta and git diff stats
- TUI Sync screen: branch list with `c` (create), `s` (switch), `d` (delete) keys

### P6.5 — ✅ Overnight task queue

**Problem:** Multi-step work requires a human to restart each task when credits run out.

```bash
ccm queue add "Refactor auth module" --project ~/app
ccm queue add "Write tests for billing" --project ~/app
ccm queue run                # work through queue unattended
ccm queue status             # pending / running / done / failed
ccm queue pause              # pause after current task
ccm queue clear
```

- New module: `core/queue.js`; queue persisted in `~/.ccm/queue.json`
- Each task: `{ id, prompt, projectRoot, status, accountUsed, startedAt, completedAt, exitReason }`
- Execution: `ccm run --print "<prompt>"` per task; rotate on credit limit; retry 3× on error
- Electron: new `Queue.jsx` page — task cards, live progress, morning summary view
- TUI: queue screen with `a` (add), `r` (run), `p` (pause), `Enter` (task detail) keys

### P6.6 — ✅ Parallel session manager

**Problem:** Large codebases have independent components that could run simultaneously.

```bash
ccm run --worker frontend
ccm run --worker api
ccm worker list               # all live workers: account + runtime + status
ccm worker logs frontend
ccm worker stop frontend
ccm worker stop --all
```

- Worker state in `~/.ccm/workers.json`: name, PID, account, project, startedAt
- Each worker has independent credit rotation; workers never share an account (file-lock)
- Electron: `Workers.jsx` — multi-pane terminal layout, one pane per live worker
- New module: `core/workers.js`; `workerName` added to runner spawn options and session log

### P6.7 — ✅ Team mode

**Problem:** Two developers burn the same shared account simultaneously with no coordination.

```bash
ccm team init https://github.com/org/ccm-team-config.git
ccm team sync
ccm team status                # who is using what, since when
ccm team unlock <account>      # force-release a stale lock
```

- New module: `core/team.js`
- Shared config in a private git repo: `team-accounts.json` + `locks/<account-name>.json`
- Lock file: `{ "user": "$USER", "hostname": "...", "sessionId": "...", "lockedAt": "..." }`
- On `ccm run`: pull repo → lock account → run → unlock + push
- Stale lock expiry: `lockedAt` older than `2 × averageSessionLength` auto-expires on `ccm team sync`

### P6.8 — ✅ Prompt library

**Problem:** Users type the same setup prompts at the start of every session.

```bash
ccm prompt save "rails-debug" "You are working on a Rails 7 app..."
ccm prompt list
ccm prompt show rails-debug
ccm prompt edit rails-debug        # opens in $EDITOR
ccm prompt delete rails-debug
ccm run --prompt rails-debug
```

- Stored in `~/.ccm/prompts.json`
- Template variables: `{{project}}`, `{{account}}`, `{{date}}`, `{{gitBranch}}`
- New module: `core/prompts.js`
- TUI Run screen: `p` key opens fuzzy-search prompt picker
- Electron RunSession: prompt picker dropdown with live preview panel

### P6.9 — ✅ Account cost optimizer

**Problem:** Round-robin rotation ignores real differences between accounts — quotas, latency, burn rate.

Set per project or globally:
```json
{ "accountStrategy": "cheapest" }
```

| Strategy | Selection logic |
|---|---|
| `round-robin` | Default — rotate in priority order |
| `cheapest` | Most remaining estimated tokens |
| `fastest` | Lowest observed P50 latency (from session log) |
| `reserved` | Always use named account; fall back to round-robin on exhaustion |
| `random` | Random from non-exhausted accounts |

- `getNextFreshAccount(strategy, sessionLog)` accepts strategy parameter
- Latency tracked as `firstTokenLatencyMs` in session log entries

### P6.10 — ✅ Remote CCM agent

**Problem:** Long-running sessions make more sense on a remote server. Managing them requires SSH.

```bash
# On the remote server:
ccm serve --remote --port 7837 --token <32-char-secret>

# In Electron: Settings → Connections → Add remote → host:port + token
```

- New module: `core/agent-server.js` — WebSocket server
- Events: `session:start`, `session:stdout`, `session:stderr`, `session:end`, `account:switch`,
  `accounts:list`, `sessions:list`, `checkpoints:list`
- Auth: HMAC-signed messages — unsigned messages rejected
- Electron: `RemoteConnect.jsx` in Settings; remote appears as second sidebar section
- `--tls-cert` + `--tls-key` flags for WSS in production

---
