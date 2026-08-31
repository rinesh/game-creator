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

function parseFrontmatterSection(markdown, sectionName) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;

  const fields = new Map();
  let inSection = false;
  for (const line of match[1].split(/\r?\n/)) {
    const sectionMatch = line.match(/^([a-zA-Z0-9_-]+):\s*$/);
    if (sectionMatch) {
      inSection = sectionMatch[1] === sectionName;
      continue;
    }
    if (!inSection) continue;
    const fieldMatch = line.match(/^  ([a-zA-Z0-9_-]+):\s*(.+)$/);
    if (fieldMatch) fields.set(fieldMatch[1], unquote(fieldMatch[2]));
    if (line && !/^\s/.test(line)) inSection = false;
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

function parseContractVersion(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d+)\.(\d+)$/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

function isCompatibleContract(value, minimum) {
  const candidate = parseContractVersion(value);
  const floor = parseContractVersion(minimum);
  if (!candidate || !floor || candidate.major !== floor.major) return false;
  return candidate.minor >= floor.minor;
}

function hasProfile(tools, requirements) {
  return requirements.every((tool) => tools.has(tool));
}

const skillMarkdown = read("skills/kaplay/SKILL.md");
const frontmatter = parseFrontmatter(skillMarkdown);
const skillMetadata = parseFrontmatterSection(skillMarkdown, "metadata");
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
check(skillMetadata !== null, "SKILL.md must include flat metadata fields");
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
const webmcpReference = read("skills/kaplay/kaplayground-webmcp.md");
const contractDocumentation = `${skillMarkdown}\n${webmcpReference}\n${flowTest}`;
const expectedReferenceTopics = [
  "file-editing",
  "preview-verification",
  "kaplay-patterns",
  "assets",
  "persistence",
  "failure-recovery",
];

check(skillMetadata?.get("version") === "1.5.1", "skill version must be 1.5.1");
check(fixture.contract.minimum === "1.1", "contract minimum must be 1.1");
check(fixture.contract.testedThrough === "1.x", "tested contract family must be 1.x");
check(fixture.contract.guideVersion === 5, "agent guide version must be 5");
check(
  skillMetadata?.get("kaplayground-contract-minimum") === fixture.contract.minimum,
  "skill metadata must match the contract minimum",
);
check(
  skillMetadata?.get("kaplayground-contract-tested-through") === fixture.contract.testedThrough,
  "skill metadata must match the tested contract family",
);
check(
  JSON.stringify(fixture.referenceTopics) === JSON.stringify(expectedReferenceTopics),
  "focused reference topics must match Contract 1.1",
);

const fullSurface = new Set(fixture.fullSurface);
check(
  Array.isArray(fixture.fullSurface) &&
    fixture.fullSurface.length === 20 &&
    fullSurface.size === 20,
  "full surface must contain exactly twenty unique tools",
);
for (const tool of fullSurface) {
  check(/^kaplayground_[a-z0-9_]+$/.test(tool), `invalid tool name: ${tool}`);
}
check(
  !/\b(?:nineteen|19-tool|canonical tool surface)\b/i.test(contractDocumentation),
  "skill guidance must not retain an exact-count contract gate",
);
check(
  /absent[^.]*older[^.]*unknown|absent[^.]*older[^.]*different-major/i.test(contractDocumentation),
  "skill guidance must keep absent, older, and unknown contracts inspection-only",
);
check(
  webmcpReference.includes("kaplayground_get_reference") &&
    webmcpReference.includes("source-only mutation"),
  "static reference must cover focused references and source-only confirmation",
);

for (const [profileName, requirements] of Object.entries(fixture.profiles)) {
  check(Array.isArray(requirements), `${profileName} profile must be an array`);
  check(
    new Set(requirements).size === requirements.length,
    `${profileName} profile contains duplicate tools`,
  );
  for (const tool of requirements) {
    check(fullSurface.has(tool), `${profileName} references an unknown tool: ${tool}`);
  }
}

for (const testCase of fixture.cases) {
  const advertised = new Set(
    testCase.tools === "fullSurface" ? fixture.fullSurface : testCase.tools,
  );
  const schemaCompatible = new Set(testCase.schemaCompatibleTools ?? advertised);
  for (const tool of advertised) {
    check(fullSurface.has(tool), `${testCase.name} advertises an unknown tool: ${tool}`);
  }
  for (const tool of schemaCompatible) {
    check(advertised.has(tool), `${testCase.name} marks an unadvertised tool schema-compatible: ${tool}`);
  }
  const usableTools = new Set(
    [...advertised].filter((tool) => schemaCompatible.has(tool)),
  );
  const contractCompatible = isCompatibleContract(
    testCase.contractVersion,
    fixture.contract.minimum,
  );
  const inspection = hasProfile(usableTools, fixture.profiles.inspection);
  const existingFileEditing = hasProfile(
    usableTools,
    fixture.profiles.existingFileEditing,
  );
  const verifiedIteration = hasProfile(
    usableTools,
    fixture.profiles.verifiedIteration,
  );
  const recommendedEvidence = hasProfile(
    usableTools,
    fixture.profiles.recommendedEvidence,
  );
  const sourceOnlyConfirmationRequired =
    contractCompatible &&
    existingFileEditing &&
    !verifiedIteration &&
    !testCase.sourceOnlyAccepted;
  const mutationAllowed =
    contractCompatible &&
    existingFileEditing &&
    (verifiedIteration || testCase.sourceOnlyAccepted === true);
  const actual = {
    contractCompatible,
    inspection,
    existingFileEditing,
    verifiedIteration,
    recommendedEvidence,
    sourceOnlyConfirmationRequired,
    mutationAllowed,
  };

  check(
    JSON.stringify(actual) === JSON.stringify(testCase.expected),
    `${testCase.name} produced ${JSON.stringify(actual)} instead of ${JSON.stringify(testCase.expected)}`,
  );
}
check(fixture.cases.length === 9, "contract fixture must contain nine cases");

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
    `KAPLAY skill contract validation passed (${fixture.cases.length} contract cases, ${fullSurface.size} tools, ${fixture.positiveTriggers.length} positive triggers, ${fixture.negativeTriggers.length} negative triggers).`,
  );
}
