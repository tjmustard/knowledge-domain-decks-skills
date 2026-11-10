# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Six cards closing Decision-Making and opening Time & Motion (`data/laws/dec-09.json` to `dec-11.json`, `tme-02.json` to `tme-04.json`)**: Simon's Bounded Rationality and Satisficing, Cognitive Absorption, Decision Fatigue, Accot-Zhai Steering Law, Doherty Threshold, and Perceived Performance Heuristics. Decision-Making now has all eleven laws the research list gives it; the deck is eighteen cards and the print build thirty-six pages.
- **Two diagram shapes (`scripts/svg.js`, `data/law-schema.json`)**: `steering-tunnel` draws two corridors of one length at different widths, and `decline-curve` draws a monotone fall with every label a parameter. The second declares `monotoneDown` on the shape itself, so the acceptance gate samples the drawn path and fails if it turns back up; `decay-curve` declares `false` and is checked for nothing. Neither claim is global, because the recall curve is a U on purpose.
- **Citation and scope decisions (`DECISIONS.md` §16-24)**: Decision Fatigue cites Baumeister et al. (1998) but asserts the observable rather than the ego-depletion mechanism, which Hagger et al. (2016) failed to replicate; Cognitive Absorption cites Agarwal & Karahanna alone; Doherty cites IBM Technical Report GE20-0752-0 with no page count, because the two sources that confirm the report disagree on its extent; Perceived Performance cites Seow with Miller as antecedent; §16 records why no check joins prose about an artifact to the artifact.
- **Six decision-making cards (`data/laws/dec-03.json` to `dec-08.json`)**: Tesler's Law, Choice Overload, Cognitive Load Theory, Working Memory Capacity Model, Cognitive Friction, and Framing Effect, each citing one exact primary source.
- **Two diagram shapes (`scripts/svg.js`, `data/law-schema.json`)**: `split-bar` shows a fixed total moving between two parties, and `paired-panels` compares two sets of cells side by side; neither is expressible with the existing six shapes. Both are in the schema's shape enum, and `DECISIONS.md` §15 records why they exist and what a filled mark means.
- **Citation and scope decisions (`DECISIONS.md` §12-14)**: Tesler's Law cites Saffer (2007) because its own attribution is a c. 1984 personal communication with no paper to cite; Cognitive Friction cites Cooper (1999), a trade book, because that book named the construct; Miller's Law and Working Memory Capacity ship as two cards by the project owner's decision, with the differentiation between them recorded.

### Changed
- **Split-bar diagram (`scripts/svg.js`)**: Row labels sit at the track's left edge, and the threshold is drawn per bar rather than as one rule across the drawing, because the single rule struck through the labels above and below each track. `DEC-03` and `DEC-05` are already published and were re-rendered and inspected after the change; `DECISIONS.md` §23 records it.
- **Web smoke test (`scripts/check-web.mjs`)**: The expected card count and the filter expectation are read from `data/laws/` at run time instead of being written as constants, so growing the deck no longer requires editing the test. Verified by deleting a record: the test fails naming both the rendered and expected counts.
- **Header icon (`media/icons/`, `media/icon.png`)**: The header icon is now a transparent WebP set at 1024, 512, 256, 192, and 128 px under `media/icons/`, replacing `media/icon.png`, which is removed, so any existing reference to the old path now 404s. The sizes were produced once with sharp used as a throwaway tool; it is not a dependency, and no generator is committed.

### Fixed
- **Citations (`packages/prepress/src/card.typ`, `packages/web/app.js`, `packages/rules/generate.mjs`)**: The Source line appended a period after any title, so a title ending in a question mark printed `Resource?.`. The added stop is now suppressed when the title already ends in `?`, `!` or `.`, in all four renderers that print it; the general rule also corrected `DEC-04`, whose title ends the same way. A dead `formatCitation` with the same bug was deleted. `DECISIONS.md` §24 records it, including the three expressions of the rule and the trigger to revisit them.
- **Print template (`packages/prepress/src/card.typ`)**: `card.category.upper()` used a string method that Typst 0.15.1 does not provide; the call is now `upper(card.category)`, the template's only method-style string call. The PDF now builds, with every MediaBox 216 x 360 pt.
- **Source line (`packages/prepress/src/card.typ`)**: Raised from 5.5 pt to 6.5 pt, so the citation sits at body size instead of being the only type below it. It reads back at 6.5 pt on every verso and stays inside the safe inset.

## [0.1.0] - 2026-11-09

