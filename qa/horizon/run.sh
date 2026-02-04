#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Credentials for this runner are expected to come from macOS Keychain (preferred).
# We intentionally do NOT attempt to sign in to 1Password here because cron runs
# can prompt/flake depending on desktop unlock state.

cd "$ROOT_DIR"
# Provide email via env to pair with keychain password.
HORIZON_KEYCHAIN_EMAIL="${HORIZON_KEYCHAIN_EMAIL:-ajh-inbox@proton.me}" node run.js
