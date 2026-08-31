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
const localKaplaySkillPath = resolve(repositoryRoot, "skills/kaplay/SKILL.md");
const localKaplaySkill = existsSync(localKaplaySkillPath)
  ? read("skills/kaplay/SKILL.md")
  : "";
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
  /phaser/i.test(packageMetadata.description) &&
    /three\.js/i.test(packageMetadata.description) &&
    /kaplay/i.test(packageMetadata.description),
  "package description must include Phaser, Three.js, and the bundled KAPLAY workflow",
);
check(
  /kaplay/i.test(claudePlugin.description),
  "Claude plugin description must advertise the bundled KAPLAY workflow",
);
check(
  /kaplay/i.test(claudeMarketplace.metadata?.description ?? "") &&
    /kaplay/i.test(claudeMarketplace.plugins?.[0]?.description ?? ""),
  "Claude marketplace descriptions must advertise the bundled KAPLAY workflow",
);
check(
  /name:\s*kaplay/.test(localKaplaySkill) && /version:\s*1\.5\.0/.test(localKaplaySkill),
  "bundled KAPLAY skill must retain its name and distribution version",
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
  repositoryAgents.includes("owns and bundles `skills/kaplay`") &&
    repositoryAgents.includes("alternative distribution") &&
    repositoryAgents.includes("install one KAPLAY distribution at a time") &&
    repositoryAgents.includes("Codex supports fallback listing metadata") &&
    repositoryAgents.includes("intentionally keeps the aggregate entry minimal"),
  "AGENTS.md must preserve local ownership and distinguish the separate plugin",
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

for (const requiredPath of [
  "skills/kaplay",
  "scripts/validate-kaplay-skill.mjs",
  "tests/fixtures/kaplay-skill-contract.json",
  "tests/flows/08-kaplayground-webmcp.md",
]) {
  check(existsSync(resolve(repositoryRoot, requiredPath)), `${requiredPath} must be present`);
}

const routingDocuments = {
  "agents/game-creator.md": gameCreatorAgent,
  "skills/make-game/SKILL.md": makeGame,
  "skills/quick-game/SKILL.md": quickGame,
  "README.md": readme,
};
for (const [path, contents] of Object.entries(routingDocuments)) {
  check(
    /kaplay/i.test(contents),
    `${path} must retain local KAPLAY routing or documentation`,
  );
}

const kaplaygroundPluginUrl =
  `https://github.com/rinesh/kaplayground/tree/${kaplaygroundPluginTag}/plugins/kaplayground`;
check(
  readme.includes(kaplaygroundPluginUrl) &&
    readme.includes("alternative distribution") &&
    readme.includes("not a replacement"),
  "README must identify the Kaplayground plugin as a separate alternative",
);
check(
  readme.includes(aggregateMarketplaceCommand) &&
    readme.includes(aggregateMarketplaceUpgradeCommand) &&
    readme.includes(directMarketplaceCommand),
  "README must document both aggregate and direct marketplace commands",
);
check(
  readme.includes("aggregate may repin a newer validated release") &&
    readme.includes("direct tag remains fixed at 1.5.0") &&
    readme.includes("repository policy fields do not override workspace policy"),
  "README must distinguish the refreshable aggregate, frozen tag, and workspace policy",
);
check(
  readme.includes("npx skills add rinesh/game-creator") &&
    readme.includes("https://github.com/rinesh/game-creator/tree/main/skills/kaplay") &&
    readme.includes("$kaplay"),
  "README must document bundled KAPLAY installation and invocation",
);
check(
  readme.includes("Choose the bundled skill or the separate plugin, not both"),
  "README must warn users to install only one KAPLAY distribution",
);
check(
  /load the `kaplay` skill/.test(gameCreatorAgent) &&
    /load the `kaplay` skill/.test(makeGame) &&
    /use kaplay instead/i.test(quickGame),
  "game-creator, make-game, and quick-game must route live KAPLAY work locally",
);
check(
  !/github\.com\/rinesh\/kaplayground\/tree\/(?:dev|main)\/plugins\/kaplayground/.test(readme),
  "README contains a mutable Kaplayground plugin link",
);

const localTriggerPrompts = [
  "build a coin collector in KAPLAY",
  "use rinesh/kaplayground WebMCP to edit the current game",
  "make a platformer in the open Kaplayground project",
  "fix the current Kaplayground preview",
  "iterate on this KAPLAY game with the page-defined browser tools",
];
for (const prompt of localTriggerPrompts) {
  check(
    positiveTriggers.includes(prompt),
    `positive trigger ownership is missing for: ${prompt}`,
  );
  check(
    !negativeTriggers.includes(prompt),
    `KAPLAY prompt appears in negative triggers: ${prompt}`,
  );
}

if (failures.length > 0) {
  console.error("KAPLAY distribution validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("KAPLAY distribution validation passed.");
