# GitHub sync

CCM can automatically push your project to a git remote on every account switch, and back up session JSONL files to a private repository.

## Enable

```bash
ccm sync on github
```

Or in `~/.ccm/config.json`:
```json
{
  "github": {
    "enabled": true,
    "projectSync": true,
    "autoPushOnSwitch": true,
    "autoPushOnEnd": false,
    "sessionBackup": false,
    "backupRepo": ""
  }
}
```

## Project sync

When `projectSync: true`, CCM pushes your current directory to its `origin` remote every time it switches accounts. This ensures your code is safe before context is transferred.

```bash
ccm sync push          # push manually
ccm sync checkpoint    # commit + push
```

## Session backup

When `sessionBackup: true` and `backupRepo` is set, CCM copies JSONL session files to a private repository. This lets you restore any session on any machine.

```bash
# Set up a private backup repo
ccm sync on session-backup
# Then set the repo URL in settings or config.json

# Restore a session by ID
ccm sync restore <session-id>
```

## Per-project remote

You can override which git remote to push to per project. In `.ccm-project.json`:

```json
{
  "remote": "upstream"
}
```

Falls back to `origin` if the specified remote doesn't exist.

## Status

```bash
ccm sync status         # show git status and sync config
ccm sync checkpoints    # list recent checkpoints
```
