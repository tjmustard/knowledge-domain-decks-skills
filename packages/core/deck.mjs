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
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DECKS_DIR = join(ROOT, "decks");

// Output paths in deck.json are resolved against the repository root, the way
// a reader would read them. An absolute path wins, which is what lets a test
// build a deck into a scratch directory without touching the checkout.
export const resolveFromRoot = (path) => resolve(ROOT, path);

// A deck directory is one with a deck.json. Sorted, so "all decks" is a stable
// order and two machines generating every deck agree on what came first.
export async function listDeckSlugs(dir = DECKS_DIR) {
  const entries = await readdir(dir, { withFileTypes: true });
  const slugs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      await readFile(join(dir, entry.name, "deck.json"), "utf8");
      slugs.push(entry.name);
    } catch {
      // A directory without a deck.json is not a deck; skip it silently rather
      // than failing every command for a stray folder someone left behind.
    }
  }
  return slugs.sort();
}

export async function loadDeck(slug, decksDir = DECKS_DIR) {
  const dir = join(decksDir, slug);
  const deck = JSON.parse(await readFile(join(dir, "deck.json"), "utf8"));
  if (deck.slug !== slug) {
    throw new Error(`decks/${slug}/deck.json declares slug "${deck.slug}"; the directory and the slug must agree`);
  }
  return { ...deck, slug, dir };
}

// Load every deck, or the one named by --deck. Unknown slugs fail loudly: a
// typo that silently builds nothing is the failure this refuses.
export async function loadDecks({ only, dir = DECKS_DIR } = {}) {
  if (only) {
    for (const slug of only) {
      const available = await listDeckSlugs(dir);
      if (!available.includes(slug)) {
        throw new Error(`No deck "${slug}". Available: ${available.join(", ")}`);
      }
    }
    return Promise.all(only.map((slug) => loadDeck(slug, dir)));
  }
  return Promise.all((await listDeckSlugs(dir)).map((slug) => loadDeck(slug, dir)));
}

// --deck a --deck b, --deck=a, and --deck a,b all mean the same thing, because
// people type all three.
export function deckArgs(argv = process.argv.slice(2)) {
  const only = [];
  let dir = DECKS_DIR;
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
    } else if (arg === "--decks-dir") {
      dir = resolve(argv[i + 1] || "");
      i += 1;
    } else if (arg.startsWith("--decks-dir=")) {
      dir = resolve(arg.slice("--decks-dir=".length));
    }
  }
  return { only: only.length > 0 ? only : null, dir };
}

// The arguments that are not --deck: a file list, for validate's fixtures.
export function positionalArgs(argv = process.argv.slice(2)) {
  const out = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--deck" || arg === "--decks-dir") {
      i += 1;
    } else if (!arg.startsWith("--deck=") && !arg.startsWith("--decks-dir=")) {
      out.push(arg);
    }
  }
  return out;
}


/*
 * A deck's record shape, read from deck.json and defaulting to the shape the
 * first deck established. A deck that declares nothing gets exactly the
 * behaviour that shipped before this existed, which is what keeps its artifacts
 * byte-identical rather than merely similar.
 *
 *   fields     which key holds the group, the ordered items, the attribution
 *              and the figure
 *   labels     what the renderers print above the ordered items. `items` heads
 *              the list in the rules file; `resourceItems` names the bullet in
 *              the skill's resource files. They are separate because the first
 *              deck calls the same list "Checklist" in one place and "Check" in
 *              the other, and both of those strings are shipped bytes.
 *   itemStyle  "checklist" (ticked checks) or "steps" (numbered beats)
 */
export const DEFAULT_FIELDS = {
  group: "category",
  items: "checklist",
  attribution: "academicOrigin",
  figure: "graphicMetaphor",
  // A fill-in-the-blank line some records carry and most do not. Naming it
  // here means a record with no prompt renders nothing at all.
  prompt: "prompt",
  // The two lines on the front face. A deck that calls them something else
  // prints its own words without the template knowing which deck it is.
  headline: "axiom",
  context: "trigger",
  // The failure pair. A deck whose cards carry no such pair maps this to a
  // field its records do not have, and the block is absent rather than empty.
  antiPattern: "antiPattern"
};

// How a declared block is laid out. "traits" and "words" join short entries
// with a centred dot, "quotes" joins them with a space, "prose" is a paragraph,
// "list" is one entry per line, "example" is a short italic paragraph, and
// "labelled" prints a record's own `{ label, text }` pair - the form the team
// deck's manager scripts take, where the label names the move and the text is
// the sentence said. "beforeAfter" prints a record's `{ bland, optimized }`
// pair as the two rewrites it is. "lines" prints one entry per printed line,
// which is how a fill-in template keeps the source's own line structure.
// "verbatim" is one string printed line for line, with its blank lines and its
// indentation intact: the source's own plain text, not a reflow of it. A
// verbatim block whose every non-empty line opens with `|` prints unfenced as
// a markdown table, because a fenced table is a picture of a table.
export const BLOCK_STYLES = ["traits", "words", "quotes", "prose", "list", "example", "labelled", "labelledList", "beforeAfter", "lines", "verbatim"];

