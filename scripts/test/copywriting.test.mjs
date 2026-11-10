/*
 * The copy deck's inventory contract, from the first commit.
 *
 * The forty-eight formulas are an extraction, not a retyping: the committed
 * inventory is the authority for every record, and no test may read the
 * read-only research folder (DECISIONS 46). This source is tiered, and the deck
 * ships both tiers: 22 blueprints and 26 taxonomy rows, with nothing filled in
 * for the latter. Every measured claim in the inventory - the counts, the field
 * ranges, the ratio count - is recomputed here from the records it describes,
 * and the eleven recorded source defects are asserted to be carried rather than
 * repaired away. CR-02's formula is LaTeX, so the declared rendering table is
 * held to its cases and the printed-form guard is falsified before it is
 * trusted.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LATEX_TABLE, latexResidue, renderFormula } from "../../decks/copywriting/data/latex.mjs";

const ROOT = join(import.meta.dirname, "..", "..");
const INVENTORY = join(ROOT, "decks", "copywriting", "data", "source-inventory.json");
const LAYOUT = join(ROOT, "decks", "copywriting", "data", "layout-map.json");
const TOTAL = 48;

const loadInventory = async () => JSON.parse(await readFile(INVENTORY, "utf8"));

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  // The inventory records the upper middle value for an even sample, and its
  // note says so; deck nine's inventory recorded the lower middle.
  return sorted[Math.floor(sorted.length / 2)];
};

const stats = (values) => ({
  n: values.length,
  min: Math.min(...values),
  median: median(values),
  max: Math.max(...values)
});

// A ratio pair is a claim about one component: its label and its percent must
// stand in the same sentence of the prose. Presence somewhere in the paragraph
// is not pairing - two percentages swapped between clauses would pass it, and
// AIDA would print the wrong proportions while the suite called it correct.
const sentences = (text) => text.split(/(?<=[.!?])\s+/);
const pairSentence = (prose, pair) =>
  sentences(prose).find(
    (sentence) =>
      sentence.toLowerCase().includes(pair.label.toLowerCase()) &&
      new RegExp(`${pair.percent}\\s*%`).test(sentence)
  ) || null;

test("the inventory holds forty-eight formulas in four surfaces of twelve", async () => {
  const inventory = await loadInventory();
  assert.equal(inventory.records.length, TOTAL, "the inventory holds 48 formulas");

  const prefixes = ["ST", "HL", "UX", "CR"];
  inventory.records.forEach((record, index) => {
    assert.equal(record.id, `CPY-${String(index + 1).padStart(2, "0")}`, "the id is the taxonomy position");
    const expected = `${prefixes[Math.floor(index / 12)]}-${String((index % 12) + 1).padStart(2, "0")}`;
    assert.equal(record.formulaId, expected, `record ${index + 1} is out of taxonomy order`);
  });

  const phases = {};
  for (const record of inventory.records) phases[record.phase] = (phases[record.phase] || 0) + 1;
  assert.deepEqual(
    phases,
    {
      "Structural Formulas": 12,
      "Headlines & Hooks": 12,
      "Product Microcopy": 12,
      "Clarity & Rhythm": 12
    },
    "the surfaces are 12/12/12/12"
  );
  assert.deepEqual(
    inventory.counts.byPrefix,
    { ST: 12, HL: 12, UX: 12, CR: 12 },
    "the declared prefix split matches the records"
  );

  // The tier is the source's shape: 22 full blueprints and 26 taxonomy rows.
  const blueprints = inventory.records.filter((record) => record.blueprint);
  assert.equal(blueprints.length, 22, "22 blueprints");
  assert.equal(inventory.counts.blueprints, 22, "the declared blueprint count matches");
  assert.equal(inventory.counts.noBlueprint, 26, "26 taxonomy-only formulas");
  for (const record of inventory.records) {
    assert.equal(record.template !== null, record.blueprint, `${record.formulaId} tier disagrees with its template`);
    assert.equal(record.blueprintProse !== null, record.blueprint, `${record.formulaId} prose disagrees with its tier`);
    if (record.blueprint) {
      assert.ok(
        record.example && record.example.bland && record.example.optimized,
        `${record.formulaId} blueprint has no before/after example`
      );
    } else {
      assert.deepEqual(record.example, [], `${record.formulaId} taxonomy-only record carries an example`);
    }
  }
});

test("every measured claim in the inventory is derived from its records", async () => {
  const inventory = await loadInventory();
  const records = inventory.records;
  const measure = {
    name: () => records.map((record) => record.name.length),
    mechanism: () => records.map((record) => record.mechanism.length),
    scope: () => records.map((record) => record.scope.length),
    blueprintProse: () =>
      records.filter((record) => record.blueprint).map((record) => record.blueprintProse.length),
    template: () =>
      records.filter((record) => record.blueprint).map((record) => record.template.length),
    exampleOptimized: () =>
      records.filter((record) => record.blueprint).map((record) => record.exampleOptimizedLen)
  };
  assert.deepEqual(
    Object.keys(inventory.lengths).sort(),
    Object.keys(measure).sort(),
    "the summary measures exactly the fields it claims"
  );
  for (const [field, pick] of Object.entries(measure)) {
    assert.deepEqual(inventory.lengths[field], stats(pick()), `${field} summary is stale`);
  }

  const byPrefix = {};
  for (const record of records) {
    const prefix = record.formulaId.slice(0, 2);
    byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
  }
  assert.deepEqual(byPrefix, inventory.counts.byPrefix, "the prefix count is derived");
  assert.equal(inventory.counts.records, records.length, "the record count is derived");
});

test("the ratio count is measured from the blueprint prose, not assumed", async () => {
  // The front prints a ratio line only where the prose states component
  // percentages. The count was measured at the checkpoint (the dispatcher's eye
  // said about sixteen); the prose says seventeen, and the prose is the record.
  const inventory = await loadInventory();
  const states = (record) => record.blueprint && /\d{1,3}\s*%/.test(record.blueprintProse);
  const measured = inventory.records.filter(states).map((record) => record.formulaId);
  assert.equal(measured.length, 17, "seventeen blueprints state percentages");
  assert.deepEqual(inventory.ratios.ids, measured, "the recorded ratio ids are the measured ones");
  assert.equal(inventory.ratios.cards, measured.length, "the recorded ratio count is derived");

  // The five blueprints that state none, and all 26 taxonomy-only records,
  // print their scope line instead.
  const without = inventory.records
    .filter((record) => record.blueprint && !states(record))
    .map((record) => record.formulaId);
  assert.deepEqual(without, ["CR-01", "CR-02", "CR-03", "CR-04", "CR-05"], "the ratio line is absent exactly where the prose is");
});

test("the eleven recorded source defects are carried, not repaired away", async () => {
  const inventory = await loadInventory();
  const defects = inventory.sourceDefects;
  assert.equal(defects.length, 11, "eleven defects are recorded");
  const kinds = defects.map((defect) => defect.kind);
  for (const kind of [
    "italic formula id",
    "template emitted as heading",
    "template written as HTML comment",
    "glued example table",
    "span artifact in template",
    "LaTeX formula in prose"
  ]) {
    assert.ok(kinds.includes(kind), `the defect "${kind}" is not recorded`);
  }

  const byFormula = new Map(inventory.records.map((record) => [record.formulaId, record]));

  // The italic row prints its id as the source writes it.
  assert.ok(byFormula.has("CR-08"), "CR-08 is a record");

  // Five templates arrived as markdown headings; the text is the template and
  // the hash was markup.
  for (const id of ["ST-01", "ST-02", "ST-04", "UX-01", "UX-03"]) {
    assert.ok(!byFormula.get(id).template.startsWith("#"), `${id} kept its heading marker`);
  }
  // Two arrived wrapped in an HTML comment; the instruction was unwrapped.
  for (const id of ["CR-01", "CR-02"]) {
    const template = byFormula.get(id).template;
    assert.ok(!template.includes("<!--") && !template.includes("-->"), `${id} kept its comment markup`);
  }
  // HL-03's glued table parsed into two example cells.
  const hl3 = byFormula.get("HL-03").example;
  assert.ok(hl3 && hl3.bland && hl3.optimized, "HL-03's example cells parsed");

  // The extraction markers were stripped after unescaping, and none survives.
  for (const record of inventory.records) {
    const text = JSON.stringify(record);
    assert.ok(!/\[span_\d+\]|\(start_span\)|\(end_span\)/.test(text), `${record.formulaId} keeps a span marker`);
  }

  // CR-02's formula is still LaTeX in the source record; the deck renders it
  // through the declared table when it prints.
  assert.match(byFormula.get("CR-02").blueprintProse, /\\frac\{/, "CR-02's formula is LaTeX in the source");
});

test("the declared table renders the formula and the guard fails on residue", () => {
  // The table's cases, exactly as declared.
  assert.equal(
    renderFormula("\\left[ \\frac{\\text{total words}}{\\text{total sentences}} \\right]"),
    "[ total words ÷ total sentences ]"
  );
  assert.equal(renderFormula("Fog \\= 0.4"), "Fog = 0.4");
  assert.equal(renderFormula("\\left( a \\right)"), "( a )");

  // The guard is a real guard: it names the character it catches.
  assert.equal(latexResidue("plain words"), null);
  assert.equal(latexResidue("\\frac{a}{b}"), "\\");
  assert.equal(latexResidue("{a}"), "{");

  // Every declared rule is in the table, so a rule cannot be added to the
  // renderer and left out of the declaration.
  const declared = LATEX_TABLE.map((rule) => rule.from);
  for (const token of ["\\left[", "\\right]", "\\left(", "\\right)", "\\="]) {
    assert.ok(declared.includes(token), `${token} is not declared`);
  }
});

// Build the copy deck into a scratch tree and count the template lines that
// actually printed: the card template emits one metadata record per printed
// line, naming the card it belongs to. A deck whose template block prints the
// joined string emits none, which is the falsification below.
const printedTemplateLines = async (dir, style) => {
  const decksDir = join(dir, `decks-${style}`);
  const deckDir = join(decksDir, "copywriting");
  await cp(join(ROOT, "decks", "copywriting"), deckDir, { recursive: true });
  const deck = JSON.parse(await readFile(join(deckDir, "deck.json"), "utf8"));
  deck.outputs.pdf = join(dir, `out-${style}`, "copywriting.pdf");
  for (const block of deck.blocks) {
    if (block.field === "templateLines" || block.field === "template") {
      block.field = style === "lines" ? "templateLines" : "template";
      block.style = style;
    }
  }
  await writeFile(join(deckDir, "deck.json"), JSON.stringify(deck, null, 2) + "\n");

  const build = join(dir, `build-${style}`);
  const built = spawnSync(
    process.execPath,
    ["packages/prepress/build.mjs", "--decks-dir", decksDir, "--deck", "copywriting", "--build-dir", build],
    { cwd: ROOT, encoding: "utf8", timeout: 300_000 }
  );
  assert.equal(built.status, 0, `${built.stdout || ""}\n${built.stderr || ""}`.trim());

  const compileRoot = join(dir, `compile-${style}`);
  await cp(join(ROOT, "packages", "prepress", "src"), join(compileRoot, "src"), { recursive: true });
  await symlink(build, join(compileRoot, "build"), "dir");
  const queried = spawnSync(
    "typst",
    ["query", "--root", ".", "--format", "json", "src/card.typ", "<block-line>"],
    { cwd: compileRoot, encoding: "utf8", timeout: 300_000 }
  );
  assert.equal(queried.status, 0, `${queried.stdout || ""}\n${queried.stderr || ""}`.trim());
  const lines = {};
  for (const item of JSON.parse(queried.stdout)) {
    (lines[item.value.card] ||= []).push(item.value.line);
  }
  return lines;
};

test("a card prints its template as exactly its templateLines, one per line", async (t) => {
  const typst = spawnSync("typst", ["--version"], { encoding: "utf8" });
  if (typst.error || typst.status !== 0) {
    t.diagnostic("Typst is absent, so the printed template lines were not counted");
    return;
  }
  const dir = await mkdtemp(join(tmpdir(), "copy-template-lines-"));
  try {
    const inventory = await loadInventory();
    const cards = new Map();
    for (const record of inventory.records) {
      const card = JSON.parse(
        await readFile(join(ROOT, "decks", "copywriting", "data", "laws", `${record.id.toLowerCase()}.json`), "utf8")
      );
      cards.set(record.id, card);
    }

    const printed = await printedTemplateLines(dir, "lines");
    const blueprints = inventory.records.filter((record) => record.blueprint);
    assert.equal(Object.keys(printed).length, blueprints.length, "every blueprint printed its template");
    for (const record of blueprints) {
      assert.deepEqual(
        printed[record.id],
        cards.get(record.id).templateLines,
        `${record.id} printed a different set of lines than its record`
      );
    }
    // A taxonomy-only card has no template lines to print: its sentence stands
    // under the same heading instead, so nothing is flattened and nothing is
    // invented.
    for (const record of inventory.records.filter((entry) => !entry.blueprint)) {
      assert.equal(printed[record.id], undefined, `${record.id} printed template lines it does not have`);
      assert.ok(cards.get(record.id).noTemplate, `${record.id} has no no-template sentence`);
    }
    // The cards whose source is a list of parts print one line per part.
    assert.equal(printed["CPY-01"].length, 6, "AIDA prints its six parts");
    assert.equal(printed["CPY-04"].length, 5, "QUEST prints its five stages");
    assert.equal(printed["CPY-27"].length, 3, "the blank-state guidance prints its three lines");

    // The falsification: the same deck with the block printing the joined
    // string emits no template lines at all, so the rule above cannot pass a
    // flattened template.
    const flattened = await printedTemplateLines(dir, "prose");
    assert.equal(flattened["CPY-04"], undefined, "the joined run printed template lines");
    for (const record of blueprints) {
      assert.equal(
        flattened[record.id],
        undefined,
        `${record.id} would pass the line rule with its template flattened`
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the ratio pairing rule fails a ratio whose percentages are swapped", async () => {
  // The falsification the dispatcher asked for: swap AIDA's Attention and
  // Desire shares, update the front line to match, and the pairing rule must
  // still fail. A rule that only checks presence would pass this.
  const inventory = await loadInventory();
  const layout = JSON.parse(await readFile(LAYOUT, "utf8"));
  const record = inventory.records.find((entry) => entry.formulaId === "ST-01");
  const ratio = layout.ratios[record.id];
  assert.ok(ratio, "AIDA has an extracted ratio");

  for (const pair of ratio.pairs) {
    assert.ok(pairSentence(record.blueprintProse, pair), `AIDA pairs "${pair.label} ${pair.percent}"`);
  }

  const swapped = ratio.pairs.map((pair) =>
    pair.label === "Attention"
      ? { ...pair, percent: 40 }
      : pair.label === "Desire"
        ? { ...pair, percent: 15 }
        : pair
  );
  assert.equal(
    swapped.map((pair) => `${pair.label} ${pair.percent}`).join(" · "),
    "Attention 40 · Interest 30 · Desire 15 · Action 15",
    "the swapped front line is updated to match the swapped pairs"
  );
  assert.deepEqual(
    swapped.filter((pair) => !pairSentence(record.blueprintProse, pair)).map((pair) => pair.label),
    ["Attention", "Desire"],
    "the swapped pair must fail the same-sentence rule"
  );
});

test("every figure follows the committed layout map and names what it draws", async () => {
  // Deck nine's last figure defect was a map that filed rows by topic; the rule
  // is that a row's quoted datum must carry the family's own stem. The count of
  // ratio cards is the prose's, and the front line is the ratio where the prose
  // states one, the scope line otherwise.
  const inventory = await loadInventory();
  const layout = JSON.parse(await readFile(LAYOUT, "utf8"));
  const map = layout.map;
  const families = layout.families;
  const byId = new Map(inventory.records.map((record) => [record.id, record]));

  assert.equal(Object.keys(map).length, TOTAL, "the layout map covers every formula");
  const counts = {};
  for (const [cardId, row] of Object.entries(map)) {
    const record = byId.get(cardId);
    assert.ok(record, `${cardId} has no inventory record`);
    assert.ok(families[row.family], `${cardId} names an unknown family: ${row.family}`);
    counts[row.family] = (counts[row.family] || 0) + 1;

    assert.equal(row.divisions, 12, `${cardId} divisions are the surface`);
    const surfacePosition = inventory.records.filter((r) => r.phase === record.phase).findIndex((r) => r.id === record.id) + 1;
    assert.equal(row.mark, surfacePosition, `${cardId} mark is not its position in the surface`);
    assert.ok(row.frontSize >= 6.5 && row.frontSize <= 9, `${cardId} front size`);

    const noun = families[row.family].noun;
    assert.ok(row.label.toLowerCase().startsWith(noun), `${cardId} label does not name "${noun}": "${row.label}"`);
    assert.ok(row.label.includes(`position ${row.mark} of ${row.divisions}`), `${cardId} label omits its mark`);

    const basis = row.basis;
    assert.ok(basis && basis.datum && basis.field && basis.quote, `${cardId} has no basis`);
    const value = basis.field.split(".").reduce((v, key) => (v == null ? v : v[key]), record);
    assert.ok(typeof value === "string" && value.includes(basis.quote), `${cardId} quote is not in ${basis.field}`);
    const stems = families[row.family].operative;
    const lowered = basis.quote.toLowerCase();
    assert.ok(
      stems.find((stem) => lowered.includes(stem)),
      `${cardId} is filed as ${row.family}, but its quote carries no ${row.family} stem: "${basis.quote}"`
    );
  }
  for (const [family, count] of Object.entries(counts)) {
    assert.ok(count > 1, `family "${family}" holds a single card`);
  }

  // The ratio extraction: seventeen cards, every label and percent in the
  // prose, and a front line that is the ratio or the scope, never both.
  assert.equal(Object.keys(layout.ratios).length, 17, "seventeen ratio cards");
  for (const record of inventory.records) {
    const ratio = layout.ratios[record.id];
    if (inventory.ratios.ids.includes(record.formulaId)) {
      assert.ok(ratio, `${record.id} has no extracted ratio`);
      for (const pair of ratio.pairs) {
        assert.ok(
          pairSentence(record.blueprintProse, pair),
          `${record.id} prints "${pair.label} ${pair.percent}" but no sentence of its prose pairs ${pair.percent}% with "${pair.label}"`
        );
      }
      assert.equal(
        ratio.frontLine,
        ratio.pairs.map((pair) => `${pair.label} ${pair.percent}`).join(" · "),
        `${record.id} front line is not its ratio`
      );
    } else {
      assert.ok(!ratio, `${record.id} has a ratio the prose does not state`);
    }
  }
});
