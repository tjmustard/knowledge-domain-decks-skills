/*
 * The shared prepress build directory holds the last deck a person built, not a
 * test fixture.
 *
 * build.mjs writes cards.json, accents.typ, fields.typ and one SVG per card into
 * packages/prepress/build. A test that builds a deck invented in a scratch
 * directory used to write its fixture there too, so after `npm test` a direct
 * `typst compile` - and any later build that reused the directory - rendered
 * the fixture instead of the committed deck.
 *
 * Two assertions, both about that shared directory:
 *   1. Whatever it holds belongs to a committed deck.
 *   2. A build with an explicit --build-dir writes there and leaves it alone.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCards, loadDecks } from "../../packages/core/deck.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SHARED = join(ROOT, "packages", "prepress", "build");

async function snapshot(dir) {
  const files = [];
  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return; // No shared build directory yet: nothing to compare.
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.push([relative(dir, path), createHash("sha256").update(await readFile(path)).digest("hex")]);
    }
  }
  await walk(dir);
  return files;
}

test("the shared build directory holds a committed deck, not a fixture", async () => {
  const manifestPath = join(SHARED, "cards.json");
  if (!existsSync(manifestPath)) {
    // A clean clone has no build directory. That is the correct state, and it
    // cannot hold a fixture either.
    return;
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const ids = manifest.map((card) => card.id).sort();
  const decks = await loadDecks({});
  const owning = [];
  for (const deck of decks) {
    const deckIds = (await loadCards(deck)).map((card) => card.id).sort();
    if (deckIds.length === ids.length && deckIds.every((id, index) => id === ids[index])) {
      owning.push(deck.slug);
    }
  }
  assert.ok(
    owning.length > 0,
    `packages/prepress/build/cards.json holds ${ids.length} cards that belong to no committed deck: ` +
      `${ids.slice(0, 6).join(", ")}${ids.length > 6 ? ", ..." : ""}`
  );
});

test("an explicit --build-dir writes there and leaves the shared directory alone", async (t) => {
  if (spawnSync("typst", ["--version"], { encoding: "utf8" }).status !== 0) {
    t.diagnostic("Typst is absent, so the isolated build could not run");
    return;
  }

  const before = await snapshot(SHARED);
  const dir = await mkdtemp(join(tmpdir(), "kdd-build-dir-"));
  try {
    const result = spawnSync(
      process.execPath,
      ["packages/prepress/build.mjs", "--deck", "ux-laws", "--build-dir", join(dir, "build")],
      { cwd: ROOT, encoding: "utf8", timeout: 300_000 }
    );
    assert.equal(result.status, 0, `${result.stdout || ""}\n${result.stderr || ""}`);

    const isolated = JSON.parse(await readFile(join(dir, "build", "cards.json"), "utf8"));
    assert.equal(isolated.length, 54, "the isolated build did not hold the UX deck");
    assert.ok(existsSync(join(dir, "build", "fields.typ")));

    // The shared directory must be byte-for-byte what it was. This is the
    // assertion the old fixed build path failed: the isolated build wrote its
    // cards into the directory a later `typst compile` reads.
    assert.deepEqual(await snapshot(SHARED), before);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
