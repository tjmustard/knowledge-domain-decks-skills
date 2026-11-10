/*
 * The engine's view of a deck.
 *
 * A deck is a directory under decks/ holding a deck.json and a data/ tree. This
 * module is the only place that knows that shape; every generator is handed a
 * loaded deck rather than a path, so moving a deck is a data change and not a
 * code change.
 *
 * Nothing here names a deck. The category order, titles, prose and colours all
 * come out of deck.json, because the same generator builds the next deck too.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DECKS_DIR = join(ROOT, "decks");

// A deck directory is one with a deck.json. Sorted, so "all decks" is a stable
// order and two machines generating every deck agree on what came first.
export async function listDeckSlugs() {
  const entries = await readdir(DECKS_DIR, { withFileTypes: true });
  const slugs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      await readFile(join(DECKS_DIR, entry.name, "deck.json"), "utf8");
      slugs.push(entry.name);
    } catch {
      // A directory without a deck.json is not a deck; skip it silently rather
      // than failing every command for a stray folder someone left behind.
    }
  }
  return slugs.sort();
}

export async function loadDeck(slug) {
  const dir = join(DECKS_DIR, slug);
  const deck = JSON.parse(await readFile(join(dir, "deck.json"), "utf8"));
  if (deck.slug !== slug) {
    throw new Error(`decks/${slug}/deck.json declares slug "${deck.slug}"; the directory and the slug must agree`);
  }
  return { ...deck, slug, dir };
}

// Load every deck, or the one named by --deck. Unknown slugs fail loudly: a
// typo that silently builds nothing is the failure this refuses.
export async function loadDecks({ only } = {}) {
  if (only) {
    for (const slug of only) {
      const available = await listDeckSlugs();
      if (!available.includes(slug)) {
        throw new Error(`No deck "${slug}". Available: ${available.join(", ")}`);
      }
    }
    return Promise.all(only.map(loadDeck));
  }
  return Promise.all((await listDeckSlugs()).map(loadDeck));
}

// --deck a --deck b, --deck=a, and --deck a,b all mean the same thing, because
// people type all three.
export function deckArgs(argv = process.argv.slice(2)) {
  const only = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--deck") {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--deck needs a slug, e.g. --deck <slug>");
      }
      only.push(...value.split(",").filter(Boolean));
      i += 1;
    } else if (arg.startsWith("--deck=")) {
      only.push(...arg.slice("--deck=".length).split(",").filter(Boolean));
    }
  }
  return { only: only.length > 0 ? only : null };
}

// The arguments that are not --deck: a file list, for validate's fixtures.
export function positionalArgs(argv = process.argv.slice(2)) {
  const out = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--deck") {
      i += 1;
    } else if (!arg.startsWith("--deck=")) {
      out.push(arg);
    }
  }
  return out;
}

export async function loadCards(deck) {
  const dir = join(deck.dir, "data", "laws");
  const files = (await readdir(dir))
    .filter((name) => name.endsWith(".json"))
    .sort();
  const cards = [];
  for (const file of files) {
    const text = await readFile(join(dir, file), "utf8");
    cards.push(JSON.parse(text));
  }
  cards.sort((a, b) => a.id.localeCompare(b.id));
  return cards;
}

// House style: one ampersand before the last author, commas between the rest,
// no serial comma. Full given names, as the records carry them. This field is
// plain text on purpose: the print template adds the no-break around its
// ampersand, so the bundles stay grep-able and contain no hidden characters.
export function authorsLabel(origin) {
  const names = origin.authors || [];
  if (names.length <= 1) return names[0] || "";
  return names.slice(0, -1).join(", ") + " & " + names[names.length - 1];
}

// A title that already ends a sentence takes no added stop. Closing quotes,
// apostrophes, and brackets are stripped first, so a title quoted or
// parenthesised as a whole is judged by its own final stop.
const TITLE_CLOSERS = new Set(['"', "“", "”", "‘", "’", "'", ")", "]"]);

export function titleStop(title) {
  let text = String(title);
  while (text.length > 0 && TITLE_CLOSERS.has(text[text.length - 1])) {
    text = text.slice(0, -1);
  }
  return /[.?!]$/.test(text) ? "" : ".";
}

// Add the two computed strings to a card's citation block. The print bundle
// and the web bundle both carry them, so no renderer re-implements the rule.
export function withCitation(card) {
  return {
    ...card,
    academicOrigin: {
      ...card.academicOrigin,
      authorsLabel: authorsLabel(card.academicOrigin),
      titleStop: titleStop(card.academicOrigin.title)
    }
  };
}

export function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
