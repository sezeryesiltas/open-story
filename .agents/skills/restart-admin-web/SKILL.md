---
name: restart-admin-web
description: Restart the open-story admin web development server by stopping any process listening on port 3000 and starting `apps/admin-web` again on port 3000. Use when Codex needs to recover a stuck local Next.js server, relaunch the project's admin UI after code changes, or ensure the open-story web app is running locally.
---

# Restart Admin Web

## Overview

Use the bundled restart script instead of manually hunting for processes. The script is specific to this repository: it resolves the repo root from the skill location, adds `~/.local/bin` to `PATH`, stops anything bound to `3000`, opens a new macOS Terminal tab for `apps/admin-web`, and waits for the port to come back.

## Workflow

1. Run:

   ```bash
   bash .agents/skills/restart-admin-web/scripts/restart-admin-web.sh
   ```

2. Read the script output to confirm:

   - which PID was stopped on port `3000`
   - the new PID that was started
   - the log file path under `.agents/tmp/admin-web.log`

3. Verify manually only if needed:

   ```bash
   tail -n 40 .agents/tmp/admin-web.log
   lsof -nP -iTCP:3000 -sTCP:LISTEN
   ```

## Notes

### scripts/
- `scripts/restart-admin-web.sh`
  Use this as the default path. It is the deterministic way to restart the project's web server.

- The script starts `pnpm --dir apps/admin-web exec next dev --port 3000` in a new macOS Terminal tab via `osascript`, which gives Next.js a normal interactive terminal.

- The script writes runtime files to:

  - `.agents/tmp/admin-web.pid`
  - `.agents/tmp/admin-web.log`

- The printed `PID` is the active listener on port `3000`.

- If the restart fails, inspect the log file before trying alternative commands.

- Do not reuse this skill for other ports or apps. It is intentionally scoped to the open-story admin web server.