/*
 * A deck's back-face blocks, in the order the deck prints them. A block is
 * declarative data, not a template: { field, label, style, card }. A deck that
 * declares none gets the face every earlier deck had, so the same code builds
 * both kinds of card. A block whose field a record does not carry prints
 * nothing, which is why every block is implicitly optional per card.
 *
 * "card": false keeps a block out of the card faces while it still prints in
 * the generated markdown. A section too long for a 3x5 back is not deleted from
 * the deck, it moves to the surface that has room for it.
 */
export function deckBlocks(deck = {}) {
  const declared = deck.blocks || [];
  if (!Array.isArray(declared)) {
    throw new Error("deck.json blocks must be an array");
  }
  return declared.map((block, index) => {
    if (!block || typeof block.field !== "string" || block.field === "") {
      throw new Error(`deck.json blocks[${index}] needs a field name`);
    }
    if (!BLOCK_STYLES.includes(block.style)) {
      throw new Error(
        `deck.json blocks[${index}] (${block.field}) style must be one of ${BLOCK_STYLES.join(", ")}, got ${JSON.stringify(block.style)}`
      );
    }
    return {
      field: block.field,
      label: block.label || block.field,
      style: block.style,
      card: block.card === undefined ? true : Boolean(block.card)
    };
  });
}

export function deckShape(deck = {}) {
  const fields = { ...DEFAULT_FIELDS, ...(deck.fields || {}) };
  const blocks = deckBlocks(deck);
  const itemStyle = deck.itemStyle || "checklist";
  // The card face calls the same list by a longer name than the rules file does,
  // and a deck that names its own items names them on both. The default is
  // resolved once here so print and web cannot drift apart.
  const cardItems = deck.labels?.cardItems || (itemStyle === "steps" ? "Structure" : "Operational checklist");
  return {
    fields,
    blocks,
    itemStyle,
    // The card's kicker prints the group. A deck whose group names are longer
    // than the kicker can hold gives each one a short printed form here; the
    // records, the rules headings and the web keep the full name.
    groupLabels: deck.labels?.group || {},
    // The field that carries a per-card point size for the headline, for a
    // deck whose front line is long enough to need a different size on
    // different cards. A deck that names none prints the template's 9 pt.
    headlineSize: fields.headlineSize || null,
    // The field that carries the id a card prints, where the source's own id
    // differs from the record's deck id (the copy deck prints ST-01 on a card
    // whose record is CPY-01). A deck that names none prints card.id, as every
    // earlier deck did.
    cardId: fields.cardId || null,
    // A square figure's width, which is also its height. The default is the
    // size every earlier deck was set at; a deck with a two-line name or a long
    // front line can ask for less rather than cut its own text.
    figureWidth: deck.figureWidth || "1.8in",
    // The name is set at 14 pt on every earlier deck. A deck whose names are
    // long enough to wrap three and four deep can set them smaller: on a 3x5
    // card the name is a label, and the line it saves is the one that fits.
    nameSize: deck.nameSize || "14pt",
    labelItems: deck.labels?.items || "Checklist",
    labelCardItems: cardItems,
    labelResourceItems: deck.labels?.resourceItems || "Check",
    labelPrompt: deck.labels?.prompt || "Prompt",
    labelGroup: deck.labels?.group || null,
    // The heading over the front face's second line. Only a deck that replaces
    // the default wording reads this; every earlier deck prints "When to apply".
    labelContext: deck.labels?.context || "When to apply",
    // The words the rules file uses for the headline and context fields, for a
    // deck that prints blocks instead of a checklist and an anti-pattern.
    labelHeadline: deck.labels?.headline || null,
    group: (card) => card[fields.group],
    items: (card) => (fields.items ? card[fields.items] : []) || [],
    // A deck may declare no attribution at all. The accessor returns nothing
    // then, and every renderer already tolerates an absent citation.
    attribution: (card) => (fields.attribution ? card[fields.attribution] : undefined) || {},
    figure: (card) => card[fields.figure] || card.graphicMetaphor
  };
}

// The order a deck's cards are read in. `printOrder` is declared in deck.json:
// "id" (the default, and what every deck did before this existed) or "family",
// which follows the deck's own category list. The printed pages and the web
// bundle both take their order from here, so one deck cannot show two orders.
export function orderCards(deck, cards) {
  const order = deck.printOrder || "id";
  if (order === "id") return cards;
  if (order !== "family") {
    throw new Error(`deck.json printOrder must be "id" or "family", got ${JSON.stringify(order)}`);
  }
  const rank = new Map((deck.categories || []).map((category, index) => [category, index]));
  const group = deckShape(deck).group;
  return [...cards].sort((a, b) => {
    const ra = rank.has(group(a)) ? rank.get(group(a)) : rank.size;
    const rb = rank.has(group(b)) ? rank.get(group(b)) : rank.size;
    return ra - rb || a.id.localeCompare(b.id);
  });
}

