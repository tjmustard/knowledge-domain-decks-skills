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
 * Exit codes:
 *   0  at least one layer passed and none failed (others may be NOT RUN)
 *   1  something failed
 *   3  nothing was verified - every layer was NOT RUN, so this is not a pass
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


// Walk a parameters object and yield the path to every leaf value. Object
// parameters are common (TME-01 stores {hard: {...}, easy: {...}}), so a sweep
// that only looks at the top level can miss a dead knob entirely.
function leafPaths(value, prefix = []) {
  if (value === null || typeof value !== "object") return [prefix];
  if (Array.isArray(value)) return value.flatMap((item, i) => leafPaths(item, [...prefix, i]));
  return Object.entries(value).flatMap(([key, child]) => leafPaths(child, [...prefix, key]));
}

function getPath(root, path) {
  return path.reduce((node, key) => node[key], root);
}

function setPath(root, path, next) {
  const last = path[path.length - 1];
  const parent = path.slice(0, -1).reduce((node, key) => node[key], root);
  parent[last] = next;
}

// Move a leaf far enough that a drawing that reads it must change, and keep
// the type stable so the generator is not fed a value it would reject.
function perturb(value) {
  if (typeof value === "number") return value === 0 ? 7 : value * 2 + 3;
  if (typeof value === "string") return `${value}X`;
  if (typeof value === "boolean") return !value;
  return value;
}

const PROBEABLE = new Set(["number", "string", "boolean"]);


