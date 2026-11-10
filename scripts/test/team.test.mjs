/*
 * The team deck's own contract, beyond the generic engine checks.
 *
 * The forty-four frameworks are an extraction, not a retyping: the committed
 * inventory is the authority for every name, dimension, diagnostic, script,
 * foundation and unabridged check, and no test may read the read-only research
 * folder (DECISIONS 46).
 *
 * Three things a card cannot prove by looking at it. The first is the figure:
 * the source ships four drawn assets and assigns none of them, so the committed
 * layout map is the authority for every card's family and for the line the card
 * prints. The second is the budget answer: the script is carried verbatim and
 * the checks are compressed, so the source's own text must survive in the
 * artifacts an agent reads. The third is the dimension: a dimension is
 * committed whole or not at all.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadCards, loadDeck, sourceLine, sourceShort } from "../../packages/core/deck.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const INVENTORY = join(ROOT, "decks", "team", "data", "source-inventory.json");
const LAYOUT = join(ROOT, "decks", "team", "data", "layout-map.json");
const TOTAL = 44;
const ASSETS = [
  "culture continuum",
  "Radical Candor quadrant",
  "Tuckman developmental arc",
  "five-axis safety radar"
];

const categorySlug = (category) =>
  category.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// One card's slice of a generated markdown file: from its own heading to the
// next heading at the same level. A note shared by many cards would pass a
// whole-file `includes()`, which is the mistake this prevents.
function section(text, heading, marker) {
  const start = text.indexOf(heading);
  assert.ok(start >= 0, `missing heading ${heading}`);
  const next = text.indexOf(`\n${marker} `, start + heading.length);
  return text.slice(start, next < 0 ? text.length : next);
}

test("every record matches the committed inventory", async () => {
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  assert.equal(inventory.records.length, TOTAL, "the inventory holds 44 frameworks");

  const deck = await loadDeck("team");
  const cards = await loadCards(deck);
  const rows = new Map(inventory.records.map((row) => [row.id, row]));

  for (const card of cards) {
    const row = rows.get(card.id);
    assert.ok(row, `${card.id} is not in the inventory`);
    assert.equal(card.sourceCardNo, row.sourceCardNo, `${card.id} source card number`);
    assert.equal(card.name, row.name, `${card.id} name`);
    assert.equal(card.category, row.category, `${card.id} category`);
    assert.equal(card.diagnostic, row.diagnostic, `${card.id} friction diagnostic`);
    assert.equal(card.script.label, row.scripts[0].label, `${card.id} script label`);
    assert.equal(card.script.text, row.scripts[0].text, `${card.id} script is not verbatim`);
    assert.deepEqual(card.auditFull, row.audit, `${card.id} unabridged checks`);
    assert.equal(card.foundation, row.foundation, `${card.id} foundation`);
    assert.equal(card.audit.length, 2, `${card.id} carries two compressed checks`);
  }
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length, "ids are unique");
  assert.equal(cards.length, TOTAL, "all four dimensions are committed");
});

test("every figure follows the committed layout map", async () => {
  const map = JSON.parse(await readFile(LAYOUT, "utf8")).map;
  const deck = await loadDeck("team");
  const cards = await loadCards(deck);
  const nouns = { continuum: "continuum", quadrant: "quadrant", arc: "arc", radar: "radar" };
  for (const card of cards) {
    const expected = map[card.id];
    assert.ok(expected, `${card.id} has no layout-map row`);
    assert.ok(ASSETS.includes(expected.sourceAsset), `${card.id} names an unknown source asset`);
    assert.equal(card.figure.svgShape, "team-figure", `${card.id} figure shape`);
    assert.equal(card.figure.parametricParams.family, expected.family, `${card.id} family`);
    assert.equal(card.figure.parametricParams.divisions, expected.divisions, `${card.id} divisions`);
    assert.equal(card.figure.parametricParams.mark, expected.mark, `${card.id} mark`);
    // The line under the figure names the drawing, so a reader can see that the
    // label and the picture are the same claim.
    assert.equal(card.schematic, expected.label, `${card.id} printed schematic`);
    assert.ok(
      card.schematic.endsWith(nouns[expected.family]),
      `${card.id} prints "${card.schematic}" over a ${expected.family} drawing`
    );
  }
  assert.equal(Object.keys(map).length, TOTAL, "the layout map covers every card");
});

test("a dimension is committed whole or not at all", async () => {
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  const expected = {};
  for (const row of inventory.records) expected[row.category] = (expected[row.category] || 0) + 1;
  assert.deepEqual(
    Object.values(expected),
    [11, 11, 11, 11],
    "the source splits into four dimensions of eleven"
  );

  const deck = await loadDeck("team");
  const cards = await loadCards(deck);
  const seen = {};
  for (const card of cards) seen[card.category] = (seen[card.category] || 0) + 1;
  for (const [category, count] of Object.entries(seen)) {
    assert.ok(expected[category], `${category} is not an inventory category`);
    assert.equal(count, expected[category], `${category} is incomplete (${count} of ${expected[category]})`);
  }
});

test("the inventory's measured summary matches the records it holds", async () => {
  // The summary block is the one claim in the inventory a reader will quote
  // without recounting, so it is under test like every other measured claim.
  // It was stale once: the audit max still read 528, the value of a leaked
  // audit cell, after the records had been re-cut to 239.
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  const records = inventory.records;
  const measure = {
    foundation: (row) => row.foundation.length,
    diagnostic: (row) => row.diagnostic.length,
    script: (row) => row.scripts[0].text.length,
    audit: (row) => row.audit.reduce((sum, item) => sum + item.length, 0)
  };
  const stats = (pick) => {
    const values = records.map(pick).sort((a, b) => a - b);
    return {
      min: values[0],
      // The lower median: the 22nd of 44 sorted values, no interpolation.
      median: values[Math.floor((values.length - 1) / 2)],
      max: values[values.length - 1]
    };
  };
  assert.deepEqual(
    Object.keys(inventory.fieldLengths).sort(),
    Object.keys(measure).sort(),
    "the summary measures exactly the four extracted fields"
  );
  for (const [field, pick] of Object.entries(measure)) {
    assert.deepEqual(inventory.fieldLengths[field], stats(pick), `${field} summary is stale`);
  }
});

test("the compressed checks stay questions a manager can answer yes or no", async () => {
  // The check is the card's commitment; a summary is not. Each compressed
  // check opens with an auxiliary verb, ends in a question mark, and offers no
  // either/or alternative (that form has two answers and is not a check).
  const deck = await loadDeck("team");
  const cards = await loadCards(deck);
  const auxiliaries = /^(Do|Does|Did|Is|Are|Was|Were|Has|Have|Can|Will|Should)\b/;
  for (const card of cards) {
    for (const item of card.audit) {
      assert.match(item, /\?$/, `${card.id} check is not a question: "${item}"`);
      assert.match(item, auxiliaries, `${card.id} check does not open with an auxiliary: "${item}"`);
      assert.ok(!item.includes(", or "), `${card.id} check offers an either/or: "${item}"`);
    }
  }
});

test("rules and skill carry the script, the foundation and the checks unabridged", async () => {
  const deck = await loadDeck("team");
  const cards = await loadCards(deck);
  const rules = await readFile(join(ROOT, "rules", "team-rules.md"), "utf8");
  const resources = {};
  for (const category of new Set(cards.map((card) => card.category))) {
    resources[category] = await readFile(
      join(ROOT, "skills", "team", "resources", `${categorySlug(category)}.md`),
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
      assert.ok(text.includes(card.script.text), `${card.id} script is missing from the ${where}`);
      assert.ok(text.includes(card.script.label), `${card.id} script label is missing from the ${where}`);
      assert.ok(text.includes(card.foundation), `${card.id} foundation is missing from the ${where}`);
      for (const item of card.auditFull) {
        assert.ok(text.includes(item), `${card.id} unabridged check is missing from the ${where}`);
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
  // A labelled block prints a {label, text} pair through the renderers; an
  // object reaching a prose surface would come out as [object Object].
  const deck = await loadDeck("team");
  const cards = await loadCards(deck);
  const files = [join(ROOT, "rules", "team-rules.md")];
  for (const category of new Set(cards.map((card) => card.category))) {
    files.push(join(ROOT, "skills", "team", "resources", `${categorySlug(category)}.md`));
  }
  for (const file of files) {
    const text = await readFile(file, "utf8");
    assert.ok(!text.includes("[object Object]"), `${file} contains an object literal`);
    assert.ok(!/\{ text:/.test(text), `${file} prints a field as an object`);
  }
});
