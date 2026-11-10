/*
 * The validator, tested by running it the way a person does.
 *
 * scripts/validate.mjs is a program, not a library: it reads its arguments and
 * exits. Importing it would execute it, so every case here spawns it. That also
 * means these tests exercise the exit codes a caller actually branches on,
 * rather than a function the script happens to call.
 *
 * accept.mjs runs the committed fixtures inside the worktree it is verifying -
 * that is the check that the rule is live in a particular commit. These run the
 * same fixtures in the working tree in milliseconds, and add the one rule the
 * gate does not cover: duplicate ids.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function validate(...files) {
  const result = spawnSync(
    process.execPath,
    ["scripts/validate.mjs", ...files],
    { cwd: ROOT, encoding: "utf8" }
  );
  return {
    status: result.status,
    output: `${result.stdout}\n${result.stderr}`,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

test("every shipped record validates", () => {
  const { status, output } = validate();
  assert.equal(status, 0, output);
  assert.match(output, /OK: 54 record\(s\) valid/);
});

test("an over-long axiom is rejected for the word limit, not some other reason", async () => {
  const { status, output } = validate("--deck", "ux-laws", "scripts/fixtures/sixteen-word-axiom.json");
  assert.equal(status, 1, "a rejected fixture must exit 1");
  // The reason is the point. A fixture that fails because a required property
  // went missing has stopped testing the rule it is named for, and "it failed"
  // would still be true.
  assert.match(output, /axiom exceeds 15 words/);
});

test("an unknown property is rejected", async () => {
  const { status, output } = validate("--deck", "ux-laws", "scripts/fixtures/extra-property-record.json");
  assert.equal(status, 1);
  assert.match(output, /additional propert/i);
});

test("the control fixture is accepted", async () => {
  const { status, output } = validate("--deck", "ux-laws", "scripts/fixtures/control-valid-record.json");
  assert.equal(status, 0, output);
});

test("two records with the same id are rejected", async () => {
  // The gate never covers this: it validates what is committed, and the deck
  // has no duplicates. Copying one record to a second name is the cheapest
  // way to prove the rule still runs, and it is the only case here that is not
  // a duplicate of a gate layer.
  const dir = await mkdtemp(join(tmpdir(), "deck-dup-"));
  try {
    const source = await readFile(
      join(ROOT, "scripts", "fixtures", "control-valid-record.json"),
      "utf8"
    );
    const { name } = JSON.parse(source);
    const first = join(dir, "a.json");
    const second = join(dir, "b.json");
    await writeFile(first, source);
    await writeFile(second, source);

    const { status, output } = validate(first, second);
    assert.equal(status, 1);
    // The message names the first record seen, by name rather than by id, so
    // the assertion follows the validator's own wording instead of inventing
    // one. A change to that wording should make someone read this line.
    assert.ok(
      output.includes(`/id duplicates ${name}`),
      `expected the validator to name ${JSON.stringify(name)}, got:\n${output}`
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
