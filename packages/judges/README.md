# judges — cross-model audit panels

Runs a panel of models from different families against one artifact and writes a
report of what each of them claims is wrong. It is the tool that produced the
audit findings in `DECISIONS.md`; this directory is the part worth keeping.

## What it is for

A single model reviewing its own work returns its own taste as consensus. A
panel of models from separate training lineages returns a wider spread of
objections, and the objections that two of them reach independently are the ones
worth checking first.

**The panel does not decide anything.** Every row is a claim. A claim becomes a
defect when someone checks it at the source and writes down what they found.
This is not a formality: the first panel run produced sixty-five findings from
one judge, eight tautologies from another, and a confident miscount of a
thirty-card file as twenty-four cards. The adjudication step is where the value
is, and it is deliberately not automated here.

## Usage

```bash
node packages/judges/run.mjs \
  --panel packages/judges/panels/deck-skill.json \
  --artifact skills/ux-laws/SKILL.md
```

Options:

- `--out <dir>` — where runs are written (default `.judges`, gitignored)
- `--only <model>` — run one judge from the panel; repeatable
- `--dry-run` — assemble and write the prompt, call no model
- `--timeout <seconds>` — per-model limit (default 1800)
- `--endpoint <url>` — override the panel's endpoint

Each run writes a directory:

```
.judges/<timestamp>-<artifact-hash>/
  artifact.md        the exact bytes judged
  prompt.txt         the exact prompt sent
  manifest.json      panel, artifact hash, endpoint, per-judge settings
  out-<model>.json   parsed verdict plus telemetry
  raw-<model>.txt    the model's unmodified reply
  report.json        machine-readable aggregate
  report.md          the report to read
```

Exit codes: `0` every judge returned a usable verdict, `1` at least one failed,
truncated or returned no JSON, `3` nothing was judged.

## Panel configuration

A panel names the models, their families, and the measured settings for each.
It is a file rather than flags because the same panel should produce a
comparable report months later, and because the numbers are measurements, not
preferences.

Two fields are not optional:

- `authorFamily` — the panel refuses to run if every judge shares it.
- `numCtx` — sent explicitly. Ollama's default context is 2048 tokens, and it
  truncates silently.

`excluded` is where a model goes when it is deliberately not asked, with the
reason. The report prints it under **Not run**, so an exclusion is visible to
the reader rather than living only in the panel file.

## The truncation check

The runner compares the server's `prompt_eval_count` against a hard lower bound
of `characters / 6`. No English text tokenizes at better than six characters per
token, so a prompt that reports fewer tokens than that was cut before the model
saw it. A truncated judge is recorded as `TRUNCATED` in the report and its
verdict is not counted.

This check exists because it caught a real failure: a local model received about
a twelfth of a 27 KB artifact, scored every dimension zero, and returned a
confident verdict about text it had never read. Nothing in the response said so.

## Reading a report

1. **Convergence first.** Quotes raised independently by more than one judge.
   Matching is exact on a normalised prefix; fuzzy matching would invent
   agreement.
2. **Findings with their quotes.** A mechanism without a quote is an opinion
   about the artifact, not an observation of it.
3. **Instrument notes.** Token counts, finish reason, and whether the model
   honours a schema. A judge that ignores `format` is not wrong, it just costs
   more and needs its JSON extracted from prose.
4. **Not run.** Models the panel deliberately did not ask, with the reason. The
   section exists so the judge table is not read as the whole field of models.

## Adding a judge

Measure it before trusting it, and put the measurement in the panel file:

- does it honour `format`?
- what context does it actually have?
- at what token budget does it finish rather than hit `length`?
- how many findings does it produce, and how many survive a source check?

`qwen3.5:4b` is listed as excluded in `panels/deck-skill.json` for a measured
reason: its 4096-token context cannot hold a deck-sized artifact.

## Tests

```bash
npm run test:judges
# or: node --test packages/judges/test/*.test.mjs
```

The tests cover the parts that can fail silently: schema deviation reporting,
JSON extraction from prose, truncation detection, and the report's own
disclaimer.
