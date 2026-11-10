/*
 * Geometry that has regressed before, pinned where the bug would show.
 *
 * accept.mjs already sweeps every shape in the deck for its contract - the
 * viewBox, currentColor, and the rule that every declared parameter must move
 * the drawing. That sweep cannot say "the two clusters are 110 units apart",
 * because it does not know what the shape means. These two do.
 *
 * proximity-grid: the inter-cluster gap is the whole idea of the card, and the
 * dashed measure must span exactly that gap. It has been wrong before - the
 * clusters were 130 units apart while the line and its label said 110 - and a
 * drawing whose measure disagrees with its own label is worse than either
 * number alone.
 *
 * intake-funnel: the drawing must show exactly as many outputs as the record
 * declares. HMM-06 once showed three identical output forms under a card whose
 * caption says emit one, so a reader could count three.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(join(ROOT, "scripts", "svg.js"));
const { renderSvg } = require("./svg.js");

const draw = (svgShape, parametricParams = {}) => renderSvg({ svgShape, parametricParams });

const circles = (svg) =>
  [...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)"/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2])
  }));

const rects = (svg) =>
  [...svg.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/g)].map(
    (match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
      width: Number(match[3]),
      height: Number(match[4])
    })
  );

const dashed = (svg) => {
  const match = /<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"[^>]*stroke-dasharray/.exec(svg);
  assert.ok(match, "the measure line is missing");
  const [, x1, y1, x2, y2] = match.map(Number);
  return { x1, y1, x2, y2 };
};

test("proximity-grid spaces two clusters by exactly its interGap", () => {
  const svg = draw("proximity-grid", { columns: 4, rows: 2, intraGap: 40, interGap: 110 });
  const points = circles(svg);
  assert.equal(points.length, 16, "4 columns x 2 rows x 2 clusters");

  const ys = [...new Set(points.map((point) => point.y))].sort((a, b) => a - b);
  const xs = [...new Set(points.map((point) => point.x))].sort((a, b) => a - b);
  assert.equal(xs.length, 4);

  // Within a cluster the pitch is the intra gap; between clusters it is the
  // inter gap. Both are the numbers the card is about.
  const gaps = ys.slice(1).map((y, i) => y - ys[i]);
  assert.deepEqual(gaps.slice(0, 1), [40], "intra-cluster pitch");
  assert.deepEqual(gaps.slice(-1), [40], "intra-cluster pitch");
  assert.equal(gaps[1], 110, "inter-cluster gap");
});

test("proximity-grid draws its measure across the gap it labels", () => {
  const svg = draw("proximity-grid", { columns: 4, rows: 2, intraGap: 40, interGap: 110 });
  const ys = [...new Set(circles(svg).map((point) => point.y))].sort((a, b) => a - b);
  const measure = dashed(svg);

  // The line must join the inner row of one cluster to the inner row of the
  // other. When the clusters were 130 apart the line stopped 20 units short,
  // so it measured a distance no dot on the page was at.
  assert.equal(measure.y1, ys[1], "measure starts at the last row of the top cluster");
  assert.equal(measure.y2, ys[2], "measure ends at the first row of the bottom cluster");
  assert.equal(Math.abs(measure.y2 - measure.y1), 110);
});

test("proximity-grid keeps its pitch when the cluster shape changes", () => {
  for (const params of [
    { columns: 2, rows: 2 },
    { columns: 6, rows: 3 },
    { columns: 10, rows: 2 }
  ]) {
    const points = circles(draw("proximity-grid", params));
    assert.equal(points.length, params.columns * params.rows * 2);

    const xs = [...new Set(points.map((point) => point.x))].sort((a, b) => a - b);
    assert.equal(xs.length, params.columns);
    // The columns are evenly pitched whatever their number. This is the
    // invariant the loop is supposed to produce; it is not a claim about where
    // the block sits on the page.
    const pitches = xs.slice(1).map((x, i) => x - xs[i]);
    assert.deepEqual([...new Set(pitches)], [params.intraGap ?? 40]);

    const ys = [...new Set(points.map((point) => point.y))].sort((a, b) => a - b);
    assert.equal(ys.length, params.rows * 2);
    const rowPitches = ys.slice(1).map((y, i) => y - ys[i]);
    assert.deepEqual([...new Set(rowPitches)].sort((a, b) => a - b), [40, 110].sort((a, b) => a - b));
  }
});

test("intake-funnel draws exactly the number of outputs the record declares", () => {
  for (const outputs of [1, 2, 3, 4, 5]) {
    const svg = draw("intake-funnel", { outputs });
    // The shape also draws one input glyph, and one of the three input glyphs
    // is a rectangle. Only the output column at x = 258 is being counted.
    assert.equal(rects(svg).filter((box) => box.x === 258).length, outputs, `outputs: ${outputs}`);
  }
});

test("intake-funnel stands its output stack on the page centre", () => {
  for (const outputs of [1, 2, 3, 4, 5]) {
    const boxes = rects(draw("intake-funnel", { outputs })).filter((box) => box.x === 258);
    const top = Math.min(...boxes.map((box) => box.y));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height));
    assert.equal((top + bottom) / 2, 190, `outputs: ${outputs} should be centred on y = 190`);
  }
});
