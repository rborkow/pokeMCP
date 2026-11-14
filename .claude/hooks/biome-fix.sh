#!/bin/sh
# PostToolUse hook: after Claude edits or writes a file, apply Biome's safe fixes
# (format, import order) so agent edits match what the pre-commit hook and CI enforce.
# biome.json decides which files are in scope; anything else is ignored silently.
# Never blocks: a failure here only means the pre-commit hook will flag it later.
file=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$file" ] && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
bunx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true "$file" >/dev/null 2>&1
exit 0
