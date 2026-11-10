/*
 * The strategy deck's own contract, beyond the generic engine checks.
 *
 * The forty-two frameworks are an extraction, not a retyping: the committed
 * inventory is the authority for every name, dimension, diagnosis, canvas and
 * both unabridged item lists, and no test may read the read-only research
 * folder (DECISIONS 46).
 *
 * Three things on a card cannot be checked by looking at one. The first is the
 * figure: the source names six layout types and assigns none of them, so the
 * committed layout map is the authority for every card's schematic family. The
 * second is the compression budget: the card carries three pressure questions
 * and three actions, and the full source must survive in the artifacts that an
 * agent reads. The third is the dimension: a dimension is committed whole or
 * not at all, so a half-extracted dimension cannot pass as a finished one.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadCards, loadDeck, sourceLine, sourceShort } from "../../packages/core/deck.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const INVENTORY = join(ROOT, "decks", "strategy", "data", "source-inventory.json");
const LAYOUT = join(ROOT, "decks", "strategy", "data", "layout-map.json");
const TOTAL = 42;

const categorySlug = (category) =>
  category.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// One card's slice of a generated markdown file: from its own heading to the
// next heading at the same level. A note or citation shared by many cards would
// pass a whole-file `includes()`, which is the mistake this prevents.
function section(text, heading, marker) {
  const start = text.indexOf(heading);
  assert.ok(start >= 0, `missing heading ${heading}`);
  const next = text.indexOf(`\n${marker} `, start + heading.length);
  return text.slice(start, next < 0 ? text.length : next);
}

test("every record matches the committed inventory", async () => {
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  assert.equal(inventory.rituals.length, TOTAL, "the inventory holds 42 frameworks");
  assert.equal(inventory.categories.length, 4);

  const deck = await loadDeck("strategy");
  const cards = await loadCards(deck);
  const rows = new Map(inventory.rituals.map((row) => [row.id, row]));

  for (const card of cards) {
    const row = rows.get(card.id);
    assert.ok(row, `${card.id} is not in the inventory`);
    assert.ok(
      row.name === card.name || row.name.includes(card.name),
      `${card.id} name is neither the table's phrase nor a shorter phrase within it`
    );
    assert.equal(card.category, row.category, `${card.id} category`);
    assert.equal(card.diagnosis, row.diagnosis, `${card.id} diagnosis`);
    assert.ok(row.tableSchematic, `${card.id} inventory carries the table's schematic tag`);
    assert.equal(card.canvas, row.canvas, `${card.id} canvas`);
    assert.deepEqual(
      card.stressTestFull,
      row.stressTest,
      `${card.id} unabridged pressure questions`
    );
    assert.deepEqual(card.checklistFull, row.checklist, `${card.id} unabridged actions`);
    assert.equal(card.stressTest.length, 3, `${card.id} carries three pressure questions`);
    assert.equal(card.checklist.length, 3, `${card.id} carries three actions`);
  }
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length, "ids are unique");
  assert.equal(cards.length, TOTAL, "all four dimensions are committed");
});

test("every figure follows the committed layout map", async () => {
  const map = JSON.parse(await readFile(LAYOUT, "utf8")).map;
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  const rows = new Map(inventory.rituals.map((row) => [row.id, row]));
  const deck = await loadDeck("strategy");
  const cards = await loadCards(deck);
  for (const card of cards) {
    const expected = map[card.id];
    assert.ok(expected, `${card.id} has no layout-map row`);
    // The map's source tag is the table's own words; the label is the line the
    // card prints. A drawing treatment may differ from the source family, but
    // the printed label and the drawing must agree with the map.
    assert.equal(expected.sourceTag, rows.get(card.id).tableSchematic, `${card.id} source tag`);
    assert.equal(card.figure.svgShape, "strategy-canvas", `${card.id} figure shape`);
    assert.equal(card.figure.parametricParams.treatment, expected.treatment, `${card.id} treatment`);
    assert.equal(card.figure.parametricParams.columns, expected.columns, `${card.id} columns`);
    assert.equal(card.figure.parametricParams.rows, expected.rows, `${card.id} rows`);
    assert.equal(card.schematic, expected.label, `${card.id} printed schematic`);
  }
});

test("a dimension is committed whole or not at all", async () => {
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  const expected = {};
  for (const row of inventory.rituals) expected[row.category] = (expected[row.category] || 0) + 1;
  assert.deepEqual(
    Object.values(expected),
    [11, 11, 11, 9],
    "the source splits into four dimensions of 11, 11, 11 and 9"
  );

  const deck = await loadDeck("strategy");
  const cards = await loadCards(deck);
  const seen = {};
  for (const card of cards) seen[card.category] = (seen[card.category] || 0) + 1;
  for (const [category, count] of Object.entries(seen)) {
    assert.ok(expected[category], `${category} is not an inventory category`);
    assert.equal(
      count,
      expected[category],
      `${category} is incomplete (${count} of ${expected[category]})`
    );
  }
});

test("rules and skill carry the source unabridged", async () => {
  const deck = await loadDeck("strategy");
  const cards = await loadCards(deck);
  const rules = await readFile(join(ROOT, "rules", "strategy-rules.md"), "utf8");
  const resources = {};
  for (const category of new Set(cards.map((card) => card.category))) {
    resources[category] = await readFile(
      join(ROOT, "skills", "strategy", "resources", `${categorySlug(category)}.md`),
      "utf8"
    );
  }

  for (const card of cards) {
    const ruleSection = section(rules, `### ${card.id} — ${card.name}`, "###");
    const skillSection = section(resources[card.category], `## ${card.id} — ${card.name}`, "##");
    for (const [where, text] of [
      ["rules", ruleSection],
      ["skill resource", skillSection]
    ]) {
      assert.ok(text.includes(card.canvas), `${card.id} canvas is missing from the ${where}`);
      for (const item of card.stressTestFull) {
        assert.ok(text.includes(item), `${card.id} unabridged question is missing from the ${where}`);
      }
      for (const item of card.checklistFull) {
        assert.ok(text.includes(item), `${card.id} unabridged action is missing from the ${where}`);
      }
    }
    assert.ok(ruleSection.includes(sourceLine(card.origin)), `${card.id} citation is missing from the rules`);
    assert.ok(
      skillSection.includes(sourceShort(card.origin)),
      `${card.id} citation is missing from the ${card.category} skill resource`
    );
  }
});

test("no generated artifact prints a record object as its own text", async () => {
  // A declared list block prints strings; an array of {text} objects would come
  // out as an object literal on the card and as [object Object] in the rules.
  const deck = await loadDeck("strategy");
  const cards = await loadCards(deck);
  const files = [join(ROOT, "rules", "strategy-rules.md")];
  for (const category of new Set(cards.map((card) => card.category))) {
    files.push(join(ROOT, "skills", "strategy", "resources", `${categorySlug(category)}.md`));
  }
  for (const file of files) {
    const text = await readFile(file, "utf8");
    assert.ok(!text.includes("[object Object]"), `${file} contains an object literal`);
    assert.ok(!/\{ text:/.test(text), `${file} prints a field as an object`);
  }
});
