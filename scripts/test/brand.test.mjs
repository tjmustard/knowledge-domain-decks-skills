/*
 * The brand deck's own contract, beyond the generic engine checks.
 *
 * The forty-two frameworks are an extraction, not a retyping: the committed
 * inventory is the authority for every name, diagnostic, pedigree, artifact and
 * anti-pattern, and no test may read the read-only research folder. Two things
 * were settled before a single card was drawn, and both are asserted here. The
 * layout map fixes every card's schematic family and the two numbers the figure
 * prints, so a drawing cannot disagree with its own caption. And the declared
 * rendering table in data/render.mjs is the only way the source's escaped
 * markdown reaches a record: the records are exactly its output, and no printed
 * field keeps a backslash, a brace or a macro.
 *
 * Attribution has two tiers and no third. A framework's originator prints the
 * line the source's own pedigree gives - a person, pair, agency, standards
 * group, named project or named practice, with the year the source gives and no
 * work title added. Where the source names nobody, the card says so. The schema
 * has no author, year, title or publication property to fill, which is the
 * structural half of the same rule.
 *
 * One redaction is recorded: card 30's pedigree carries an appositive naming
 * the commercial card deck this source is built around, and that appositive is
 * the only text the deck removes. The two names - the commercial deck's and the
 * source folder's - may appear in no artifact, and this file assembles them
 * from fragments so the guard does not carry the names it forbids.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { citationText, loadCards, loadDeck, sourceLine, sourceShort } from "../../packages/core/deck.mjs";
import { renderText } from "../../decks/brand/data/render.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const DATA = join(ROOT, "decks", "brand", "data");
const INVENTORY = join(DATA, "source-inventory.json");
const LAYOUT = join(DATA, "layout-map.json");
const SCHEMA = join(DATA, "law-schema.json");
const TOTAL = 42;

// The source splits into four pillars of 11/10/11/10, in section order.
const PILLAR_COUNTS = [11, 10, 11, 10];

// The committed layout map is the authority for the family and its two numbers;
// the SPEC's eleven-family proposal is what the counts below reproduce after
// the two declared checkpoint-two changes: BRA-18 is a ledger (four definition
// columns, not a continuum) and BRA-22's centre is ring 3 under the rings rule.
const FAMILY_COUNTS = {
  ledger: 9,
  matrix: 6,
  axes: 5,
  score: 5,
  arc: 5,
  tiers: 3,
  manifest: 3,
  facets: 2,
  rings: 2,
  statement: 1,
  network: 1
};

const UNIT = {
  ledger: "part",
  matrix: "cell",
  axes: "axis",
  score: "dimension",
  arc: "stage",
  tiers: "level",
  manifest: "key",
  facets: "facet",
  rings: "ring",
  statement: "clause",
  network: "node"
};

const FAMILY_LABEL = {
  Ledger: "ledger",
  Matrix: "matrix",
  Axes: "axes",
  Score: "score",
  Arc: "arc",
  Tiers: "tiers",
  Manifest: "manifest",
  Facets: "facets",
  Rings: "rings",
  Statement: "statement",
  Network: "network"
};

const NO_ORIGIN = "The source names no originator.";
const HONEST = ["BRA-18", "BRA-19", "BRA-23"];

// The front's size is fixed by the question's measured length. The bound is on
// the record's own diagnostic, so changing the text without changing the size
// fails here rather than in the print fit.
const sizeFor = (length) => (length <= 115 ? 9 : length <= 135 ? 8.5 : length <= 165 ? 8 : 7.5);

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

// The two names the SPEC keeps out of every artifact, assembled from fragments
// and matched case-insensitively because the source's footnote URLs carry
// lowercase slugs of both.
const FORBIDDEN = [["Pip", "Decks"].join(" "), ["Brand", "Tactics"].join(" ")].map((name) => name.toLowerCase());

test("the deck is forty-two records in four pillars of 11/10/11/10", async () => {
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  assert.equal(inventory.cards.length, TOTAL, "the inventory holds 42 cards");

  const deck = await loadDeck("brand");
  assert.equal(deck.name, "Brand Architecture");
  assert.equal(deck.slug, "brand");
  assert.equal(deck.categories.length, 4, "four pillars");

  const cards = await loadCards(deck);
  assert.equal(cards.length, TOTAL, "every card is committed");
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length, "ids are unique");

  const seen = {};
  for (const card of cards) seen[card.pillar] = (seen[card.pillar] || 0) + 1;
  assert.deepEqual(Object.values(seen), PILLAR_COUNTS, "the source splits into 11/10/11/10");
  for (const category of Object.keys(seen)) {
    assert.ok(deck.categories.includes(category), `${category} is not a declared category`);
  }

  for (const card of cards) {
    assert.equal(card.id, `BRA-${String(card.sourceCardNo).padStart(2, "0")}`, `${card.id} id and source number`);
    assert.equal(Number(card.id.slice(4)), card.sourceCardNo, `${card.id} id number is the source's card number`);
  }
  // The kicker is the short pillar name the front prints, in pillar order.
  assert.deepEqual([...new Set(cards.map((card) => card.kicker))], ["Positioning", "Personality", "Narrative", "Assets"]);
});

test("every record is the committed inventory's text after the declared rendering", async () => {
  const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
  const cards = await loadCards(await loadDeck("brand"));
  const rows = new Map(inventory.cards.map((row) => [row.id, row]));
  assert.equal(cards.length, rows.size, "the record set and the inventory have the same size");
  assert.equal(
    inventory.sourceSha256,
    "10b84d490f8e8b4427c2b8b4c77f6401b3b2424460859b018df11040a439314d",
    "the inventory records the source this deck was built from"
  );
  assert.equal(inventory.sourceBytes, 57860, "the source's measured size");

  for (const card of cards) {
    const row = rows.get(card.id);
    assert.ok(row, `${card.id} is not in the inventory`);
    assert.equal(card.sourceCardNo, row.n, `${card.id} source card number`);
    assert.equal(card.pillar, row.pillar, `${card.id} pillar`);
    assert.equal(card.kicker, row.kicker, `${card.id} kicker`);
    for (const field of ["name", "diagnostic", "trap", "pedigreeFull", "artifactFull", "trapFull"]) {
      assert.equal(card[field], renderText(row[field]), `${card.id} ${field} is the source's text, rendered`);
    }
    assert.deepEqual(
      card.artifact,
      row.artifact.map((line) => renderText(line)),
      `${card.id} artifact is the source's lines, rendered`
    );
    assert.equal(card.origin.line, row.origin.line && renderText(row.origin.line), `${card.id} origin line`);
    assert.equal(card.origin.note, row.origin.note, `${card.id} origin note`);
    if (row.sourceNote) {
      assert.equal(card.sourceNote, renderText(row.sourceNote), `${card.id} source note`);
    }
  }
});

test("no printed field carries a macro or an escape after rendering", async () => {
  // The residue check does not ask the rendering table whether it did its job:
  // it looks for the two characters a LaTeX macro or a markdown escape leaves
  // behind. A field that kept either would print as source code on a card.
  const cards = await loadCards(await loadDeck("brand"));
  for (const card of cards) {
    const fields = [
      ["name", card.name],
      ["diagnostic", card.diagnostic],
      ["trap", card.trap],
      ["pedigreeFull", card.pedigreeFull],
      ["artifactFull", card.artifactFull],
      ["trapFull", card.trapFull],
      ["origin", card.origin.line || ""],
      ...(card.sourceNote ? [["sourceNote", card.sourceNote]] : []),
      ...card.artifact.map((line, index) => [`artifact[${index}]`, line])
    ];
    for (const [field, value] of fields) {
      const residue = String(value).match(/[\\{}]/);
      assert.equal(residue, null, `${card.id}.${field} keeps ${JSON.stringify(residue && residue[0])}`);
    }
  }
});

test("every schematic line agrees with its figure and its layout row", async () => {
  const layout = JSON.parse(await readFile(LAYOUT, "utf8"));
  const cards = await loadCards(await loadDeck("brand"));
  const counts = {};
  for (const card of cards) {
    const row = layout.map[card.id];
    assert.ok(row, `${card.id} has no layout-map row`);
    const params = card.figure.parametricParams;
    assert.equal(card.figure.svgShape, "brand-figure", `${card.id} figure shape`);
    assert.equal(params.family, row.family, `${card.id} family follows the layout map`);
    assert.equal(params.divisions, row.divisions, `${card.id} divisions follow the layout map`);
    assert.equal(params.mark, row.mark, `${card.id} mark follows the layout map`);
    assert.ok(params.mark >= 1 && params.mark <= params.divisions, `${card.id} mark is one of its parts`);
    assert.equal(card.schematic, row.label, `${card.id} prints the layout map's own line`);
    assert.equal(card.diagnosticSize, row.diagnosticSize, `${card.id} front size follows the layout map`);
    assert.equal(card.diagnosticSize, sizeFor(card.diagnostic.length), `${card.id} size follows its question's measured length`);

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
  assert.deepEqual(counts, FAMILY_COUNTS, "the eleven figure families carry the counts the map declares");
});

test("the rings rule holds: ring 1 is the outer edge and the marked ring is the one listed", async () => {
  // The one geometric exception to "the mark is the artifact's listed
  // position": BRA-08 lists its centre fifth and BRA-22 lists Why first, and
  // the figure numbers both from the outer edge inward. Both cards mark their
  // centre, so both marks equal their divisions; a change to either without the
  // other would make one drawing claim the wrong ring.
  const layout = JSON.parse(await readFile(LAYOUT, "utf8"));
  const rings = Object.entries(layout.map).filter(([, row]) => row.family === "rings");
  assert.deepEqual(rings.map(([id]) => id), ["BRA-08", "BRA-22"], "two cards are concentric rings");
  for (const [id, row] of rings) {
    assert.equal(row.mark, row.divisions, `${id} marks its centre, which is its last ring`);
    assert.ok(layout.numbering.includes("outer edge inward"), "the map declares the rings numbering");
  }
});

test("every figure's numbers are anchored in the card's own text", async () => {
  // A figure drawn from nothing is decoration. Each layout row names the field
  // its family and numbers come from and quotes the words they encode; the
  // quote must be present in that field of the record as printed, so a later
  // edit to the card's text breaks the test rather than silently orphaning the
  // drawing.
  const layout = JSON.parse(await readFile(LAYOUT, "utf8"));
  const cards = await loadCards(await loadDeck("brand"));
  const byId = new Map(cards.map((card) => [card.id, card]));
  for (const [id, row] of Object.entries(layout.map)) {
    const card = byId.get(id);
    assert.ok(row.basis && row.basis.field && row.basis.quote, `${id} layout row names its basis`);
    const value = card[row.basis.field];
    const text = Array.isArray(value)
      ? value.map((entry) => (entry && entry.text) || entry).join("\n")
      : String(value);
    assert.ok(text.includes(row.basis.quote), `${id} figure basis "${row.basis.quote}" is not in its ${row.basis.field}`);
  }
});

test("attribution has two tiers and no third", async () => {
  const cards = await loadCards(await loadDeck("brand"));
  const named = cards.filter((card) => card.origin.line);
  const honest = cards.filter((card) => card.origin.note);
  assert.equal(named.length, 39, "thirty-nine lines name the source's own originator");
  assert.equal(honest.length, 3, "three say the source names nobody");
  assert.equal(named.length + honest.length, TOTAL);
  assert.deepEqual(honest.map((card) => card.id), HONEST, "the three honest cards are the recorded ones");
  for (const card of honest) assert.equal(card.origin.note, NO_ORIGIN, `${card.id} honest line`);
  for (const card of named) {
    assert.deepEqual(Object.keys(card.origin), ["line"], `${card.id} carries the line and nothing else`);
    assert.equal(card.origin.line, card.origin.line.trim(), `${card.id} line has no padding`);
    // No work title: the source italicises its titles, so a carried title would
    // bring the markdown emphasis with it. The year stays as the source gives
    // it, including a decade ("1990s") or a version ("2025.10").
    assert.ok(!card.origin.line.includes("*"), `${card.id} line carries a work title`);
    assert.ok(!/["“”]/.test(card.origin.line), `${card.id} line carries a quoted title`);
  }

  // The line is what all three surfaces print, unjoined.
  for (const card of named) {
    assert.equal(sourceShort(card.origin), card.origin.line, `${card.id} short source is the line`);
    assert.equal(sourceLine(card.origin), card.origin.line, `${card.id} rules source is the line`);
    assert.equal(citationText(card.origin), card.origin.line, `${card.id} card citation is the line`);
  }
  for (const card of honest) {
    assert.equal(sourceShort(card.origin), NO_ORIGIN, `${card.id} short source is the honest line`);
    assert.equal(citationText(card.origin), NO_ORIGIN, `${card.id} card citation is the honest line`);
  }

  // The schema is the structural half: with no author, year, title or
  // publication property declared, a record cannot acquire one and validate.
  const schema = JSON.parse(readFileSync(SCHEMA, "utf8"));
  const origin = schema.properties.origin;
  assert.deepEqual(Object.keys(origin.properties).sort(), ["line", "note"]);
});

test("card 30's redaction is the only text the deck removes", async () => {
  // The inventory is the authority for the source's text, and the previous test
  // proves every record is exactly its rendered output: no artifact adds or
  // drops a character relative to the inventory. This one states the other
  // half - that the one place the inventory itself departs from the source is
  // card 30's appositive, that it is recorded, and that neither name survives
  // anywhere the deck ships.
  const cards = await loadCards(await loadDeck("brand"));
  const card = cards.find((entry) => entry.id === "BRA-30");
  assert.ok(card, "card 30 is committed");
  for (const name of FORBIDDEN) {
    assert.ok(!card.pedigreeFull.toLowerCase().includes(name), "card 30's pedigree still names the commercial deck");
  }
  assert.ok(card.pedigreeFull.includes("Alex M. H. Smith"), "the rest of card 30's pedigree prints");
  assert.ok(card.pedigreeFull.includes("2020"), "with the year the source gives");
  assert.ok(card.sourceNote, "card 30 carries the note that records the redaction");
  assert.ok(/only text/i.test(card.sourceNote), "the note says the appositive is the only text removed");
  assert.deepEqual(
    cards.filter((entry) => entry.sourceNote).map((entry) => entry.id),
    ["BRA-21", "BRA-24", "BRA-25", "BRA-30", "BRA-35", "BRA-42"],
    "six cards carry a recorded source note, and card 30 is one"
  );

  // The guard itself: assembled fragments, matched case-insensitively, because
  // the source's footnote URLs carry lowercase slugs of both names.
  assert.ok(FORBIDDEN.every((name) => name === name.toLowerCase() && name.length > 4), "the guard's names are real");
  const probe = `[${FORBIDDEN[0].toUpperCase()}]`;
  assert.ok(FORBIDDEN.some((name) => probe.toLowerCase().includes(name)), "the guard sees an upper-case occurrence");

  const files = [
    ...walk(join(ROOT, "decks", "brand")),
    join(ROOT, "rules", "brand-rules.md"),
    ...walk(join(ROOT, "skills", "brand")),
    ...walk(join(ROOT, "packages", "web", "decks", "brand")),
    join(ROOT, "packages", "web", "index.html")
  ];
  assert.ok(files.length > TOTAL, `walked ${files.length} artifact files`);
  for (const file of files) {
    const text = readFileSync(file, "utf8").toLowerCase();
    for (const name of FORBIDDEN) {
      // Counted, not line-matched: footnote 5 carries the commercial name twice
      // on one line, so a line count would read 3 where the occurrences are 4.
      const occurrences = text.split(name).length - 1;
      assert.equal(occurrences, 0, `${file.slice(ROOT.length + 1)} names the forbidden string ${occurrences} time(s)`);
    }
  }
});

test("card 21's semiotic notation prints literally", async () => {
  const card = record("BRA-21");
  // The source writes the four corners in escaped LaTeX; the rendering table
  // drops the math-mode delimiters and keeps the source's spacing.
  assert.ok(card.artifactFull.includes("~ S1"), "the full block keeps the source's '~ S1'");
  assert.ok(card.artifactFull.includes("~ S2"), "the full block keeps the source's '~ S2'");
  assert.ok(card.artifact.join(" ").includes("Contradictory (~ S1)"), "the card prints the same notation");
  assert.ok(card.sourceNote.includes("rendering table"), "the note records how the notation was restored");
  for (const token of ["S1", "S2", "~ S1", "~ S2"]) {
    assert.ok(card.artifact.join(" ").includes(token), `card 21 prints ${token}`);
  }
});

test("rules and pillar resources carry the source unabridged, card by card", async () => {
  const cards = await loadCards(await loadDeck("brand"));
  const rules = await readFile(join(ROOT, "rules", "brand-rules.md"), "utf8");
  const resources = {};
  for (const pillar of new Set(cards.map((card) => card.pillar))) {
    resources[pillar] = await readFile(
      join(ROOT, "skills", "brand", "resources", `${categorySlug(pillar)}.md`),
      "utf8"
    );
  }

  for (const card of cards) {
    const ruleSection = section(rules, `### ${card.id} — ${card.name}`, "###");
    const skillSection = section(resources[card.pillar], `## ${card.id} — ${card.name}`, "##");
    for (const [where, text] of [
      ["rules", ruleSection],
      ["skill resource", skillSection]
    ]) {
      for (const field of ["pedigreeFull", "artifactFull", "trapFull"]) {
        assert.ok(text.includes(card[field]), `${card.id} ${field} is missing from the ${where}`);
      }
      if (card.sourceNote) {
        assert.ok(text.includes(card.sourceNote), `${card.id} source note is missing from the ${where}`);
      }
    }
    assert.ok(ruleSection.includes(card.origin.line || card.origin.note), `${card.id} source line in the rules`);
    assert.ok(skillSection.includes(card.origin.line || card.origin.note), `${card.id} source line in the resource`);
  }
});

test("a short artifact or trap states no number its source block does not", async () => {
  // The compression rule is on the rules file: drop explanation, never add a
  // claim, change a number or omit a stated bound. A digit run in a short form
  // must occur in the block it was compressed from; comparing the two blocks
  // separately, not their union, is what stops a number migrating between them.
  const cards = await loadCards(await loadDeck("brand"));
  for (const card of cards) {
    const artifact = new Set(numbers(card.artifactFull));
    for (const figure of numbers(card.artifact.join(" "))) {
      assert.ok(artifact.has(figure), `${card.id} artifact states ${figure}, which its full artifact never states`);
    }
    const trap = new Set(numbers(card.trapFull));
    for (const figure of numbers(card.trap)) {
      assert.ok(trap.has(figure), `${card.id} trap states ${figure}, which its full trap never states`);
    }
    assert.ok(card.artifact.length >= 1 && card.artifact.length <= 6, `${card.id} artifact is 1 to 6 lines`);
  }
  // BRA-21's artifact is the source's own prose, so it prints the block entire.
  assert.equal(record("BRA-21").artifact.join(" "), record("BRA-21").artifactFull);
});

test("no test of this deck reads the read-only research folder", () => {
  // The folder's name is assembled here for the same reason as the names above:
  // the guard does not carry the string it forbids. This file's own literals are
  // fragments, so a walk over its own source finds no whole occurrence. The
  // claim is about this deck: the archetypes deck's test does read the folder,
  // and that is a separate finding, not something this deck's guard can fix.
  const folder = ["Supporting", "Information"].join("");
  const files = [join(ROOT, "scripts", "test", "brand.test.mjs"), ...walk(join(ROOT, "decks", "brand"))];
  for (const file of files) {
    if (!file.endsWith(".mjs") && !file.endsWith(".json")) continue;
    assert.ok(!readFileSync(file, "utf8").includes(folder), `${file.slice(ROOT.length + 1)} reads the read-only folder`);
  }
});
