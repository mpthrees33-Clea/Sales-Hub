#!/usr/bin/env bash
# SessionStart hook for the superpowers skills library (project-level install).
#
# Injects the "using-superpowers" meta-skill into context at session start so
# Claude proactively discovers and invokes the relevant skills. Adapted from
# obra/superpowers' plugin hook to run as a repo-local hook instead of a plugin
# (uses CLAUDE_PROJECT_DIR rather than CLAUDE_PLUGIN_ROOT).

set -euo pipefail

# Resolve the repo root. CLAUDE_PROJECT_DIR is set by Claude Code for hooks;
# fall back to a path relative to this script when run manually.
if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
    PROJECT_DIR="${CLAUDE_PROJECT_DIR}"
else
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
fi

SKILL_FILE="${PROJECT_DIR}/.claude/skills/using-superpowers/SKILL.md"

# Read using-superpowers content
using_superpowers_content=$(cat "${SKILL_FILE}" 2>&1 || echo "Error reading using-superpowers skill")

# Escape string for JSON embedding using bash parameter substitution.
escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

using_superpowers_escaped=$(escape_for_json "$using_superpowers_content")
session_context="<EXTREMELY_IMPORTANT>\nYou have superpowers.\n\n**Below is the full content of your 'using-superpowers' skill - your introduction to using skills. For all other skills, use the 'Skill' tool:**\n\n${using_superpowers_escaped}\n</EXTREMELY_IMPORTANT>"

# Emit context injection in Claude Code's expected format.
# Uses printf instead of heredoc to work around bash 5.3+ heredoc hang.
printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "SessionStart",\n    "additionalContext": "%s"\n  }\n}\n' "$session_context"

exit 0
