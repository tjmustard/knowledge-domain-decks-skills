#!/usr/bin/env node
/*
 * Run a cross-model judge panel against one artifact.
 *
 * Usage:
 *   node packages/judges/run.mjs --panel <panel.json> --artifact <file> [options]
 *
 * Options:
 *   --out <dir>        where runs are written (default .judges)
 *   --only <model>     run one judge from the panel; repeatable
 *   --dry-run          assemble and write the prompt, call no model
 *   --timeout <sec>    per-model timeout (default 1800)
 *
 * Exit codes:
 *   0  every judge returned a usable, untruncated verdict
 *   1  at least one judge failed, truncated, or returned no JSON
 *   3  no judge returned a usable verdict, so nothing was judged
 *
 * The panel is run one model at a time on purpose. In the trial, two cloud
 * models driven at once produced a timeout on one and a truncated verdict on
 * the other; nothing about this is faster in parallel, because the bottleneck
 * is one endpoint and one rate limit.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { basename, join, resolve } from "node:path";
import { loadPanel } from "./lib/config.mjs";
import { renderPrompt, truncation } from "./lib/prompt.mjs";
import { chat, EndpointError } from "./lib/ollama.mjs";
import { FINDING_SCHEMA, extractJson, validateJudgeOutput, normaliseJudgeOutput } from "./lib/schema.mjs";
import { buildReport, renderMarkdown } from "./lib/report.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1];
};
const flags = (name) => args.flatMap((arg, i) => (arg === name ? [args[i + 1]] : []));

const panelPath = flag("--panel");
const artifactPath = flag("--artifact");
if (!panelPath || !artifactPath) {
  console.error("usage: node packages/judges/run.mjs --panel <panel.json> --artifact <file>");
  process.exit(2);
}

const panel = await loadPanel(resolve(panelPath));
const only = flags("--only");
const judges = only.length > 0 ? panel.judges.filter((j) => only.includes(j.model)) : panel.judges;
if (judges.length === 0) {
  console.error(`no judge matched --only ${only.join(", ")}; panel has ${panel.judges.map((j) => j.model).join(", ")}`);
  process.exit(2);
}

const artifact = await readFile(resolve(artifactPath));
const sha256 = createHash("sha256").update(artifact).digest("hex");
const promptTemplate = await readFile(panel.promptPath, "utf8");
const prompt = renderPrompt(promptTemplate, {
  kind: panel.target.kind,
  job: panel.target.job,
  artifact: artifact.toString("utf8"),
  path: basename(artifactPath)
});

const startedAt = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
// The suffix is not decoration: two runs started in the same second on the same
// artifact would otherwise share a directory, and the second would overwrite the
// first's report. Same failure the acceptance gate had until this morning.
const runId = `${startedAt}-${sha256.slice(0, 12)}-${randomBytes(2).toString("hex")}`;
const outDir = resolve(flag("--out", ".judges"));
const runDir = join(outDir, runId);
await mkdir(runDir, { recursive: true });

const manifest = {
  id: runId,
  startedAt,
  artifact: { path: basename(artifactPath), sha256, bytes: artifact.byteLength },
  panel: { name: panel.name, authorFamily: panel.authorFamily, source: panel.sourcePath },
  endpoint: flag("--endpoint", panel.endpoint),
  promptChars: prompt.length,
  judges: judges.map((j) => ({ model: j.model, family: j.family, numCtx: j.numCtx, numPredict: j.numPredict, schema: j.schema || "enforced" })),
  excluded: panel.excluded || []
};

await writeFile(join(runDir, "artifact.md"), artifact);
await writeFile(join(runDir, "prompt.txt"), prompt);
await writeFile(join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`run:      ${runId}`);
console.log(`artifact: ${manifest.artifact.path} (${manifest.artifact.bytes} bytes, sha256 ${sha256.slice(0, 12)})`);
console.log(`prompt:   ${prompt.length} characters`);
console.log("");

const timeoutMs = Number(flag("--timeout", "1800")) * 1000;
const results = [];

for (const judge of judges) {
  const label = judge.model.padEnd(24);
  if (args.includes("--dry-run")) {
    console.log(`${label} dry run — prompt written, no request sent`);
    continue;
  }
  process.stdout.write(`${label} asking...`);
  const started = Date.now();
  let result;
  try {
    const response = await chat({
      endpoint: manifest.endpoint,
      model: judge.model,
      prompt,
      numCtx: judge.numCtx,
      numPredict: judge.numPredict,
      schema: FINDING_SCHEMA,
      timeoutMs
    });
    const elapsedMs = Date.now() - started;
    const truncated = truncation(prompt, response.promptTokens);

    let parsed = null;
    if (judge.schema === "ignored") {
      parsed = extractJson(response.content);
    } else {
      try {
        parsed = JSON.parse(response.content);
      } catch {
        parsed = extractJson(response.content);
      }
    }

    const validation = parsed
      ? validateJudgeOutput(normaliseJudgeOutput(parsed))
      : { ok: false, problems: ["no JSON object in the reply"] };
    const status = !parsed ? "no-json" : truncated ? "truncated" : "ok";

    result = {
      model: judge.model,
      family: judge.family,
      schema: judge.schema || "enforced",
      status,
      reason: !parsed ? "the reply contained no parseable JSON object" : truncated || null,
      truncation: truncated,
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      elapsedMs,
      tokensPerSecond:
        response.completionTokens && elapsedMs > 0 ? (response.completionTokens / elapsedMs) * 1000 : null,
      finishReason: response.finishReason,
      problems: validation.problems,
      verdict: parsed?.verdict || null,
      scores: parsed?.scores || null,
      findings: parsed?.failures || [],
      ambiguities: parsed?.ambiguities || [],
      gaps: parsed?.coverage_gaps || []
    };

    const slug = judge.model.replace(/[^A-Za-z0-9.-]+/g, "-");
    await writeFile(join(runDir, `out-${slug}.json`), JSON.stringify(result, null, 2) + "\n");
    await writeFile(join(runDir, `raw-${slug}.txt`), response.content);
    process.stdout.write(
      ` ${status} — ${result.findings.length} findings, verdict ${result.verdict || "none"}\n`
    );
  } catch (error) {
    const details = error instanceof EndpointError ? error.details : {};
    result = {
      model: judge.model,
      family: judge.family,
      schema: judge.schema || "enforced",
      status: "error",
      reason: error.message,
      problems: [],
      findings: [],
      ambiguities: [],
      gaps: [],
      elapsedMs: Date.now() - started,
      ...details
    };
    process.stdout.write(` error — ${error.message}\n`);
  }
  results.push(result);
}

if (args.includes("--dry-run")) {
  console.log(`\nDry run complete. Prompt and manifest are in ${runDir}.`);
  process.exit(0);
}

const report = buildReport({ manifest, judges: results });
await writeFile(join(runDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
await writeFile(join(runDir, "report.md"), renderMarkdown(report));

const ok = results.filter((r) => r.status === "ok").length;
console.log("");
console.log(`${ok} of ${results.length} judge(s) returned a usable verdict — ${runDir}/report.md`);
console.log("Findings are unadjudicated. Nothing here is a defect until someone checks it at the source.");

process.exit(ok === 0 ? 3 : ok === results.length ? 0 : 1);
