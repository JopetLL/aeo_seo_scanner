#!/usr/bin/env bash
# Run the aeo_seo_scanner CLI that lives in the repo containing this skill.
# Works when the skill folder is symlinked into ~/.claude/skills.
set -euo pipefail

script_dir="$(cd "$(dirname "$(realpath "$0")")" && pwd)"
repo="$(cd "$script_dir/../../.." && pwd)"

if [[ ! -f "$repo/dist/cli.js" ]]; then
  echo "Building aeo_seo_scanner (first run)…" >&2
  (cd "$repo" && npm install --silent >&2 && npm run build --silent >&2)
fi

exec node "$repo/dist/cli.js" "$@"
