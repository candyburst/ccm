# Security

This document describes CCM's security model, what is and isn't protected, and how to report vulnerabilities.

---

## What is protected

### API key encryption

API keys are encrypted at rest using **AES-256-GCM** before being written to `~/.ccm/accounts.json`.

- A unique 96-bit (12-byte) IV is generated for every encryption operation — IVs are never reused
- The GCM auth tag is always verified on decryption — tampered ciphertext returns `null`, never garbage
- The encryption key is a 256-bit random secret stored in `~/.ccm/.key` (created on first run, mode `0600`)
- If `CCM_SECRET` is set, that passphrase is used to derive the key via `scrypt` instead of the persisted random key — useful for portable setups or CI

### File permissions

| File | Mode | Why |
|---|---|---|
| `~/.ccm/.key` | `0600` | Machine encryption key — owner read/write only |
| `~/.ccm/accounts.json` | `0600` | Encrypted account registry |
| `~/.ccm/config.json` | `0644` | Non-sensitive settings |
| `~/.ccm/session-log.json` | `0644` | Session metadata — no keys, no tokens |
| `~/.ccm/workers.json` | `0644` | Worker process state |
| `~/.ccm/queue.json` | `0644` | Task queue — prompts only |

### Process isolation

- `ANTHROPIC_API_KEY` is injected only into the direct `claude` subprocess via the `env` option to `spawn()` — the key is never in `process.env` itself
- `CCM_SECRET` and `CCM_DEBUG` are explicitly deleted from the subprocess env before every spawn
- Email accounts are isolated via per-account `CLAUDE_CONFIG_DIR` directories — no JSONL bleed between accounts
- `ANTHROPIC_BASE_URL` is explicitly deleted when using the Anthropic provider — ensuring we always hit Anthropic directly

### Electron renderer

- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` on every `BrowserWindow`
- No raw `fs`, `path`, `child_process`, `require`, or `__dirname` exposed to the renderer
- All data flows through `contextBridge.exposeInMainWorld` only
- API keys are never sent to the renderer — masked values (`sk-···`) only
- File paths received from the renderer are validated in the main process before use

### URL validation

- `shell:open` IPC validates that the URL uses `https:` or `http:` only — rejects `file://`, `javascript:`, and other schemes

### Network-exposed services

**Local dashboard (`ccm serve`)**
- Binds to `127.0.0.1` only — not accessible from the network
- 128-bit random token required on every request
- Strictly read-only — no write endpoints of any kind
- Snapshot payload contains no API keys or encrypted blobs

**Remote agent (`ccm agent`)**
- Binds to `0.0.0.0` — designed for network access
- 192-bit random token in every request header
- All commands additionally verified with HMAC-SHA256 message signing
- `projectRoot` from clients validated before use — path traversal rejected
- Session content is streamed; treat the agent port as a sensitive service
- Run behind a firewall or SSH tunnel in production

---

## What is NOT protected

- **Session JSONL files** (`~/.claude/projects/*/` and `~/.ccm/sessions/*/`) contain your full conversation history in plaintext. Claude Code writes these — CCM does not encrypt them.
- **`~/.ccm/session-log.json`** contains metadata (account, timing, exit reason, token count) but no keys or conversation content.
- **Checkpoint JSONL backups** (`~/.ccm/checkpoints/`) are plaintext copies of session files. Protect this directory as you would `~/.claude/`.
- **Context compression** (`ccm compress`): session content is sent to the Anthropic API (`claude-haiku-4-5-20251001`) for summarisation. This requires your explicit opt-in and uses your `ANTHROPIC_API_KEY`. The transcript is truncated to 800 chars per message before sending.
- **GitHub sync**: enabling session backup pushes conversation history to a remote git repository. Use a **private** repository. Never sync to a public repo.
- **Team mode lock files** (`ccm team`): lock files contain `{ user, hostname, sessionId, lockedAt }` only — no keys or tokens. The lock repo should be private.

---

## Threat model

CCM is a local developer tool. It assumes:
- You trust the machine it runs on
- You trust other processes running under your user account
- You are responsible for securing the machine itself

CCM does **not** protect against:
- Other processes running as the same user reading `~/.ccm/`
- Physical access to the machine
- A compromised Claude Code binary
- A compromised `npm` package supply chain (use `npm audit` regularly)

---

## Moving accounts to a new machine

If you copy `accounts.json` without also copying `~/.ccm/.key`, decryption will fail.
The correct migration path uses passphrase-based export which is machine-independent:

```bash
# Old machine
ccm export --passphrase mysecret > backup.json

# New machine
npm install -g ccm
ccm import backup.json --passphrase mysecret
```

---

## Dependency security

Run `npm audit --audit-level=high` regularly. CCM's dependencies are:
- `@ccm/core` — zero runtime dependencies (Node built-ins only)
- `ccm` (TUI) — Ink, chalk, ink-text-input, ink-select-input
- `@ccm/app` — Electron, React, Vite, electron-builder, electron-updater

All packages are pinned to exact versions in the lockfile. Dependabot runs weekly and auto-merges patch-level updates.

---

## Responsible disclosure

Found a security issue? Please do **not** open a public GitHub issue.

Use **GitHub Security Advisories** (private disclosure) at:
`https://github.com/candyburst/ccm/security/advisories/new`

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix

We respond within 72 hours and aim to ship a fix within 7 days for critical findings.
