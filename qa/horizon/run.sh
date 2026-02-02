#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ensure 1Password session is available via desktop integration.
# Use a dedicated tmux socket so `op signin` works reliably in non-interactive runs.
SOCKET_DIR="${OPENCLAW_TMUX_SOCKET_DIR:-${CLAWDBOT_TMUX_SOCKET_DIR:-${TMPDIR:-/tmp}/openclaw-tmux-sockets}}"
mkdir -p "$SOCKET_DIR"
SOCKET="$SOCKET_DIR/openclaw-op.sock"
SESSION="op-qa-$(date +%Y%m%d-%H%M%S)"

function tmux_run() {
  tmux -S "$SOCKET" new -d -s "$SESSION" -n shell
  tmux -S "$SOCKET" send-keys -t "$SESSION":0.0 -- "$*" Enter
  # give it a beat
  sleep 2
  tmux -S "$SOCKET" capture-pane -p -J -t "$SESSION":0.0 -S -200
  tmux -S "$SOCKET" kill-session -t "$SESSION" >/dev/null 2>&1 || true
}

# Try whoami; if not signed in, sign in (will prompt/require desktop integration approval if needed).
if ! op whoami >/dev/null 2>&1; then
  tmux_run "op signin --account team-shareability.1password.com >/dev/null"
fi

cd "$ROOT_DIR"
node run.js
