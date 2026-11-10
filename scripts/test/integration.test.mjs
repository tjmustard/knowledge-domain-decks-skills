/*
 * The whole pipeline in one run, plus the gate, on the working tree.
 *
 * The unit files beside this one are cheap and need nothing installed. This one
 * is the opposite: it runs every generator, builds the PDF, drives a browser,
 * and finally asks the gate to verify HEAD in a worktree of its own. It exists
 * because the pieces can each be right while the pipeline is wrong - a
 * generator that writes where the next step does not read, a build that needs a
 * file nobody generates.
 *
 * A stage that cannot run is reported as skipped, with the reason. It is never
 * quietly dropped: a suite that passes because it did not look is the failure
 * this repository has spent the most words on.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: options.timeout ?? 600_000
  });
  return {
    status: result.status,
    timedOut: result.signal === "SIGTERM",
    output: `${result.stdout || ""}\n${result.stderr || ""}`.trim()
  };
}

const stage = (args) => run("npm", ["run", "--silent", ...args]);

const typst = spawnSync("typst", ["--version"], { encoding: "utf8" });
const hasTypst = !typst.error && typst.status === 0;

// On a developer's machine a missing tool is a fact about the machine, and a
// skip says so. In CI it is not: the workflow installs Typst and pins CHROME_PATH
// precisely so that those steps run, so a skip there means the installation
// failed and the run is green on less than it claims. Skips become failures.
const inCI = Boolean(process.env.CI);

const absent = (t, why, detail) => {
  if (inCI) assert.fail(`${why} in CI, where the workflow is supposed to provide it: ${detail}`);
  t.skip(`${why} on this machine: ${detail}`);
};

// check:web exits 2 when it cannot find a browser.
function expectPass(label, result) {
  assert.equal(result.status, 0, `${label} failed${result.timedOut ? " (timed out)" : ""}:\n${result.output}`);
}

test("the pipeline runs end to end", async (t) => {
  await t.test("validate", () => {
    const result = stage(["validate"]);
    expectPass("validate", result);
    assert.match(result.output, /OK: 54 record\(s\) valid/);
  });

  await t.test("build:web", () => {
    expectPass("build:web", stage(["build:web"]));
  });

  await t.test("build:rules", () => {
    expectPass("build:rules", stage(["build:rules"]));
  });

  await t.test("build:pdf and check:pdf", (sub) => {
    if (!hasTypst) {
      absent(sub, "no Typst", "no PDF was built, so its page boxes are unproven");
      return;
    }
    expectPass("build:pdf", stage(["build:pdf"]));
    const checked = stage(["check:pdf"]);
    expectPass("check:pdf", checked);
    assert.match(checked.output, /108 pages/);
  });

  await t.test("check:web", (sub) => {
    const result = stage(["check:web"]);
    if (result.status === 2) {
      absent(sub, "no Chrome or Chromium", "set CHROME_PATH to run the web smoke test");
      return;
    }
    expectPass("check:web", result);
  });
});

test("the gate verifies HEAD in a worktree of its own", async (t) => {
  // The gate needs a clean tree: it regenerates inside the worktree and fails
  // if regeneration leaves changes. Running it after the pipeline above is
  // therefore also a check that every generator is deterministic.
  const result = run("npm", ["run", "--silent", "accept", "--", "HEAD"]);
  if (result.status === 3) {
    absent(t, "the gate verified nothing", `exit 3:\n${result.output}`);
    return;
  }
  assert.equal(result.status, 0, `the gate failed:\n${result.output}`);
  // A pass with no NOT RUN is not expected - print: contents is manual by
  // design - so the assertion records how much was actually proven.
  assert.match(result.output, /\d+ passed, 0 failed, \d+ not run/);
});
