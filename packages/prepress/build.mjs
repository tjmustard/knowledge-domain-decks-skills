#!/usr/bin/env node
/*
 * Build the print deck.
 *
 * 1. Generate one SVG per card from its graphicMetaphor data.
 * 2. Write build/cards.json and build/accents.typ for the Typst template.
 * 3. Run Typst to emit dist/<slug>.pdf (one card per 3.00 x 5.00 in page).
 *
 * Typst is required. This script will not silently substitute another renderer.
 *
 * The template is deck-neutral: the category colours and the card records are
 * handed to it as files, so nothing in packages/prepress names a deck.
 */
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { ROOT, deckArgs, deckShape, loadCards, loadDecks, orderCards, resolveFromRoot, withCitation } from "../core/deck.mjs";

const require = createRequire(import.meta.url);
const { renderSvg } = require("../core/svg.js");

const here = join(ROOT, "packages", "prepress");
const defaultBuildDir = join(here, "build");

/*
 * The generated intermediate files (cards.json, accents.typ, fields.typ, one
 * SVG per card) go into a build directory. It is packages/prepress/build by
 * default, which is what every command a reader runs uses. --build-dir moves
 * it, so a test that builds a deck invented in a scratch directory can keep its
 * fixture out - otherwise a later `typst compile` against the shared directory
 * would print the fixture instead of the committed deck.
 */
let buildDir = defaultBuildDir;
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--build-dir") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        console.error("--build-dir needs a directory path.");
        process.exit(2);
      }
      buildDir = resolveFromRoot(value);
      i += 1;
    } else if (arg.startsWith("--build-dir=")) {
      buildDir = resolveFromRoot(arg.slice("--build-dir=".length));
    }
  }
}
const svgDir = join(buildDir, "svg");
const distDir = join(here, "dist");

/*
 * Typst stamps the compile time into /ModDate and the XMP dates, and derives the
 * trailer /ID from them, so two builds of one commit differ in those fields even
 * when the file length is the same. Pinning SOURCE_DATE_EPOCH, the
 * reproducible-builds convention, removes that variable.
 *
 * The epoch is a fixed date rather than the commit time on purpose: an exported
 * tree or tarball has no git history, and a build there must produce the same
 * bytes as a build inside a checkout. An inherited SOURCE_DATE_EPOCH still wins,
 * so a distributor that repackages the deck can stamp their own.
 */
const DECK_EPOCH = 1794182400; // 2026-11-09T00:00:00Z, the deck's first release
let epochSource = "the deck's fixed release epoch";

const inherited = process.env.SOURCE_DATE_EPOCH;
if (inherited !== undefined && inherited !== "") {
  if (!/^\d+$/.test(inherited) || !Number.isSafeInteger(Number(inherited))) {
    console.error(
      `SOURCE_DATE_EPOCH must be whole seconds since 1970, got "${inherited}".`
    );
    process.exit(2);
  }
  epochSource = "the environment";
}
const epoch = inherited !== undefined && inherited !== "" ? Number(inherited) : DECK_EPOCH;

const version = spawnSync("typst", ["--version"], { encoding: "utf8" });
if (version.error || version.status !== 0) {
  console.error(
    "Typst is not installed (or not on PATH).\n" +
      "Install it, then rerun: npm run build:pdf\n" +
      "The template and this build script are ready; no other renderer is substituted."
  );
  process.exit(2);
}

// Typst source for one deck's category colours. Written where the template
// looks for it, so a deck without accents simply gets an empty map and the
// template's fallback colour applies to every card.
// The record shape, as the template sees it. A deck with no fields block gets
// the first deck's names, which is what keeps its printed pages identical.
function groupLabelTyp(labels) {
  const entries = Object.entries(labels || {});
  if (entries.length === 0) return "(:)";
  return `(${entries
    .map(([group, short]) => `(${JSON.stringify(group)}): ${JSON.stringify(short)}`)
    .join(", ")})`;
}

