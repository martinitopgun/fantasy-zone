#!/bin/bash
# Graphify in EVERY Claude Code cloud chat, whatever project it opens. Paste this whole file into your cloud
# environment's Setup script (in a Claude Code chat: tap the environment name at the top, then Edit). It runs
# when each new chat's computer starts:
#   1. installs Graphify (official package "graphifyy", command "graphify"),
#   2. adds the /graphify skill for all projects,
#   3. makes each chat map the project it opens and nudge Claude to use the map before reading files.
# Projects that already set Graphify up themselves (like fantasy-zone) are left to their own setup.
set -u

uv tool install --quiet "graphifyy==0.9.97" 2>/dev/null || python3 -m pip install --quiet --user "graphifyy==0.9.97" || exit 0
export PATH="$HOME/.local/bin:$PATH"
graphify install >/dev/null 2>&1 || true

python3 - <<'PY'
import json, os
path = os.path.expanduser("~/.claude/settings.json")
try:
    settings = json.load(open(path))
except Exception:
    settings = {}
g = os.path.expanduser("~/.local/bin/graphify")
own = '[ -f "$CLAUDE_PROJECT_DIR/.claude/skills/graphify/SKILL.md" ] && exit 0'  # the project has its own Graphify setup
hooks = settings.setdefault("hooks", {})
def add(event, entry):
    entries = hooks.setdefault(event, [])
    if json.dumps(entry) not in map(json.dumps, entries):
        entries.append(entry)
add("SessionStart", {"hooks": [{"type": "command", "command": f'{own}; cd "$CLAUDE_PROJECT_DIR" 2>/dev/null && [ -d .git ] && {g} update . --force >/dev/null 2>&1; exit 0'}]})
add("PreToolUse", {"matcher": "Bash|Grep", "hooks": [{"type": "command", "command": f"{own}; exec {g} hook-guard search", "timeout": 10}]})
add("PreToolUse", {"matcher": "Read|Glob", "hooks": [{"type": "command", "command": f"{own}; exec {g} hook-guard read", "timeout": 10}]})
os.makedirs(os.path.dirname(path), exist_ok=True)
json.dump(settings, open(path, "w"), indent=2)
PY
exit 0
