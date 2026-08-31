#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const kaplaygroundPluginSha = "c70d10d26ce6134a898c3ce06c7bf04cdc641738";
const kaplaygroundPluginVersion = "1.5.0";
const kaplaygroundPluginTag = `kaplayground-plugin-v${kaplaygroundPluginVersion}`;
const aggregateMarketplaceCommand =
  "codex plugin marketplace add rinesh/game-creator --ref main";
const aggregateMarketplaceUpgradeCommand =
  "codex plugin marketplace upgrade game-creator";
const directMarketplaceCommand =
  `codex plugin marketplace add rinesh/kaplayground --ref ${kaplaygroundPluginTag}`;
const failures = [];

function read(relativePath) {
  return readFileSync(resolve(repositoryRoot, relativePath), "utf8");
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

const packageMetadata = json("package.json");
const claudePlugin = json(".claude-plugin/plugin.json");
const claudeMarketplace = json(".claude-plugin/marketplace.json");
const codexMarketplace = json(".agents/plugins/marketplace.json");
const repositoryAgents = read("AGENTS.md");
const readme = read("README.md");
const gameCreatorAgent = read("agents/game-creator.md");
const makeGame = read("skills/make-game/SKILL.md");
const quickGame = read("skills/quick-game/SKILL.md");
const positiveTriggers = read("tests/trigger-positive.txt");
const negativeTriggers = read("tests/trigger-negative.txt");

check(packageMetadata.version === "1.5.0", "package version must remain 1.5.0");
check(
  claudePlugin.version === packageMetadata.version &&
    claudeMarketplace.metadata?.version === packageMetadata.version &&
    claudeMarketplace.plugins?.[0]?.version === packageMetadata.version,
  "package and Claude distribution versions must match",
);
check(
  !/kaplay/i.test(packageMetadata.description),
  "package description must describe only Phaser and Three.js ownership",
);
check(
  !/kaplay/i.test(claudePlugin.description),
  "Claude plugin description must not claim KAPLAY ownership",
);
check(
  !/kaplay/i.test(claudeMarketplace.metadata?.description ?? "") &&
    !/kaplay/i.test(claudeMarketplace.plugins?.[0]?.description ?? ""),
  "Claude marketplace descriptions must not claim KAPLAY ownership",
);

const aggregateEntry = codexMarketplace.plugins?.find(
  (entry) => entry.name === "kaplayground",
);
check(Boolean(aggregateEntry), "Codex marketplace must advertise kaplayground");
const repositoryDisallowedAggregateFields = Object.keys(aggregateEntry ?? {}).filter(
  (field) => !["name", "source", "policy", "category"].includes(field),
);
check(
  repositoryDisallowedAggregateFields.length === 0,
  `Kaplayground aggregate entry has remote manifest fields disallowed by this repository's no-duplication policy: ${repositoryDisallowedAggregateFields.join(", ")}`,
);
check(
  repositoryAgents.includes("Codex supports fallback listing metadata") &&
    repositoryAgents.includes("intentionally keeps the aggregate entry minimal") &&
    repositoryAgents.includes("generate it from and validate it against the pinned manifest") &&
    !repositoryAgents.includes("unsupported fallback fields") &&
    !repositoryAgents.includes("unresolved Git-backed source is skipped"),
  "AGENTS.md must describe minimal aggregate metadata as repository policy, not a Codex schema limitation",
);
const aggregateSource = aggregateEntry?.source;
check(
  aggregateSource?.source === "git-subdir" &&
    aggregateSource.url === "https://github.com/rinesh/kaplayground.git" &&
    aggregateSource.path === "./plugins/kaplayground" &&
    typeof aggregateSource.sha === "string" &&
    /^[0-9a-f]{40}$/.test(aggregateSource.sha) &&
    aggregateSource.sha === kaplaygroundPluginSha &&
    !Object.hasOwn(aggregateSource, "ref"),
  "Kaplayground aggregate entry must use the exact immutable git-subdir SHA without a mutable ref",
);
check(
  aggregateEntry?.policy?.installation === "AVAILABLE" &&
    aggregateEntry.policy.authentication === "ON_INSTALL",
  "Kaplayground aggregate entry must use AVAILABLE and ON_INSTALL policies",
);
check(
  aggregateEntry?.category === "Development",
  "Kaplayground aggregate entry must use the Development category",
);

for (const removedPath of [
  "skills/kaplay",
  "scripts/validate-kaplay-skill.mjs",
  "tests/fixtures/kaplay-skill-contract.json",
  "tests/flows/08-kaplayground-webmcp.md",
]) {
  check(!existsSync(resolve(repositoryRoot, removedPath)), `${removedPath} must be removed`);
}

const routingDocuments = {
  "agents/game-creator.md": gameCreatorAgent,
  "skills/make-game/SKILL.md": makeGame,
  "skills/quick-game/SKILL.md": quickGame,
  "README.md": readme,
};
for (const [path, contents] of Object.entries(routingDocuments)) {
  check(
    !/skills\/kaplay|tree\/main\/skills\/kaplay|load the `kaplay` skill|use kaplay instead|\$kaplay|\/game-creator:kaplay/i.test(
      contents,
    ),
    `${path} contains dangling local KAPLAY routing`,
  );
}

const kaplaygroundPluginUrl =
  `https://github.com/rinesh/kaplayground/tree/${kaplaygroundPluginTag}/plugins/kaplayground`;
check(
  readme.includes(kaplaygroundPluginUrl) &&
    readme.includes("does not bundle a copy"),
  "README must identify Kaplayground as a separate related plugin",
);
check(
  readme.includes(aggregateMarketplaceCommand) &&
    readme.includes(aggregateMarketplaceUpgradeCommand) &&
    readme.includes(directMarketplaceCommand),
  "README must document both aggregate and direct marketplace commands",
);
check(
  readme.includes("refreshable aggregate channel") &&
    readme.includes("tag is frozen") &&
    readme.includes("repository policy fields do not override workspace policy"),
  "README must distinguish the update channel, frozen tag, and ChatGPT workspace policy",
);
check(
  readme.includes("Choose one marketplace source") &&
    /do not install the plugin from\s+both/.test(readme),
  "README must warn users to install the plugin from only one marketplace",
);
for (const [path, contents] of Object.entries({
  "agents/game-creator.md": gameCreatorAgent,
  "skills/make-game/SKILL.md": makeGame,
  "skills/quick-game/SKILL.md": quickGame,
})) {
  check(
    contents.includes(kaplaygroundPluginUrl) &&
      contents.includes("separate"),
    `${path} must route forced KAPLAY requests to the separate plugin`,
  );
}
for (const [path, contents] of Object.entries(routingDocuments)) {
  check(
    !/github\.com\/rinesh\/kaplayground\/tree\/(?:dev|main)\/plugins\/kaplayground/.test(
      contents,
    ),
    `${path} contains a mutable Kaplayground discovery link`,
  );
}

const movedTriggerPrompts = [
  "build a coin collector in KAPLAY",
  "use rinesh/kaplayground WebMCP to edit the current game",
  "make a platformer in the open Kaplayground project",
  "fix the current Kaplayground preview",
  "iterate on this KAPLAY game with the page-defined browser tools",
];
for (const prompt of movedTriggerPrompts) {
  check(
    !positiveTriggers.includes(prompt),
    `positive trigger ownership remains for: ${prompt}`,
  );
  check(
    negativeTriggers.includes(prompt),
    `negative boundary fixture is missing: ${prompt}`,
  );
}

if (failures.length > 0) {
  console.error("Plugin ownership boundary validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Plugin ownership boundary validation passed.");