function fieldsTyp(deck) {
  const shape = deckShape(deck);
  // A deck can map a field away - a card with no checklist and no anti-pattern
  // says so by naming no field for it. Typst's spelling of "no field" is
  // `none`, and the template tests for that before looking a key up.
  const typ = (value) => (value ? JSON.stringify(value) : "none");
  const attribution = typ(shape.fields.attribution);
  // Only the blocks the deck puts on the card face. A block declared with
  // "card": false still prints in the rules and the skill; it has no room here.
  const printed = shape.blocks.filter((block) => block.card !== false);
  const blocks = printed.length
    ? [
        "#let blocks = (",
        ...printed.map(
          (block) =>
            `  (field: ${JSON.stringify(block.field)}, ` +
            `label: ${JSON.stringify(block.label.toUpperCase())}, ` +
            `style: ${JSON.stringify(block.style)}, ` +
            `sizeField: ${typ(block.sizeField)}),`
        ),
        ")"
      ]
    : ["#let blocks = ()"];
  return [
    `#let field-group = ${JSON.stringify(shape.fields.group)}`,
    `#let field-items = ${typ(shape.fields.items)}`,
    `#let field-attribution = ${attribution}`,
    `#let field-prompt = ${typ(shape.fields.prompt)}`,
    `#let field-headline = ${typ(shape.fields.headline)}`,
    `#let field-context = ${typ(shape.fields.context)}`,
    `#let field-anti = ${typ(shape.fields.antiPattern)}`,
    `#let label-items = ${JSON.stringify(shape.labelCardItems.toUpperCase())}`,
    `#let label-prompt = ${JSON.stringify(shape.labelPrompt.toUpperCase())}`,
    `#let field-headline-size = ${typ(shape.headlineSize)}`,
    `#let field-name-size = ${typ(shape.nameSizeField)}`,
    `#let field-card-id = ${typ(shape.cardId)}`,
    `#let label-context = ${JSON.stringify(shape.labelContext.toUpperCase())}`,
    `#let item-style = ${JSON.stringify(shape.itemStyle)}`,
    // A deck with no short forms gets Typst's empty dictionary - `(:)`, not
    // `()`, which is an array and would take an integer index - and the
    // template falls back to the group's full name, so every earlier deck
    // prints the line it always printed.
    `#let group-label = ${groupLabelTyp(shape.groupLabels)}`,
    `#let figure-width = ${shape.figureWidth}`,
    `#let name-size = ${shape.nameSize}`,
    ...blocks,
    ""
  ].join("\n");
}

function accentsTyp(deck) {
  const entries = Object.entries(deck.accents || {});
  if (entries.length === 0) return "#let accent-color = (:)\n";
  const lines = entries.map(([category, hex]) => `  "${category}": rgb("${hex}"),`);
  return ["#let accent-color = (", ...lines, ")", ""].join("\n");
}

const decks = await loadDecks(deckArgs());
await mkdir(svgDir, { recursive: true });
await mkdir(distDir, { recursive: true });

for (const deck of decks) {
  // The order the deck declares, not the order its ids happen to sort in.
  const cards = orderCards(deck, await loadCards(deck));
  const manifest = [];
  for (const card of cards) {
    await writeFile(join(svgDir, `${card.id}.svg`), renderSvg(deckShape(deck).figure(card)));
    manifest.push({
      ...withCitation(card, deck),
      svgFile: `../build/svg/${card.id}.svg`
    });
  }
  await writeFile(join(buildDir, "cards.json"), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(join(buildDir, "accents.typ"), accentsTyp(deck));

  await writeFile(join(buildDir, "fields.typ"), fieldsTyp(deck));

  const pdfName = deck.outputs?.pdf || `packages/prepress/dist/${deck.slug}.pdf`;
  const pdf = resolveFromRoot(pdfName);
  // A deck may name any output path, including one outside dist/. Typst writes
  // the file itself and will not create its directory, so the deck's own
  // directory is made here rather than left to chance.
  await mkdir(dirname(pdf), { recursive: true });
  // The template reads ../build/... relative to its own file. A custom build
  // directory is reached through a temporary root holding a copy of src/ and a
  // link named build/, so the template's paths and the shipped PDF's bytes stay
  // exactly what they are.
  let compileRoot = here;
  if (buildDir !== defaultBuildDir) {
    compileRoot = await mkdtemp(join(tmpdir(), "kdd-prepress-"));
    await cp(join(here, "src"), join(compileRoot, "src"), { recursive: true });
    await symlink(buildDir, join(compileRoot, "build"), "dir");
  }
  const result = spawnSync(
    "typst",
    // --ignore-system-fonts: the face is vendored and Typst's own fonts are
    // bundled, so nothing on the machine can reach the page. Without it a host
    // font could still satisfy a family the template names, and the bytes would
    // stop describing the commit.
    [
      "compile", "--root", ".", "--ignore-system-fonts",
      "--font-path", join(here, "fonts"), "src/card.typ", pdf
    ],
    {
      cwd: compileRoot,
      encoding: "utf8",
      env: { ...process.env, SOURCE_DATE_EPOCH: String(epoch) }
    }
  );
  if (compileRoot !== here) await rm(compileRoot, { recursive: true, force: true });
  if (result.status !== 0) {
    console.error(result.stdout || "");
    console.error(result.stderr || "");
    console.error(`Typst compile failed for deck ${deck.slug}.`);
    process.exit(result.status || 1);
  }

  console.log(
    `Typst ${version.stdout.trim()} built ${pdfName} ` +
      `(${cards.length * 2} pages: ${cards.length} cards, recto + verso).`
  );
  console.log(
    `SOURCE_DATE_EPOCH ${epoch} from ${epochSource}; ` +
      `rebuilds are byte-identical on this Typst version, with every font read from the repository.`
  );
}
