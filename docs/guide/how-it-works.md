# How it works

CCM's core feature is **smart resume** — continuing a Claude Code session on a different account without losing context.

## The smart resume flow

When credits run out on the active account, CCM does four things in order:

```
Credit limit detected on Account A
  │
  ├─ 1. Mark Account A as exhausted for this run
  ├─ 2. git add -A && git commit   (save all file changes)
  ├─ 3. Copy ~/.claude/projects/<cwd>/<session-id>.jsonl
  │      → Account B's config directory
  └─ 4. claude --resume <session-id>   (Account B picks up the conversation)
```

## Why it works

Claude Code stores every session as a JSONL file containing the full conversation — every message, file read, tool call, and decision. When CCM copies that file to the new account's config directory and relaunches with `--resume`, Claude Code loads the full history and continues as if nothing happened.

## Session encoding

Claude Code encodes the working directory path into the session folder name by replacing every non-alphanumeric character with a hyphen. CCM's `encodeCwd()` function replicates this exactly — if it doesn't match, `--resume` won't find the session file.

## Account isolation

Email accounts each get an isolated `~/.ccm/sessions/<name>/` directory. CCM sets `CLAUDE_CONFIG_DIR` to point Claude Code at the right directory for each account, keeping sessions and tokens completely separate.

## What gets stored

```
~/.ccm/
  accounts.json           Encrypted account registry
  config.json             Settings
  session-log.json        History of every ccm run
  sessions/
    <account-name>/       Isolated config per email account
  checkpoints/
    <account-name>/       Local JSONL backups before each switch
```
