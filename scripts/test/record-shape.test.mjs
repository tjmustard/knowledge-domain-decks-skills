/*
 * The record shape is a deck's own, and the renderers follow it.
 *
 * The invented-deck test proves the engine builds a deck it has never seen; it
 * does so with the first deck's field names. This one builds a deck whose
 * records are shaped differently on purpose - a family instead of a category,
 * ordered beats instead of a checklist, an attribution that is only a title -
 * and checks that the rules file, the skill and the citation line follow the
 * declaration rather than the first deck's assumptions.
 *
 * If a renderer ever goes back to reading `card.category` directly, this fails
 * while the byte-identity check for the shipped deck still passes, which is
 * the pair of tests that matters: one holds today's output still, the other
 * proves the indirection is load-bearing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const runNode = (script, args) => {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 300_000
  });
  return { status: result.status, output: `${result.stdout || ""}\n${result.stderr || ""}`.trim() };
};

const SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://example.invalid/invented-shape-schema.json",
  type: "object",
  required: ["id", "name", "family", "axiom", "trigger", "steps", "antiPattern", "origin", "figure"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    family: { type: "string" },
    axiom: { type: "string" },
    trigger: { type: "string" },
    steps: {
      type: "array",
      minItems: 2,
      items: {
        type: "object",
        required: ["text"],
        additionalProperties: false,
        properties: { text: { type: "string" } }
      }
    },
    antiPattern: {
      type: "object",
      required: ["violation", "remediation"],
      additionalProperties: false,
      properties: { violation: { type: "string" }, remediation: { type: "string" } }
    },
    prompt: { type: "string" },
    origin: {
      type: "object",
      additionalProperties: false,
      properties: {
        authors: { type: "array", items: { type: "string" } },
        year: { type: "number" },
        title: { type: "string" },
        publication: { type: "string" }
      }
    },
    figure: {
      type: "object",
      required: ["svgShape"],
      properties: {
        svgShape: { type: "string" },
        parametricParams: { type: "object" }
      }
    }
  }
};

test("a deck with its own record shape renders through its own field names", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "kdd-shape-"));
  try {
    const deckDir = join(dir, "decks", "rebeat");
    await mkdir(join(deckDir, "data", "laws"), { recursive: true });
    await writeFile(join(deckDir, "data", "law-schema.json"), JSON.stringify(SCHEMA, null, 2));

    // A sparse attribution on purpose: no authors, no year, no publication.
    // The citation line must still read as a sentence.
    await writeFile(
      join(deckDir, "data", "laws", "reb-01.json"),
      JSON.stringify(
        {
          id: "REB-01",
          name: "The Invented Shape",
          family: "Invented Family",
          axiom: "A deck may name its own fields, and the renderers must follow.",
          trigger: "Used only by the record-shape test.",
          steps: [{ text: "First beat" }, { text: "Second beat" }, { text: "Third beat" }],
          antiPattern: {
            violation: "A renderer that reads the first deck's keys.",
            remediation: "Read the field names the deck declares."
          },
          origin: { title: "An Unattributed Folk Tale" },
          prompt: "Fill in: the beat this card is missing is ____.",
          figure: { svgShape: "proximity-grid", parametricParams: { columns: 3, rows: 2 } }
        },
        null,
        2
      ) + "\n"
    );

    // A second card with no prompt at all: the block must vanish rather than
    // leave a heading over empty space.
    await writeFile(
      join(deckDir, "data", "laws", "reb-02.json"),
      JSON.stringify(
        {
          id: "REB-02",
          name: "The Bare Card",
          family: "Invented Family",
          axiom: "A record may carry no prompt, and then nothing is drawn.",
          trigger: "Used only by the record-shape test.",
          steps: [{ text: "Only beat" }, { text: "Other beat" }],
          antiPattern: {
            violation: "Printing an empty prompt block.",
            remediation: "Draw the heading only when the line exists."
          },
          origin: { authors: ["Ada Lovelace"], year: 1843, title: "Notes", publication: "Memoirs" },
          figure: { svgShape: "proximity-grid", parametricParams: { columns: 2, rows: 2 } }
        },
        null,
        2
      ) + "\n"
    );

    const deck = {
      id: "rebeat",
      slug: "rebeat",
      name: "Rebeat",
      categories: ["Invented Family"],
      accents: { "Invented Family": "#334155" },
      fields: { group: "family", items: "steps", attribution: "origin", figure: "figure" },
      labels: { items: "Structure", resourceItems: "Structure" },
      itemStyle: "steps",
      outputs: {
        rules: join(dir, "out", "rebeat-rules.md"),
        skill: join(dir, "out", "skills", "rebeat"),
        pdf: join(dir, "out", "rebeat.pdf")
      },
      rules: { title: "Rebeat Rules", intro: "Rules from a differently shaped deck." },
      skill: {
        name: "rebeat",
        description: "A deck with {cards} card.",
        title: "Rebeat",
        intro: "The index.",
        commonRules: ["Follow the beats."],
        footer: "End."
      },
      web: {
        global: "REBEAT",
        accentsGlobal: "REBEAT_ACCENTS",
        title: "Rebeat",
        heading: "Rebeat",
        lede: "Shaped differently.",
        source: "Generated by a test.",
        dir: join(dir, "out", "web")
      }
    };
    await writeFile(join(deckDir, "deck.json"), JSON.stringify(deck, null, 2) + "\n");

    const args = ["--decks-dir", join(dir, "decks")];
    const validated = runNode("scripts/validate.mjs", args);
    assert.equal(validated.status, 0, validated.output);

    const rules = runNode("packages/rules/generate.mjs", args);
    assert.equal(rules.status, 0, rules.output);
    const rulesText = await readFile(join(dir, "out", "rebeat-rules.md"), "utf8");

    // The label comes from the deck, and the items are the declared array.
    assert.match(rulesText, /\*\*Structure\.\*\*/);
    assert.match(rulesText, /- \[ \] First beat/);
    assert.match(rulesText, /- \[ \] Third beat/);
    // A title-only attribution still prints as a sentence, not as "()".
    assert.match(rulesText, /\*\*Source\.\*\* \*An Unattributed Folk Tale\*\./);
    assert.ok(!/\(\s*\)/.test(rulesText), "an absent year must not print empty parentheses");

    const skill = await readFile(join(dir, "out", "skills", "rebeat", "SKILL.md"), "utf8");
    assert.match(skill, /^## Invented Family \(2 cards\)$/m);
    assert.ok(skill.includes("resources/invented-family.md"));

    const resource = await readFile(join(dir, "out", "skills", "rebeat", "resources", "invented-family.md"), "utf8");
    assert.match(resource, /- \*\*Structure:\*\*/);
    assert.match(resource, /- \*\*Source:\*\* \*An Unattributed Folk Tale\*\./);
    assert.ok(!/,\s*\*An Unattributed/.test(resource), "a title-only source must not open with a comma");
    // A fully populated attribution prints as it always has.
    assert.match(resource, /- \*\*Source:\*\* Ada Lovelace \(1843\), \*Notes\*\./);

    const web = runNode("scripts/generate-web-data.mjs", args);
    assert.equal(web.status, 0, web.output);
    const page = await readFile(join(dir, "out", "web", "index.html"), "utf8");
    // The page tells the viewer which key carries the group and what to call it.
    assert.match(page, /"group":"family"/);
    assert.match(page, /"itemStyle":"steps"/);

    // The prompt reaches the bundle on the card that has one, and the other
    // card carries no prompt key at all.
    const bundle = await readFile(join(dir, "out", "web", "deck-data.js"), "utf8");
    assert.match(bundle, /the beat this card is missing is ____/);
    assert.equal((bundle.match(/"prompt":/g) || []).length, 1);

    if (spawnSync("typst", ["--version"], { encoding: "utf8" }).status === 0) {
      const printed = runNode("packages/prepress/build.mjs", [...args, "--build-dir", join(dir, "prepress-build")]);
      assert.equal(printed.status, 0, printed.output);
      // Two cards are four pages, recto then verso, at the deck's trim size.
      // The printed leg reads the same field names, so a template that still
      // said `card.category` would fail here rather than on the first real card.
      const checked = runNode("scripts/pdf-check.mjs", [...args, "--deck", "rebeat", "--expect-pages", "4"]);
      assert.equal(checked.status, 0, checked.output);
    } else {
      t.diagnostic("Typst is absent, so this deck's card face was not built");
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
