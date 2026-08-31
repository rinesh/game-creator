# Flow Test 08: Build in KAPLAYGROUND through WebMCP

## Objective

Test that the KAPLAY skill edits the project currently open in a WebMCP-enabled KAPLAYGROUND browser page and reports exactly what the page and browser can verify.

## Prerequisites

- A WebMCP-enabled KAPLAYGROUND page is open in a browser the agent can control.
- The page advertises its `kaplayground_*` WebMCP tools.
- The active project is a clean disposable starter with no unsaved work.
- Browser control can capture the page; preview-iframe input and evaluation may be unavailable and must limit the behavioral verification claim.

## Test Prompt

"/kaplay replace the clean starter with a suitable ready-made example, then build a top-down coin collector with WASD and arrow controls, a 30-second timer, and R to restart. Use an Asset Brew character sprite and collection sound."

## Steps

### Phase 1: Discover and inspect

- [ ] Obtains the tab's `webmcp` capability, fetches its current tools, and calls only advertised names.
- [ ] Requires the canonical nineteen `kaplayground_*` tools and calls `kaplayground_get_agent_guide` before editing.
- [ ] Calls `kaplayground_get_project` and records `projectId`, `projectRevision`, `storageState`, `kaplayVersion`, project mode (`ex` means Example, `pj` means Project), preview state, `hasUnsavedChanges`, and current example metadata.
- [ ] Calls `kaplayground_list_examples`, chooses one exact returned key that fits the request, and calls `kaplayground_open_example` with the current `expectedProjectRevision` and `discardUnsavedChanges: false`.
- [ ] Treats the opened example as a project replacement, discards every old revision, and calls `kaplayground_get_project` again before inspecting source.
- [ ] Lists project files and relevant asset metadata, then reads every file it will change, retaining the project and content revisions and rejecting truncated content.

### Phase 2: Implement safely

- [ ] Keeps `main.js` as the entry and preserves the project's global or scoped KAPLAY API style.
- [ ] Uses a scene with restart through `go("game")`, continuous movement through `onKeyDown`, and version-correct overlap areas: plain `area()` for v3001, sensors for exact v4000, or runtime feature detection for `master`.
- [ ] Exposes `window.render_game_to_text()` with the visible game state.
- [ ] Calls `kaplayground_search_asset_brew` with descriptive sprite and sound queries, then inserts exact untruncated returned loader code into the project's existing asset-loading location without inventing URLs or claiming an asset upload.
- [ ] Replaces existing files with complete content plus the latest `expectedRevision` and `expectedProjectRevision`; it never invents a project identifier or partial patch operation.
- [ ] Creates files only as direct JS/TS children of `scenes/`, `objects/`, or `utils/`, passes `expectedProjectRevision`, and removes none unless explicitly requested and confirmed.
- [ ] Uses `runPreview: false` for every mutation so preview failure cannot obscure whether a write succeeded.

### Phase 3: WebMCP and browser verification

- [ ] Uses a landscape project layout, calls `kaplayground_run_preview` separately, and retains its acknowledged `runId`.
- [ ] Requires `available: true` diagnostics and `available: true` console capture filtered to the exact run ID; it reports truncation or dropped capture entries rather than treating incomplete evidence as clean.
- [ ] Calls `kaplayground_inspect_preview`, verifies that its run ID matches, and interprets `available` before using the shallow runtime snapshot as evidence.
- [ ] Uses a browser screenshot of the KAPLAYGROUND tab; it does not expect a WebMCP screenshot or base64 payload.
- [ ] Confirms the initial frame shows the player, coin, timer, score, controls, and restart affordance legibly.

### Phase 4: Behavioral verification and handoff

- [ ] When browser iframe input is available, clicks or focuses the preview canvas before exercising movement, collection, timeout, and restart, then captures same-run inspection state, transition logs, and screenshots.
- [ ] When iframe evaluation is separately available, also observes state through `render_game_to_text()`; it does not require evaluation merely because input works.
- [ ] When iframe control is unavailable, says that source, available diagnostics, same-run console output, bounded runtime inspection, and the initial frame were verified while input, collision, scoring, and restart remain unexercised.
- [ ] Calls `kaplayground_save_project` with the current project revision, records the returned project ID and autosaved state, then calls `kaplayground_get_project` again and reports `mode`, `projectId`, `storageState`, and `hasUnsavedChanges` exactly.

## Success Criteria

- [ ] The requested source is present after a revision-safe replacement or supported creation.
- [ ] The page-owned guide was consulted, the requested example switch used an exact returned key, and all later calls use the replacement project's revision.
- [ ] The requested sprite and sound use exact Asset Brew loader code, with no fabricated catalog metadata, path, URL, or asset mutation.
- [ ] The final run has available diagnostics and available same-run console capture with no current errors; incomplete capture is disclosed.
- [ ] Runtime inspection, persistence, and final project metadata all refer to the intended project/run.
- [ ] Verification claims match the available evidence.
- [ ] No separate MCP server, bridge credential, unadvertised project identifier, or unrelated local project is introduced.

## Anti-patterns

- Starting or configuring a separate stdio MCP bridge instead of using the page-advertised tools.
- Reusing a stale revision after a conflict or replacing a truncated read.
- Opening an example when the user did not request another starting point, or setting `discardUnsavedChanges: true` without explicit approval.
- Claiming gameplay works from diagnostics and an initial screenshot alone.
- Omitting `expectedProjectRevision`, combining mutations with preview execution, or checking console output by timestamp instead of `runId`.
- Fabricating Asset Brew URLs or loader functions instead of using the returned code.
- Claiming WebMCP created a project with chosen metadata, selected an arbitrary saved project, renamed or exported a project, or uploaded assets.
