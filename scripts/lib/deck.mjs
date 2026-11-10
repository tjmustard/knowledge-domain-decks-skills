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

export function formatAuthors(origin) {
  return origin.authors.join(" & ");
}

export function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
