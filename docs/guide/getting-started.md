# Getting started

Get CCM running and your first Claude Code session going in under 5 minutes.

## Requirements

- **Node.js 18+** — [nodejs.org](https://nodejs.org) or `nvm install 20`
- **Claude Code** — `npm install -g @anthropic-ai/claude-code`
- **git** — any version

## Install

```bash
npm install -g ccm
```

Verify:

```bash
ccm --version
ccm status
```

## Add your first account

You need an Anthropic account — either an **API key** or an **email login** (Claude Max / Pro).

**API key** (from [console.anthropic.com](https://console.anthropic.com/settings/keys)):

```bash
ccm account add
# Choose: API key
# Paste your sk-ant-... key when prompted
```

**Email login** (Claude Max / Pro subscription):

```bash
ccm account add
# Choose: Email login
# Enter your email — a browser will open for OAuth
ccm login <account-name>
```

## Run a session

```bash
# In your project directory
ccm project init          # bind this directory to your account
ccm run                   # launch Claude Code
```

That's it. If credits run out, CCM switches to your next account and resumes automatically.

## Add more accounts

The more accounts you add, the longer CCM can run unattended:

```bash
ccm account add           # add another account
ccm status                # see all accounts and which is active
```

## Next steps

- [How it works](/guide/how-it-works) — understand smart resume
- [TUI guide](/guide/tui) — keyboard shortcuts and screens
- [Configuration](/guide/configuration) — all settings
