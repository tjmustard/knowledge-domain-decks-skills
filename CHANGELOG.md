# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Print template (`packages/prepress/src/card.typ`)**: `card.category.upper()` used a string method that Typst 0.15.1 does not provide; the call is now `upper(card.category)`, the template's only method-style string call. The PDF now builds: 12 pages, every MediaBox 216 x 360 pt.
- **Source line (`packages/prepress/src/card.typ`)**: Raised from 5.5 pt to 6.5 pt, so the citation sits at body size instead of being the only type below it. It reads back at 6.5 pt on all six versos and stays inside the safe inset.

### Changed
- **Header icon (`media/icons/`, `media/icon.png`)**: The header icon is now a transparent WebP set at 1024, 512, 256, 192, and 128 px under `media/icons/`, replacing `media/icon.png`, which is removed, so any existing reference to the old path now 404s. The sizes were produced once with sharp used as a throwaway tool; it is not a dependency, and no generator is committed.

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