// A failing child prints a stack whose tail is boilerplate. Take the lines that
// name the failure, so a red layer is diagnosable from the gate's own output
// instead of needing a hand-reproduction.
function reason(text, limit = 3) {
  const lines = String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const named = lines.filter((line) =>
    /\b\w*Error\b|code [A-Z]+|notarget|EUSAGE|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(line)
  );
  const picked = (named.length > 0 ? named : lines).slice(0, limit);
  return picked.join(" / ") || "no output";
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
git(["worktree", "prune"]);
const added = git(["worktree", "add", "--detach", worktree, sha]);
if (added.status !== 0) {
  console.error(`could not create a worktree at ${worktree}: ${added.stderr.trim()}`);
  process.exit(1);
}

const at = (args) => git(args, worktree);
const npm = (args) => run("npm", args, { cwd: worktree });

let cleanedUp = false;
const cleanup = () => {
  if (cleanedUp) return;
  cleanedUp = true;
  git(["worktree", "remove", "--force", worktree]);
};

// Print the verdict and leave with a code. cleanup() cannot be left to the
// finally block here: process.exit would skip it and leak a registered worktree.
const finish = (code) => {
  cleanup();
  const { failed, passed } = report(results, sha);
  // Nothing verified is not a pass - but an explicit caller decision wins.
  process.exit(code === undefined ? (failed > 0 ? 1 : passed === 0 ? 3 : 0) : code);
};

try {
  // npm resolves the nearest package.json above its cwd, so without this guard a
  // commit that has no package.json would install into (and, with npm ci, wipe)
  // the calling project's node_modules instead of the isolated tree.
  if (!existsSync(join(worktree, "package.json"))) {
    record("dependencies", "not run", "this commit has no package.json, so there is nothing to install");
    finish();
  }

  // --silent writes nothing to stderr on failure, which would make every
  // install failure look like a broken machine. Keep npm's reason instead.
  const installed = npm(["ci", "--prefix", worktree, "--loglevel=error", "--no-audit", "--no-fund"]);
  if (installed.status !== 0) {
    // Keep npm's actual reason, not the boilerplate tail it prints after it.
    const message = installed.stderr.split("\n")
      .map((line) => line.replace(/^npm (error|warn)\s*/, "").trim())
      .filter((line) => line && !/^A complete log of this run|^Run "npm help|^\/?Users\/.*\/_logs\//.test(line))
      .slice(0, 2)
      .join(" / ") || "npm gave no reason";
    // Allowlist, not a denylist: only these mean "this machine cannot install",
    // which is NOT RUN. Anything else is the commit's own fault. A denylist of
    // known-bad phrasings silently misses each new npm failure mode.
    const machineFault = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|ECONNRESET|E403|403 Forbidden|SELF_SIGNED_CERT|CERT_HAS_EXPIRED|UNABLE_TO_VERIFY|ERR_TLS|self.signed certificate/i.test(installed.stderr);
    record("dependencies", machineFault ? "not run" : "fail",
      machineFault
        ? `could not reach the registry from here, so nothing was verified: ${message}`
        : `npm ci failed against this commit: ${message}`);
    finish(machineFault ? undefined : 1);
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
        result.status === 0 ? "control fixture validates" : reason(output, 2));
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
    const missing = targets.filter((target) => !existsSync(join(worktree, target)));
    const hashOf = async () => {
      const out = [];
      for (const target of targets) {
        const bytes = await readFile(join(worktree, target));
        out.push(createHash("md5").update(bytes).digest("hex"));
      }
      return out.join(" ");
    };
    const before = missing.length === 0 ? await hashOf() : null;
    if (missing.length > 0) {
      record("generators", "fail",
        `${missing.join(", ")} not in this commit; run the generators and commit their output`);
    } else {
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
  }

  // --- 4. parametric SVG contract ------------------------------------------
  {
    const require = createRequire(join(worktree, "scripts", "svg.js"));
    const { renderSvg } = require("./svg.js");
    const dir = join(worktree, "data", "laws");
    const files = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
    const problems = [];
    const unprobed = [];
    const shapes = new Set();

    for (const file of files) {
      const card = JSON.parse(await readFile(join(dir, file), "utf8"));
      const metaphor = card.graphicMetaphor;
      const svg = renderSvg(metaphor);
      shapes.add(metaphor.svgShape);

      if (!/viewBox="0 0 400 400"/.test(svg)) problems.push(`${card.id}: viewBox is not 0 0 400 400`);
      if (/<filter|<image/.test(svg)) problems.push(`${card.id}: contains a filter or bitmap`);
      if (/#[0-9a-fA-F]{3,6}\b/.test(svg)) problems.push(`${card.id}: hardcoded colour instead of currentColor`);

      // Every declared parameter must actually change the drawing, at any
      // depth: a parameter nothing reads is data promising a knob that does
      // nothing. Nested parameters count - an object parameter that is skipped
      // would let a dead knob hide one level down and still report clean.
      for (const path of leafPaths(metaphor.parametricParams || {})) {
        if (!PROBEABLE.has(typeof getPath(metaphor.parametricParams, path))) {
          unprobed.push(`${card.id}:${path.join(".")}`);
          continue;
        }
        const probe = JSON.parse(JSON.stringify(metaphor));
        setPath(probe.parametricParams, path, perturb(getPath(probe.parametricParams, path)));
        if (renderSvg(probe) === svg) {
          problems.push(`${card.id}: parameter "${path.join(".")}" does not affect the drawing`);
        }
      }
    }

    record("svg", problems.length === 0 ? "pass" : "fail",
      problems.length === 0
        ? `${files.length} cards, shapes: ${[...shapes].sort().join(", ")}; contract holds and every parameter is used` +
          (unprobed.length ? ` (not probeable, so unproven: ${unprobed.join(", ")})` : "")
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
      record("web 390x844", "fail", reason(`${web.stderr} ${web.stdout}`));
    }
  }

  // --- 6. print ------------------------------------------------------------
  {
    const built = npm(["run", "--silent", "build:pdf"]);
    if (built.status === 2) {
      record("print", "not run", "Typst is not installed, so no PDF exists - unknown, not a pass");
    } else if (built.status !== 0) {
      record("print", "fail", reason(`${built.stderr} ${built.stdout}`));
    } else {
      record("print: built", "pass", built.stdout.trim().split("\n").pop());
      const checked = npm(["run", "--silent", "check:pdf"]);
      if (checked.status === 0) {
        record("print: page boxes", "pass", checked.stdout.trim().split("\n").pop());
      } else if (checked.status === 2) {
        record("print: page boxes", "not run", "no PDF to inspect after a successful build");
      } else {
        record("print: page boxes", "fail", reason(`${checked.stderr} ${checked.stdout}`));
      }
      record("print: contents", "not run",
        "page boxes are not evidence that trim marks are drawn, text is legible, or the SVG was embedded - inspect the PDF by hand");
    }
  }
} finally {
  cleanup();
}

// --- report -----------------------------------------------------------------
function report(rows, commit) {
  console.log("");
  for (const { layer, state, detail } of rows) {
    const label = { pass: "PASS   ", fail: "FAIL   ", "not run": "NOT RUN" }[state];
    console.log(`${label}  ${layer}`);
    if (detail) console.log(`         ${detail}`);
  }

  const failed = rows.filter((r) => r.state === "fail").length;
  const notRun = rows.filter((r) => r.state === "not run").length;
  const passed = rows.filter((r) => r.state === "pass").length;
  console.log("");
  console.log(
    `${passed} passed, ${failed} failed, ${notRun} not run — commit ${commit}` +
      (notRun > 0 ? "\nNOT RUN means unproven, not accepted." : "")
  );
  return { failed, passed };
}

const { failed, passed } = report(results, sha);
cleanup();
// Nothing verified is not a pass: a CI step must not read this as green.
process.exit(failed > 0 ? 1 : passed === 0 ? 3 : 0);
