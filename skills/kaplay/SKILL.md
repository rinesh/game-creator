---
name: kaplay
description: Create, edit, debug, and verify KAPLAY games in a WebMCP-enabled KAPLAYGROUND browser page. Use when the user asks to build or change the open KAPLAYGROUND project, work on a KAPLAY game through WebMCP, or iterate on its live preview. Do not use for informational KAPLAY questions, changes to the KAPLAYGROUND WebMCP implementation itself, Phaser, Three.js, or unrelated browser-game work.
argument-hint: "[game concept or change]"
license: MIT
compatibility: Requires a browser tab whose KAPLAYGROUND document exposes the page-defined WebMCP tools; browser iframe control is required for behavioral verification beyond build, console, and the initial frame.
metadata:
  author: OpusGameLabs
  version: 1.4.0
  tags: [game, 2d, kaplay, kaplayground, webmcp, browser-game]
---

# KAPLAY + KAPLAYGROUND WebMCP

Build and iterate on the project currently open in a WebMCP-enabled KAPLAYGROUND browser page. Use that page's discovered `kaplayground_*` tools for project inspection, conflict-safe edits, preview control, diagnostics, and console output. Use browser automation on the same tab for screenshots and gameplay input.

Use KAPLAY `3001.0.19` as the conservative stable fallback, then treat `kaplayground_get_project.kaplayVersion` as the active editor selection. An exact `4000.*` value permits v4000 behavior. The value `master` is a moving target rather than a major-version guarantee, so use version-neutral or runtime-feature-detected patterns and inspect KAPLAY's `VERSION` value after initialization before relying on a version-specific API.

## Reference Files

- [kaplayground-webmcp.md](kaplayground-webmcp.md) — Exact browser WebMCP discovery, tool schemas, mutation constraints, verification loop, and failure handling. Read this for every live KAPLAYGROUND task.
- [core-patterns.md](core-patterns.md) — KAPLAY components, scenes, input, collisions, state hooks, and a single-file starter. Read this when creating gameplay or changing game code.

## Required Surface

Use the host's browser-control capability to obtain the intended KAPLAYGROUND tab, then fetch its WebMCP tools and call only names the page advertises. The expected prefix is `kaplayground_`, with underscore-separated names such as `kaplayground_get_project` and `kaplayground_replace_file`.

Use only the tools advertised by the active page. The canonical surface has no separate stdio server and no page tool for arbitrary filesystem access, command execution, partial patching, screenshots, or server-side console filtering. If the page does not expose WebMCP, report that browser/page capability as the blocker instead of silently falling back to another MCP transport or creating another local project.

## Live Iteration Workflow

1. **Discover and inspect.** Fetch the current tab's WebMCP tools. Call `kaplayground_get_project`, then `kaplayground_list_files`, and read every relevant file with `kaplayground_read_file`. Record the selected KAPLAY version, project mode (`ex` means Example and `pj` means Project), preview state, `hasUnsavedChanges`, and each file's returned revision. Neither mode proves that the page has a persistent project key. Never replace a file whose read was truncated.

2. **Define the smallest playable change.** For a new game, implement input, the core mechanic, scoring or progress, a fail or completion state, and restart. Keep the first pass to one scene and one mechanic. For an existing game, change only what the request requires.

3. **Edit with optimistic concurrency.** Compute the complete updated file content locally and call `kaplayground_replace_file` with the exact revision from the latest read. Use `runPreview: false` until a multi-file edit is internally consistent. Use `kaplayground_create_file` only when it is advertised and the requested path fits its editor restrictions. Treat `kaplayground_remove_file` as destructive and use it only when the user requested that removal and the host's confirmation policy allows it. If a revision conflict occurs, re-read and reapply the change to the new content; after a repeated conflict, stop and ask the user to pause their edits.

4. **Run and collect fresh evidence.** Before running, call `kaplayground_get_console` with the largest practical limit and retain its newest timestamp. When the baseline list is empty, treat every subsequently returned entry as fresh rather than comparing timestamps from different clocks. Call `kaplayground_run_preview`, or set `runPreview: true` on the final write. The page has no readiness event, so poll diagnostics and console briefly for no more than 5 seconds. `kaplayground_get_diagnostics` reports current Monaco markers; when a baseline timestamp exists, treat only newer console entries as evidence from this run.

5. **Inspect the rendered game.** Take a browser screenshot of the same tab; WebMCP does not provide a screenshot tool. Check that the player, hazards or goals, instructions, score or progress, and restart affordance are visible and legible. An initial frame proves rendering, not gameplay.

6. **Exercise behavior when possible.** Click or focus the preview canvas before sending keys, then use browser input against the preview iframe to exercise the main controls, collision or scoring path, failure state, and restart. Read `window.render_game_to_text()` when iframe evaluation is separately available; otherwise use visible state changes, fresh transition logs, and screenshots as behavioral evidence. If the browser cannot operate the preview, state that build, console, and the initial frame were verified while gameplay behavior remains unexercised.

## KAPLAY Implementation Rules

- In KAPLAYGROUND, preserve the project's current API style. The standard editor exposes the selected KAPLAY runtime; do not add `import kaplay from "kaplay"` to a global-style Example.
- Keep `main.js` as the entry file. Use the recognized root files (`kaplay.js`, `assets.js`) and direct JavaScript or TypeScript files in `scenes/`, `objects/`, and `utils/`. Do not introduce the Phaser/Three.js `src/core`, `systems`, `audio`, or `ui` layout.
- Put restartable gameplay inside `scene("game", ...)` and restart with `go("game")` so scene-owned objects and handlers are recreated cleanly.
- Compose objects with `add([ ...components, "tag" ])` and add an area component to both sides of a collision. In v3001, plain `area()` detects body-less overlaps; in v4000, a body-less overlap participant needs `area({ isSensor: true })`. For `master`, use the feature-detected `overlapArea()` helper in [core-patterns.md](core-patterns.md). Add `body()` only for solidity, gravity, or physical resolution.
- Use `onKeyDown` for continuous movement and `onKeyPress` for discrete actions. Add touch or pointer controls when the request targets mobile play.
- Keep tunable values in one `CONFIG` object near the top of a small game. Preserve existing file boundaries in a larger project.
- Prefer KAPLAY primitives for a new prototype. WebMCP cannot upload assets, so use only assets already confirmed by the project or public URLs the user requested.
- Use `fixed()` for camera-independent HUD elements and keep instructions concise and readable.
- For a new game, expose `window.render_game_to_text()` as described in [core-patterns.md](core-patterns.md). Add `advanceTime(ms)` only when it advances a game-owned deterministic clock; a wrapper around `setTimeout` is not simulation control.
- Log a concise scene-ready marker plus meaningful state transitions such as score changes, game over, and restart. Avoid per-frame logging because KAPLAYGROUND retains console entries across preview runs.

## Completion Gate

Do not report completion until all of these are true:

- The page advertised the required WebMCP tools, and every intended edit succeeded with a current revision.
- A final run produced no current error diagnostics or new runtime-error console entries.
- A browser screenshot shows a coherent initial frame with readable controls and state.
- When browser iframe control was available, the core mechanic and restart were exercised and their resulting state was observed.
- When behavioral tools were unavailable, the handoff limits its verification claim accordingly.
- `kaplayground_get_project` was checked after the edits, and the handoff reports `mode` and `hasUnsavedChanges` exactly. Because WebMCP does not reveal the persistent project key, tell the user to save through the KAPLAYGROUND UI unless the visible page independently confirms the work is saved. WebMCP does not expose project creation, project selection, project rename, explicit save, export, or asset-upload tools.
