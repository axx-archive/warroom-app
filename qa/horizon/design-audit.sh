#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Provide email via env for Keychain-backed password.
HORIZON_KEYCHAIN_EMAIL="${HORIZON_KEYCHAIN_EMAIL:-ajh-inbox@proton.me}" \
HORIZON_DESIGN_SYSTEM_PATH="${HORIZON_DESIGN_SYSTEM_PATH:-/Users/ajhart/Desktop/InsideOut/docs/DESIGN-SYSTEM.md}" \
node design-audit.js
