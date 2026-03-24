# CCM — Claude Code Manager

[![npm version](https://img.shields.io/npm/v/ccm?color=00d4a0)](https://www.npmjs.com/package/ccm)
[![Node ≥18](https://img.shields.io/badge/node-%3E%3D18-00d4a0)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-00d4a0)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/candyburst/ccm/ci.yml?branch=main)](https://github.com/candyburst/ccm/actions)
[![Status: Beta](https://img.shields.io/badge/status-beta-orange)](https://github.com/candyburst/ccm/issues)

> **CCM is in active development.** Core features work. APIs and config formats may change before v1.1. [Report issues here.](https://github.com/candyburst/ccm/issues)

---

You're mid-session. Claude is making real progress on a complex task. Then:

```
Credit balance is too low to run this operation.
```

Context gone. You start over. CCM fixes this.

---

## What it does

CCM manages multiple Anthropic accounts and switches between them automatically when credits run out — then resumes the conversation on the next account using Claude Code's `--resume` flag. From Claude's perspective, nothing happened.

```
[ccm] Credit limit on "personal" → switching to "work"
[ccm] Session transferred (a3f9b2c1…) → resuming on "work"
```

Works with **API keys** and **email accounts** (Claude Max / Pro).
Runs on macOS, Linux, and Windows.

---

## Install

```bash
npm install -g ccm
```

Requires **Node.js 18+** and **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)**.

---

## Quick start

```bash
ccm account add              # add an API key or email account
cd ~/my-project
ccm project init             # bind this directory to your account
ccm run                      # launch Claude Code
```

Add a second account and CCM switches automatically when the first runs out.

---

## How smart resume works

Claude Code stores every session as a JSONL file containing the full conversation — every message, file read, tool call, and decision. When credits run out, CCM:

1. Commits your working tree (`git add -A && git commit`)
2. Copies the session file to the next account's config directory
3. Relaunches with `claude --resume <session-id>`

Claude picks up exactly where it left off — same context, same files, same task.

---

## Interfaces

| Interface | Command | Best for |
|---|---|---|
| TUI | `ccm` | Interactive account management |
| CLI | `ccm run` | Scripts, automation, headless servers |
| Electron app | Launch from Applications | Visual dashboard, session history |
| Web dashboard | `ccm serve` | Monitor from a browser tab |
| Remote agent | `ccm agent` | Sessions running on a remote server |

---

## Key commands

```bash
# Accounts
ccm account add                    # API key or email account
ccm account list                   # all accounts and status
ccm account disable <name>         # skip an account during rotation
ccm switch <name>                  # set active account

# Sessions
ccm run                            # launch Claude Code with auto-switch
ccm run --watch                    # auto-restart on crash or network drop
ccm run --worker frontend          # named parallel worker
ccm status                         # active account + project

# Projects
ccm project init                   # bind current directory
ccm project bind <account>         # rebind to different account

# Sync & backup
ccm export --passphrase <secret>   # encrypted account backup
ccm import backup.json             # restore on a new machine
ccm hooks on                       # auto-checkpoint on session end

# Automation
ccm queue add "Refactor auth"      # unattended overnight task
ccm serve                          # local read-only web dashboard
```

Full reference: [docs/cli/reference.md](docs/cli/reference.md)

---

## Configuration

`~/.ccm/config.json`:

```json
{
  "autoSwitch":    true,
  "smartResume":   true,
  "gitCheckpoint": true
}
```

Per-project: `.ccm-project.json` (created by `ccm project init`).

---

## Security

API keys are encrypted with **AES-256-GCM** before being written to disk. The encryption key lives at `~/.ccm/.key` (mode `0600`). Keys are never transmitted — they are injected only into the Claude Code subprocess environment at spawn time.

See [SECURITY.md](SECURITY.md) for the full threat model.

---

## Documentation

- [Getting started](docs/guide/getting-started.md)
- [How smart resume works](docs/guide/smart-resume.md)
- [CLI reference](docs/cli/reference.md)
- [Configuration](docs/guide/configuration.md)
- [Export and import](docs/guide/export-import.md)
- [Security model](docs/guide/security.md)
- [Troubleshooting](docs/guide/troubleshooting.md)
- [CHANGELOG](CHANGELOG.md)

---

## Development status

CCM is **beta software**. The core account rotation and smart resume features are stable and well-tested. Some newer features (context compression, team mode, remote agent) are functional but less battle-tested in production.

**Known limitations:**
- `ccm queue` requires Claude Code ≥ 1.0.0 (`--message` flag)
- Burn rate time-remaining display requires per-account token quota data (not yet tracked)
- Context compression sends session content to the Anthropic API — must be explicitly enabled

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports, fixes, and feature discussions all welcome.

If CCM saves you time, a ⭐ on GitHub helps others find it.

## License

MIT — see [LICENSE](LICENSE).
