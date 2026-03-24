# Hooks

CCM can register hooks in `~/.claude/settings.json` so Claude Code calls CCM automatically at key points.

## Enable hooks

```bash
ccm hooks on     # register all CCM hooks
ccm hooks off    # remove all CCM hooks
ccm hooks        # show current status
```

## Available hooks

| Hook ID | Claude Code event | Command |
|---|---|---|
| `ccm-checkpoint` | `SessionEnd` | `ccm checkpoint --silent` |
| `ccm-push` | `PostToolCall` | `ccm sync push --silent --if-dirty` |

## What they do

**`ccm-checkpoint`** — runs `ccm checkpoint --silent` every time a Claude Code session ends. This creates a git commit automatically, so your work is always saved.

**`ccm-push`** — runs after every tool call if the working directory has uncommitted changes. Keeps your remote repository up to date in real time.

## Self-healing

If `hooksEnabled: true` in your config, CCM checks that hooks are registered at the start of every `ccm run` and re-registers them if they've been removed.

## Manual config

CCM writes directly to `~/.claude/settings.json`. After running `ccm hooks on`, the file contains:

```json
{
  "hooks": {
    "SessionEnd":   [{ "command": "ccm checkpoint --silent" }],
    "PostToolCall": [{ "command": "ccm sync push --silent --if-dirty" }]
  }
}
```

CCM only adds its own hooks and never modifies other entries in the file.
