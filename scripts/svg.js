/*
 * Parametric card graphics.
 *
 * One generator, shared by the print pipeline (CommonJS require) and the
 * static web viewer (classic <script>). Every shape is derived from the card's
 * graphicMetaphor data; nothing here is a hand-authored illustration.
 *
 * Contract: viewBox="0 0 400 400", valid XML, strokes use
 * vector-effect="non-scaling-stroke", marks use currentColor so the deck theme
 * can recolor them.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ParametricSvg = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Monospace stack, and load-bearing beyond appearance: diagram labels are
  // bounded by character count (about 45 fits the safe box on the decline-curve
  // labels, measured at 1.79 pt per character). If this becomes proportional,
  // character count stops being width and that bound must be deleted, not retuned.
  var FONT = "ui-monospace, SFMono-Regular, Menlo, monospace";
  var STROKE = 'vector-effect="non-scaling-stroke"';

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function label(x, y, text, opts) {
    opts = opts || {};
    var size = opts.size || 11;
    var weight = opts.weight || 600;
    var anchor = opts.anchor || "middle";
    return (
      '<text x="' + x + '" y="' + y + '" font-family="' + FONT +
      '" font-size="' + size + '" font-weight="' + weight +
      '" text-anchor="' + anchor + '" fill="currentColor" opacity="' +
      (opts.opacity || 0.72) + '">' + esc(text) + "</text>"
    );
  }

  function line(x1, y1, x2, y2, width, opacity, dash) {
    return (
      '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
      '" stroke="currentColor" stroke-width="' + (width || 2) +
      '" stroke-linecap="round"' +
      (dash ? ' stroke-dasharray="' + dash + '"' : "") +
      ' opacity="' + (opacity == null ? 0.85 : opacity) + '" ' + STROKE + "/>"
    );
  }

  function circle(cx, cy, r, opts) {
    opts = opts || {};
    var fill = opts.hollow ? "none" : "currentColor";
    return (
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r +
      '" fill="' + fill + '" stroke="currentColor" stroke-width="' +
      (opts.width || 2) + '" opacity="' + (opts.opacity == null ? 0.9 : opts.opacity) +
      '" ' + STROKE + "/>"
    );
  }

  function rect(x, y, w, h, opts) {
    opts = opts || {};
    return (
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" rx="' + (opts.rx || 0) + '" fill="' + (opts.fill || "none") +
      '" stroke="currentColor" stroke-width="' + (opts.width || 2) +
      '" opacity="' + (opts.opacity == null ? 0.85 : opts.opacity) + '" ' +
      STROKE + "/>"
    );
  }

  function wrap(body) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" ' +
      'width="100%" height="100%" preserveAspectRatio="xMidYMid meet" ' +
      'role="img" aria-label="Parametric diagram of the card principle">' +
      body + "</svg>"
    );
  }

  var shapes = {
    /* Jakob's Law: a conventional layout beside a chaotic one. */
    "convention-grid": function (p) {
      var cols = p.columns || 4;
      var rows = p.rows || 3;
      var jitter = p.chaoticOffset == null ? 18 : p.chaoticOffset;
      var out = [];
      out.push(rect(30, 50, 160, 250, { rx: 6, opacity: 0.35, width: 1.5 }));
      out.push(rect(210, 50, 160, 250, { rx: 6, opacity: 0.35, width: 1.5 }));
      out.push(label(110, 40, "CONVENTION", { size: 10 }));
      out.push(label(290, 40, "DIVERGENCE", { size: 10 }));
      /* canonical: logo, nav row, search, content grid */
      out.push(rect(42, 62, 24, 14, { rx: 2, opacity: 0.8, width: 1.5 }));
      out.push(line(78, 70, 160, 70, 3, 0.8));
      out.push(rect(150, 62, 28, 14, { rx: 2, opacity: 0.5, width: 1.5 }));
      out.push(line(42, 88, 178, 88, 1.5, 0.35));
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          out.push(rect(44 + c * 34, 104 + r * 40, 26, 28, {
            rx: 2, opacity: 0.55, width: 1.5
          }));
        }
      }
      /* chaotic: displaced blocks, footer navigation */
      var seed = 3;
      for (var i = 0; i < cols * rows; i++) {
        seed = (seed * 7 + 11) % 29;
        var dx = (seed % 5 - 2) * jitter * 0.5;
        var dy = ((seed >> 1) % 5 - 2) * jitter * 0.4;
        var rr = Math.floor(i / cols);
        var cc = i % cols;
        out.push(rect(224 + cc * 34 + dx, 96 + rr * 40 + dy, 26, 28, {
          rx: 1, opacity: 0.45, width: 1.5
        }));
      }
      out.push(line(224, 288, 356, 288, 3, 0.6));
      out.push(label(200, 340, "FAMILIAR GRAMMAR BECOMES EXPECTATION", { size: 9 }));
      return out.join("");
    },

    /* Law of Proximity: two groups, tight inside, far apart. */
    "proximity-grid": function (p) {
      var cols = p.columns || 4;
      var rows = p.rows || 2;
      var intra = p.intraGap || 40;
      var inter = p.interGap || 110;
      var out = [];
      var clusterW = 40 + (cols - 1) * intra;
      var x0 = 200 - clusterW / 2;
      var topY = 150 - inter / 2 - ((rows - 1) * intra) / 2 - 20;
      var bottomY = 150 + inter / 2 + 20;
      [topY, bottomY].forEach(function (baseY) {
        out.push(rect(x0 - 20, baseY - 20, clusterW + 40,
          (rows - 1) * intra + 40, { rx: 6, opacity: 0.35, width: 1.5 }));
        for (var r = 0; r < rows; r++) {
          for (var c = 0; c < cols; c++) {
            out.push(circle(x0 + c * intra, baseY + r * intra, 9, {
              opacity: 0.85
            }));
          }
        }
      });
      out.push(line(200, 150 - inter / 2, 200, 150 + inter / 2, 1.5, 0.4, "4 4"));
      out.push(label(250, 150, "gap = " + inter, { size: 9 }));
      out.push(label(200, 350, "SPACING CREATES THE GROUPS", { size: 9 }));
      return out.join("");
    },

    /* Hick's Law: dense fan beside a clean binary fork. */
    hierarchy: function (p) {
      var many = p.branches || 16;
      var few = p.optimalBranches || 2;
      var out = [];
      out.push(line(200, 40, 200, 360, 1, 0.3, "4 4"));
      out.push(label(100, 70, many + " CHOICES", { size: 10 }));
      out.push(label(300, 70, few + " CHOICES", { size: 10 }));
      out.push(circle(100, 120, 7));
      var span = 130;
      for (var i = 0; i < many; i++) {
        var tx = 30 + (i / (many - 1)) * span;
        out.push(line(100, 120, tx, 260, 1.2, 0.45));
      }
      out.push(circle(300, 120, 7));
      for (var j = 0; j < few; j++) {
        var fx = few === 1 ? 300 : 250 + (j / (few - 1)) * 100;
        out.push(line(300, 120, fx, 260, 2.5, j === few - 1 ? 1 : 0.55));
        out.push(circle(fx, 260, 9, { hollow: j !== few - 1 }));
      }
      out.push(label(100, 320, "T = b log2(" + (many + 1) + ")", { size: 9 }));
      out.push(label(300, 320, "T = b log2(" + (few + 1) + ")", { size: 9 }));
      out.push(label(200, 360, "DECISION LATENCY SCALES WITH CHOICES", { size: 9 }));
      return out.join("");
    },

    /* Working memory: a bounded hull of active chunks with overflow satellites. */
    network: function (p) {
      var nodes = p.nodes || 7;
      var satellites = p.satellites || 2;
      var radius = p.hullRadius || 110;
      var coreLabel = p.coreLabel || (nodes + " CORE CHUNKS");
      var capacityLabel = p.capacityLabel || "CAPACITY: 7 +/- 2 UNITS";
      var surplus = p.surplusLabels || ["-2", "+2"];
      var out = [];
      out.push(
        '<circle cx="200" cy="180" r="' + radius +
        '" fill="currentColor" fill-opacity="0.04" stroke="currentColor" ' +
        'stroke-width="1.5" stroke-dasharray="4 4" opacity="0.7" ' + STROKE + "/>"
      );
      var inner = radius * 0.62;
      var positions = [
        [200, 120], [152, 152], [248, 152], [134, 206],
        [200, 216], [266, 206], [200, 164]
      ];
      for (var i = 0; i < nodes; i++) {
        var pt = positions[i % positions.length];
        var ang = (i / nodes) * Math.PI * 2;
        var x = i < positions.length ? pt[0] : 200 + Math.cos(ang) * inner;
        var y = i < positions.length ? pt[1] : 180 + Math.sin(ang) * inner;
        out.push(circle(x, y, 12, { opacity: 0.85 }));
      }
      for (var s = 0; s < satellites; s++) {
        var sx = s === 0 ? 200 - radius - 34 : 200 + radius + 34;
        out.push(circle(sx, 180, 12, { hollow: true, opacity: 0.45, width: 1.5 }));
        out.push(line(sx, 196, sx, 226, 1.2, 0.4, "2 2"));
      }
      out.push(label(200 - radius - 34, 248, surplus[0], { size: 9 }));
      out.push(label(200, 248, coreLabel, { size: 9 }));
      out.push(label(200 + radius + 34, 248, surplus[1], { size: 9 }));
      out.push(label(200, 340, capacityLabel, { size: 9 }));
      return out.join("");
    },

    /* Fitts's Law: long trip to a small target vs. short trip to a wide one. */
    "target-vector": function (p) {
      var hard = p.hard || { distance: 270, width: 20 };
      var easy = p.easy || { distance: 100, width: 180 };
      var out = [];
      var hx = 60 + hard.distance;
      var ex = 60 + easy.distance;
      out.push(circle(60, 120, 6));
      out.push(line(60, 120, hx, 120, 1.5, 0.55, "4 4"));
      out.push(rect(hx, 120 - hard.width / 2, hard.width, hard.width, {
        rx: 2, opacity: 0.8
      }));
      out.push(label(60, 100, "ORIGIN", { size: 9, anchor: "start" }));
      out.push(label(200, 100, "LONG D, SMALL W", { size: 9 }));
      out.push(circle(60, 240, 6));
      out.push(line(60, 240, ex, 240, 3, 0.9));
      out.push(rect(ex, 240 - 40, easy.width, 80, { rx: 6, opacity: 0.8 }));
      out.push(label(200, 300, "LARGE W, LOW D", { size: 9 }));
      out.push(label(200, 340, "T = a + b log2(1 + D/W)", { size: 10 }));
      return out.join("");
    },

    /* Accot-Zhai: two corridors of one length, the narrow one harder to steer. */
    "steering-tunnel": function (p) {
      var narrow = p.narrowWidth || 14;
      var wide = p.wideWidth || 120;
      var length = p.length || 240;
      var narrowLabel = p.narrowLabel || "NARROW CORRIDOR";
      var wideLabel = p.wideLabel || "WIDE CORRIDOR";
      var caption = p.caption || "";
      var x0 = 60;
      var x1 = x0 + length;
      var out = [];
      [
        { y: 120, width: narrow, text: narrowLabel },
        { y: 250, width: wide, text: wideLabel }
      ].forEach(function (row) {
        var half = row.width / 2;
        out.push(label(x0 + length / 2, row.y - half - 16, row.text, { size: 9 }));
        out.push(line(x0, row.y - half, x1, row.y - half, 1.5, 0.6));
        out.push(line(x0, row.y + half, x1, row.y + half, 1.5, 0.6));
        out.push(line(x1, row.y - half, x1, row.y + half, 2.5, 0.85));
        out.push(circle(x0, row.y, 5));
        out.push(line(x0 + 14, row.y, x1 - 8, row.y, 1.2, 0.4, "4 4"));
        out.push(circle(x0 + length * 0.55, row.y, 6, { opacity: 0.9 }));
      });
      out.push(label(200, 340, "T = a + b A / W", { size: 9 }));
      if (caption) out.push(label(200, 362, caption, { size: 9 }));
      return out.join("");
    },

    /* Serial Position: U-shaped recall curve, strong ends, weak middle. */
    "decay-curve": function (p) {
      var left = p.primacyX || 80;
      var right = p.recencyX || 320;
      var peak = p.peakY || 120;
      var trough = p.troughY || 240;
      var out = [];
      out.push(line(60, 280, 340, 280, 1, 0.3));
      out.push(
        '<path d="M ' + left + " " + peak + " C " + (left + 40) + " " +
        (trough + 20) + ", " + (right - 40) + " " + (trough + 20) + ", " +
        right + " " + peak + '" fill="none" stroke="currentColor" ' +
        'stroke-width="3.5" opacity="0.9" ' + STROKE + "/>"
      );
      out.push(circle(left, peak, 9));
      out.push(circle(200, trough, 8, { hollow: true, opacity: 0.5, width: 1.5 }));
      out.push(circle(right, peak, 9));
      out.push(label(left, peak - 20, "PRIMACY", { size: 9 }));
      out.push(label(200, trough + 28, "DECAY", { size: 9, opacity: 0.55 }));
      out.push(label(right, peak - 20, "RECENCY", { size: 9 }));
      out.push(label(200, 340, "SEQUENCE POSITION PREDICTS RECALL", { size: 9 }));
      return out.join("");
    },

    /* Decision quality over a session: a monotone decline, no rebound.
       SVG y grows downward, so a decline means startY < endY. Both control
       points interpolate between the endpoints, which makes every y(t) move
       in one direction by construction; the trait declared below additionally
       asserts that the card uses the shape downward. */
    "decline-curve": function (p) {
      var startY = p.startY == null ? 110 : p.startY;
      var endY = p.endY == null ? 260 : p.endY;
      var startLabel = p.startLabel || "START";
      var endLabel = p.endLabel || "END";
      var caption = p.caption || "";
      var c1y = startY + (endY - startY) * 0.35;
      var c2y = startY + (endY - startY) * 0.65;
      var out = [];
      out.push(line(60, 300, 340, 300, 1, 0.3));
      out.push(
        '<path d="M 60 ' + startY + ' C 150 ' + c1y + ", 250 " + c2y +
        ", 340 " + endY + '" fill="none" stroke="currentColor" ' +
        'stroke-width="3.5" opacity="0.9" ' + STROKE + "/>"
      );
      out.push(circle(60, startY, 9));
      out.push(circle(340, endY, 9));
      out.push(label(60, startY - 18, startLabel, { size: 9 }));
      /* The curve approaches the end point from above, so the end label sits
         below it; above would strike through the line. Fall back above only
         when the axis at y=300 leaves no room. */
      out.push(label(340, endY + 24 <= 290 ? endY + 24 : endY - 34,
        endLabel, { size: 9 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Complexity budget: one fixed track partitioned into labelled demands,
       optionally measured against a capacity line. */
    "split-bar": function (p) {
      var rows = p.rows || [];
      var max = p.max || 100;
      var ref = p.reference;
      var caption = p.caption || "";
      var x0 = 40;
      var track = 320;
      var top = 120;
      var gap = 80;
      var barH = 30;
      var out = [];
      rows.forEach(function (row, i) {
        var y = top + i * gap;
        out.push(label(x0, y - 16, row.label, { size: 9, anchor: "start" }));
        var x = x0;
        (row.segments || []).forEach(function (seg) {
          var sw = (seg.weight / max) * track;
          out.push(rect(x, y, sw, barH, {
            rx: 3,
            fill: seg.filled ? "currentColor" : "none",
            opacity: seg.filled ? 0.8 : 0.4,
            width: 1.5
          }));
          out.push(label(x + sw / 2, y + barH + 16, seg.label, { size: 8 }));
          x += sw;
        });
      });
      if (ref) {
        var rx = x0 + ref.at * track;
        /* Draw the threshold per bar, so it does not run through the row and
           segment labels that sit above and below each track. */
        out.push(line(rx, top - 34, rx, top - 6, 1.5, 0.75, "4 4"));
        rows.forEach(function (row, i) {
          var y = top + i * gap;
          out.push(line(rx, y, rx, y + barH, 1.5, 0.75, "4 4"));
        });
        out.push(label(rx, top - 42, ref.label, { size: 8 }));
      }
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Paired comparison: two panels of equal cells, one per condition. */
    "paired-panels": function (p) {
      var caption = p.caption || "";
      var size = p.cellSize || 0;
      var out = [];
      var top = 70;
      var panelH = 240;
      var panelW = 168;
      [
        { x: 26, panel: p.left || {} },
        { x: 206, panel: p.right || {} }
      ].forEach(function (side) {
        var panel = side.panel;
        var cells = panel.cells || 1;
        var cols = panel.columns || Math.min(cells, 3);
        var rows = Math.ceil(cells / cols);
        var pad = 16;
        var cellGap = 8;
        var cw;
        var chh;
        if (size) {
          cw = size;
          chh = size;
        } else {
          cw = (panelW - 2 * pad - (cols - 1) * cellGap) / cols;
          chh = Math.min(cw, (panelH - 2 * pad - (rows - 1) * cellGap) / rows);
        }
        var gridW = cols * cw + (cols - 1) * cellGap;
        var gridH = rows * chh + (rows - 1) * cellGap;
        var gx = side.x + (panelW - gridW) / 2;
        var gy = top + (panelH - gridH) / 2;
        out.push(rect(side.x, top, panelW, panelH, { rx: 6, opacity: 0.35, width: 1.5 }));
        out.push(label(side.x + panelW / 2, top - 14, panel.caption || "", { size: 9 }));
        for (var i = 0; i < cells; i++) {
          var r = Math.floor(i / cols);
          var c = i % cols;
          var filled = i < (panel.filled || 0);
          out.push(rect(gx + c * (cw + cellGap), gy + r * (chh + cellGap),
            cw, chh, {
              rx: 3,
              fill: filled ? "currentColor" : "none",
              opacity: filled ? 0.8 : 0.55,
              width: 1.5
            }));
        }
      });
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    }
  };

  /* Direction claims live on the shape, beside the drawing that must honour
     them. The acceptance gate holds a shape to the claim it makes here; a
     shape with no entry claims nothing. SVG y grows downward, so
     monotoneDown means each later sample is lower on the card (a larger y). */
  shapes["decay-curve"].traits = { monotoneDown: false };
  shapes["decline-curve"].traits = { monotoneDown: true };

  function renderSvg(metaphor) {
    if (!metaphor || !metaphor.svgShape) {
      throw new Error("graphicMetaphor.svgShape is required");
    }
    var draw = shapes[metaphor.svgShape];
    if (!draw) {
      throw new Error("unknown svgShape: " + metaphor.svgShape);
    }
    var body = draw(metaphor.parametricParams || {});
    return wrap(body);
  }

  var shapeTraits = {};
  Object.keys(shapes).forEach(function (name) {
    shapeTraits[name] = shapes[name].traits || null;
  });

  return {
    renderSvg: renderSvg,
    shapes: Object.keys(shapes),
    shapeTraits: shapeTraits
  };
});
