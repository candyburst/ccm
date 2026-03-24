# Security model

## What is encrypted

API keys are encrypted at rest using **AES-256-GCM** before being written to `~/.ccm/accounts.json`.

- A random 256-bit key is generated on first run and stored at `~/.ccm/.key` (mode `0600`)
- Each encryption uses a fresh 12-byte IV — keys are never reused
- The GCM auth tag is always verified on decryption — tampered ciphertext returns `null`
- If `CCM_SECRET` is set, that passphrase is used instead of the machine key

`accounts.json` is also created with mode `0600` — readable only by the account owner.

## What is not encrypted

- Account names, notes, email addresses — stored in plaintext in `accounts.json`
- Session JSONL files — Claude Code's own format, not encrypted by CCM
- Session log (`session-log.json`) — timing, account name, exit reason only — no key material
- Config file (`config.json`) — settings only, no credentials

## Attack surface

### Local machine

The primary attack vector is access to `~/.ccm/`. If an attacker has read access to `accounts.json` and `~/.ccm/.key`, they can decrypt API keys. Mitigations:

- Mode `0600` on both files
- Consider setting `CCM_SECRET` in your shell profile for additional protection
- The machine key is tied to the file — moving `accounts.json` without `.key` yields undecryptable data

### Local web dashboard (`ccm serve`)

- Binds to `127.0.0.1` only — not accessible from other machines
- 128-bit random token required on every request
- Read-only — no write endpoints
- No API keys or encrypted blobs in the snapshot payload

### Remote agent (`ccm agent`)

- Binds to `0.0.0.0` — accessible from the network
- HMAC-SHA256 message signing required for all commands
- 192-bit random token
- `projectRoot` paths from clients are validated against expected directories
- Session content is streamed — treat the agent port as sensitive

### Subprocess isolation

- `ANTHROPIC_API_KEY` is injected only into the direct `claude` subprocess via `spawn()` `env` — not `{ ...process.env }` which would leak CCM's own env
- `CCM_SECRET` and `CCM_DEBUG` are explicitly deleted from the subprocess env on every spawn
- Email account session directories are fully isolated — account A's JSONL is never visible to account B

### Electron renderer

- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
- No raw `fs`, `path`, or `child_process` access in the renderer
- All data flows through the `contextBridge` API
- File paths from the renderer are validated in the main process

## Export security

`ccm export --passphrase <p>` re-encrypts all API keys with a passphrase-derived key before writing. The export file contains no machine-specific key material — safe to transmit, but treat the passphrase as a secret.

`ccm export --plain` stores keys in plaintext — use only for debugging on a trusted local machine.

## Responsible disclosure

Found a security issue? Please report it via GitHub Security Advisories (private disclosure) rather than opening a public issue. Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix

We aim to respond within 72 hours and resolve critical issues within 7 days.