// The known-tensions register, where a deck keeps one. It lives beside the
// records rather than inside data/laws/ so that loading cards cannot mistake a
// ruling for a card. A deck with no register simply has no tensions to print.
export async function loadConflicts(deck) {
  const file = join(deck.dir, "data", "law-conflicts.json");
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error(`could not read ${file}: ${error.message}`);
  }
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
export function withCitation(card, deck) {
  const shape = deckShape(deck);
  // A deck may carry no attribution field. There is then no citation to
  // prepare, and adding a key named "undefined" would be worse than nothing.
  if (!shape.fields.attribution) return { ...card };
  const origin = shape.attribution(card);
  const prepared = {
    ...origin,
    authorsLabel: authorsLabel(origin),
    titleStop: titleStop(origin.title)
  };
  // An origin may carry an ordered list of works instead of one work at the
  // top level. Each work gets the same two computed strings, so a renderer
  // prints the second citation exactly the way it prints the first.
  if (Array.isArray(origin.works)) {
    prepared.works = origin.works.map((work) => ({
      ...work,
      authorsLabel: authorsLabel(work),
      titleStop: titleStop(work.title)
    }));
  }
  return { ...card, [shape.fields.attribution]: prepared };
}

/*
 * One printed citation line. A deck's attributions can be uneven by nature - a
 * named author with a work and a year, sometimes a bare work, sometimes a
 * tradition with nothing else - so every part after the names is optional. With
 * all four parts present this returns exactly the string the first deck printed
 * before the shape was parameterised.
 */
// The shorter form used in the skill's resource files: names, year, title, no
// publication. Same tolerance for absent parts.
// A signed year as a citation prints it. The schema accepts negative years for
// BCE, and a citation that prints "-335" is a data value leaking into prose.
export function formatYear(year) {
  if (year === undefined || year === null) return "";
  return year < 0 ? `${-year} BCE` : String(year);
}

export function sourceShort(origin = {}) {
  // An origin with an ordered list of works cites each of them, in order.
  // Each short form already ends with the work's own stop, so one space
  // separates them. A source-silent origin has no work to cite: the note is
  // the whole attribution, and dropping it here would leave the rules and the
  // skill resources with no source line at all.
  if (Array.isArray(origin.works) && origin.works.length > 0) {
    return origin.works.map((work) => sourceShort(work)).join(" ");
  }
  if (!origin.authors && !origin.title && !origin.publication && origin.note) {
    return origin.note;
  }
  const names = authorsLabel(origin);
  const year = origin.year === undefined || origin.year === null ? "" : ` (${formatYear(origin.year)})`;
  const head = `${names}${year}`;
  const title = origin.title ? `*${origin.title}*${titleStop(origin.title)}` : "";
  // The comma belongs to the join, not to the title: an attribution that is
  // only a title must not open with one.
  if (!title) return head;
  return head ? `${head}, ${title}` : title;
}

export function sourceLine(origin = {}) {
  // One citation sentence per work, in declaration order. Each already ends
  // with its own stop, so the join is a single space. A source-silent origin
  // prints its note: the note is the attribution, and an empty line would
  // omit it from the two artifacts an agent reads.
  if (Array.isArray(origin.works) && origin.works.length > 0) {
    return origin.works.map((work) => sourceLine(work)).join(" ");
  }
  if (!origin.authors && !origin.title && !origin.publication && origin.note) {
    return origin.note;
  }
  const names = authorsLabel(origin);
  const year = origin.year === undefined || origin.year === null ? "" : ` (${formatYear(origin.year)})`;
  const head = `${names}${year}`;
  const title = origin.title ? ` *${origin.title}*${titleStop(origin.title)}` : "";
  const tail = origin.publication ? ` ${origin.publication}` : "";
  let body = `${head}${head ? "." : ""}${title}${tail}`.trim();
  if (body && !/[.?!]$/.test(body)) body += ".";
  return body;
}

// The citation line the card's verso and the web index both print: one work
// per origin, or one line per work when the origin lists several. A bare note
// is the whole line when the origin names no author, work or publication.
// Renderers that pass a withCitation-prepared origin get the computed
// authorsLabel and titleStop; a raw record is accepted too, so the rule is
// testable without a full deck build.
export function citationText(origin = {}) {
  if (!origin) return "";
  if (Array.isArray(origin.works) && origin.works.length > 0) {
    return origin.works.map((work) => citationText(work)).join(" ");
  }
  const names = origin.authorsLabel !== undefined ? origin.authorsLabel : authorsLabel(origin);
  const stop = origin.titleStop !== undefined ? origin.titleStop : titleStop(origin.title);
  if (origin.note && !names && !origin.title && !origin.publication) return origin.note;
  const year =
    origin.year === undefined || origin.year === null
      ? ""
      : ` (${origin.year < 0 ? `${-origin.year} BCE` : origin.year})`;
  const by = names ? names + year : year === "" ? "" : year.trim();
  const parts = [];
  if (by) parts.push(`${by}.`);
  if (origin.title) {
    const work = `${origin.title}${stop}`;
    parts.push(origin.publication ? `${work} ${origin.publication}.` : work);
  } else if (origin.publication) {
    parts.push(`${origin.publication}.`);
  }
  return parts.join(" ");
}

export function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
