#!/usr/bin/env node
/*
 * Validate cards against a deck's schema.
 *
 * Usage:
 *   node scripts/validate.mjs                       # every deck
 *   node scripts/validate.mjs --deck ux-laws        # one deck
 *   node scripts/validate.mjs --deck ux-laws a.json b.json   # specific files
 *
 * Exits 0 when every record is valid; exits 1 with per-field errors otherwise.
 *
 * A file list is validated against the schema of the deck named by --deck, or
 * of the only deck when there is just one. With several decks and no --deck
 * there is no honest answer to "which schema", so it asks instead of guessing.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import {
  deckArgs,
  positionalArgs,
  loadCards,
  loadDeck,
  loadDecks,
  listDeckSlugs,
  wordCount
} from "../packages/core/deck.mjs";

const { only } = deckArgs();
const argFiles = positionalArgs();

async function schemaFor(deck) {
  const schemaPath = join(deck.dir, "data", "law-schema.json");
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  return { schema, schemaPath, check: ajv.compile(schema) };
}

function checkRecords(cards, validate, schema, schemaPath, label) {
  let failed = 0;
  const seen = new Map();

  for (const card of cards) {
    const errors = [];
    if (!validate(card)) {
      for (const err of validate.errors) {
        const where = err.instancePath || "(root)";
        errors.push(`${where} ${err.message}`);
      }
    }

    // The schema can only bound characters; the source prose also says
    // "15 words or fewer", so enforce that here too.
    if (typeof card.axiom === "string" && wordCount(card.axiom) > 15) {
      errors.push(`/axiom exceeds 15 words (${wordCount(card.axiom)})`);
    }

    if (card.id) {
      if (seen.has(card.id)) {
        errors.push(`/id duplicates ${seen.get(card.id)}`);
      } else {
        seen.set(card.id, card.name || card.id);
      }
    }

    if (errors.length > 0) {
      failed += 1;
      console.error(`FAIL ${card.id || "(no id)"} — ${card.name || "(unnamed)"}`);
      for (const error of errors) console.error(`  - ${error}`);
    } else {
      console.log(`ok   ${card.id} — ${card.name}`);
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} of ${cards.length} record(s) failed schema validation (${label}).`);
    return false;
  }
  console.log(`\nOK: ${cards.length} record(s) valid against ${schema.$id || schemaPath}.`);
  return true;
}

if (argFiles.length > 0) {
  // Fixtures: one schema, chosen explicitly or by there being only one deck.
  let slug = only ? only[0] : null;
  if (!slug) {
    const slugs = await listDeckSlugs();
    if (slugs.length !== 1) {
      console.error(
        `A file list needs --deck: ${slugs.length} decks exist (${slugs.join(", ")}), ` +
          "and each has its own schema."
      );
      process.exit(1);
    }
    [slug] = slugs;
  }
  const deck = await loadDeck(slug);
  const { schema, schemaPath, check } = await schemaFor(deck);
  const cards = [];
  for (const file of argFiles) cards.push(JSON.parse(await readFile(file, "utf8")));
  process.exit(checkRecords(cards, check, schema, schemaPath, argFiles.join(", ")) ? 0 : 1);
}

const decks = await loadDecks({ only });
let ok = true;
for (const deck of decks) {
  const { schema, schemaPath, check } = await schemaFor(deck);
  const cards = await loadCards(deck);
  if (decks.length > 1) console.log(`== ${deck.slug}`);
  if (!checkRecords(cards, check, schema, schemaPath, `decks/${deck.slug}/data/laws/*.json`)) {
    ok = false;
  }
}
process.exit(ok ? 0 : 1);
