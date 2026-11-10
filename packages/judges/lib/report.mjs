/*
 * Turn a panel's raw outputs into one report.
 *
 * Two rules shape it. First, findings are shown as evidence with their quotes,
 * not summarised into a score: a score is what let a judge that invented a card
 * count look like a judge that found something. Second, the report says in its
 * own header that nothing in it has been adjudicated, because the first trial's
 * central lesson was that the panel produces candidates and a person produces
 * defects.
 */

export function buildReport({ manifest, judges }) {
  const usable = judges.filter((j) => j.status === "ok");
  const byVerdict = { pass: 0, conditional: 0, fail: 0 };
  for (const judge of usable) {
    if (judge.verdict in byVerdict) byVerdict[judge.verdict] += 1;
  }

  const findingsByJudge = Object.fromEntries(
    judges.map((j) => [j.model, (j.findings || []).length])
  );

  return {
    run: manifest,
    judges,
    summary: {
      judges: judges.length,
      answered: usable.length,
      verdicts: byVerdict,
      findingsByJudge,
      failureCount: judges.reduce((n, j) => n + (j.findings || []).length, 0),
      convergence: convergence(judges)
    }
  };
}

// Two judges raising the same quote is the strongest signal this harness can
// produce on its own, so it is computed and shown first. The match is exact on
// a normalised prefix: fuzzy matching would invent agreement.
export function convergence(judges) {
  const seen = new Map();
  for (const judge of judges) {
    for (const finding of judge.findings || []) {
      const key = normalise(finding.quote);
      if (!key) continue;
      if (!seen.has(key)) seen.set(key, { quote: finding.quote, judges: new Set(), severities: new Set() });
      const entry = seen.get(key);
      entry.judges.add(judge.model);
      if (finding.severity) entry.severities.add(finding.severity);
    }
  }
  return [...seen.values()]
    .filter((entry) => entry.judges.size > 1)
    .map((entry) => ({
      quote: entry.quote,
      judges: [...entry.judges],
      severities: [...entry.severities]
    }))
    .sort((a, b) => b.judges.length - a.judges.length);
}

function normalise(quote) {
  return String(quote || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 80);
}

export function renderMarkdown(report) {
  const { run, summary } = report;
  const lines = [];
  lines.push(`# Judge panel: ${run.panel.name}`);
  lines.push("");
  lines.push("**Nothing here is adjudicated.** Each row is one model's claim. A");
  lines.push("finding becomes a defect only after someone checks it at the source;");
  lines.push("a finding that was not checked is not evidence, it is a candidate.");
  lines.push("");
  lines.push(`- artifact: \`${run.artifact.path}\``);
  lines.push(`- sha256: \`${run.artifact.sha256}\` (${run.artifact.bytes} bytes)`);
  lines.push(`- run: \`${run.id}\`, started ${run.startedAt}`);
  lines.push(`- panel: ${run.panel.name}, authoring family \`${run.panel.authorFamily}\` excluded`);
  lines.push("");
  lines.push("| judge | family | status | verdict | failures | ambiguities | gaps | scores | tok/s |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const judge of report.judges) {
    const scores = judge.scores
      ? Object.values(judge.scores).join("/")
      : "—";
    const speed = judge.tokensPerSecond ? judge.tokensPerSecond.toFixed(1) : "—";
    lines.push(
      `| \`${judge.model}\` | ${judge.family} | ${judge.status} | ${judge.verdict || "—"} | ${(judge.findings || []).length} | ${(judge.ambiguities || []).length} | ${(judge.gaps || []).length} | ${scores} | ${speed} |`
    );
  }
  lines.push("");

  // A judge that was deliberately not asked is part of the instrument's
  // reading, not a footnote: a report that showed three models and stayed
  // silent about the two the panel refused would let a reader take the
  // coverage as the whole field of models.
  const excluded = run.excluded || [];
  if (excluded.length > 0) {
    lines.push("## Not run");
    lines.push("");
    for (const entry of excluded) {
      lines.push(`- \`${entry.model}\` (${entry.family || "unknown family"}) — ${oneLine(entry.reason)}`);
    }
    lines.push("");
  }

  if (summary.convergence.length > 0) {
    lines.push("## Raised independently by more than one judge");
    lines.push("");
    for (const entry of summary.convergence) {
      lines.push(`- **${entry.quote}** — ${entry.judges.join(", ")} (${entry.severities.join(", ") || "no severity"})`);
    }
    lines.push("");
  }

  lines.push("## Findings, by judge");
  for (const judge of report.judges) {
    lines.push("");
    lines.push(`### ${judge.model} — ${judge.status}${judge.verdict ? `, ${judge.verdict}` : ""}`);
    if (judge.status !== "ok") {
      lines.push("");
      lines.push(`No usable verdict: ${judge.reason || "unknown reason"}.`);
    }
    if ((judge.problems || []).length > 0) {
      lines.push("");
      lines.push(`Schema deviations: ${judge.problems.join("; ")}.`);
    }
    for (const finding of judge.findings || []) {
      lines.push("");
      lines.push(`- **${finding.severity || "unrated"}** — ${oneLine(finding.quote)}`);
      if (finding.mechanism) lines.push(`  - mechanism: ${oneLine(finding.mechanism)}`);
      if (finding.agent_does) lines.push(`  - agent does: ${oneLine(finding.agent_does)}`);
    }
    if ((judge.gaps || []).length > 0) {
      lines.push("");
      lines.push("Coverage gaps:");
      for (const gap of judge.gaps) lines.push(`- ${oneLine(gap)}`);
    }
  }

  lines.push("");
  lines.push("## Instrument notes");
  lines.push("");
  for (const judge of report.judges) {
    const notes = [];
    if (judge.promptTokens) notes.push(`${judge.promptTokens} prompt tokens`);
    if (judge.completionTokens) notes.push(`${judge.completionTokens} completion tokens`);
    if (judge.finishReason) notes.push(`finish ${judge.finishReason}`);
    if (judge.schema === "ignored") {
      notes.push("ignores format; JSON was extracted from prose");
    }
    if (judge.truncation) notes.push(`TRUNCATED: ${judge.truncation}`);
    if (notes.length > 0) lines.push(`- \`${judge.model}\`: ${notes.join(", ")}`);
  }
  lines.push("");
  return lines.join("\n");
}

function oneLine(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}
