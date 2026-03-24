# Electron app

The CCM desktop app provides a full GUI for managing accounts and sessions. Download the installer from GitHub Releases, or build from source.

## Pages

### Dashboard

The home screen. Shows all accounts as cards with status indicators.

- **Add account** button — opens the Add Account wizard
- **Set active** — switches the active account
- **Re-login** — re-authenticates an email account
- **Disable / Enable** — toggle an account out of rotation
- **Remove** — permanently delete an account
- Stats cards: total sessions, total time, auto-switches

### Run Session

Launch a Claude Code session from the app.

1. Select account from the dropdown
2. Optionally enter extra flags to pass to `claude`
3. Click **Start** — Claude Code launches as a subprocess
4. Live output streams to the terminal panel
5. **Stop** button sends SIGTERM to the process

### Projects

Manage project-to-account bindings.

- **New project** — opens a folder picker, creates `.ccm-project.json`
- **Rebind** — change which account a project uses
- **Scan roots** — configure which directories CCM scans for projects
- After init, CCM prompts to add `.ccm-project.json` to `.gitignore`

### Sessions

Full session history with filters.

- Filter by account, exit reason, and date range
- Token count shown per session (when available)
- **Clear history** permanently deletes the log

### Sync

Configure git checkpoints and GitHub sync.

- Toggle `gitCheckpoint`, `smartResume`, `github.enabled`
- Set a GitHub backup repository URL and test the connection
- **Checkpoint now** button
- Checkpoint list with diff view and restore

### Settings

- **Auto-switch on credit limit** toggle
- **Keep session log** toggle
- **Desktop notifications** toggle
- Security info: encryption model, CCM_SECRET env var usage
- Storage paths

### Onboarding

On first launch (no accounts configured), a wizard replaces the Dashboard:
1. Choose auth method (API key or Email)
2. Name the account
3. Enter credentials
4. Optional notes
5. Optionally bind the current directory as a project

## Auto-update

When a new version is released on GitHub, CCM downloads it in the background and prompts you to install when ready. Updates are installed on next app launch.
