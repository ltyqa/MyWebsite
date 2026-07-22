#!/usr/bin/env bash
set -euo pipefail

export OPENCLAW_CONFIG_PATH="${HOME}/.config/openclaw/website-session-cleanup.json"
OPENCLAW_BIN="${OPENCLAW_BIN:-${HOME}/.local/share/pnpm/openclaw}"

exec "${OPENCLAW_BIN}" sessions cleanup \
  --store "${HOME}/.openclaw/agents/website/sessions/sessions.json" \
  --enforce \
  --json
