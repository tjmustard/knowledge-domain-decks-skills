/*
 * The productivity deck's own contract, beyond the generic engine checks.
 *
 * The forty-four tactics are an extraction, not a retyping: the committed
 * inventory is the authority for every name, diagnostic, algorithm, plain-text
 * setup and failure trap, and no test may read the read-only research folder
 * (DECISIONS 46). Two things were settled before a single card was drawn, and
 * both are asserted here. The layout map fixes every card's schematic family
 * and the two numbers the figure prints, so a drawing cannot disagree with its
 * own caption. And the declared rendering table in data/render.mjs is the only
 * way the source's escaped markdown reaches a record: the records are exactly
 * its output, and no printed field keeps a backslash, a brace or a macro.
 *
 * The two tiers of attribution are a deliberate narrowing of what the source
 * offers. A tactic title that names a person prints that name and nothing else;
 * every other card prints the honest line. The schema has no year, work or
 * publication property to fill, which is the structural half of the same rule.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadCards, loadDeck } from "../../packages/core/deck.mjs";
import { renderText } from "../../decks/productivity/data/render.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const DATA = join(ROOT, "decks", "productivity", "data");
const INVENTORY = join(DATA, "source-inventory.json");
const LAYOUT = join(DATA, "layout-map.json");
const SCHEMA = join(DATA, "law-schema.json");
const TOTAL = 44;

// The source numbers 183 steps; one algorithm's fifth step is glued onto its
// fourth, so the record numbers five and the card prints 184. Pinned, not
// tolerated: any other difference between the source's count and the card's is
// a defect this deck has not recorded.
const STEPS_DECLARED = 183;
const STEPS_PRINTED = 184;
const CORRECTED = ["TAC-14"];

// The source assigns no figure to any tactic, so the committed layout map is the
// authority for the family and its two numbers. The SPEC fixes the family counts.
const FAMILY_COUNTS = { pipeline: 3, gate: 8, matrix: 5, gauge: 3, rhythm: 8, loop: 7, ladder: 6, threshold: 4 };

const UNIT = { pipeline: "stage", gate: "route", matrix: "cell", gauge: "level", rhythm: "beat", loop: "step", ladder: "rung", threshold: "point" };
const FAMILY_LABEL = { Pipeline: "pipeline", Gate: "gate", Matrix: "matrix", Gauge: "gauge", Rhythm: "rhythm", Loop: "loop", Ladder: "ladder", Threshold: "threshold" };
const NO_ORIGIN = "The source names no originator.";

const record = (id) => JSON.parse(readFileSync(join(DATA, "laws", `${id.toLowerCase()}.json`), "utf8"));

function categorySlug(category) {
  return category.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// One card's slice of a generated markdown file: from its own heading to the
// next heading at the same level. A shared sentence would pass a whole-file
// `includes()`, which is the mistake this prevents.
function section(text, heading, marker) {
  const start = text.indexOf(heading);
  assert.ok(start >= 0, `missing heading ${heading}`);
  const next = text.indexOf(`\n${marker} `, start + heading.length);
  return text.slice(start, next < 0 ? text.length : next);
}

const numbers = (value) => String(value).match(/\d+/g) || [];

// Every file this deck ships, walked rather than listed, so a path added later
// is still covered by the naming guard below.
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

test("the deck is forty-four records in four domains of eleven", async () => {
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  assert.equal(inventory.cards.length, TOTAL, "the inventory holds 44 tactics");

  const deck = await loadDeck("productivity");
  assert.equal(deck.name, "Productivity Architecture");
  assert.equal(deck.slug, "productivity");
  assert.equal(deck.categories.length, 4, "four domains");

  const cards = await loadCards(deck);
  assert.equal(cards.length, TOTAL, "every tactic is committed");
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length, "ids are unique");

  const seen = {};
  for (const card of cards) seen[card.domain] = (seen[card.domain] || 0) + 1;
  assert.deepEqual(
    Object.values(seen),
    [11, 11, 11, 11],
    "the source splits into four domains of eleven"
  );
  for (const category of Object.keys(seen)) {
    assert.ok(deck.categories.includes(category), `${category} is not a declared category`);
  }
});

test("every record is the committed inventory's text after the declared rendering", async () => {
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  const cards = await loadCards(await loadDeck("productivity"));
  const rows = new Map(inventory.cards.map((row) => [row.id, row]));
  assert.equal(cards.length, rows.size, "the record set and the inventory have the same size");

  for (const card of cards) {
    const row = rows.get(card.id);
    assert.ok(row, `${card.id} is not in the inventory`);
    assert.equal(card.sourceTacticNo, row.n, `${card.id} source tactic number`);
    assert.equal(Number(card.id.slice(4)), row.n, `${card.id} id number and source number`);
    assert.equal(card.domain, row.domain, `${card.id} domain`);
    for (const field of ["name", "diagnostic", "trap", "procedureFull", "setupFull", "trapFull"]) {
      assert.equal(card[field], renderText(row[field]), `${card.id} ${field} is the source's text, rendered`);
    }
    assert.deepEqual(
      card.procedure.map((step) => step.text),
      row.procedure.map((step) => renderText(step)),
      `${card.id} procedure is the source's steps, rendered`
    );
    if (row.sourceNote) {
      assert.equal(card.sourceNote, renderText(row.sourceNote), `${card.id} source note`);
    }
  }
});

test("no printed field carries a macro or an escape after rendering", async () => {
  // The residue check does not ask the rendering table whether it did its job:
  // it looks for the two characters a LaTeX macro or a markdown escape leaves
  // behind. A field that kept either would print as source code on a card.
  const cards = await loadCards(await loadDeck("productivity"));
  for (const card of cards) {
    const fields = [
      ["name", card.name],
      ["diagnostic", card.diagnostic],
      ["trap", card.trap],
      ["procedureFull", card.procedureFull],
      ["setupFull", card.setupFull],
      ["trapFull", card.trapFull],
      ...(card.sourceNote ? [["sourceNote", card.sourceNote]] : []),
      ...card.procedure.map((step, index) => [`procedure[${index}]`, step.text])
    ];
    for (const [field, value] of fields) {
      const residue = String(value).match(/[\\{}]/);
      assert.equal(residue, null, `${card.id}.${field} keeps ${JSON.stringify(residue && residue[0])}`);
    }
  }
});

test("every schematic line agrees with its figure and its layout row", async () => {
  const layout = JSON.parse(await readFile(LAYOUT, "utf8"));
  const cards = await loadCards(await loadDeck("productivity"));
  const counts = {};
  for (const card of cards) {
    const row = layout.map[card.id];
    assert.ok(row, `${card.id} has no layout-map row`);
    const params = card.figure.parametricParams;
    assert.equal(card.figure.svgShape, "productivity-figure", `${card.id} figure shape`);
    assert.equal(params.family, row.family, `${card.id} family follows the layout map`);
    assert.equal(params.divisions, row.divisions, `${card.id} divisions follow the layout map`);
    assert.equal(params.mark, row.mark, `${card.id} mark follows the layout map`);
    assert.ok(params.mark >= 1 && params.mark <= params.divisions, `${card.id} mark is one of its parts`);
    assert.equal(card.schematic, row.label, `${card.id} prints the layout map's own line`);
    assert.equal(card.diagnosticSize, row.diagnosticSize, `${card.id} front size follows the layout map`);

    // The line is parseable, and the parsed numbers are the drawing's numbers.
    // Family and unit are a fixed pair: a "Gate at beat 2" would be two words
    // from different figures.
    const match = card.schematic.match(/^([A-Z][a-z]+) at ([a-z]+) (\d+) of (\d+)$/);
    assert.ok(match, `${card.id} schematic "${card.schematic}" is not '<Family> at <unit> <mark> of <divisions>'`);
    const [, family, unit, mark, divisions] = match;
    assert.equal(FAMILY_LABEL[family], params.family, `${card.id} schematic family names its figure`);
    assert.equal(unit, UNIT[params.family], `${card.id} schematic unit belongs to its figure`);
    assert.equal(Number(mark), params.mark, `${card.id} schematic mark is the drawing's mark`);
    assert.equal(Number(divisions), params.divisions, `${card.id} schematic divisions are the drawing's`);

    counts[params.family] = (counts[params.family] || 0) + 1;
  }
  assert.equal(Object.keys(layout.map).length, TOTAL, "the layout map has no row without a record");
  assert.deepEqual(counts, FAMILY_COUNTS, "the eight figure families carry the counts the SPEC fixes");
});

test("every figure's numbers are anchored in the card's own text", async () => {
  // A figure drawn from nothing is decoration. Each layout row names the field
  // its family and numbers come from and quotes the words they encode; the
  // quote must be present in that field of the record as printed, so a later
  // edit to the card's text breaks the test rather than silently orphaning the
  // drawing.
  const layout = JSON.parse(await readFile(LAYOUT, "utf8"));
  for (const [id, row] of Object.entries(layout.map)) {
    const card = record(id);
    assert.ok(row.basis && row.basis.field && row.basis.quote, `${id} layout row names its basis`);
    const value = card[row.basis.field];
    const text = Array.isArray(value) ? value.map((entry) => entry.text || entry).join("\n") : String(value);
    assert.ok(
      text.includes(row.basis.quote),
      `${id} figure basis "${row.basis.quote}" is not in its ${row.basis.field}`
    );
  }
});

test("the short procedure counts the source's steps, including the recorded correction", async () => {
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  const cards = await loadCards(await loadDeck("productivity"));
  const rows = new Map(inventory.cards.map((row) => [row.id, row]));

  assert.equal(inventory.counts.stepsDeclared, STEPS_DECLARED, "the source declares 183 step markers");
  let printed = 0;
  const corrections = [];
  for (const card of cards) {
    const row = rows.get(card.id);
    printed += card.procedure.length;
    const difference = card.procedure.length - row.stepsDeclared;
    if (difference === 1) {
      corrections.push(card.id);
      assert.ok(card.sourceNote, `${card.id} adds a step without the note that explains it`);
    } else {
      assert.equal(difference, 0, `${card.id} prints ${card.procedure.length} steps against ${row.stepsDeclared} declared`);
    }
    assert.ok(card.procedure.length >= 3 && card.procedure.length <= 5, `${card.id} procedure is 3 to 5 steps`);
  }
  assert.equal(printed, STEPS_PRINTED, "the deck prints 184 steps");
  assert.deepEqual(corrections, CORRECTED, "one algorithm is corrected, and it is the recorded one");

  // Two source defects print with their card: the setup whose line breaks were
  // lost, and the glued step. A third note would be a defect the layout map and
  // the report-back do not know about.
  const noted = cards.filter((card) => card.sourceNote).map((card) => card.id);
  assert.deepEqual(noted, ["TAC-12", "TAC-14"], "two cards carry a recorded source defect");
});

test("a short step states no number its source algorithm does not", async () => {
  // The compression rule is on the rules file: drop explanation, never add a
  // claim or change a number. A digit run in a short step must occur in the
  // algorithm it was compressed from; a short trap's must occur in its own full
  // trap. Comparing the two blocks separately, not their union, is what stops a
  // number migrating from one block to the other.
  const cards = await loadCards(await loadDeck("productivity"));
  for (const card of cards) {
    const algorithm = new Set(numbers(card.procedureFull));
    card.procedure.forEach((step, index) => {
      for (const figure of numbers(step.text)) {
        assert.ok(algorithm.has(figure), `${card.id} step ${index + 1} states ${figure}, which its algorithm never states`);
      }
    });
    const trap = new Set(numbers(card.trapFull));
    for (const figure of numbers(card.trap)) {
      assert.ok(trap.has(figure), `${card.id} trap states ${figure}, which its full trap never states`);
    }
  }
});

test("rules and resources carry the source unabridged, card by card", async () => {
  const cards = await loadCards(await loadDeck("productivity"));
  const rules = await readFile(join(ROOT, "rules", "productivity-rules.md"), "utf8");
  const resources = {};
  for (const domain of new Set(cards.map((card) => card.domain))) {
    resources[domain] = await readFile(
      join(ROOT, "skills", "productivity", "resources", `${categorySlug(domain)}.md`),
      "utf8"
    );
  }

  for (const card of cards) {
    const ruleSection = section(rules, `### ${card.id} — ${card.name}`, "###");
    const skillSection = section(resources[card.domain], `## ${card.id} — ${card.name}`, "##");
    for (const [where, text] of [
      ["rules", ruleSection],
      ["skill resource", skillSection]
    ]) {
      for (const field of ["procedureFull", "setupFull", "trapFull"]) {
        assert.ok(text.includes(card[field]), `${card.id} ${field} is missing from the ${where}`);
      }
      if (card.sourceNote) {
        assert.ok(text.includes(card.sourceNote), `${card.id} source note is missing from the ${where}`);
      }
    }
  }
});

test("attribution has two tiers and no third", async () => {
  const cards = await loadCards(await loadDeck("productivity"));
  const named = cards.filter((card) => card.origin.authors);
  const honest = cards.filter((card) => card.origin.note);
  assert.equal(named.length, 11, "eleven titles name a person");
  assert.equal(honest.length, 33, "thirty-three say the source names nobody");
  assert.equal(named.length + honest.length, TOTAL);
  for (const card of honest) assert.equal(card.origin.note, NO_ORIGIN, `${card.id} honest line`);
  for (const card of named) {
    assert.deepEqual(Object.keys(card.origin), ["authors"], `${card.id} carries the name and nothing else`);
    assert.equal(card.origin.authors.length, 1, `${card.id} names one person`);
    assert.equal(card.origin.authors[0], card.origin.authors[0].trim(), `${card.id} name has no padding`);
    assert.ok(!/\d{4}/.test(card.origin.authors[0]), `${card.id} name carries no year`);
  }

  // The schema is the structural half: with no year, work or publication
  // property declared, a record cannot acquire one and still validate.
  const schema = JSON.parse(readFileSync(SCHEMA, "utf8"));
  const origin = schema.properties.origin;
  assert.deepEqual(Object.keys(origin.properties).sort(), ["authors", "note"]);
});

test("no artifact names the commercial deck, its folder, or the read-only research tree", () => {
  // The source folder is named after a commercial card deck, and the SPEC keeps
  // that name out of every artifact. This file is an artifact too, so the three
  // strings are assembled here rather than written out: the guard does not
  // carry the names it forbids.
  const forbidden = [
    ["Pip", "Decks"].join(" "),
    ["11", " - ", "Productivity", " Tactics"].join(""),
    ["Supporting", "Information"].join("")
  ];
  const files = [
    ...walk(join(ROOT, "decks", "productivity")),
    join(ROOT, "rules", "productivity-rules.md"),
    ...walk(join(ROOT, "skills", "productivity")),
    ...walk(join(ROOT, "packages", "web", "decks", "productivity")),
    join(ROOT, "packages", "web", "index.html")
  ];
  assert.ok(files.length > TOTAL, `walked ${files.length} artifact files`);
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const name of forbidden) {
      assert.ok(!text.includes(name), `${file.slice(ROOT.length + 1)} names ${JSON.stringify(name)}`);
    }
  }
});
