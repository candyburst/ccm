# CCM Build Guide

How to install, run in development, and build a distributable desktop app.

---

## Prerequisites

| Tool | Min version | Install |
|---|---|---|
| Node.js | 18.0+ | https://nodejs.org or `nvm install 20` |
| npm | 8.0+ | comes with Node |
| Claude Code | latest | `npm install -g @anthropic-ai/claude-code` |
| Git | any | https://git-scm.com |

Check you have everything:

```bash
node --version    # should print v18.x.x or higher
npm --version     # should print 8.x.x or higher
claude --version  # should print Claude Code version
git --version
```

---

## 1. Get the code

### From the zip (this release)

```bash
unzip ccm.zip
cd ccm
```

### From GitHub (when published)

```bash
git clone https://github.com/candyburst/ccm.git
cd ccm
```

---

## 2. Install dependencies

Run this once from the **root** of the project (not inside any package subfolder):

```bash
npm install
```

This installs all three packages at once (`@ccm/core`, `@ccm/tui`, `@ccm/app`) because the root `package.json` uses npm workspaces.

---

## 3. Run the Electron app in development

```bash
npm run app
```

This does two things in parallel:
1. Starts the **Vite dev server** at `http://localhost:5173` (hot-reload React)
2. Launches **Electron** pointing at that dev server once it's ready

A desktop window should open automatically. The app will hot-reload when you edit any file inside `packages/app/src/`.

> **Tip:** If the window doesn't open, check the terminal for errors. The most common cause is a port conflict on 5173 — change it in `packages/app/vite.config.js`.

---

## 4. Build a distributable app

This compiles the React UI with Vite, then packages it with Electron Builder into a platform-specific installer.

```bash
npm run app:build
```

Output lands in `packages/app/release/`:

| Platform | Output file |
|---|---|
| macOS | `CCM-0.1.0.dmg` + `CCM-0.1.0-mac.zip` |
| Windows | `CCM Setup 0.1.0.exe` (NSIS installer) |
| Linux | `CCM-0.1.0.AppImage` + `ccm_0.1.0_amd64.deb` |

