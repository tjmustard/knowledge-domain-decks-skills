/*
 * The label harness is opt-in, and that promise has two halves: when it cannot
 * measure it says so instead of reporting an empty pass, and nothing automated
 * runs it. Both are checked here without launching Chrome - the missing-browser
 * path is the only path `npm test` exercises.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("a missing Chrome is NOT RUN, not an empty report", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/measure-labels.mjs", "--chrome", "/nonexistent/chrome"],
    { cwd: ROOT, encoding: "utf8" }
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /NOT RUN: Chrome was not found at \/nonexistent\/chrome/);
  assert.match(result.stderr, /unknown, not a pass/);
  assert.equal(result.stdout, "");
});

test("no gate, CI job or npm script calls the harness", async () => {
  const callers = [
    ["package.json", await readFile(join(ROOT, "package.json"), "utf8")],
    [".github/workflows/ci.yml", await readFile(join(ROOT, ".github/workflows/ci.yml"), "utf8")],
    ["scripts/accept.mjs", await readFile(join(ROOT, "scripts/accept.mjs"), "utf8")]
  ];
  for (const [file, text] of callers) {
    assert.ok(
      !text.includes("measure-labels"),
      `${file} calls measure-labels, which is opt-in only`
    );
  }
});

test("the header names the command that reproduces DECISIONS 30", async () => {
  const text = await readFile(join(ROOT, "scripts", "measure-labels.mjs"), "utf8");
  const header = text.slice(0, text.indexOf("*/"));
  assert.match(header, /node scripts\/measure-labels\.mjs/);
  // Every count the header prints, not only the one that was visible when the
  // test was written: 437 cards scanned, 136 of them labelled, 505 labels in
  // four decks. A test for "505 labels" alone is how the other counts drifted.
  for (const count of [/\b437\b/, /\b136\b/, /505 labels/, /four decks/]) {
    assert.match(header, count);
  }
  assert.match(header, /14\.0938 units/);
});
