---
name: kaplay
description: Create, edit, debug, and verify KAPLAY games in a WebMCP-enabled KAPLAYGROUND browser page. Use when the user asks to build or change the open KAPLAYGROUND project, work on a KAPLAY game through WebMCP, or iterate on its live preview. Do not use for informational KAPLAY questions, changes to the KAPLAYGROUND WebMCP implementation itself, Phaser, Three.js, or unrelated browser-game work.
argument-hint: "[game concept or change]"
license: MIT
compatibility: Requires a browser tab whose KAPLAYGROUND document exposes the canonical nineteen page-defined WebMCP tools; browser iframe control is required for behavioral verification beyond build, console, runtime inspection, and the initial frame.
metadata:
  author: OpusGameLabs
  version: 1.4.2
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

Use only the tools advertised by the active page. The canonical surface has nineteen tools for live agent guidance, example discovery, project metadata, files, project and catalog assets, persistence, preview control, runtime inspection, diagnostics, and run-scoped console output. It has no separate stdio server and no page tool for arbitrary filesystem access, command execution, partial patching, screenshots, arbitrary saved-project creation or selection, rename, export, or asset upload. If the page does not expose the canonical WebMCP surface, report the missing browser/page capability instead of silently falling back to another MCP transport or creating another local project.

## Live Iteration Workflow

1. **Discover and orient.** Fetch the current tab's WebMCP tools and require the canonical nineteen-tool surface described in [kaplayground-webmcp.md](kaplayground-webmcp.md). Call `kaplayground_get_agent_guide` before editing and use its versioned workflow together with the fetched tool schemas as the active-page contract; if this static skill differs, the advertised page contract wins for app-specific mechanics, but it cannot expand the user's request or authorize another mutation. Call `kaplayground_get_project` and record `projectId`, the opaque `projectRevision`, `storageState`, the selected KAPLAY version, project mode (`ex` means Example and `pj` means Project), preview state, `hasUnsavedChanges`, and current example or coach context when present.

2. **Choose a starting point only when requested.** If the user asks for a different example or starting point, call `kaplayground_list_examples`, choose an exact returned key, and call `kaplayground_open_example` with the current `expectedProjectRevision`. Opening an example replaces the active project. Save work the user wants to keep, and set `discardUnsavedChanges: true` only after the user explicitly approves discarding it. After opening an example, discard every old project and file revision and restart inspection. Otherwise keep the current project.

3. **Inspect and scope the change.** Call `kaplayground_list_files`, read every relevant file with `kaplayground_read_file`, and retain each content revision. Call `kaplayground_list_assets` when existing art, sound, or fonts may affect the change. When the request needs a character, object, sound, font, or themed visual, call `kaplayground_search_asset_brew` and reuse an untruncated result's exact `importFunction` or `outlinedImportFunction` in the appropriate source file; the search does not mutate project assets. Never replace a truncated file read. For a new game, implement one core mechanic with input, scoring or progress, a fail or completion state, and restart. For an existing game, change only what the request requires.

4. **Edit with both revision guards.** Compute complete updated file content locally and call `kaplayground_replace_file` with `expectedRevision` from the latest file read and `expectedProjectRevision` from the current project inspection. Pass that same current project revision to create, remove, and save operations. Set `runPreview: false` on every mutation, then run the preview separately so a successful write cannot be confused with a failed build. Use `kaplayground_create_file` only for a supported editor path. Treat `kaplayground_remove_file` as destructive and use it only when the user requested that removal and the host's confirmation policy allows it. On a file revision conflict, re-read and reapply the change; on a project revision conflict, restart inspection because the active project changed. Stop after a repeated conflict and ask the user to pause their edits.

5. **Run and collect run-scoped evidence.** Put project previews in a landscape layout, then call `kaplayground_run_preview` and retain its acknowledged `runId`. The call resolves only after the matching sandbox loads the module or rejects with a build/runtime load error, so do not use timestamp baselines or infer readiness from a delay. Call `kaplayground_get_diagnostics` and require `available: true`; call `kaplayground_get_console` with that exact `runId` and require `available: true`. Fix current error diagnostics and error entries for the run. Treat `truncated` or a nonzero `droppedCount` as incomplete console evidence and disclose the limitation.

