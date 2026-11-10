#!/usr/bin/env node
/*
 * Acceptance gate for a commit.
 *
 * Verifies a commit in a detached worktree that nobody else is editing, so the
 * result describes that commit and not whatever happens to be on disk.
 *
 * Usage:
 *   npm run accept              # accepts HEAD
 *   npm run accept -- <ref>     # any commit-ish
 *
 * Exit codes: 0 every layer passed (a layer may be NOT RUN), 1 something failed.
 *
 * NOT RUN is a real verdict, not a pass: it means a check could not execute
 * here (no Typst, no browser), so the corresponding claim stays unproven.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ref = process.argv[2] || "HEAD";

const results = [];
const record = (layer, state, detail) => results.push({ layer, state, detail });

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options
  });
  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    missing: Boolean(result.error)
  };
}

const git = (args, cwd = ROOT) => run("git", args, { cwd });

// --- resolve the commit -----------------------------------------------------
const resolved = git(["rev-parse", "--verify", `${ref}^{commit}`]);
if (resolved.status !== 0) {
  console.error(`No such commit: ${ref}`);
  process.exit(1);
}
const sha = resolved.stdout.trim();
const subject = git(["log", "-1", "--format=%s", sha]).stdout.trim();
const short = sha.slice(0, 7);

const worktree = join(ROOT, ".worktrees", `accept-${short}`);
console.log(`acceptance run: ${short}  ${subject}`);
console.log(`tree:           ${worktree} (detached worktree of ${sha})`);
console.log("");

// --- prepare the isolated tree ---------------------------------------------
await mkdir(join(ROOT, ".worktrees"), { recursive: true });
await rm(worktree, { recursive: true, force: true });
const added = git(["worktree", "add", "--detach", worktree, sha]);
if (added.status !== 0) {
  console.error(`could not create a worktree at ${worktree}: ${added.stderr.trim()}`);
  process.exit(1);
}

const at = (args) => git(args, worktree);
const npm = (args) => run("npm", args, { cwd: worktree });

const cleanup = () => git(["worktree", "remove", "--force", worktree]);

try {
  const installed = npm(["ci", "--silent", "--no-audit", "--no-fund"]);
  if (installed.status !== 0) {
    console.error(`npm ci failed in the worktree:\n${installed.stderr.slice(-800)}`);
    cleanup();
    process.exit(1);
  }

  // --- 1. nothing that should stay out of the repository is committed ------
  {
    const tracked = at(["ls-files"]).stdout.split("\n").filter(Boolean);
    const forbidden = tracked.filter((path) =>
      /^(\.openrig\/|\.claude\/|CLAUDE\.local\.md|AGENTS\.md|SupportingInformation\/|node_modules\/|gate-lane-verdict\.json)/.test(path)
    );
    record(
      "commit hygiene",
      forbidden.length === 0 ? "pass" : "fail",
      forbidden.length === 0
        ? `${tracked.length} tracked files, none of them local-only or generated`
        : `committed local-only paths: ${forbidden.join(", ")}`
    );
  }

  // --- 2. schema, and the schema's ability to reject known-bad records -----
  {
    const valid = npm(["run", "--silent", "validate"]);
    record(
      "schema: shipped records",
      valid.status === 0 ? "pass" : "fail",
      valid.status === 0
        ? valid.stdout.trim().split("\n").pop()
        : valid.stderr.trim().split("\n").slice(-3).join(" / ")
    );
  }

  // Fixtures are committed so a future edit cannot quietly stop testing them.
  // Each must fail, and for its own reason - otherwise "it failed" proves
  // nothing about which rule is live.
  const fixtures = [
    { file: "scripts/fixtures/extra-property-record.json", why: /additional propert/i, label: "schema: extra property rejected" },
    { file: "scripts/fixtures/sixteen-word-axiom.json", why: /exceeds 15 words/i, label: "schema: over-long axiom rejected" },
    { file: "scripts/fixtures/control-valid-record.json", why: null, label: "schema: control record accepted" }
  ];
  for (const fixture of fixtures) {
    if (!existsSync(join(worktree, fixture.file))) {
      record(fixture.label, "fail", `${fixture.file} is not in this commit, so the rule behind it is untested`);
      continue;
    }
    const result = run("node", ["scripts/validate.mjs", fixture.file], { cwd: worktree });
    const output = `${result.stdout}\n${result.stderr}`;
    if (fixture.why === null) {
      record(fixture.label, result.status === 0 ? "pass" : "fail",
        result.status === 0 ? "control fixture validates" : output.trim().split("\n").slice(-2).join(" / "));
    } else {
      const rejected = result.status === 1;
      const forTheRightReason = fixture.why.test(output);
      record(fixture.label,
        rejected && forTheRightReason ? "pass" : "fail",
        rejected && forTheRightReason
          ? "rejected for the intended reason"
          : rejected
            ? `rejected, but not for ${fixture.why} - the fixture no longer tests what it claims`
            : "accepted, so this rule is not being enforced");
    }
  }

  // --- 3. generators are deterministic and match what is committed ---------
  {
    const targets = ["rules/ux-rules.md", "skills/ux-laws/SKILL.md", "packages/web/deck-data.js"];
    const hashOf = async () => {
      const out = [];
      for (const target of targets) {
        const bytes = await readFile(join(worktree, target));
        out.push(createHash("md5").update(bytes).digest("hex"));
      }
      return out.join(" ");
    };
    const before = await hashOf();
    npm(["run", "--silent", "build:rules"]);
    npm(["run", "--silent", "build:web"]);
    const after = await hashOf();
    const dirty = at(["status", "--porcelain"]).stdout.trim();

    if (before !== after) {
      record("generators", "fail", "regenerating changed committed output, so committed artifacts are stale");
    } else if (dirty) {
      record("generators", "fail", `regeneration left the checkout dirty: ${dirty.split("\n").slice(0, 3).join(", ")}`);
    } else {
      record("generators", "pass", `byte-identical on re-run (${before})`);
    }
    record("working tree", dirty ? "fail" : "pass",
      dirty ? `unexpected changes: ${dirty.split("\n").slice(0, 3).join(", ")}` : "clean after every generator ran");
  }

  // --- 4. parametric SVG contract ------------------------------------------
  {
    const require = createRequire(join(worktree, "scripts", "render-shim.cjs"));
    const { renderSvg } = require("./svg.js");
    const dir = join(worktree, "data", "laws");
    const files = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
    const problems = [];
    const shapes = new Set();

    for (const file of files) {
      const card = JSON.parse(await readFile(join(dir, file), "utf8"));
      const metaphor = card.graphicMetaphor;
      const svg = renderSvg(metaphor);
      shapes.add(metaphor.svgShape);

      if (!/viewBox="0 0 400 400"/.test(svg)) problems.push(`${card.id}: viewBox is not 0 0 400 400`);
      if (/<filter|<image/.test(svg)) problems.push(`${card.id}: contains a filter or bitmap`);
      if (/#[0-9a-fA-F]{3,6}\b/.test(svg)) problems.push(`${card.id}: hardcoded colour instead of currentColor`);

      // Every declared parameter must actually change the drawing. A parameter
      // nothing reads is data promising a knob that does nothing.
      for (const [key, value] of Object.entries(metaphor.parametricParams || {})) {
        if (typeof value !== "number" && typeof value !== "string") continue;
        const probe = JSON.parse(JSON.stringify(metaphor));
        probe.parametricParams[key] = typeof value === "number" ? (value === 0 ? 1 : value * 2) : `${value}X`;
        if (renderSvg(probe) === svg) problems.push(`${card.id}: parameter "${key}" does not affect the drawing`);
      }
    }

    record("svg", problems.length === 0 ? "pass" : "fail",
      problems.length === 0
        ? `${files.length} cards, shapes: ${[...shapes].sort().join(", ")}; contract holds and every parameter is used`
        : problems.join(" | "));
  }

  // --- 5. web smoke test ---------------------------------------------------
  {
    const web = npm(["run", "--silent", "check:web"]);
    if (web.status === 0) {
      record("web 390x844", "pass", web.stdout.trim().split("\n").pop());
    } else if (web.status === 2) {
      record("web 390x844", "not run", "no Chrome/Chromium available here (set CHROME_PATH to run it)");
    } else {
      record("web 390x844", "fail", web.stderr.trim().split("\n").slice(-3).join(" / "));
    }
  }

  // --- 6. print ------------------------------------------------------------
  {
    const built = npm(["run", "--silent", "build:pdf"]);
    if (built.status === 2) {
      record("print", "not run", "Typst is not installed, so no PDF exists - unknown, not a pass");
    } else if (built.status !== 0) {
      record("print", "fail", built.stderr.trim().split("\n").slice(-3).join(" / "));
    } else {
      record("print: built", "pass", built.stdout.trim().split("\n").pop());
      const checked = npm(["run", "--silent", "check:pdf"]);
      if (checked.status === 0) {
        record("print: page boxes", "pass", checked.stdout.trim().split("\n").pop());
      } else if (checked.status === 2) {
        record("print: page boxes", "not run", "no PDF to inspect after a successful build");
      } else {
        record("print: page boxes", "fail", checked.stderr.trim().split("\n").slice(-3).join(" / "));
      }
      record("print: contents", "not run",
        "page boxes are not evidence that trim marks are drawn, text is legible, or the SVG was embedded - inspect the PDF by hand");
    }
  }
} finally {
  cleanup();
}

// --- report -----------------------------------------------------------------
console.log("");
for (const { layer, state, detail } of results) {
  const label = { pass: "PASS   ", fail: "FAIL   ", "not run": "NOT RUN" }[state];
  console.log(`${label}  ${layer}`);
  if (detail) console.log(`         ${detail}`);
}

const failed = results.filter((r) => r.state === "fail").length;
const notRun = results.filter((r) => r.state === "not run").length;
const passed = results.filter((r) => r.state === "pass").length;
console.log("");
console.log(
  `${passed} passed, ${failed} failed, ${notRun} not run — commit ${sha}` +
    (notRun > 0 ? "\nNOT RUN means unproven, not accepted." : "")
);
process.exit(failed > 0 ? 1 : 0);
