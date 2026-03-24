# Configuration

CCM stores all settings in `~/.ccm/config.json`. You can edit it directly or use `ccm sync on/off` for sync settings.

## Settings reference

| Key | Default | Description |
|---|---|---|
| `autoSwitch` | `true` | Rotate to the next account on credit limit |
| `keepSessionLog` | `true` | Record each run to `~/.ccm/session-log.json` |
| `smartResume` | `true` | Transfer session JSONL + `--resume` on switch |
| `gitCheckpoint` | `true` | `git add -A && git commit` before every switch |
| `showNotifications` | `true` | Desktop notifications (Electron app only) |
| `projectScanRoots` | `null` | Directories to scan for projects (null = home dir) |
| `hooksEnabled` | `false` | Register CCM hooks in `~/.claude/settings.json` |
| `github.enabled` | `false` | Enable GitHub sync |
| `github.projectSync` | `true` | Push project on switch |
| `github.autoPushOnSwitch` | `true` | Push when switching accounts |
| `github.autoPushOnEnd` | `false` | Push when session ends normally |
| `github.sessionBackup` | `false` | Backup JSONL files to a private repo |
| `github.backupRepo` | `""` | SSH or HTTPS URL for the backup repo |

## Per-project settings

Each project can have a `.ccm-project.json` file:

```json
{
  "name": "my-app",
  "account": "personal",
  "remote": "origin",
  "notes": ""
}
```

| Key | Description |
|---|---|
| `account` | Which CCM account to use for this project |
| `remote` | Git remote to push to (default: `origin`) |

## Environment variables

| Variable | Description |
|---|---|
| `CCM_SECRET` | Custom passphrase for API key encryption (overrides machine key) |
| `CCM_DEBUG` | Set to `1` to enable debug logging |
