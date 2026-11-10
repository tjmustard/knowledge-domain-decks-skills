/*
 * The generator and what it produces.
 *
 * packages/rules/generate.mjs is a pure function of data/laws/*.json: read the
 * records, write four artifacts, touch nothing else. Two properties follow, and
 * both have been broken in this repository before:
 *
 *   - running it twice on the same records writes the same bytes, so a diff in
 *     generated output always means the records changed;
 *   - the year the record carries is the year the reader sees, in every
 *     artifact that prints one.
 *
 * The gate already proves the first inside a worktree and checks the committed
 * bytes for U+00A0. What it cannot show is which artifacts a year reaches, so
 * that is what the second half below is for.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCards } from "../lib/deck.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function regenerate() {
  const result = spawnSync(process.execPath, ["packages/rules/generate.mjs"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

async function artifactHashes() {
  const files = [
    "rules/ux-rules.md",
    "skills/ux-laws/SKILL.md",
    "packages/web/deck-data.js"
  ];
  // The web bundle is a different generator's output, but it is read here for
  // the same reason the gate reads it: these four artifacts are one dataset.
  const resources = (await loadCards()).map((card) => card.category);
  const slugs = [...new Set(resources)].map((category) =>
    category.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  );
  for (const slug of slugs) files.push(`skills/ux-laws/resources/${slug}.md`);

  const hashes = {};
  for (const file of files) {
    hashes[file] = createHash("sha256").update(await readFile(join(ROOT, file))).digest("hex");
  }
  return hashes;
}

test("regenerating writes identical bytes", async () => {
  // The rules generator only; deck-data.js is produced by build:web and is
  // included in the hash set so a rules edit cannot move it by accident.
  regenerate();
  const before = await artifactHashes();
  regenerate();
  const after = await artifactHashes();
  assert.deepEqual(after, before);
});

test("generated artifacts carry no no-break space", async () => {
  // U+00A0 belongs to the print template, which adds it around the ampersand.
  // A normalising comparison treats it and a plain space as one column, which
  // is how this mistake survives a careful read, so this checks the bytes.
  const files = Object.keys(await artifactHashes());
  const hits = [];
  for (const file of files) {
    const bytes = await readFile(join(ROOT, file));
    const at = bytes.indexOf(Buffer.from([0xc2, 0xa0]));
    if (at !== -1) hits.push(`${file} at byte ${at}`);
  }
  assert.deepEqual(hits, []);
});

test("every card's year reaches the rules file, and only those years do", async () => {
  regenerate();
  const rules = await readFile(join(ROOT, "rules", "ux-rules.md"), "utf8");
  const printed = [...rules.matchAll(/^\*\*Source\.\*\* .*\((\d{4})\)\./gm)].map((match) =>
    Number(match[1])
  );
  const cards = await loadCards();

  assert.equal(printed.length, cards.length, "one Source line per card");
  assert.deepEqual(
    [...printed].sort((a, b) => a - b),
    cards.map((card) => card.academicOrigin.year).sort((a, b) => a - b)
  );
  // A year is printed as the integer the record carries. A locale-formatted
  // one would read 1,834 and still look plausible in a sentence.
  assert.ok(!/\b1,\d{3}\b/.test(rules), "a year was printed with a thousands separator");
});

test("the web bundle carries the same years as the records", async () => {
  regenerate();
  const bundle = await readFile(join(ROOT, "packages", "web", "deck-data.js"), "utf8");
  const printed = [...bundle.matchAll(/"year":\s*(\d+)/g)].map((match) => Number(match[1]));
  const cards = await loadCards();
  assert.deepEqual(
    [...printed].sort((a, b) => a - b),
    cards.map((card) => card.academicOrigin.year).sort((a, b) => a - b)
  );
});