Electron Builder auto-detects your OS and builds for it. To cross-compile (e.g. build Windows on macOS), see [Electron Builder docs](https://www.electron.build/multi-platform-build).

### macOS — required for .dmg

On macOS you need Xcode Command Line Tools:

```bash
xcode-select --install
```

For a **signed** build (needed for Gatekeeper):

```bash
# Set your Apple Developer credentials
export APPLE_ID="you@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="YOUR_TEAM_ID"

npm run app:build
```

To skip signing (unsigned local build):

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run app:build
```

### Windows — required tools

Install on Windows:
- Visual Studio Build Tools: https://visualstudio.microsoft.com/visual-cpp-build-tools/
- Python 3 (for native modules): https://www.python.org/

Or use the one-liner:

```bash
npm install --global windows-build-tools   # run as Administrator
```

### Linux — required tools

```bash
sudo apt install rpm fakeroot dpkg        # Ubuntu/Debian
sudo dnf install rpm-build                 # Fedora
```

---

## 5. Build a portable version (no installer)

Portable builds run directly from a folder — no installation, no admin rights, no registry entries. Drop the folder on a USB drive or zip it up and it works on any compatible machine.

### What "portable" means per platform

| Platform | What you get | How to run |
|---|---|---|
| macOS | `CCM-portable-mac.zip` → `CCM.app` | Unzip → double-click (or `open CCM.app`) |
| Windows | `CCM-portable-win.zip` → `CCM.exe` | Unzip → double-click `CCM.exe` |
| Linux | `CCM-0.1.0.AppImage` | `chmod +x` → run directly, no install |

AppImage is already portable by nature — the standard `.appimage` target from section 4 doubles as your Linux portable.

---

### 5a. macOS portable

Add a `portable-mac` target to `packages/app/package.json` under `"build"`:

```json
"portable-mac": {
  "target": [
    { "target": "zip", "arch": ["x64", "arm64"] }
  ],
  "category": "public.app-category.developer-tools"
}
```

Build it:

```bash
cd packages/app
npx electron-builder --mac zip --x64 --arm64
```

Output: `release/CCM-0.1.0-mac.zip`

Unzip anywhere and double-click `CCM.app`. No DMG, no drag-to-Applications.

> **Gatekeeper note:** Unsigned portable builds will be blocked. Either sign them (see section 4) or strip the quarantine flag after unzipping:
> ```bash
> xattr -cr CCM.app
> ```

---

### 5b. Windows portable

Add a `portable-win` target:

```json
"portable-win": {
  "target": [
    { "target": "portable", "arch": ["x64", "ia32", "arm64"] }
  ]
}
```

Build it:

```bash
cd packages/app
npx electron-builder --win portable --x64
# arm64 (Surface Pro X, Snapdragon laptops):
npx electron-builder --win portable --arm64
# 32-bit legacy machines:
npx electron-builder --win portable --ia32
```

Output: `release/CCM 0.1.0.exe` — a self-contained executable (not an NSIS installer).

Store user data next to the `.exe` so it stays portable:

```js
// packages/app/electron/main.js  — add near the top
if (process.platform === 'win32') {
  const exeDir = path.dirname(process.execPath)
  const portableMarker = path.join(exeDir, 'portable.flag')
  if (fs.existsSync(portableMarker)) {
    app.setPath('userData', path.join(exeDir, 'userdata'))
  }
}
```

Create an empty `portable.flag` file alongside the `.exe` to activate portable mode. Without this file the app uses `%APPDATA%` as normal.

---

### 5c. Linux portable (AppImage)

AppImage is already the portable format — the `.AppImage` from section 4 is self-contained. No extra configuration needed.

For a universal x86_64 + arm64 build in one step:

```bash
cd packages/app
npx electron-builder --linux AppImage --x64 --arm64
```

Output:
- `release/CCM-0.1.0.AppImage` (x86_64)
- `release/CCM-0.1.0-arm64.AppImage` (arm64 — Raspberry Pi 4+, Ampere servers)

Run on any Linux distro (kernel 3.10+, FUSE required):

```bash
chmod +x CCM-0.1.0.AppImage
./CCM-0.1.0.AppImage
```

If FUSE is unavailable (some containers/CI):

```bash
./CCM-0.1.0.AppImage --appimage-extract-and-run
```

---

### 5d. Build all portables at once

Add this script to the root `package.json`:

```json
"scripts": {
  "app:portable": "npm run app:portable --workspace=packages/app"
}
```

And in `packages/app/package.json`:

```json
"scripts": {
  "app:portable": "electron-builder --mac zip --win portable --linux AppImage --x64 --arm64"
}
```

Run from the repo root:

```bash
npm run app:portable
```

> **Cross-compilation note:** Building macOS targets requires a macOS host. For CI, use a macOS runner for the `zip` target and a Linux runner for `AppImage` + `portable` Windows. See [Electron Builder multi-platform docs](https://www.electron.build/multi-platform-build).

Output summary after a full portable build:

```
packages/app/release/
├── CCM-0.1.0-mac.zip          macOS universal (x64 + arm64)
├── CCM 0.1.0.exe              Windows portable (x64)
├── CCM-0.1.0.AppImage         Linux x86_64
└── CCM-0.1.0-arm64.AppImage   Linux arm64
```

---

### 5e. Portable CLI (ccm command)

The TUI/CLI can also be distributed as a standalone binary that requires no Node.js installation, using [`pkg`](https://github.com/vercel/pkg) or [`ncc`](https://github.com/vercel/ncc).

Install `pkg`:

```bash
npm install -g @vercel/pkg
```

Add to `packages/tui/package.json`:

```json
"pkg": {
  "scripts": "src/**/*.js",
  "targets": ["node18-macos-x64", "node18-macos-arm64", "node18-win-x64", "node18-linux-x64", "node18-linux-arm64"],
  "outputPath": "dist"
}
```

Build standalone binaries:

```bash
cd packages/tui
pkg . --out-path dist/
```

Output:

```
packages/tui/dist/
├── ccm-macos-x64
├── ccm-macos-arm64
├── ccm-win-x64.exe
├── ccm-linux-x64
└── ccm-linux-arm64
```

Users copy the binary to anywhere in their `$PATH` — no `npm install`, no Node.js required.

> **Note:** `pkg` bundles Node.js into the binary, adding ~30–40MB per target. This is expected for standalone CLI tools.

---

## 6. Install and run the built app

### macOS
Open `packages/app/release/CCM-0.1.0.dmg` → drag CCM to Applications → launch from Spotlight.

### Windows
Run `packages/app/release/CCM Setup 0.1.0.exe` → follow installer → launch from Start Menu.

### Linux (AppImage)
```bash
chmod +x packages/app/release/CCM-0.1.0.AppImage
./packages/app/release/CCM-0.1.0.AppImage
```

### Linux (deb)
```bash
sudo dpkg -i packages/app/release/ccm_0.1.0_amd64.deb
ccm-app   # launches the desktop app
```

---

## 7. Also install the CLI (recommended)

Even if you use the Electron app, the CLI gives you `ccm run` which is how you actually launch Claude Code with the right account. The GUI manages accounts and settings; the CLI is how you use them day-to-day.

```bash
npm link --workspace=packages/tui
```

This makes `ccm` available anywhere in your terminal:

```bash
ccm status          # show active account
ccm run             # launch Claude Code
ccm switch work     # change active account
```

---

## 8. First launch walkthrough

When you open the app for the first time:

1. **Dashboard** is empty — no accounts yet.
2. Click **+ add account** in the sidebar (or press the button).
3. Choose auth type:
   - **API key** — paste your key from https://console.anthropic.com
   - **Email login** — enter your email, the app will open a browser for OAuth
4. Give the account a name (e.g. `personal`, `work`, `backup`).
5. Click **set active** on your first account.
6. Navigate to **Run session** → select the account → press **▶ start**.

For the CLI flow:
```bash
ccm                    # open TUI
# or
ccm switch personal    # set active account directly
ccm run                # launch Claude Code
```

---

## 9. Troubleshooting

### "Cannot find module '@ccm/core'"

You ran `npm install` inside a package subfolder instead of the root. Fix:

```bash
cd /path/to/ccm        # go to root
npm install            # installs workspace links
```

### "Claude Code not found"

The `claude` binary isn't in your PATH:

```bash
npm install -g @anthropic-ai/claude-code
which claude           # should print a path
```

### Electron window is blank / shows localhost refused

The Vite server didn't start in time. In `packages/app/package.json`, increase the wait-on timeout:

```json
"dev": "concurrently \"vite\" \"wait-on http://localhost:5173 --timeout 60000 && electron .\""
```

### App opens but IPC calls fail silently

Open DevTools (`Cmd+Opt+I` / `Ctrl+Shift+I`) and check the Console tab. Most IPC errors surface there. Common cause: `@ccm/core` ESM import failed in the main process — check `packages/core/src/index.js` re-exports everything correctly.

### "Error: ENOENT ~/.ccm/accounts.json"

Normal on first launch — CCM creates this file automatically when you add your first account. Not a bug.

### macOS: "CCM is damaged and can't be opened"

This is Gatekeeper rejecting an unsigned build. Fix:

```bash
xattr -cr /Applications/CCM.app
```

Or build a signed version with your Apple Developer credentials (see step 4).

### CLAUDE_CONFIG_DIR not respected (email accounts)

Some older Claude Code versions may not honour `CLAUDE_CONFIG_DIR`. Test:

```bash
CLAUDE_CONFIG_DIR=/tmp/test-claude claude --version
ls /tmp/test-claude    # should have files if respected
```

If empty, update Claude Code: `npm update -g @anthropic-ai/claude-code`

---

## 10. Dev tips

### Hot reload the Electron main process

`npm run app` hot-reloads the React renderer but **not** `electron/main.js`. After editing main.js, press `Ctrl+R` in the Electron window to reload, or restart the whole command.

### Open DevTools in development

DevTools open automatically in dev mode (see `main.js`). In production builds, add this keyboard shortcut to `main.js`:

```js
globalShortcut.register('CommandOrControl+Shift+I', () => {
  BrowserWindow.getFocusedWindow()?.webContents.openDevTools()
})
```

### Inspect the main process

In VS Code, add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "name": "Electron Main",
  "request": "attach",
  "port": 9229,
  "timeout": 30000
}
```

Start with: `ELECTRON_INSPECT=9229 npm run app`

### Change the app window size

Edit `packages/app/electron/main.js`:

```js
const win = new BrowserWindow({
  width: 1200,   // change these
  height: 800,
  // ...
})
```

---

## 11. File structure quick reference

```
ccm/
├── package.json              npm workspaces root — run npm commands here
├── packages/
│   ├── core/                 shared logic — no UI, no build step needed
│   ├── tui/
│   │   └── bin/ccm.js        the `ccm` CLI/TUI binary
│   └── app/
│       ├── electron/
│       │   ├── main.js       Electron main process (Node.js, CJS)
│       │   └── preload.js    bridge between main and renderer
│       ├── src/              React app (runs in Electron renderer)
│       │   ├── App.jsx
│       │   ├── pages/
│       │   └── components/
│       ├── index.html        HTML entry point
│       └── vite.config.js    Vite config for React build
├── DEVELOPMENT.md                 Architecture & contributor reference
├── ROADMAP.md                planned features

```
