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

# 1Password is optional now (Keychain is preferred). Only sign in if available and needed.
if command -v op >/dev/null 2>&1; then
  if ! op whoami >/dev/null 2>&1; then
    tmux_run "op signin --account team-shareability.1password.com >/dev/null"
  fi
fi

cd "$ROOT_DIR"
# Provide email via env to pair with keychain password.
HORIZON_KEYCHAIN_EMAIL="${HORIZON_KEYCHAIN_EMAIL:-ajh-inbox@proton.me}" node run.js
