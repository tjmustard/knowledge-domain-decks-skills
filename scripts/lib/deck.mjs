import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const CATEGORY_ORDER = [
  "Heuristic & Mental Models",
  "Gestalt & Visual Perception",
  "Decision-Making & Cognitive Load",
  "Time, Motion & Ergonomics",
  "Memory, Perception & Attention"
];

export async function loadCards(root = ROOT) {
  const dir = join(root, "data", "laws");
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
// no serial comma. Full given names, as the records carry them.
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
