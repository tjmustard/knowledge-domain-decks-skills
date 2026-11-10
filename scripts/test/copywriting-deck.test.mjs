/*
 * The copy deck's printed deck, from the inventory to every artifact.
 *
 * The forty-eight formulas are an extraction: the committed inventory is the
 * authority, and the cards, the rules, the four surface resources and the web
 * bundle are all derived from it. This test compares the printed deck to the
 * inventory record for record, holds the layout map's label, size and figure
 * to the record they describe, and requires the rules and each resource to
 * carry the whole record - proportions, mechanism, deployment, template (or the
 * deck's own sentence saying the source prints none), blueprint prose and the
 * before/after example - so compression can never be silent.
 *
 * Attribution is the third thing it guards: a card either cites a work the
 * audit names, with the same author, year and title, or prints the note saying
 * the source names no originator. No card may invent a citation.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { renderFormula } from "../../decks/copywriting/data/latex.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const INVENTORY = join(ROOT, "decks", "copywriting", "data", "source-inventory.json");
const LAYOUT = join(ROOT, "decks", "copywriting", "data", "layout-map.json");
const AUDIT = join(ROOT, "decks", "copywriting", "data", "attribution-audit.json");
const DECK = join(ROOT, "decks", "copywriting", "deck.json");
const LAWS = join(ROOT, "decks", "copywriting", "data", "laws");
const TOTAL = 48;
const NO_ORIGIN = "The source names no originator.";

const loadInventory = async () => JSON.parse(await readFile(INVENTORY, "utf8"));
const loadDeck = async () => JSON.parse(await readFile(DECK, "utf8"));
const loadCards = async () => {
  const names = (await readdir(LAWS)).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(names.map(async (name) => JSON.parse(await readFile(join(LAWS, name), "utf8"))));
};

const slug = (category) =>
  category
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// One card's own section of an artifact, so a shared sentence elsewhere in the
// file cannot stand in for a missing one.
const section = (text, heading, marker) => {
  const start = text.indexOf(heading);
  assert.ok(start >= 0, `missing heading ${heading}`);
  const next = text.indexOf(`\n${marker} `, start + heading.length);
  return text.slice(start, next < 0 ? text.length : next);
};

const attribution = (origin) =>
  origin.authors ? `${origin.authors.join(" & ")} (${origin.year})` : origin.note;

test("the printed deck is the inventory, record for record", async () => {
  const inventory = await loadInventory();
  const layout = JSON.parse(await readFile(LAYOUT, "utf8"));
  const deck = await loadDeck();
  const cards = await loadCards();
  assert.equal(cards.length, TOTAL, "the deck holds 48 cards");
  assert.equal(deck.fields.cardId, "formulaId", "the front kicker prints the source's formula id");

  const byId = new Map(cards.map((card) => [card.id, card]));
  assert.equal(byId.size, TOTAL, "every card id is unique");
  for (const record of inventory.records) {
    const card = byId.get(record.id);
    assert.ok(card, `${record.id} has no card`);
    assert.equal(card.formulaId, record.formulaId, `${record.id} lost the source's id`);
    assert.notEqual(card.formulaId, card.id, `${record.id} prints the source id, not its deck id`);
    for (const field of ["name", "phase", "surface", "mechanism", "scope", "blueprint"]) {
      assert.deepEqual(card[field], record[field], `${record.id} ${field} is not the source's`);
    }

    // The template: verbatim where the source prints one, and the deck's own
    // sentence - never an invented pattern - where it does not.
    if (record.blueprint) {
      assert.equal(card.template, record.template, `${record.id} template is not verbatim`);
      assert.deepEqual(card.templateLines, record.templateLines, `${record.id} lines are not the source's`);
      assert.equal(card.templateLines.join(" "), card.template, `${record.id} lines do not join to its template`);
      assert.equal(card.noTemplate, undefined, `${record.id} both has a template and says it has none`);
    } else {
      assert.equal(card.template, null, `${record.id} invented a template`);
      assert.equal(card.templateLines, undefined, `${record.id} invented template lines`);
      assert.equal(typeof card.noTemplate, "string", `${record.id} does not say the source prints no template`);
      assert.match(card.noTemplate, /taxonomy row only/, `${record.id} no-template sentence is not the deck's`);
    }

    // The blueprint prose is the source's, through the declared rendering.
    assert.equal(
      card.blueprintProse,
      record.blueprintProse === null ? null : renderFormula(record.blueprintProse),
      `${record.id} blueprint prose changed`
    );
    if (record.blueprint) {
      assert.deepEqual(card.example, record.example, `${record.id} example changed`);
    } else {
      assert.equal(card.example, null, `${record.id} invented an example`);
    }

    // The front line, its size, the printed label and the drawing are the map's.
    const row = layout.map[record.id];
    assert.equal(card.frontSize, row.frontSize, `${record.id} front size disagrees with the map`);
    assert.equal(card.schematic, row.label, `${record.id} schematic disagrees with the map`);
    const ratio = layout.ratios[record.id];
    assert.equal(
      card.frontLine,
      ratio ? ratio.frontLine : record.scope,
      `${record.id} front line is neither its ratio nor its scope`
    );
    assert.deepEqual(card.ratio, ratio ? ratio.pairs : undefined, `${record.id} ratio disagrees with the map`);
    assert.deepEqual(
      card.figure.parametricParams,
      { family: row.family, divisions: row.divisions, mark: row.mark },
      `${record.id} figure disagrees with the map`
    );
  }
});

test("the four surfaces hold twelve cards each, in the taxonomy's order", async () => {
  const inventory = await loadInventory();
  const deck = await loadDeck();
  const cards = await loadCards();
  const phases = {};
  for (const card of cards) phases[card.phase] = (phases[card.phase] || 0) + 1;
  assert.deepEqual(Object.keys(phases), deck.categories, "the surfaces print in the declared order");
  assert.deepEqual(Object.values(phases), [12, 12, 12, 12], "the surfaces are 12/12/12/12");

  // The formula id is the surface prefix and the position in it, so the kicker
  // and the phase cannot disagree.
  const prefixes = ["ST", "HL", "UX", "CR"];
  inventory.records.forEach((record, index) => {
    const card = cards.find((entry) => entry.id === record.id);
    assert.ok(card, `${record.id} is not printed`);
    assert.equal(card.formulaId, record.formulaId);
    assert.equal(card.formulaId.slice(0, 2), prefixes[Math.floor(index / 12)], `${record.id} is not in its surface`);
  });
});

test("the rules and each surface resource carry every card's full record", async () => {
  const deck = await loadDeck();
  const cards = await loadCards();
  const rules = await readFile(join(ROOT, "rules", "copywriting-rules.md"), "utf8");
  const resources = {};
  for (const category of deck.categories) {
    resources[category] = await readFile(
      join(ROOT, "skills", "copywriting", "resources", `${slug(category)}.md`),
      "utf8"
    );
  }

  for (const card of cards) {
    const ruleSection = section(rules, `### ${card.id} — ${card.name}`, "###");
    const skillSection = section(resources[card.phase], `## ${card.id} — ${card.name}`, "##");
    for (const [artifact, text] of [
      ["rules", ruleSection],
      [card.phase, skillSection]
    ]) {
      // The card's own words, then the depth the source gives: the proportions
      // where it states them, the template line for line, the example pair.
      assert.ok(text.includes(card.frontLine), `${card.id} front line is missing from the ${artifact}`);
      assert.ok(text.includes(card.schematic), `${card.id} schematic is missing from the ${artifact}`);
      assert.ok(text.includes(card.mechanism), `${card.id} mechanism is missing from the ${artifact}`);
      assert.ok(text.includes(card.surface), `${card.id} deployment is missing from the ${artifact}`);
      if (card.blueprint) {
        for (const line of card.templateLines) {
          assert.ok(text.includes(line), `${card.id} template line is missing from the ${artifact}`);
        }
        assert.ok(text.includes(card.blueprintProse), `${card.id} blueprint prose is missing from the ${artifact}`);
        assert.ok(text.includes(card.example.bland), `${card.id} bland example is missing from the ${artifact}`);
        assert.ok(text.includes(card.example.optimized), `${card.id} optimized example is missing from the ${artifact}`);
      } else {
        assert.ok(text.includes(card.noTemplate), `${card.id} no-template sentence is missing from the ${artifact}`);
        assert.ok(!text.includes("**Template.**\n\n\n"), `${card.id} printed an empty template heading`);
      }
      assert.ok(
        text.includes(attribution(card.origin)),
        `${card.id} attribution is missing from the ${artifact}`
      );
    }
  }
});

test("the web bundle carries every card and prints the formula id", async () => {
  const cards = await loadCards();
  const bundle = await readFile(join(ROOT, "packages", "web", "decks", "copywriting", "deck-data.js"), "utf8");
  const page = await readFile(join(ROOT, "packages", "web", "decks", "copywriting", "index.html"), "utf8");
  assert.equal([...bundle.matchAll(/"id":\s*"CPY-\d\d"/g)].length, TOTAL, "the bundle holds every card");
  assert.ok(page.includes('"cardId":"formulaId"'), "the viewer does not print the source id");
  for (const card of cards) {
    assert.ok(bundle.includes(JSON.stringify(card.name)), `${card.id} name is missing from the bundle`);
    assert.ok(bundle.includes(JSON.stringify(card.mechanism)), `${card.id} mechanism is missing from the bundle`);
    if (card.blueprint) {
      for (const line of card.templateLines) {
        assert.ok(bundle.includes(JSON.stringify(line)), `${card.id} template line is missing from the bundle`);
      }
    } else {
      assert.ok(bundle.includes(JSON.stringify(card.noTemplate)), `${card.id} no-template sentence is missing from the bundle`);
    }
  }
});

test("every attribution is a checked work or the honest note", async () => {
  const cards = await loadCards();
  const audit = JSON.parse(await readFile(AUDIT, "utf8"));
  const cited = new Map(
    audit.candidates
      .filter((candidate) => candidate.verdict === "cited")
      .map((candidate) => [candidate.formulaId, candidate])
  );
  assert.equal(cited.size, 6, "six formulas cite a work");

  let noted = 0;
  for (const card of cards) {
    if (cited.has(card.formulaId)) {
      const entry = cited.get(card.formulaId);
      assert.ok(card.origin.authors, `${card.id} is cited but names no author`);
      assert.ok(
        entry.origin.includes(card.origin.authors[0]) && entry.origin.includes(String(card.origin.year)),
        `${card.id} citation disagrees with the audit: ${entry.origin}`
      );
      assert.match(card.origin.note, /^Checked \d{4}-\d{2}-\d{2}/, `${card.id} has no dated check note`);
    } else {
      assert.deepEqual(card.origin, { note: NO_ORIGIN }, `${card.id} names an originator the audit does not`);
      noted += 1;
    }
  }
  assert.equal(noted, TOTAL - cited.size, "the note count is the cards the audit does not cite");
  assert.equal(audit.counts.cited, cited.size, "the audit's cited count is stale");
  assert.equal(audit.counts.noOriginator, noted, "the audit's note count is stale");
  assert.equal(audit.counts.total, TOTAL, "the audit's total is stale");
});
