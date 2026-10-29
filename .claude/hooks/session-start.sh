#!/bin/bash
# Claude Code cloud sessions start on a fresh computer. Install Graphify (the map of this project's code that
# lets Claude look things up instead of reading whole files, so it uses fewer tokens) and rebuild the map, so
# the graphify hooks in .claude/settings.json and `graphify query` work from the first message.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

export PATH="$HOME/.local/bin:$PATH"
if ! command -v graphify >/dev/null 2>&1; then
  # Official package is "graphifyy" (double y); the command it installs is "graphify". Pinned to the tested version.
  if command -v uv >/dev/null 2>&1; then
    uv tool install --quiet "graphifyy==0.9.97"
  else
    python3 -m pip install --quiet --user "graphifyy==0.9.97"
  fi
fi

# Let the session's own commands find graphify too.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
fi

# Rebuild the code map from what's in the repository now (local, no AI calls, a few seconds).
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
graphify update . --force >/dev/null 2>&1 || echo "graphify: couldn't rebuild the code map; run 'graphify update . --force'" >&2
