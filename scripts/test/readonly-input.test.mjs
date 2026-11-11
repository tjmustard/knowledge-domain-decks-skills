/*
 * The person's rule: the read-only research input is gitignored, and no test
 * may read it. `scripts/accept.mjs` enforces the "never commit it" half; this
 * test enforces the other half, because a test that reads the folder makes the
 * suite give one answer here and another in a fresh clone.
 *
 * The needle is assembled at run time. Written literally, this file would
 * contain the very string it scans for: it would fail itself, and the tempting
 * fix - an exclusion for this file - would be a quiet hole in the guard.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const HERE = import.meta.dirname;
const ROOT = join(HERE, "..", "..");
const FOLDER = ["Supporting", "Information"].join("");
const EXTENSIONS = [".mjs", ".js", ".cjs"];

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (EXTENSIONS.some((extension) => entry.name.endsWith(extension))) files.push(path);
  }
  return files;
};

test("no test names the read-only research input", async () => {
  const files = (await walk(HERE)).sort();
  // A scan that reached no files would pass vacuously, so the scan proves it
  // covered the suite: it must reach this file, which sits in the same tree.
  assert.ok(
    files.includes(import.meta.filename),
    `the scan did not reach this test file among ${files.length} file(s)`
  );

  const hits = [];
  for (const file of files) {
    const lines = (await readFile(file, "utf8")).split("\n");
    lines.forEach((line, index) => {
      if (line.includes(FOLDER)) hits.push(`${relative(ROOT, file)}:${index + 1}: ${line.trim()}`);
    });
  }

  assert.deepEqual(
    hits,
    [],
    `a test names the read-only input, which no test may read:\n${hits.join("\n")}`
  );
});
