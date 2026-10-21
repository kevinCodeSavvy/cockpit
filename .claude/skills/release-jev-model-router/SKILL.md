---
name: release-jev-model-router
description: Use when jev-model-router changes are done and a new version must be released and the installed plugin updated.
---

1. Bump the version in `plugins/jev-model-router/.claude-plugin/plugin.json`.
2. Update the README.
3. Run `claude plugin test plugins/jev-model-router`.
4. Run `scripts/sync-jev.sh`, then `scripts/sync-jev.sh --check` to confirm.
5. Commit and push in both cockpit and `~/claude-mods/jev-model-router`.
6. Run `claude plugin update jev-model-router@kevin-mods`, then restart Claude Code (old sessions keep the old version).
