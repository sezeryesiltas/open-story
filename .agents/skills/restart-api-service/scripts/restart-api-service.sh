#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
APP_DIR="${REPO_ROOT}/apps/api"
RUNTIME_DIR="${REPO_ROOT}/.agents/tmp"
PID_FILE="${RUNTIME_DIR}/api-service.pid"
LOG_FILE="${RUNTIME_DIR}/api-service.log"
PORT="3001"
HEALTHCHECK_URL="http://127.0.0.1:${PORT}/v1/settings/database"

export PATH="${HOME}/.local/bin:${PATH}"

if [[ ! -f "${REPO_ROOT}/package.json" || ! -f "${APP_DIR}/package.json" ]]; then
  echo "Repository layout not recognized from ${SCRIPT_DIR}" >&2
  exit 1
fi

mkdir -p "${RUNTIME_DIR}"

stop_pid() {
  local pid="$1"

  if ! kill -0 "${pid}" >/dev/null 2>&1; then
    return 0
  fi

  kill "${pid}" >/dev/null 2>&1 || true

  for _ in {1..20}; do
    if ! kill -0 "${pid}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done

  kill -9 "${pid}" >/dev/null 2>&1 || true
}

port_pids="$(lsof -ti "tcp:${PORT}" 2>/dev/null | sort -u || true)"

if [[ -f "${PID_FILE}" ]]; then
  recorded_pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -n "${recorded_pid}" ]]; then
    port_pids="$(printf '%s\n%s\n' "${port_pids}" "${recorded_pid}" | awk 'NF' | sort -u)"
  fi
fi

if [[ -n "${port_pids}" ]]; then
  while IFS= read -r pid; do
    [[ -n "${pid}" ]] || continue
    echo "Stopping PID ${pid}"
    stop_pid "${pid}"
  done <<< "${port_pids}"
else
  echo "No existing process found on port ${PORT}"
fi

rm -f "${PID_FILE}"
rm -f "${LOG_FILE}"

terminal_cmd="cd \"${REPO_ROOT}\"; export PATH=\"${HOME}/.local/bin:\$PATH\"; export OPEN_STORY_API_PORT=\"${PORT}\"; mkdir -p \"${RUNTIME_DIR}\"; : > \"${LOG_FILE}\"; pnpm --dir \"${APP_DIR}\" dev 2>&1 | tee -a \"${LOG_FILE}\""

if ! osascript \
  -e 'on run argv' \
  -e 'set shellCommand to item 1 of argv' \
  -e 'tell application "Terminal"' \
  -e 'activate' \
  -e 'do script shellCommand' \
  -e 'end tell' \
  -e 'end run' \
  "${terminal_cmd}" >/dev/null; then
  echo "Failed to launch Terminal for API restart" >&2
  exit 1
fi

for _ in {1..60}; do
  listener_pid="$(lsof -ti "tcp:${PORT}" 2>/dev/null | head -n 1 || true)"
  if [[ -n "${listener_pid}" ]] && /usr/bin/curl -fsS "${HEALTHCHECK_URL}" >/dev/null 2>&1; then
    printf '%s\n' "${listener_pid}" > "${PID_FILE}"
    echo "API service restarted on port ${PORT}"
    echo "PID: ${listener_pid}"
    echo "Log: ${LOG_FILE}"
    exit 0
  fi

  sleep 1
done

echo "Timed out waiting for port ${PORT} to become ready" >&2
rm -f "${PID_FILE}"
tail -n 60 "${LOG_FILE}" >&2 || true
exit 1
