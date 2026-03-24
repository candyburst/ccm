# Web dashboard

CCM includes a local read-only web dashboard and a remote agent for monitoring sessions from a browser.

## Local dashboard

```bash
ccm serve                    # http://localhost:7837
ccm serve --port 9000        # custom port
ccm serve --open             # open in default browser automatically
```

The dashboard shows:
- All accounts with status (active, disabled, type)
- Recent session history with duration and exit reason
- Stats: total sessions, total time, switches

Updates automatically every 5 seconds via Server-Sent Events.

### Authentication

A random token is generated on start and printed to stderr:

```
[ccm] Dashboard: http://localhost:7837/?token=a1b2c3...
```

The token must be present in the URL as a query parameter. Without it, all requests return 401.

The dashboard only binds to `127.0.0.1` — it is not accessible from other machines on the network.

## Remote agent

For monitoring sessions running on a remote server:

```bash
# On the remote server
ccm agent --port 7838

# The token is printed to stderr:
# [ccm] Token: abc123...
```

The remote agent:
- Listens on `0.0.0.0` (accessible over the network)
- Uses HMAC-signed messages for authentication
- Streams stdout and stderr over SSE in real time
- Supports `runner:start`, `sessions:list`, `accounts:list`, and `stats` commands

### Connecting the Electron app

In the Electron app Settings page, enter the remote agent address and token to connect. The RemoteConnect page streams live session output directly to your local machine.
