#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import {
  dirname,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillDirectory = resolve(repositoryRoot, "skills/kaplay");
const failures = [];

function read(relativePath) {
  return readFileSync(resolve(repositoryRoot, relativePath), "utf8");
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;

  const fields = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    if (/^\s/.test(line)) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    fields.set(line.slice(0, separator).trim(), unquote(line.slice(separator + 1)));
  }
  return fields;
}

function markdownFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(path));
    if (entry.isFile() && entry.name.endsWith(".md")) files.push(path);
  }
  return files;
}

function normalizedLines(relativePath) {
  return read(relativePath)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.toLocaleLowerCase("en-US"));
}

function difference(expected, actual) {
  return [...expected].filter((value) => !actual.has(value));
}

const skillMarkdown = read("skills/kaplay/SKILL.md");
const frontmatter = parseFrontmatter(skillMarkdown);
check(frontmatter !== null, "skills/kaplay/SKILL.md must start with YAML frontmatter");
if (frontmatter) {
  const allowedFrontmatterKeys = new Set([
    "allowed-tools",
    "description",
    "license",
    "metadata",
    "name",
  ]);
  const unexpectedKeys = [...frontmatter.keys()].filter(
    (key) => !allowedFrontmatterKeys.has(key),
  );
  check(frontmatter.get("name") === "kaplay", "frontmatter name must match the kaplay folder");
  check(Boolean(frontmatter.get("description")), "frontmatter description is required");
  check(
    unexpectedKeys.length === 0,
    `unsupported frontmatter keys: ${unexpectedKeys.join(", ")}`,
  );
}
check(
  !/\b(?:TODO|TBD|REPLACE_ME)\b/.test(skillMarkdown),
  "SKILL.md contains an unfinished scaffold placeholder",
);

for (const markdownPath of markdownFiles(skillDirectory)) {
  const markdown = readFileSync(markdownPath, "utf8");
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of markdown.matchAll(linkPattern)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "");
    const target = rawTarget.split(/\s+["']/)[0].split("#")[0];
    if (!target || target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;

    let decodedTarget;
    try {
      decodedTarget = decodeURIComponent(target);
    } catch {
      failures.push(`${relative(repositoryRoot, markdownPath)} has an invalid encoded link: ${target}`);
      continue;
    }

    const resolvedTarget = resolve(dirname(markdownPath), decodedTarget);
    const staysInSkill = resolvedTarget === skillDirectory || resolvedTarget.startsWith(`${skillDirectory}${sep}`);
    check(staysInSkill, `${relative(repositoryRoot, markdownPath)} links outside the skill: ${target}`);
    check(existsSync(resolvedTarget), `${relative(repositoryRoot, markdownPath)} has a missing link: ${target}`);
  }
}

const readme = read("README.md");
const triggerGuide = read("tests/trigger-tests.md");
const flowTest = read("tests/flows/08-kaplayground-webmcp.md");
const packageMetadata = JSON.parse(read("package.json"));
check(readme.includes("npx skills add rinesh/game-creator"), "README must install this fork");
check(readme.includes("$skill-installer"), "README must document the Codex skill installer");
check(
  readme.includes("https://github.com/rinesh/game-creator/tree/main/skills/kaplay"),
  "README must point the Codex installer at this fork's kaplay skill",
);
check(readme.includes("$kaplay"), "README must document explicit $kaplay invocation");
check(flowTest.includes('"$kaplay '), "the KAPLAY flow test must use Codex $kaplay invocation");
check(
  !readme.includes("/game-creator:kaplay"),
  "README still contains the obsolete namespaced KAPLAY invocation",
);
check(
  !`${readme}\n${triggerGuide}`.includes("npx skills add OpusGameLabs/game-creator"),
  "installation instructions still target the upstream repository",
);
check(
  packageMetadata.repository?.url === "git+https://github.com/rinesh/game-creator.git",
  "package repository metadata must identify this fork",
);

const fixture = JSON.parse(read("tests/fixtures/kaplay-skill-contract.json"));
const expectedTools = new Set(fixture.canonicalTools);
check(expectedTools.size === 19, "canonical tool snapshot must contain nineteen unique tools");
for (const tool of expectedTools) {
  check(/^kaplayground_[a-z0-9_]+$/.test(tool), `invalid canonical tool name: ${tool}`);
}

const webmcpReference = read("skills/kaplay/kaplayground-webmcp.md");
const surfaceMatch = webmcpReference.match(
  /## Canonical Tool Surface\s+([\s\S]*?)\s+## Editor Tools/,
);
check(Boolean(surfaceMatch), "WebMCP reference must contain a canonical tool surface section");
if (surfaceMatch) {
  const documentedTools = new Set(surfaceMatch[1].match(/kaplayground_[a-z0-9_]+/g) ?? []);
  const missingTools = difference(expectedTools, documentedTools);
  const unexpectedTools = difference(documentedTools, expectedTools);
  check(missingTools.length === 0, `canonical tool section is missing: ${missingTools.join(", ")}`);
  check(unexpectedTools.length === 0, `canonical tool section has unexpected tools: ${unexpectedTools.join(", ")}`);
}

const positiveTriggers = new Set(normalizedLines("tests/trigger-positive.txt"));
const negativeTriggers = new Set(normalizedLines("tests/trigger-negative.txt"));
const triggerOverlap = [...positiveTriggers].filter((prompt) => negativeTriggers.has(prompt));
for (const prompt of fixture.positiveTriggers) {
  check(
    positiveTriggers.has(prompt.toLocaleLowerCase("en-US")),
    `positive trigger fixture is missing: ${prompt}`,
  );
}
for (const prompt of fixture.negativeTriggers) {
  check(
    negativeTriggers.has(prompt.toLocaleLowerCase("en-US")),
    `negative trigger fixture is missing: ${prompt}`,
  );
}
check(
  [...positiveTriggers].every((prompt) => !negativeTriggers.has(prompt)),
  `positive and negative trigger fixtures overlap: ${triggerOverlap.join(", ")}`,
);

if (failures.length > 0) {
  console.error("KAPLAY skill contract validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `KAPLAY skill contract validation passed (${expectedTools.size} tools, ${fixture.positiveTriggers.length} positive triggers, ${fixture.negativeTriggers.length} negative triggers).`,
  );
}
