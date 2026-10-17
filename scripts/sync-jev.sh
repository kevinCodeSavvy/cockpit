#!/usr/bin/env bash
# Keep the standalone jev-model-router repo in step with plugins/jev-model-router.
# This repo is the source of truth; the standalone copy is a mirror.
#
#   scripts/sync-jev.sh --check [DEST]   report drift, exit 1 if any
#   scripts/sync-jev.sh [DEST]           copy this repo's files over DEST, commit nothing
#
# DEST defaults to ~/claude-mods/jev-model-router. The standalone repo's own
# .git and its .claude-plugin/marketplace.json are left alone, since they only
# exist there.
set -euo pipefail

mode=sync
if [[ "${1:-}" == "--check" ]]; then
  mode=check
  shift
fi

src="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/plugins/jev-model-router"
dest="${1:-$HOME/claude-mods/jev-model-router}"

[[ -d "$src" ]] || { echo "sync-jev: source not found: $src" >&2; exit 2; }
[[ -d "$dest" ]] || { echo "sync-jev: destination not found: $dest" >&2; exit 2; }

if [[ "$mode" == "check" ]]; then
  if diff -rq -x .git -x marketplace.json "$src" "$dest"; then
    echo "in sync: $src and $dest"
  else
    echo "drifted: run scripts/sync-jev.sh to copy $src over $dest" >&2
    exit 1
  fi
  exit 0
fi

rsync -a --delete --itemize-changes --exclude .git --exclude marketplace.json "$src"/ "$dest"/
echo "synced $src -> $dest"
git -C "$dest" status --short
