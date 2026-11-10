/*
 * The deck's own facts: which records load, the order they come out in, and the
 * two citation strings every renderer shares.
 *
 * This is the cheap half of the gate. `npm run accept` proves the same things
 * about a committed tree, in a detached worktree, after an npm ci - the right
 * instrument for a release and the wrong one for a two-second loop. Nothing
 * here needs a browser, Typst, or a clean tree, and nothing here re-implements
 * a check that only the gate can make.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  loadDeck,
  loadCards,
  orderCards,
  authorsLabel,
  formatYear,
  sourceLine,
  sourceShort,
  titleStop,
  wordCount,
  withCitation
} from "../../packages/core/deck.mjs";

const deck = await loadDeck("ux-laws");

// The counts are written out rather than derived from the directory so that
// adding a card stops the build. A derived expectation would grow silently with
// the dataset, and "54 cards" is a claim the README makes about this deck.
test("the deck holds 54 records, eleven from each section but TME", async () => {
  const cards = await loadCards(deck);
  assert.equal(cards.length, 54);
  const byPrefix = Object.fromEntries(
    ["DEC", "GES", "HMM", "MPA", "TME"].map((prefix) => [
      prefix,
      cards.filter((card) => card.id.startsWith(prefix)).length
    ])
  );
  assert.deepEqual(byPrefix, { DEC: 11, GES: 11, HMM: 11, MPA: 11, TME: 10 });
});

test("records come out in deck order", async () => {
  const ids = (await loadCards(deck)).map((card) => card.id);
  // The loader sorts with localeCompare. On this dataset a plain codepoint
  // sort gives the identical sequence, so this pins the order and not the
  // comparator: a test claiming to catch a comparator swap would assert
  // something the data cannot distinguish.
  assert.deepEqual(ids, [...ids].sort((a, b) => a.localeCompare(b)));
  assert.equal(ids[0], "DEC-01");
  assert.equal(ids.at(-1), "TME-10");
});

test("each id prefix carries the category the deck says it does", async () => {
  const expected = {
    DEC: "Decision-Making & Cognitive Load",
    GES: "Gestalt & Visual Perception",
    HMM: "Heuristic & Mental Models",
    MPA: "Memory, Perception & Attention",
    TME: "Time, Motion & Ergonomics"
  };
  const cards = await loadCards(deck);
  const wrong = cards
    .filter((card) => card.category !== expected[card.id.slice(0, 3)])
    .map((card) => `${card.id} is filed under ${card.category}`);
  assert.deepEqual(wrong, []);

  // deck.categories decides how the generated skill groups its tables. It is a
  // different order from the id order, so asserting they agree would be wrong;
  // what must hold is that it names exactly the categories the records use.
  assert.deepEqual(
    [...new Set(cards.map((card) => card.category))].sort(),
    [...deck.categories].sort()
  );
});

test("authorsLabel joins with one ampersand and no serial comma", () => {
  assert.equal(authorsLabel({ authors: ["Ada Lovelace"] }), "Ada Lovelace");
  assert.equal(authorsLabel({ authors: ["Ada Lovelace", "Alan Turing"] }), "Ada Lovelace & Alan Turing");
  assert.equal(
    authorsLabel({ authors: ["Ada Lovelace", "Alan Turing", "Grace Hopper"] }),
    "Ada Lovelace, Alan Turing & Grace Hopper"
  );
  // An empty author list is a schema violation, and validate.mjs says so. The
  // helper must not throw on its way to being reported.
  assert.equal(authorsLabel({ authors: [] }), "");
  assert.equal(authorsLabel({}), "");
});

test("wordCount counts words, not spaces", () => {
  assert.equal(wordCount("one"), 1);
  assert.equal(wordCount("one  two"), 2);
  assert.equal(wordCount("  one\ntwo  "), 2);
  assert.equal(wordCount(""), 0);
  assert.equal(wordCount("   "), 0);
});

test("titleStop adds a stop unless the title already ends one", () => {
  // A reduced table: accept.mjs holds the full twelve-case predicate table and
  // runs it inside the worktree it is verifying. This is the same predicate at
  // working-tree speed, and includes the two cases that are easy to get wrong.
  assert.equal(titleStop("A plain title"), ".");
  assert.equal(titleStop("Ends."), "");
  assert.equal(titleStop("Why?"), "");
  assert.equal(titleStop("Really!"), "");
  // A closing mark is part of the quotation, not the title's own stop.
  assert.equal(titleStop('Quoted?"'), "");
  assert.equal(titleStop("Quoted.’"), "");
  // A possessive apostrophe is not a closing mark, so the title still needs one.
  assert.equal(titleStop("Users'"), ".");
  assert.equal(titleStop("O'Brien's guide"), ".");
});

test("withCitation adds both strings and leaves the record alone", async () => {
  const [card] = (await loadCards(deck)).filter((item) => item.id === "DEC-01");
  const before = JSON.stringify(card);
  const cited = withCitation(card);
  assert.equal(JSON.stringify(card), before, "withCitation must not mutate its argument");
  assert.equal(cited.academicOrigin.authorsLabel, authorsLabel(card.academicOrigin));
  assert.equal(cited.academicOrigin.titleStop, titleStop(card.academicOrigin.title));
  assert.equal(cited.id, card.id);
  assert.equal(cited.axiom, card.axiom);
});

test("a year before the common era is printed as BCE, not as a negative number", () => {
  assert.equal(formatYear(1999), "1999");
  assert.equal(formatYear(0), "0");
  assert.equal(formatYear(-335), "335 BCE");
  assert.equal(formatYear(undefined), "");
  assert.equal(
    sourceLine({ authors: ["Aristotle"], year: -335, title: "Poetics" }),
    "Aristotle (335 BCE). *Poetics*."
  );
  assert.equal(
    sourceShort({ authors: ["Aristotle"], year: -335, title: "Poetics" }),
    "Aristotle (335 BCE), *Poetics*."
  );
});

test("printOrder decides the card order, and id order is the default", async () => {
  const narrative = await loadDeck("narrative");
  const cards = await loadCards(narrative);
  const byFamily = orderCards(narrative, cards);
  // Follows deck.categories: Arc, Persuasion, Corporate, Micro.
  assert.deepEqual(
    [...new Set(byFamily.map((card) => card.family))],
    narrative.categories
  );
  // Within a family the ids still ascend, so the order is stable.
  const arc = byFamily.filter((card) => card.family === "Arc & Plot").map((c) => c.id);
  assert.deepEqual(arc, [...arc].sort());

  const asDeclared = await loadDeck("ux-laws");
  assert.equal(asDeclared.printOrder, undefined, "the first deck must not declare an order");
  // A deck that declares nothing keeps the id order it always had.
  assert.deepEqual(orderCards(asDeclared, cards.map((c) => c)), cards.map((c) => c));

  assert.throws(() => orderCards({ ...narrative, printOrder: "random" }, cards), /printOrder/);
});