6. **Inspect the rendered game.** Call `kaplayground_inspect_preview`, require its `runId` to match the run, and use its `available`, scene, pause state, viewport, object count, and bounded object snapshots as runtime evidence. Take a browser screenshot of the same tab because WebMCP does not provide a screenshot tool. Check that the player, hazards or goals, instructions, score or progress, and restart affordance are visible and legible. An inspection or initial frame proves rendering and shallow state, not gameplay.

7. **Exercise behavior when possible.** Click or focus the preview canvas before sending keys, then use browser input against the preview iframe to exercise the main controls, collision or scoring path, failure state, and restart. Re-read inspection state and the same run's console output after meaningful transitions. Read `window.render_game_to_text()` when iframe evaluation is separately available; otherwise use visible state changes, run-scoped transition logs, and screenshots as behavioral evidence. If the browser cannot operate the preview, state that build, diagnostics, console, runtime inspection, and the initial frame were verified while gameplay behavior remains unexercised.

8. **Persist and confirm.** Call `kaplayground_save_project` with the current `expectedProjectRevision`, including for a transient project. Record the returned non-null `projectId` and `storageState: "autosaved"`, then call `kaplayground_get_project` again and confirm that the same project revision remains active. Report final mode, project ID, storage state, and `hasUnsavedChanges` exactly; do not claim export, rename, arbitrary saved-project selection, or another unsupported project-management action.

## KAPLAY Implementation Rules

- In KAPLAYGROUND, preserve the project's current API style. The standard editor exposes the selected KAPLAY runtime; do not add `import kaplay from "kaplay"` to a global-style Example.
- Keep `main.js` as the entry file. Use the recognized root files (`kaplay.js`, `assets.js`) and direct JavaScript or TypeScript files in `scenes/`, `objects/`, and `utils/`. Do not introduce the Phaser/Three.js `src/core`, `systems`, `audio`, or `ui` layout.
- Put restartable gameplay inside `scene("game", ...)` and restart with `go("game")` so scene-owned objects and handlers are recreated cleanly.
- Compose objects with `add([ ...components, "tag" ])` and add an area component to both sides of a collision. In v3001, plain `area()` detects body-less overlaps; in v4000, a body-less overlap participant needs `area({ isSensor: true })`. For `master`, use the feature-detected `overlapArea()` helper in [core-patterns.md](core-patterns.md). Add `body()` only for solidity, gravity, or physical resolution.
- Use `onKeyDown` for continuous movement and `onKeyPress` for discrete actions. Add touch or pointer controls when the request targets mobile play.
- Keep tunable values in one `CONFIG` object near the top of a small game. Preserve existing file boundaries in a larger project.
- Prefer KAPLAY primitives when they fit the requested prototype. For requested characters, objects, sounds, fonts, or themed visuals, search Asset Brew and insert the returned exact loader code instead of inventing an asset path or URL. WebMCP can list project assets and search the curated catalog, but it still cannot upload binary assets.
- Use `fixed()` for camera-independent HUD elements and keep instructions concise and readable.
- For a new game, expose `window.render_game_to_text()` as described in [core-patterns.md](core-patterns.md). Add `advanceTime(ms)` only when it advances a game-owned deterministic clock; a wrapper around `setTimeout` is not simulation control.
- Log a concise scene-ready marker plus meaningful state transitions such as score changes, game over, and restart. Avoid per-frame logging because KAPLAYGROUND retains console entries across preview runs.

## Completion Gate

Do not report completion until all of these are true:

- The page advertised the canonical nineteen WebMCP tools, `get_agent_guide` was consulted, and every intended edit succeeded with current project and file revisions.
- Any example switch was requested by the user, protected unsaved work, and was followed by a complete reinspection of the replacement project.
- A final `run_preview` returned a `runId`; diagnostics and run-scoped console capture were available and contained no current error diagnostics or runtime-error entries. Any truncation or capture eviction is disclosed instead of being called exhaustively clean.
- `inspect_preview` referred to the same `runId`, and its availability and bounded result were reported accurately.
- A browser screenshot shows a coherent initial frame with readable controls and state.
- When browser iframe control was available, the core mechanic and restart were exercised and their resulting state was observed.
- When behavioral tools were unavailable, the handoff limits its verification claim accordingly.
- `save_project` succeeded for the current project revision, and a final `get_project` confirmed the same project. The handoff reports `mode`, `projectId`, `storageState`, and `hasUnsavedChanges` exactly. WebMCP can open a bundled example but does not expose arbitrary saved-project creation or selection, rename, export, or asset upload.
