---
name: restart-api-service
description: Restart the open-story API development server by stopping any process listening on port 3001 and starting `apps/api` again on port 3001. Use when Codex needs to recover a stuck local API server, relaunch the backend after code changes, or ensure the open-story API is running locally.
---

# Restart API Service

## Overview

Use the bundled restart script instead of manually hunting for processes. The script is specific to this repository: it resolves the repo root from the skill location, adds `~/.local/bin` to `PATH`, stops anything bound to `3001`, opens a new macOS Terminal tab for `apps/api`, and waits for the API health endpoint to respond.

## Workflow

1. Run:

   ```bash
   bash .agents/skills/restart-api-service/scripts/restart-api-service.sh
   ```

2. Read the script output to confirm:

   - which PID was stopped on port `3001`
   - the new PID that was started
   - the log file path under `.agents/tmp/api-service.log`

3. Verify manually only if needed:

   ```bash
   tail -n 40 .agents/tmp/api-service.log
   lsof -nP -iTCP:3001 -sTCP:LISTEN
   curl -fsS http://127.0.0.1:3001/v1/settings/database
   ```

## Notes

### scripts/
- `scripts/restart-api-service.sh`
  Use this as the default path. It is the deterministic way to restart the project's API server.

- The script starts `pnpm --dir apps/api dev` in a new macOS Terminal tab via `osascript`, forcing `OPEN_STORY_API_PORT=3001` so the API binds to the expected port.

- The script writes runtime files to:

  - `.agents/tmp/api-service.pid`
  - `.agents/tmp/api-service.log`

- The printed `PID` is the active listener on port `3001`.

- If the restart fails, inspect the log file before trying alternative commands.

- Do not reuse this skill for other ports or apps. It is intentionally scoped to the open-story API development server.