### Added
- **Canonical schema (`data/law-schema.json`)**: JSON Schema draft 2020-12 for one reference card, with `additionalProperties: false` at every object level, a fixed five-value category enum, and a nine-field card anatomy.
- **First deck records (`data/laws/*.json`)**: Six cards across five categories — Jakob's Law, the Law of Proximity, Hick's Law, Miller's Law, Fitts's Law, and the Serial Position Effect — each with an axiom, trigger, checklist, anti-pattern pair, graphic metaphor, and one primary academic source.
- **Parametric SVG generator (`scripts/svg.js`)**: Six diagram shapes (`network`, `hierarchy`, `proximity-grid`, `target-vector`, `decay-curve`, `convention-grid`) drawn from each card's `graphicMetaphor` parameters, with a 400 x 400 viewBox, `currentColor` marks, and `non-scaling-stroke` on every stroke.
- **Print template (`packages/prepress/src/card.typ`, `packages/prepress/build.mjs`)**: Typst template for a 3.00 x 5.00 in page (2.75 x 4.75 in trim plus 0.125 in bleed), a 0.1875 in safe inset, corner trim marks, and recto/verso faces. The build emits `packages/prepress/dist/ux-deck.pdf`. **The PDF has not yet been rendered: Typst is absent on the development machine.**
- **Static web viewer (`packages/web/`)**: Phone-friendly card viewer with no build step and no server. The card data and generated SVG are bundled into a classic script at build time so the page works from `file://`; cards flip to the verso by click or keyboard, and category filters narrow the deck.
- **Generated agent ruleset (`packages/rules/generate.mjs`, `rules/ux-rules.md`, `skills/ux-laws/SKILL.md`)**: The same records rendered as an actionable ruleset and as a skill with a trigger-oriented description.
- **Validation (`scripts/validate.mjs`)**: Ajv 2020 compilation of the schema, per-record error output, duplicate-ID detection, and a 15-word axiom check on top of the schema's 110-character cap. Accepts optional file paths for ad hoc checks; a deliberately broken record fails with the extra-property and missing-remediation errors.
- **PDF check (`scripts/pdf-check.mjs`)**: Structural check that every page's MediaBox is 216 x 360 pt and that the page count is twice the card count; handles raw and compressed object streams and exits 2 with a clear message when no PDF exists.
- **Web check (`scripts/check-web.mjs`)**: Headless Chrome/Chromium smoke test at a true 390 x 844 viewport, asserting no horizontal overflow, six rendered cards, a flip that exposes the verso, and a category filter that narrows to one card.
- **Licences (`LICENSE`, `LICENSE-DATA`)**: MIT for code and CC0-1.0 for card data and the schema.
- **Repository hygiene (`.gitignore`)**: Ignores `node_modules/`, Prepress build and dist output, `.DS_Store`, and the read-only `SupportingInformation/` research input.
- **Documentation (`README.md`, `CHANGELOG.md`, `DECISIONS.md`)**: Setup and verification instructions, the change record, and the reasons behind every deviation from the source specifications.

### Changed
- **Citations (`data/laws/dec-01.json`, `data/laws/mpa-01.json`)**: Each card now carries exactly one primary paper with that paper's own authors, year, title, and venue. DEC-01 cites Hick (1952), and the card is named Hick's Law to match; MPA-01 cites Murdock (1962). Merged attributions were removed deck-wide.
- **Schema requirements (`data/law-schema.json`)**: Removed `remediatedPattern` from `required[]` without declaring it, because the source schema required a property it never defined and `additionalProperties: false` made every record invalid. The `antiPattern { violation, remediation }` pair remains the single remediation field.
- **Schema identifier (`data/law-schema.json`)**: `$id` now points at the intended published URL, `https://raw.githubusercontent.com/tjmustard/knowledge-domain-decks-skills/main/data/law-schema.json`, replacing the `.example` placeholder. It is live only once this slice is merged to `main`; until then it is the intended canonical location, not a resolvable identifier.
- **Package name (`package.json`, `package-lock.json`)**: Renamed to `knowledge-domain-decks-skills` to match the repository slug.

### Fixed
- **Dead parameters (`data/laws/hmm-01.json`, `data/laws/ges-01.json`)**: Removed unused `panels` and `clusters` values from `parametricParams`; only parameters the SVG generator reads remain.
- **Page-count report (`packages/prepress/build.mjs`)**: The build log now reports the actual 12 pages (six cards, recto and verso) instead of six.
- **PDF check robustness (`scripts/pdf-check.mjs`)**: Compressed object streams are inflated before scanning, so a valid PDF is no longer misread as having no pages, and a missing PDF exits 2 with a build hint rather than a stack trace.
