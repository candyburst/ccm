# Plugins

CCM supports JavaScript plugins that run automatically during sessions. Plugins live in `~/.ccm/plugins/` and are loaded at the start of every `ccm run`.

## Installing a plugin

Copy any `.js` file into `~/.ccm/plugins/`:

```bash
mkdir -p ~/.ccm/plugins
cp my-plugin.js ~/.ccm/plugins/
```

An example plugin ships with CCM at `examples/plugins/session-logger.js`.

## Plugin API

A plugin is an ES module that exports lifecycle functions:

```js
// ~/.ccm/plugins/my-plugin.js

export function onSessionStart({ account, projectRoot, flags }) {
  // Called when a session starts
}

export function onSessionEnd({ account, exitReason, durationSec, projectRoot }) {
  // Called when a session ends normally or on credit limit
}

export function onSwitch({ from, to, sessionId, projectRoot }) {
  // Called when CCM switches from one account to another
}

export function onCheckpoint({ commitHash, projectRoot, account }) {
  // Called after a successful git checkpoint
}
```

All functions are optional — export only the ones you need.

## Error isolation

A plugin crash never affects the session. Errors are caught, written to `~/.ccm/plugin-errors.log`, and logged via `CCM_DEBUG=1`. The session continues normally.

## Managing plugins

```bash
ccm plugin list              # show all plugins and their status
ccm plugin disable <name>    # disable a plugin (e.g. session-logger.js)
ccm plugin enable  <name>    # re-enable a plugin
```

Disabled plugins are listed in `~/.ccm/plugins-disabled.json`.

## Example plugin

The bundled `session-logger.js` appends a JSON line to `~/.ccm/plugin-session-log.json` for every lifecycle event:

```json
{"event":"session_start","ts":"2026-01-15T10:30:00.000Z","account":"work","projectRoot":"/Users/me/myapp"}
{"event":"session_end","ts":"2026-01-15T11:45:00.000Z","account":"work","exitReason":"normal","durationSec":4500}
```
