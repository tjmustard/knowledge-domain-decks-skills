/*
 * The README's deck badge is a hand-maintained summary above tested records, and
 * it went stale the moment deck nine closed: it read "decks-8 · 339 cards" while
 * validate counted 389 records across nine decks. Deck seven shipped the same
 * defect in a different sentence. Both numbers are derived here from the tree,
 * so the badge cannot disagree with what it summarizes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const DECKS = join(ROOT, "decks");

test("the README badge counts the decks and records it sits above", async () => {
  const readme = await readFile(join(ROOT, "README.md"), "utf8");
  const badge = readme.match(/decks-(\d+)%20%C2%B7%20(\d+)%20cards-indigo\.svg/);
  assert.ok(badge, "the README carries a decks badge");

  const deckDirs = (await readdir(DECKS, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(DECKS, entry.name))
    .filter((dir) => existsSync(join(dir, "deck.json")));
  let records = 0;
  for (const dir of deckDirs) {
    const laws = await readdir(join(dir, "data", "laws"));
    records += laws.filter((name) => name.endsWith(".json")).length;
  }

  assert.equal(
    Number(badge[1]),
    deckDirs.length,
    `the badge says ${badge[1]} decks, the tree holds ${deckDirs.length}`
  );
  assert.equal(
    Number(badge[2]),
    records,
    `the badge says ${badge[2]} cards, the records number ${records}`
  );
});
