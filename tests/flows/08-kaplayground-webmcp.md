# Flow Test 08: Build in KAPLAYGROUND through WebMCP

## Objective

Test that the KAPLAY skill edits the project currently open in a WebMCP-enabled KAPLAYGROUND browser page and reports exactly what the page and browser can verify.

## Prerequisites

- A WebMCP-enabled KAPLAYGROUND page is open in a browser the agent can control.
- The page advertises its `kaplayground_*` WebMCP tools.
- Browser control can capture the page; preview-iframe input and evaluation may be unavailable and must limit the behavioral verification claim.

## Test Prompt

"/kaplay build a top-down coin collector with WASD and arrow controls, a 30-second timer, and R to restart"

## Steps

### Phase 1: Discover and inspect

- [ ] Obtains the tab's `webmcp` capability, fetches its current tools, and calls only advertised names.
- [ ] Calls `kaplayground_get_project` and records `kaplayVersion`, project mode (`ex` means Example, `pj` means Project), preview state, and `hasUnsavedChanges` without treating mode as proof of persistence.
- [ ] Lists project files and reads every file it will change, retaining each revision and rejecting truncated content.

### Phase 2: Implement safely

- [ ] Keeps `main.js` as the entry and preserves the project's global or scoped KAPLAY API style.
- [ ] Uses a scene with restart through `go("game")`, continuous movement through `onKeyDown`, and version-correct overlap areas: plain `area()` for v3001, sensors for exact v4000, or runtime feature detection for `master`.
- [ ] Exposes `window.render_game_to_text()` with the visible game state.
- [ ] Replaces existing files with complete content plus the latest `expectedRevision`; it never invents a project identifier or partial patch operation that the page did not advertise.
- [ ] Creates files only as direct JS/TS children of `scenes/`, `objects/`, or `utils/`, and removes none unless explicitly requested and confirmed.

### Phase 3: WebMCP and browser verification

- [ ] Records the newest console timestamp, or notes an empty baseline and treats all later entries as fresh, then calls `kaplayground_run_preview` or uses the final write's `runPreview` option.
- [ ] Uses a bounded readiness loop of no more than 5 seconds, checking current Monaco diagnostics and only console entries newer than the baseline.
- [ ] Uses a browser screenshot of the KAPLAYGROUND tab; it does not expect a WebMCP screenshot or base64 payload.
- [ ] Confirms the initial frame shows the player, coin, timer, score, controls, and restart affordance legibly.

### Phase 4: Behavioral verification and handoff

- [ ] When browser iframe input is available, clicks or focuses the preview canvas before exercising movement, collection, timeout, and restart, then captures fresh transition logs and screenshots.
- [ ] When iframe evaluation is separately available, also observes state through `render_game_to_text()`; it does not require evaluation merely because input works.
- [ ] When iframe control is unavailable, says that source, diagnostics, new console output, and the initial frame were verified while input, collision, scoring, and restart remain unexercised.
- [ ] Calls `kaplayground_get_project` again, reports `mode` and `hasUnsavedChanges` exactly, and tells the user to save through the UI unless visible page state independently confirms persistence.

## Success Criteria

- [ ] The requested source is present after a revision-safe replacement or supported creation.
- [ ] The final run has no current error diagnostics or new runtime-error console entries.
- [ ] Verification claims match the available evidence.
- [ ] No separate MCP server, bridge credential, unadvertised project identifier, or unrelated local project is introduced.

## Anti-patterns

- Starting or configuring a separate stdio MCP bridge instead of using the page-advertised tools.
- Reusing a stale revision after a conflict or replacing a truncated read.
- Claiming gameplay works from diagnostics and an initial screenshot alone.
- Claiming WebMCP created, selected, renamed, saved, or exported a KAPLAYGROUND project, or uploaded its assets.
