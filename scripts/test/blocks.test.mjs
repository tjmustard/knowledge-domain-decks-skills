/*
 * A deck whose cards print declared back-face blocks, proved inside the engine.
 *
 * The block list is deck data: a deck says which fields its back carries, what
 * they are called and how each one is laid out. This test invents such a deck in
 * a scratch directory - no authored card from any shipped deck is involved - and
 * drives it through validate, the rules generator, the web generator and Typst.
 * It also checks the other half of the promise: a deck that declares no blocks
 * still gets the face the shipped decks have, word for word.
 *
 * The shipped decks' own artifacts are compared byte for byte by the build, not
 * here; this test is about the engine's two modes, not about their content.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deckShape } from "../../packages/core/deck.mjs";

const ROOT = join(import.meta.dirname, "..", "..");

const runNode = (script, args) => {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 300_000
  });
  return {
    status: result.status,
    output: `${result.stdout || ""}\n${result.stderr || ""}`.trim()
  };
};

const typst = spawnSync("typst", ["--version"], { encoding: "utf8" });
const hasTypst = !typst.error && typst.status === 0;

// The schema a block deck ships. It deliberately has none of the first deck's
// fields: a block card is not a checklist card, and the schema is the deck's.
const BLOCK_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://example.invalid/block-deck-schema.json",
  type: "object",
  required: ["id", "name", "family", "maxim", "invitation", "voiceTraits", "lexicon", "neverSay", "shadow", "anchors", "example"],
  additionalProperties: false,
  properties: {
    id: { type: "string", pattern: "^BLK-[0-9]{2}$" },
    name: { type: "string", minLength: 1 },
    family: { type: "string", minLength: 1 },
    maxim: { type: "string", maxLength: 120 },
    invitation: { type: "string", maxLength: 240 },
    voiceTraits: { type: "array", minItems: 2, items: { type: "string" } },
    lexicon: { type: "array", minItems: 1, items: { type: "string" } },
    neverSay: { type: "array", minItems: 1, items: { type: "string" } },
    shadow: { type: "string", maxLength: 300 },
    anchors: { type: "array", minItems: 1, items: { type: "string" } },
    example: { type: "string", maxLength: 200 },
    graphicMetaphor: { type: "object" }
  }
};

async function makeBlockDeck(dir) {
  const deckDir = join(dir, "decks", "blocks");
  await mkdir(join(deckDir, "data", "laws"), { recursive: true });
  await writeFile(join(deckDir, "data", "law-schema.json"), JSON.stringify(BLOCK_SCHEMA, null, 2) + "\n");
  await writeFile(
    join(deckDir, "data", "laws", "blk-01.json"),
    JSON.stringify(
      {
        id: "BLK-01",
        name: "The Invented Voice",
        family: "Invented Family",
        maxim: "A declared block reaches every surface without the engine naming the deck.",
        invitation: "Used only by the block-engine test in this repository.",
        voiceTraits: ["plain", "warm", "unhurried"],
        lexicon: ["say it once", "short sentence"],
        neverSay: ["leverage", "synergy"],
        shadow: "A voice that performs warmth without listening.",
        anchors: ["a letter home", "a shop counter"],
        example: "Say the thing. Then stop.",
        graphicMetaphor: { svgShape: "proximity-grid", parametricParams: { columns: 3, rows: 2, intraGap: 36, interGap: 96 } }
      },
      null,
      2
    ) + "\n"
  );

  const deck = {
    id: "blocks",
    slug: "blocks",
    name: "Block Deck",
    description: "A deck that exists only inside this test.",
    categories: ["Invented Family"],
    accents: { "Invented Family": "#123456" },
    // No checklist, no anti-pattern, no attribution: the record has none of
    // them, and the deck says so by mapping them away.
    fields: {
      group: "family",
      items: null,
      attribution: null,
      figure: "graphicMetaphor",
      headline: "maxim",
      context: "invitation",
      prompt: "prompt",
      antiPattern: null
    },
    labels: { headline: "Maxim", context: "Reach for it" },
    blocks: [
      { field: "voiceTraits", label: "Voice", style: "traits" },
      { field: "lexicon", label: "Lexicon", style: "list" },
      { field: "neverSay", label: "Never say", style: "list" },
      { field: "shadow", label: "Shadow", style: "prose" },
      { field: "anchors", label: "Anchors", style: "words" },
      // The example is for the writer, not the card face: the rules and the
      // skill carry it, the printed back and the viewer do not.
      { field: "example", label: "Example", style: "example", card: false }
    ],
    printOrder: "family",
    outputs: {
      rules: join(dir, "out", "blocks-rules.md"),
      skill: join(dir, "out", "skills", "blocks"),
      pdf: join(dir, "out", "blocks.pdf")
    },
    rules: { title: "Block Rules", intro: "Rules from a deck that does not ship." },
    skill: {
      name: "blocks",
      description: "A synthetic deck with {cards} card.",
      title: "Blocks",
      intro: "The index.",
      commonRules: ["Read the card."],
      footer: "End of the block deck."
    },
    web: {
      global: "BLOCKS_DECK",
      accentsGlobal: "BLOCKS_DECK_ACCENTS",
      title: "Block Deck",
      heading: "Block Deck",
      lede: "Built by a test.",
      source: "Generated by a test.",
      dir: join(dir, "out", "web")
    }
  };
  await writeFile(join(deckDir, "deck.json"), JSON.stringify(deck, null, 2) + "\n");
  return { decksDir: join(dir, "decks"), deck };
}

test("an undeclared deck gets the face the shipped decks have", () => {
  const shape = deckShape({});
  assert.deepEqual(shape.blocks, []);
  assert.equal(shape.labelCardItems, "Operational checklist");
  assert.equal(shape.labelItems, "Checklist");
  assert.equal(shape.labelResourceItems, "Check");
  assert.equal(shape.labelPrompt, "Prompt");
  assert.equal(shape.labelContext, "When to apply");
  assert.equal(shape.itemStyle, "checklist");
  assert.equal(shape.fields.attribution, "academicOrigin");
  assert.equal(shape.fields.headline, "axiom");
  assert.equal(shape.fields.context, "trigger");
});

test("blocks must be declared with a field and a known style", () => {
  assert.throws(() => deckShape({ blocks: [{ label: "X", style: "prose" }] }), /needs a field name/);
  assert.throws(
    () => deckShape({ blocks: [{ field: "x", label: "X", style: "table" }] }),
    /style must be one of/
  );
  // A block with no label falls back to its field name rather than printing
  // an empty heading.
  assert.deepEqual(deckShape({ blocks: [{ field: "voice", style: "traits" }] }).blocks, [
    { field: "voice", label: "voice", style: "traits", card: true }
  ]);
});

test("a block deck builds through validate, rules, web and print", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "kdd-blocks-"));
  try {
    const { decksDir } = await makeBlockDeck(dir);
    const args = ["--decks-dir", decksDir];

    const validated = runNode("scripts/validate.mjs", args);
    assert.equal(validated.status, 0, validated.output);
    assert.match(validated.output, /OK: 1 record\(s\) valid/);

    const rules = runNode("packages/rules/generate.mjs", args);
    assert.equal(rules.status, 0, rules.output);
    const rulesText = await readFile(join(dir, "out", "blocks-rules.md"), "utf8");
    assert.match(rulesText, /^# Block Rules$/m);
    assert.match(rulesText, /### BLK-01 — The Invented Voice/);
    // Each declared block prints under its own label, laid out by its style.
    assert.match(rulesText, /\*\*Maxim\.\*\* A declared block reaches every surface/);
    assert.match(rulesText, /\*\*Reach for it\.\*\* Used only by the block-engine test/);
    assert.match(rulesText, /\*\*Voice\.\*\* plain · warm · unhurried/);
    assert.match(rulesText, /\*\*Anchors\.\*\* a letter home · a shop counter/);
    assert.match(rulesText, /\*\*Lexicon\.\*\*\n- say it once\n- short sentence/);
    assert.match(rulesText, /\*\*Shadow\.\*\* A voice that performs warmth without listening\./);
    // A block marked off the card face still reaches the writer's rules.
    assert.match(rulesText, /\*\*Example\.\*\* Say the thing\. Then stop\./);
    // No checklist or anti-pattern heading appears for a deck that declares none.
    assert.doesNotMatch(rulesText, /Anti-pattern/);
    assert.doesNotMatch(rulesText, /Axiom/);
    // A deck with no attribution prints no source line at all.
    assert.doesNotMatch(rulesText, /\*\*Source\.\*\*/);

    const skillText = await readFile(join(dir, "out", "skills", "blocks", "SKILL.md"), "utf8");
    assert.match(skillText, /^\| ID \| Card \| Reach for it \|$/m);
    const resource = await readFile(join(dir, "out", "skills", "blocks", "resources", "invented-family.md"), "utf8");
    assert.match(resource, /- \*\*Voice:\*\* plain · warm · unhurried/);
    assert.match(resource, /- \*\*Lexicon:\*\*\n  - say it once\n  - short sentence/);
    assert.match(resource, /- \*\*Example:\*\* Say the thing\. Then stop\./);

    const web = runNode("scripts/generate-web-data.mjs", args);
    assert.equal(web.status, 0, web.output);
    const page = await readFile(join(dir, "out", "web", "index.html"), "utf8");
    // The page's field map carries the block declarations and the two front
    // lines by the names this deck gave them.
    assert.match(page, /"blocks":\[\{"field":"voiceTraits","label":"Voice","style":"traits","card":true\}/);
    // The card-face map omits the block the deck kept off the card.
    assert.doesNotMatch(page, /"field":"example"/);
    assert.match(page, /"headline":"maxim"/);
    assert.match(page, /"context":"invitation"/);
    assert.match(page, /"labelContext":"Reach for it"/);
    const bundle = await readFile(join(dir, "out", "web", "deck-data.js"), "utf8");
    assert.match(bundle, /window\.BLOCKS_DECK = /);
    assert.match(bundle, /"voiceTraits": \[/);

    // Drive the generated page in a real browser: the block headings and their
    // entries have to reach the flipped face, not just the HTML string. The
    // template links the shared stylesheet and viewer two directories up, so
    // the scratch tree gets the same pair the repository serves.
    for (const asset of ["styles.css", "app.js"]) {
      await writeFile(join(dir, asset), await readFile(join(ROOT, "packages", "web", asset), "utf8"));
    }
    const smoke = runNode("scripts/check-web.mjs", [...args, "--deck", "blocks"]);
    if (smoke.status === 2) {
      t.diagnostic("no Chrome/Chromium found, so the block deck's page was not driven in a browser");
    } else {
      assert.equal(smoke.status, 0, smoke.output);
      assert.match(smoke.output, /flip exposes verso/);
    }

    if (!hasTypst) {
      t.diagnostic("Typst is absent, so the print half of the block deck was not built");
      return;
    }
    const printed = runNode("packages/prepress/build.mjs", [...args, "--build-dir", join(dir, "prepress-build")]);
    assert.equal(printed.status, 0, printed.output);
    assert.ok(existsSync(join(dir, "out", "blocks.pdf")), "no PDF was written");

    const checked = runNode("scripts/pdf-check.mjs", ["--decks-dir", decksDir, "--deck", "blocks", "--expect-pages", "2"]);
    assert.equal(checked.status, 0, checked.output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
