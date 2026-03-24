# Smart resume

The core feature of CCM. When credits run out on one account, CCM automatically switches to the next and resumes the conversation where it left off.

## How it works

```
Credit limit detected on Account A
        │
        ├── 1. Mark Account A exhausted for this cycle
        ├── 2. git add -A && git commit  (if gitCheckpoint: true)
        ├── 3. Find ~/.claude/projects/<encodeCwd>/latest.jsonl
        ├── 4. Copy JSONL → Account B's config directory
        └── 5. claude --resume <session-id>  (using Account B)
```

## Session file location

Claude Code stores session history in:

```
~/.claude/projects/<encoded-cwd>/<session-id>.jsonl
```

For email accounts, `~/.claude` is replaced by `CLAUDE_CONFIG_DIR`, which CCM sets to an isolated directory per account under `~/.ccm/sessions/<account-name>/`.

## Path encoding

The `<encoded-cwd>` is your working directory with every non-alphanumeric character replaced by a hyphen. CCM's `encodeCwd()` function replicates Claude Code's encoding exactly.

```
/Users/alice/my-project  →  -Users-alice-my-project
/home/bob/work/api.io    →  -home-bob-work-api-io
```

If the encoding doesn't match, `--resume` won't find the session file and Claude will start fresh.

## What --resume does

Claude Code loads the full JSONL and reconstructs the conversation. All messages, file reads, tool calls, decisions, and errors are present. Claude picks up as if nothing happened.

## Resume verification

CCM monitors Claude's initial stdout after a `--resume` launch to detect whether the session actually loaded. If Claude appears to start fresh (generic greeting, no context acknowledgement), CCM logs this as `resume_outcome: fresh` in the session log.

## When resume fails silently

This can happen when:
- The JSONL is too large for Claude's context window — use `ccm compress` to reduce it
- The JSONL is from an incompatible Claude Code version
- The source and destination config directories don't have matching path encoding

## Failure modes

| Scenario | Behaviour |
|---|---|
| No JSONL found for current directory | Skip resume, start fresh, log `no_session_found` |
| Multiple JSONLs in directory | Select the most recently modified |
| All accounts exhausted | Clean exit, `[ccm] All accounts exhausted` printed |
| Resume loads but context window exceeded | Claude truncates automatically |

## Disabling resume

```bash
ccm run --no-resume    # switch accounts but always start fresh
```
