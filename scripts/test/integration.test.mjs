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

// A developer run may legitimately skip a check it cannot make. A push may not:
// pre-push sets this flag, so "the gate verified nothing" (exit 3) becomes a
// failure instead of a skip. It is deliberately not CI - CI means the workflow
// was supposed to provide the toolchain, while this means the push must have
// proved something, and only this one assertion reads it.
const strict = process.env.OPENRIG_PUSH_STRICT === "1";

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
  // The ref is HEAD in every normal run. OPENRIG_GATE_REF exists so the strict
  // path can be exercised in both directions from this tree, without checking
  // out a commit that has no test file - the old initial commit, for example,
  // makes the gate verify nothing and exit 3. It is not wired into CI or the
  // hook; the default is the point.
  const ref = process.env.OPENRIG_GATE_REF || "HEAD";
  const result = run("npm", ["run", "--silent", "accept", "--", ref]);
  if (result.status === 3) {
    if (strict) assert.fail(`the gate verified nothing on a push: exit 3:\n${result.output}`);
    absent(t, "the gate verified nothing", `exit 3:\n${result.output}`);
    return;
  }
  assert.equal(result.status, 0, `the gate failed:\n${result.output}`);
  // A run can now name a ref other than the one it executes in. The gate prints
  // the commit it resolved, so pin that: otherwise a pass about A would be
  // indistinguishable from a pass about B.
  const resolved = run("git", ["rev-parse", "--verify", `${ref}^{commit}`]);
  assert.equal(resolved.status, 0, `cannot resolve ${ref}:\n${resolved.output}`);
  assert.ok(
    result.output.includes(resolved.output.trim()),
    `the gate did not report commit ${resolved.output.trim()} for ${ref}`
  );
  // A pass with no NOT RUN is not expected - print: contents is manual by
  // design - so the assertion records how much was actually proven.
  assert.match(result.output, /\d+ passed, 0 failed, \d+ not run/);
});
