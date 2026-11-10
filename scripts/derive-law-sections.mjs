#!/usr/bin/env node
/*
 * Derive the law-section map from the untracked source document.
 *
 * Usage:
 *   node scripts/derive-law-sections.mjs "SupportingInformation/01 - UX/Open-Source UX Laws Repository.md"
 *
 * Prints the committed map (decks/ux-laws/data/law-sections.json) to stdout, so
 * a reviewer can point at their own copy of the research input, rerun this, and
 * diff. The script fails loudly rather than guessing when a heading has moved,
 * a section is unrecognised, or two names normalise to one key.
 *
 * The category column is a human reading of each section heading, declared in
 * SECTIONS below. Nothing downstream is truer than that column, which is why
 * this script matters more than the provenance header it writes: rerunning it
 * is what makes the reading reviewable.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { NORMALISATION_RULES, normaliseLawName } from "../packages/core/law-sections.mjs";

// The deck's word for each source section heading. One line per section, and
// the order is the source's.
const SECTIONS = new Map([
  ["Heuristics and Mental Models", "Heuristic & Mental Models"],
  ["Gestalt and Visual Perception", "Gestalt & Visual Perception"],
  ["Cognitive Load and Decision Making", "Decision-Making & Cognitive Load"],
  ["Motor Control, Time and Motion", "Time, Motion & Ergonomics"],
  ["Memory, Attention, and Behavioral Biases", "Memory, Perception & Attention"]
]);

// Where the deck calls a law something other than the source heading. These
// are the only rows that carry deckName, and each is listed in the map's
// header one by one. A rename that no longer differs from its source name is an
// error, not a harmless extra.
const RENAMES = new Map([
  ["Hick-Hyman Law", "Hick's Law"],
  [
    "Weber-Fechner Law of Just Noticeable Difference (JND)",
    "Weber-Fechner JND Law"
  ],
  ["Gilbreth Motion Economy Principles", "Gilbreth Motion Economy"],
  [
    "Crossman’s Movement Velocity Law (Welford’s Variant)",
    "Crossman's Velocity Law (Welford's Variant)"
  ]
]);

const TAXONOMY = "## **Canonical Taxonomy of Cognitive Principles**";

const unescape = (heading) => heading.replace(/\\(.)/g, "$1");

function parse(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === TAXONOMY);
  if (start < 0) throw new Error(`taxonomy heading not found: ${TAXONOMY}`);

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^## [^#]/.test(lines[i])) {
      end = i;
      break;
    }
  }

  const sections = [];
  const laws = [];
  let heading = null;

  for (let i = start + 1; i < end; i += 1) {
    const line = lines[i];
    const section = line.match(/^### \*\*(.+?)\*\*\s*$/);
    if (section) {
      const name = unescape(section[1]);
      if (!SECTIONS.has(name)) throw new Error(`unrecognised section heading at line ${i + 1}: ${name}`);
      heading = { name, line: i + 1, category: SECTIONS.get(name) };
      sections.push({ heading: name, line: i + 1, category: heading.category });
      continue;
    }
    const law = line.match(/^#### \*\*(\d+)\\?\.\s*(.+?)\*\*\s*$/);
    if (law) {
      if (!heading) throw new Error(`law heading before any section at line ${i + 1}: ${line}`);
      laws.push({
        number: Number(law[1]),
        sourceName: unescape(law[2]),
        category: heading.category,
        line: i + 1
      });
    }
  }

  return { start, end, sections, laws };
}

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('usage: node scripts/derive-law-sections.mjs "<source .md>"');
  process.exit(2);
}

const text = await readFile(sourcePath, "utf8");
const { start, end, sections, laws } = parse(text);

if (sections.length !== SECTIONS.size) {
  throw new Error(`${sections.length} sections parsed, ${SECTIONS.size} declared`);
}
for (const [name] of SECTIONS) {
  if (!sections.some((section) => section.heading === name)) throw new Error(`section never seen: ${name}`);
}

// The renames must apply to a law that exists, and must still differ from it.
for (const [sourceName, deckName] of RENAMES) {
  const law = laws.find((entry) => entry.sourceName === sourceName);
  if (!law) throw new Error(`rename names no source heading: ${sourceName}`);
  if (normaliseLawName(sourceName) === normaliseLawName(deckName)) {
    throw new Error(`rename does not differ after normalisation: ${sourceName} -> ${deckName}`);
  }
  law.deckName = deckName;
}
for (const law of laws) delete law.line;

// The map's own keys must be unique, over source names and deck names together.
const seen = new Map();
for (const law of laws) {
  const keys = [normaliseLawName(law.sourceName)];
  if (law.deckName) keys.push(normaliseLawName(law.deckName));
  for (const key of keys) {
    if (!key) throw new Error(`empty key for law ${law.number}`);
    if (seen.has(key)) {
      throw new Error(
        `key "${key}" is shared by ${seen.get(key)} and law ${law.number}; the map cannot be keyed by name`
      );
    }
    seen.set(key, law.number);
  }
}

const renames = laws
  .filter((law) => law.deckName)
  .map((law) => ({ number: law.number, sourceName: law.sourceName, deckName: law.deckName }));

const map = {
  header: {
    source: {
      path: sourcePath,
      sha256: createHash("sha256").update(text).digest("hex"),
      taxonomyHeadingLine: start + 1,
      endsBeforeLine: end + 1
    },
    sections,
    columns: {
      number: "The source's ordinal inside its taxonomy; never used to join.",
      sourceName: "The law heading as the source prints it, backslash escapes removed. Always derived.",
      category:
        "A human reading of the section heading, declared in scripts/derive-law-sections.mjs; not a source field.",
      deckName:
        "This deck's own word for the law, present only where it differs from sourceName; the source name stays the derived column."
    },
    note:
      "Each rename is listed under renames, one by one. The gate matches a record by deckName or sourceName and reports how many rows carry deckName; that reported count is the claim.",
    renames,
    normalisation: NORMALISATION_RULES
  },
  laws
};

process.stdout.write(`${JSON.stringify(map, null, 2)}\n`);
