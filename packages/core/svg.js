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

  /* A mark can carry one blanket opacity or two independent channel opacities,
     never both: a fill-opacity multiplied by a stroke-opacity and then by an
     overall opacity is three numbers where the drawing meant two, and a reader
     cannot tell which one the ink answers to. Setting either channel opts out
     of the blanket attribute. */
  function rect(x, y, w, h, opts) {
    opts = opts || {};
    var fill = opts.fill || "none";
    var channels = "";
    if (fill !== "none" && opts.fillOpacity != null) {
      channels += ' fill-opacity="' + opts.fillOpacity + '"';
    }
    if (opts.strokeOpacity != null) {
      channels += ' stroke-opacity="' + opts.strokeOpacity + '"';
    }
    return (
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" rx="' + (opts.rx || 0) + '" fill="' + fill +
      '" stroke="currentColor" stroke-width="' + (opts.width || 2) + '"' +
      (channels ? channels : ' opacity="' + (opts.opacity == null ? 0.85 : opts.opacity) + '"') +
      " " + STROKE + "/>"
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
      var topY = 150 - inter / 2 - (rows - 1) * intra;
      var bottomY = 150 + inter / 2;
      [topY, bottomY].forEach(function (baseY) {
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
    "hierarchy": function (p) {
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
    "network": function (p) {
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
    },

    /* Power law of practice: time per trial drops steeply and then flattens.
       The control points put the fall early, which is what separates a power
       function from a straight decline. No rebound, so the trait below holds. */
    "power-curve": function (p) {
      var startY = p.startY == null ? 110 : p.startY;
      var endY = p.endY == null ? 282 : p.endY;
      var startLabel = p.startLabel || "TRIAL 1";
      var endLabel = p.endLabel || "TRIAL 100";
      var caption = p.caption || "";
      var drop = endY - startY;
      var c1y = startY + drop * 0.72;
      var c2y = endY - drop * 0.06;
      var out = [];
      out.push(line(60, 300, 340, 300, 1, 0.3));
      out.push(
        '<path d="M 60 ' + startY + ' C 105 ' + c1y + ", 245 " + c2y +
        ", 340 " + endY + '" fill="none" stroke="currentColor" ' +
        'stroke-width="3.5" opacity="0.9" ' + STROKE + "/>"
      );
      out.push(circle(60, startY, 9));
      out.push(circle(340, endY, 9));
      out.push(label(60, startY - 18, startLabel, { size: 9 }));
      out.push(label(340, endY + 24 <= 290 ? endY + 24 : endY - 34,
        endLabel, { size: 9 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Weber's ratio: the same stimuli crowd on a raw-intensity axis and space
       evenly on a ratio axis, because equal perceived steps are equal ratios. */
    "ratio-scale": function (p) {
      var steps = p.steps || 4;
      var base = p.base || 2;
      var linearLabel = p.linearLabel || "RAW INTENSITY";
      var ratioLabel = p.ratioLabel || "PERCEIVED STEPS";
      var caption = p.caption || "";
      var x0 = 60;
      var track = 280;
      var values = [];
      for (var i = 0; i < steps; i++) values.push(Math.pow(base, i));
      var span = values[steps - 1] - values[0];
      var out = [];
      [
        {
          y: 130,
          label: linearLabel,
          pos: function (i) {
            return x0 + track * (span === 0 ? 0 : (values[i] - values[0]) / span);
          }
        },
        {
          y: 265,
          label: ratioLabel,
          pos: function (i) {
            return x0 + track * (steps === 1 ? 0 : i / (steps - 1));
          }
        }
      ].forEach(function (row) {
        out.push(label(200, row.y - 30, row.label, { size: 9 }));
        out.push(line(x0, row.y, x0 + track, row.y, 1, 0.35));
        for (var j = 0; j < steps; j++) {
          var x = row.pos(j);
          out.push(line(x, row.y - 7, x, row.y + 7, 1.5, 0.75));
          out.push(label(x, row.y + 22, String(values[j]), { size: 8 }));
        }
      });
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Motion economy: a phone held in one hand, a target in the thumb zone and
       one in the far corner, and the two travel paths between hand and target. */
    "reach-map": function (p) {
      var detour = p.detour == null ? 55 : p.detour;
      var cornerLabel = p.cornerLabel || "TOP CORNER";
      var zoneLabel = p.zoneLabel || "THUMB ZONE";
      var longLabel = p.longLabel || "LONG REACH";
      var shortLabel = p.shortLabel || "SHORT REACH";
      var caption = p.caption || "";
      var out = [];
      out.push(rect(130, 45, 140, 270, { rx: 14, opacity: 0.35, width: 1.5 }));
      out.push(line(138, 250, 262, 250, 1.5, 0.5, "4 4"));
      out.push(label(200, 240, zoneLabel, { size: 8, opacity: 0.55 }));
      out.push(circle(200, 330, 7));
      out.push(
        '<path d="M 200 330 Q ' + (200 + detour) + " 190, 252 82" +
        '" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.85" ' +
        STROKE + "/>"
      );
      out.push(circle(252, 82, 6));
      out.push(label(248, 70, cornerLabel, { size: 8, anchor: "end" }));
      out.push(line(200, 330, 180, 288, 3, 0.9));
      out.push(circle(180, 288, 6));
      out.push(label(276, 198, longLabel, { size: 8, anchor: "start" }));
      out.push(label(162, 318, shortLabel, { size: 8, anchor: "end" }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Index of difficulty: movement time rises linearly with log2(D/W + 0.5),
       so the drawing is a straight line against the index, not a curve. */
    "difficulty-line": function (p) {
      var slope = p.slope == null ? 170 : p.slope;
      var lowLabel = p.lowLabel || "WIDE TARGET";
      var highLabel = p.highLabel || "NARROW TARGET";
      var formula = p.formula || "T = a + b log2(D/W + 0.5)";
      var caption = p.caption || "";
      var yAt = function (t) { return 292 - slope * (0.08 + 0.84 * t); };
      var out = [];
      out.push(line(70, 300, 340, 300, 1, 0.3));
      out.push(line(70, 300, 70, 60, 1, 0.3));
      out.push(label(205, 320, "INDEX OF DIFFICULTY", { size: 8 }));
      out.push(label(70, 48, "TIME", { size: 8 }));
      out.push(
        '<path d="M 90 ' + yAt(0) + " L 320 " + yAt(1) +
        '" fill="none" stroke="currentColor" stroke-width="3.5" opacity="0.9" ' +
        STROKE + "/>"
      );
      out.push(circle(120, yAt(0.13), 7));
      out.push(label(120, yAt(0.13) + 30, lowLabel, { size: 8 }));
      out.push(circle(290, yAt(0.87), 7));
      out.push(label(290, yAt(0.87) - 24, highLabel, { size: 8 }));
      out.push(label(205, 344, formula, { size: 9 }));
      if (caption) out.push(label(200, 368, caption, { size: 9 }));
      return out.join("");
    },

    /* Saccadic latency: clear vision is gathered at fixations, not while the
       eye travels between them, so the dwell points carry the marks. */
    "scan-path": function (p) {
      var fixations = p.fixations || 4;
      var fixationLabel = p.fixationLabel || "FIXATION";
      var saccadeLabel = p.saccadeLabel || "SACCADE";
      var caption = p.caption || "";
      var x0 = 60;
      var track = 280;
      var y = 190;
      var positions = [];
      var out = [];
      for (var i = 0; i < fixations; i++) {
        positions.push(x0 + track * (fixations === 1 ? 0 : i / (fixations - 1)));
      }
      for (var j = 1; j < positions.length; j++) {
        out.push(line(positions[j - 1], y, positions[j], y, 1.5, 0.5, "5 6"));
      }
      for (var k = 0; k < positions.length; k++) {
        out.push(circle(positions[k], y, 7, { opacity: 0.9 }));
      }
      out.push(label(positions[0], y - 24, fixationLabel, { size: 9 }));
      if (positions.length > 1) {
        out.push(label((positions[0] + positions[1]) / 2, y + 28,
          saccadeLabel, { size: 8, opacity: 0.6 }));
      }
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Isolation effect: one item differs from a field of uniform neighbors. */
    "odd-one-out": function (p) {
      var cols = p.columns || 5;
      var rows = p.rows || 3;
      var spacingX = p.spacingX == null ? 56 : p.spacingX;
      var spacingY = p.spacingY == null ? 62 : p.spacingY;
      var oddIndex = p.oddIndex == null ? 7 : p.oddIndex;
      var dotRadius = p.dotRadius == null ? 9 : p.dotRadius;
      var oddRadius = p.oddRadius == null ? 17 : p.oddRadius;
      var oddLabel = p.oddLabel || "DISTINCT";
      var caption = p.caption || "";
      var x0 = 200 - ((cols - 1) * spacingX) / 2;
      var y0 = 170 - ((rows - 1) * spacingY) / 2;
      var out = [];
      for (var i = 0; i < cols * rows; i++) {
        var x = x0 + (i % cols) * spacingX;
        var y = y0 + Math.floor(i / cols) * spacingY;
        if (i === oddIndex) {
          out.push(circle(x, y, oddRadius, { opacity: 0.9 }));
          /* Below the mark: above it, the label crowds the row that precedes. */
          out.push(label(x, y + oddRadius + 20, oddLabel, { size: 9 }));
        } else {
          out.push(circle(x, y, dotRadius, { hollow: true, opacity: 0.45, width: 1.5 }));
        }
      }
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Peak-end: a remembered episode peaks and then ends; the curve marks the
       two moments memory keeps, and no average is drawn because none is kept. */
    "peak-end-curve": function (p) {
      var startY = p.startY == null ? 240 : p.startY;
      var peakX = p.peakX == null ? 230 : p.peakX;
      var peakY = p.peakY == null ? 90 : p.peakY;
      var endY = p.endY == null ? 140 : p.endY;
      var peakLabel = p.peakLabel || "PEAK";
      var endLabel = p.endLabel || "END";
      var caption = p.caption || "";
      var c1x = 60 + (peakX - 60) * 0.6;
      var out = [];
      out.push(line(60, 300, 340, 300, 1, 0.3));
      out.push(line(60, 300, 60, 60, 1, 0.3));
      out.push(
        '<path d="M 60 ' + startY + " C " + c1x + " " + (startY - 60) +
        ", " + (peakX - 40) + " " + peakY + ", " + peakX + " " + peakY +
        " C " + (peakX + 40) + " " + peakY + ", 300 " + endY +
        ", 340 " + endY + '" fill="none" stroke="currentColor" ' +
        'stroke-width="3.5" opacity="0.9" ' + STROKE + "/>"
      );
      out.push(circle(peakX, peakY, 8));
      out.push(circle(340, endY, 8));
      out.push(label(peakX, peakY - 20, peakLabel, { size: 9 }));
      out.push(label(340, endY + 24, endLabel, { size: 9 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Anchoring: estimates gather near an initial number instead of near the
       value the evidence supports. */
    "anchor-line": function (p) {
      var anchorX = p.anchorX == null ? 110 : p.anchorX;
      var estimateGap = p.estimateGap == null ? 24 : p.estimateGap;
      var estimates = p.estimates || 3;
      var trueX = p.trueX == null ? 320 : p.trueX;
      var anchorLabel = p.anchorLabel || "ANCHOR";
      var estimateLabel = p.estimateLabel || "ESTIMATES";
      var trueLabel = p.trueLabel || "TRUE VALUE";
      var caption = p.caption || "";
      var y = 200;
      var out = [];
      out.push(line(40, y, 360, y, 1, 0.35));
      out.push(label(200, y + 40, estimateLabel, { size: 9 }));
      out.push(line(anchorX, y - 14, anchorX, y + 14, 3, 0.9));
      out.push(label(anchorX, y - 28, anchorLabel, { size: 9 }));
      for (var i = 0; i < estimates; i++) {
        out.push(circle(anchorX + estimateGap * (i + 1), y, 7, {
          hollow: true, opacity: 0.8, width: 1.5
        }));
      }
      out.push(circle(trueX, y, 9));
      out.push(line(trueX, y - 14, trueX, y + 14, 3, 0.9));
      out.push(label(trueX, y - 28, trueLabel, { size: 9 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Selective attention: several inputs reach a filter, one is admitted. */
    "filter-gate": function (p) {
      var channels = p.channels || 3;
      var gateX = p.gateX == null ? 210 : p.gateX;
      var passIndex = p.passIndex == null ? 1 : p.passIndex;
      var inputLabel = p.inputLabel || "INPUTS";
      var gateLabel = p.gateLabel || "FILTER";
      var outputLabel = p.outputLabel || "ATTENDED";
      var caption = p.caption || "";
      var top = 110;
      var gap = 70;
      var out = [];
      out.push(label(60, top - 40, inputLabel, { size: 9 }));
      out.push(label(gateX, top - 40, gateLabel, { size: 9 }));
      out.push(label(330, top - 40, outputLabel, { size: 9 }));
      out.push(line(gateX, top - 10, gateX, top + (channels - 1) * gap + 10, 2.5, 0.85));
      for (var i = 0; i < channels; i++) {
        var y = top + i * gap;
        out.push(line(60, y, gateX, y, 2, i === passIndex ? 0.9 : 0.45));
        out.push(circle(60, y, 5));
        if (i === passIndex) {
          out.push(line(gateX, y, 330, y, 3, 0.95));
          out.push(circle(330, y, 7));
        } else {
          /* Unattended channels are attenuated, not eliminated: the line runs
             on past the gate thinner and fainter, ending in a hollow dot. Solid
             rather than dashed, because a dash already means reference or limit
             elsewhere in this deck, and a cross would claim a hard block. */
          out.push(line(gateX, y, 330, y, 1.2, 0.35));
          out.push(circle(330, y, 5, { hollow: true, opacity: 0.9, width: 1.5 }));
        }
      }
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    "sunk-gate": function (p) {
      var gateX = p.gateX == null ? 200 : p.gateX;
      var spentLabel = p.spentLabel || "SPENT";
      var nowLabel = p.nowLabel || "NOW";
      var continueLabel = p.continueLabel || "CONTINUE";
      var caption = p.caption || "";
      var out = [];
      out.push(rect(60, 188, gateX - 24 - 60, 44, { rx: 3, fill: "currentColor", opacity: 0.8, width: 1.5 }));
      out.push(label(60 + (gateX - 24 - 60) / 2, 176, spentLabel, { size: 9 }));
      out.push(line(gateX, 96, gateX, 300, 2.5, 0.85));
      out.push(label(gateX, 84, nowLabel, { size: 9 }));
      out.push(line(gateX, 210, 330, 210, 3, 0.95));
      out.push(circle(330, 210, 7));
      out.push(label(335, 190, continueLabel, { size: 9, anchor: "end" }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    "gain-loss-bars": function (p) {
      /* The bars are the same height on purpose. A bar chart asserts magnitude
         whether or not a number is printed, so unequal bars would claim a ratio
         that the 1979 paper does not state - and would contradict the caption,
         which says the gain is the same size. The asymmetry rides in the fill
         instead: the loss is solid, the gain is a faint surface with a clear
         edge. Not an empty outline: an empty shape reads as nothing there,
         while a faint one reads as lighter, and only one of those is the claim.
         Hollow therefore means exactly one thing in this deck, and it lives in
         filter-gate. */
      var gainHeight = p.gainHeight == null ? 70 : p.gainHeight;
      var lossHeight = p.lossHeight == null ? 70 : p.lossHeight;
      var baseline = p.baseline == null ? 190 : p.baseline;
      var gainStyle = p.gainStyle || "faint";
      var lossStyle = p.lossStyle || "solid";
      var gainLabel = p.gainLabel || "GAIN";
      var lossLabel = p.lossLabel || "LOSS";
      var zeroLabel = p.zeroLabel || "ZERO";
      var caption = p.caption || "";
      var out = [];
      function bar(x, y, height, style) {
        return style === "faint"
          ? rect(x, y, 50, height, { rx: 3, fill: "currentColor", fillOpacity: 0.12, width: 2, strokeOpacity: 0.8 })
          : rect(x, y, 50, height, { rx: 3, fill: "currentColor", opacity: 0.8, width: 1.5 });
      }
      out.push(line(100, 60, 100, 320, 1.5, 0.5));
      out.push(line(100, baseline, 340, baseline, 1.5, 0.5));
      out.push(bar(140, baseline - gainHeight, gainHeight, gainStyle));
      out.push(bar(240, baseline, lossHeight, lossStyle));
      out.push(label(165, baseline - gainHeight - 14, gainLabel, { size: 9 }));
      out.push(label(265, baseline + lossHeight + 20, lossLabel, { size: 9 }));
      out.push(label(92, baseline + 4, zeroLabel, { size: 8, anchor: "end" }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    "goal-gradient": function (p) {
      var goalX = p.goalX == null ? 330 : p.goalX;
      var goalY = p.goalY == null ? 90 : p.goalY;
      var goalLabel = p.goalLabel || "GOAL";
      var startLabel = p.startLabel || "START";
      var caption = p.caption || "";
      var out = [];
      out.push(line(60, 300, 340, 300, 1, 0.3));
      out.push(line(60, 300, 60, 60, 1, 0.3));
      out.push('<path d="M 60 300 C 170 296, 280 240, ' + goalX + " " + goalY + '" fill="none" stroke="currentColor" stroke-width="3.5" opacity="0.9" ' + STROKE + '/>');
      out.push(line(goalX, goalY, goalX, 300, 1.5, 0.5, "4 4"));
      out.push(circle(goalX, goalY, 7));
      out.push(label(goalX, goalY - 16, goalLabel, { size: 9, anchor: "end" }));
      out.push(label(60, 320, startLabel, { size: 8 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    "default-fork": function (p) {
      var forkX = p.forkX == null ? 120 : p.forkX;
      var optionLabel = p.optionLabel || "OPTIONS";
      var defaultLabel = p.defaultLabel || "DEFAULT";
      var altLabel = p.altLabel || "ALTERNATIVE";
      var caption = p.caption || "";
      var out = [];
      out.push(line(100, 200, forkX, 200, 2, 0.6));
      out.push(circle(100, 200, 6));
      out.push(label(100, 176, optionLabel, { size: 9 }));
      out.push(line(forkX, 200, 330, 200, 3, 0.95));
      out.push(circle(330, 200, 7));
      out.push(label(335, 180, defaultLabel, { size: 9, anchor: "end" }));
      /* The alternative is solid. Fewer people take it, but it is not weaker:
         the thin line carries lower uptake, and a hollow mark would say the
         option itself is absent or disabled. */
      out.push(line(forkX, 200, 300, 280, 1.5, 0.45));
      out.push(circle(300, 280, 6, { opacity: 0.8 }));
      out.push(label(300, 306, altLabel, { size: 9 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Mental model: the picture in the head and the system's actual states are
       two planes, and each expectation projects onto the state it predicts.
       The mismatched expectation runs down and lands on nothing. */
    "model-projection": function (p) {
      var pairs = p.pairs || 4;
      var miss = p.mismatch == null ? 1 : p.mismatch;
      var caption = p.caption || "";
      var out = [];
      var span = 260;
      var xs = [];
      for (var i = 0; i < pairs; i++) {
        xs.push(70 + i * (pairs > 1 ? span / (pairs - 1) : 0));
      }
      out.push(rect(36, 80, 328, 84, { rx: 6, opacity: 0.35, width: 1.5 }));
      out.push(rect(36, 236, 328, 84, { rx: 6, opacity: 0.35, width: 1.5 }));
      out.push(label(200, 68, "WHAT THE USER EXPECTS", { size: 9 }));
      out.push(label(200, 314, "WHAT THE SYSTEM DOES", { size: 9 }));
      for (var j = 0; j < pairs; j++) {
        out.push(circle(xs[j], 122, 9, { opacity: 0.85 }));
        out.push(line(xs[j], 131, xs[j], j === miss ? 236 : 269, 1.5, 0.45, "5 5"));
        if (j !== miss) out.push(circle(xs[j], 278, 9, { opacity: 0.85 }));
      }
      /* The state the system actually has where none was expected. */
      var extra = xs[miss] + (miss + 1 < pairs ? (xs[miss + 1] - xs[miss]) / 2 : -40);
      out.push(circle(extra, 278, 9, { opacity: 0.55 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Conceptual integrity: three containers of different shapes, each built
       from the same header, body, and action grammar. */
    "shared-grammar": function (p) {
      var caption = p.caption || "";
      var out = [];
      [
        { x: 34, y: 92, w: 96, h: 150 },
        { x: 152, y: 118, w: 96, h: 150 },
        { x: 270, y: 84, w: 96, h: 150 }
      ].forEach(function (b) {
        out.push(rect(b.x, b.y, b.w, b.h, { rx: 6, opacity: 0.4, width: 1.5 }));
        out.push(line(b.x + 10, b.y + 30, b.x + b.w - 10, b.y + 30, 3, 0.8));
        for (var r = 0; r < 3; r++) {
          out.push(line(b.x + 10, b.y + 54 + r * 16, b.x + b.w - 34,
            b.y + 54 + r * 16, 1.5, 0.45));
        }
        out.push(rect(b.x + b.w - 34, b.y + b.h - 26, 24, 14, {
          rx: 3, opacity: 0.8, width: 1.5
        }));
      });
      out.push(label(200, 60, "HEADER, BODY, ACTION EVERY TIME", { size: 9 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Aesthetic-usability: the same rows, one set snapped to a shared grid and
       one set nudged off it. The drawing shows polish, not the perception. */
    "alignment-pair": function (p) {
      var jitter = p.jitter == null ? 1 : p.jitter;
      var caption = p.caption || "";
      var out = [];
      out.push(rect(30, 80, 160, 222, { rx: 6, opacity: 0.4, width: 1.5 }));
      out.push(rect(210, 80, 160, 222, { rx: 6, opacity: 0.4, width: 1.5 }));
      out.push(label(110, 68, "ON THE GRID", { size: 9 }));
      out.push(label(290, 68, "OFF THE GRID", { size: 9 }));
      var rows = [108, 148, 188, 228, 268];
      var dxs = [6, -7, 4, -6, 5];
      var dys = [-4, 6, -5, 4, -6];
      rows.forEach(function (y, i) {
        out.push(line(46, y, 130, y, 2, 0.6));
        out.push(rect(46, y + 10, 108, 16, { rx: 2, opacity: 0.4, width: 1.5 }));
        var dx = dxs[i] * jitter;
        var dy = dys[i] * jitter;
        out.push(line(226 + dx, y + dy, 310 + dx, y + dy, 2, 0.6));
        out.push(rect(226 + dx, y + 10 + dy, 108, 16, {
          rx: 2, opacity: 0.4, width: 1.5
        }));
      });
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Least astonishment: the path the label promises, and the path the
       control actually delivers. */
    "promise-line": function (p) {
      var caption = p.caption || "";
      var out = [];
      out.push(circle(70, 120, 8, { opacity: 0.9 }));
      out.push(label(70, 96, "STATED", { size: 9 }));
      out.push(line(78, 120, 322, 120, 2, 0.35, "6 6"));
      out.push(circle(330, 120, 8, { opacity: 0.4 }));
      out.push(label(330, 96, "EXPECTED", { size: 9 }));
      out.push(
        '<path d="M 78 120 C 160 120, 240 152, 322 272" fill="none" ' +
        'stroke="currentColor" stroke-width="3" opacity="0.9" ' + STROKE + "/>"
      );
      out.push(circle(330, 280, 8, { opacity: 0.9 }));
      out.push(label(330, 306, "DELIVERED", { size: 9 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Postel: varied input shapes enter a wide mouth; one repeated block
       leaves. The funnel walls converge on the throat, they do not filter. */
    "intake-funnel": function (p) {
      var variants = p.variants || 3;
      var outputs = p.outputs || 3;
      var caption = p.caption || "";
      var out = [];
      var inY = [130, 190, 250];
      var inGlyphs = [
        circle(62, inY[0], 9, { opacity: 0.85 }),
        rect(52, inY[1] - 9, 18, 18, { rx: 2, opacity: 0.85, width: 2 }),
        '<path d="M 62 ' + (inY[2] - 10) + ' L 72 ' + (inY[2] + 8) +
          ' L 52 ' + (inY[2] + 8) + ' Z" fill="currentColor" opacity="0.85" ' +
          STROKE + "/>"
      ];
      for (var i = 0; i < Math.min(variants, inGlyphs.length); i++) {
        out.push(inGlyphs[i]);
      }
      out.push(label(62, 96, "INPUT", { size: 9 }));
      out.push(line(92, 112, 196, 168, 2, 0.55));
      out.push(line(92, 268, 196, 212, 2, 0.55));
      out.push(line(196, 168, 236, 184, 2, 0.55));
      out.push(line(196, 212, 236, 196, 2, 0.55));
      var top = 190 - (outputs * 36) / 2 + 6;
      for (var j = 0; j < outputs; j++) {
        out.push(rect(258, top + j * 36, 92, 24, {
          rx: 3, opacity: 0.7, width: 2
        }));
      }
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Parsimony: two routes between the same two points. The winding one
       makes every stop; the straight one arrives without them. */
    "parsimony-path": function (p) {
      var caption = p.caption || "";
      var out = [];
      out.push(
        '<path d="M 60 300 L 95 175 L 145 210 L 195 120 L 245 155 L 295 105 ' +
        'L 340 100" fill="none" stroke="currentColor" stroke-width="2" ' +
        'opacity="0.35" stroke-dasharray="6 5" ' + STROKE + "/>"
      );
      out.push(line(60, 300, 340, 100, 3, 0.9));
      out.push(circle(60, 300, 9));
      out.push(circle(340, 100, 9));
      out.push(label(60, 328, "START", { size: 9 }));
      out.push(label(340, 76, "ARRIVE", { size: 9 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },
    /* Conway: the same chain of links in the team structure and in the
       product's screens. The correspondence lines are dashed because they
       are a claim about shape, not a measured connection. */
    "org-mirror": function (p) {
      var teams = p.teams || 3;
      var caption = p.caption || "";
      var out = [];
      var xs = [];
      for (var i = 0; i < teams; i++) {
        xs.push(70 + i * 130);
      }
      out.push(label(200, 52, "HOW THE TEAMS TALK", { size: 9 }));
      out.push(label(200, 232, "HOW THE SCREENS LINK", { size: 9 }));
      for (var j = 0; j < teams; j++) {
        out.push(rect(xs[j] - 30, 70, 60, 40, { rx: 4, opacity: 0.7, width: 1.5 }));
        out.push(rect(xs[j] - 30, 250, 60, 40, { rx: 4, opacity: 0.7, width: 1.5 }));
        out.push(line(xs[j], 111, xs[j], 249, 1.5, 0.3, "5 5"));
        if (j < teams - 1) {
          out.push(line(xs[j] + 30, 90, xs[j + 1] - 30, 90, 3, 0.85));
          out.push(line(xs[j] + 30, 270, xs[j + 1] - 30, 270, 3, 0.85));
        }
      }
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* The two gulfs: an intent that has to cross into an action, and a state
       that has to cross back into something the person can see. Each arrow
       has a gap in it because the gap is the subject. */
    "intent-gap": function (p) {
      var caption = p.caption || "";
      var out = [];
      out.push(circle(60, 175, 11, { opacity: 0.85 }));
      out.push(label(60, 147, "INTENT", { size: 9 }));
      out.push(rect(262, 150, 100, 100, { rx: 4, opacity: 0.7, width: 1.5 }));
      out.push(label(312, 205, "SYSTEM", { size: 9 }));
      out.push(line(71, 175, 158, 175, 3, 0.85));
      out.push(line(178, 175, 252, 175, 3, 0.85));
      out.push(
        '<path d="M 252 168 L 260 175 L 252 182 Z" fill="currentColor" opacity="0.85" ' +
        STROKE + "/>"
      );
      out.push(label(168, 148, "EXECUTION", { size: 9 }));
      out.push(line(254, 265, 178, 265, 3, 0.85));
      out.push(line(158, 265, 60, 265, 3, 0.85));
      out.push(line(60, 265, 60, 195, 3, 0.85));
      out.push(
        '<path d="M 53 194 L 60 186 L 67 194 Z" fill="currentColor" opacity="0.85" ' +
        STROKE + "/>"
      );
      out.push(label(168, 292, "EVALUATION", { size: 9 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Affordance: one control drawn as a raised surface, one as a recessed
       slot. Both read as operable; neither is a picture of a click. */
    "signifier-pair": function (p) {
      var caption = p.caption || "";
      var out = [];
      out.push(rect(50, 140, 120, 60, {
        rx: 8, fill: "currentColor", fillOpacity: 0.14, width: 2, strokeOpacity: 0.8
      }));
      out.push(line(60, 208, 160, 208, 3, 0.25));
      out.push(label(110, 128, "RAISED", { size: 9 }));
      out.push(rect(230, 140, 120, 60, { rx: 8, opacity: 0.6, width: 2 }));
      out.push(line(242, 148, 338, 148, 2, 0.35));
      out.push(label(290, 128, "RECESSED", { size: 9 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Feedback: an input that reaches the system and a return path that
       closes the loop back to the person who acted. */
    "feedback-loop": function (p) {
      var caption = p.caption || "";
      var out = [];
      out.push(rect(230, 160, 110, 70, { rx: 4, opacity: 0.7, width: 1.5 }));
      out.push(label(285, 200, "SYSTEM", { size: 9 }));
      out.push(line(60, 195, 222, 195, 3, 0.85));
      out.push(circle(52, 195, 9, { opacity: 0.85 }));
      out.push(line(300, 231, 300, 300, 2, 0.6));
      out.push(line(300, 300, 60, 300, 2, 0.6));
      out.push(line(60, 300, 60, 212, 2, 0.6));
      out.push(
        '<path d="M 52 220 L 60 204 L 68 220 Z" fill="currentColor" opacity="0.6" ' +
        STROKE + "/>"
      );
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Similarity: the same property repeated down a column, with two unlike
       columns between the alike ones. Grouping follows form, not adjacency.
       The columns are evenly spaced so that proximity offers no grouping at
       all: shape is the only varying cue in the drawing. */
    "similarity-columns": function (p) {
      var rows = p.rows || 4;
      var caption = p.caption || "";
      var out = [];
      var xs = [80, 160, 240, 320];
      var isSquare = [false, true, true, false];
      for (var c = 0; c < xs.length; c++) {
        for (var r = 0; r < rows; r++) {
          var y = 90 + r * 60;
          if (isSquare[c]) {
            out.push(rect(xs[c] - 12, y - 12, 24, 24, { rx: 1, opacity: 0.75, width: 2 }));
          } else {
            out.push(circle(xs[c], y, 12, { opacity: 0.75 }));
          }
        }
      }
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Common region: three equidistant marks, and a boundary around two of
       them. The boundary is the only grouping cue in the drawing. */
    "common-region": function (p) {
      var caption = p.caption || "";
      var out = [];
      out.push(rect(48, 150, 184, 100, {
        rx: 8, fill: "currentColor", fillOpacity: 0.07, width: 2, strokeOpacity: 0.8
      }));
      out.push(circle(100, 200, 12, { opacity: 0.85 }));
      out.push(circle(200, 200, 12, { opacity: 0.85 }));
      out.push(circle(300, 200, 12, { opacity: 0.85 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Pragnanz: the same twelve points, joined once with jitter and once as a
       circle. Both drawings are legal descriptions of the marks; the second is
       the one the visual system prefers. */
    "simplest-form": function (p) {
      var caption = p.caption || "";
      var jitter = [6, -8, 4, 10, -5, 7, -9, 3, 8, -6, 5, -4];
      var pts = [];
      for (var i = 0; i < 12; i++) {
        var a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        var r = 72 + jitter[i];
        pts.push([110 + r * Math.cos(a), 190 + r * Math.sin(a)]);
      }
      var d = "M " + pts.map(function (q) {
        return q[0].toFixed(1) + " " + q[1].toFixed(1);
      }).join(" L ") + " Z";
      var out = [];
      out.push('<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2" ' +
        'opacity="0.75" ' + STROKE + "/>");
      out.push(circle(290, 190, 72, { hollow: true, width: 2, opacity: 0.75 }));
      out.push(label(110, 96, "AS DRAWN", { size: 9 }));
      out.push(label(290, 96, "AS SEEN", { size: 9 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Closure: a whole ring beside a ring broken into four arcs. The broken
       one is not completed in the drawing; the reader supplies the missing
       segments, which is the claim. */
    "broken-ring": function (p) {
      var caption = p.caption || "";
      var out = [];
      out.push(circle(110, 190, 66, { hollow: true, width: 2, opacity: 0.75 }));
      out.push(label(110, 96, "WHOLE", { size: 9 }));
      var arcs = [[-80, -10], [10, 80], [100, 170], [190, 260]];
      var d = "";
      for (var i = 0; i < arcs.length; i++) {
        var a0 = (arcs[i][0] * Math.PI) / 180;
        var a1 = (arcs[i][1] * Math.PI) / 180;
        d += "M " + (290 + 66 * Math.cos(a0)).toFixed(1) + " " +
          (190 + 66 * Math.sin(a0)).toFixed(1) + " A 66 66 0 0 1 " +
          (290 + 66 * Math.cos(a1)).toFixed(1) + " " +
          (190 + 66 * Math.sin(a1)).toFixed(1) + " ";
      }
      out.push('<path d="' + d.trim() + '" fill="none" stroke="currentColor" ' +
        'stroke-width="2" opacity="0.75" ' + STROKE + "/>");
      out.push(label(290, 96, "BROKEN", { size: 9 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Figure and ground: one wavy contour divides one field into two regions,
       with no cue saying which region owns the edge. */
    "shared-edge": function (p) {
      var caption = p.caption || "";
      var wave = [[200, 90], [182, 125], [214, 160], [186, 195], [212, 230], [196, 280]];
      var d = "M 70 90 L 200 90 ";
      for (var i = 1; i < wave.length; i++) d += "L " + wave[i][0] + " " + wave[i][1] + " ";
      d += "L 70 280 Z";
      var out = [];
      out.push('<path d="' + d + '" fill="currentColor" fill-opacity="0.12" ' +
        'stroke="none"/>');
      out.push(rect(70, 90, 260, 190, { rx: 4, opacity: 0.75, width: 2 }));
      out.push('<path d="M 200 90 ' + wave.slice(1).map(function (q) {
        return "L " + q[0] + " " + q[1];
      }).join(" ") + '" fill="none" stroke="currentColor" stroke-width="3" ' +
        'opacity="0.85" ' + STROKE + "/>");
      out.push(label(120, 76, "FIGURE", { size: 9 }));
      out.push(label(280, 76, "GROUND", { size: 9 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Continuity: two curves cross, and each is drawn as one unbroken line
       through the crossing. A reading as two V shapes is available and less
       costly to the eye only if the curves are broken. */
    "crossing-curves": function (p) {
      var caption = p.caption || "";
      var out = [];
      out.push('<path d="M 55 120 C 130 120 170 280 345 280" fill="none" ' +
        'stroke="currentColor" stroke-width="3" opacity="0.8" ' + STROKE + "/>");
      out.push('<path d="M 55 280 C 130 280 170 120 345 120" fill="none" ' +
        'stroke="currentColor" stroke-width="3" opacity="0.8" ' + STROKE + "/>");
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Uniform connectedness: the same six marks at the same spacing, once with
       no link and once with a stroke joining the middle pair. The link, not the
       gap, decides the grouping in the second row. */
    "link-beats-gap": function (p) {
      var caption = p.caption || "";
      var xs = [70, 110, 150, 230, 270, 310];
      var out = [];
      for (var i = 0; i < xs.length; i++) {
        out.push(circle(xs[i], 120, 10, { opacity: 0.75 }));
        out.push(circle(xs[i], 250, 10, { opacity: 0.75 }));
      }
      out.push(line(160, 250, 220, 250, 3, 0.85));
      out.push(label(110, 88, "UNLINKED", { size: 9 }));
      out.push(label(110, 296, "LINKED", { size: 9 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Common fate: a field of static marks and four that carry the same
       direction arrow. Direction is drawn as an arrow because a still picture
       has no motion, and the caption says what the arrows stand for. */
    "shared-motion": function (p) {
      var caption = p.caption || "";
      var cols = p.columns || 4;
      var rows = p.rows || 3;
      var moving = p.moving || 0;
      var out = [];
      var x0 = 90, y0 = 140, stepX = 73, stepY = 60;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var x = x0 + c * stepX, y = y0 + r * stepY;
          out.push(circle(x, y, 11, { opacity: 0.7 }));
          if (c === moving) {
            /* The arrow sits above the mark and stops short of the next
               column: drawn between two marks it reads as a link, which is
               GES-08's claim, not this card's. */
            out.push(line(x - 16, y - 26, x + 14, y - 26, 3, 0.85));
            out.push('<path d="M ' + (x + 14) + ' ' + (y - 33) + ' L ' +
              (x + 24) + ' ' + (y - 26) + ' L ' + (x + 14) + ' ' + (y - 19) +
              ' Z" fill="currentColor" opacity="0.85" ' + STROKE + "/>");
          }
        }
      }
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Past experience: the Necker cube. The same twelve edges support two
       readings; nothing in the drawing prefers one, and habit supplies the
       rest. */
    "necker-cube": function (p) {
      var caption = p.caption || "";
      var out = [];
      var front = [[110, 130], [250, 130], [250, 270], [110, 270]];
      var back = [[150, 170], [290, 170], [290, 310], [150, 310]];
      for (var i = 0; i < 4; i++) {
        var j = (i + 1) % 4;
        out.push(line(front[i][0], front[i][1], front[j][0], front[j][1], 2.5, 0.8));
        out.push(line(back[i][0], back[i][1], back[j][0], back[j][1], 2.5, 0.8));
        out.push(line(front[i][0], front[i][1], back[i][0], back[i][1], 2.5, 0.8));
      }
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* A story that rises to a single turning point and comes down. The apex can
       sit anywhere along the span, which is what lets one drawing stand for a
       climax at the end and for one placed near the opening. Notches on the
       rising edge mark the crises that escalate before it. */
    "rise-fall-pyramid": function (p) {
      var peakX = p.peakX == null ? 0.5 : p.peakX;
      var crises = p.crises == null ? 0 : p.crises;
      var riseLabel = p.riseLabel || "RISE";
      var fallLabel = p.fallLabel || "FALL";
      var caption = p.caption || "";
      var leftX = 60;
      var rightX = 340;
      var baseY = 300;
      var apexX = leftX + (rightX - leftX) * peakX;
      var apexY = 90;
      var out = [];
      out.push(line(leftX, baseY, rightX, baseY, 1, 0.3));
      out.push(
        '<path d="M ' + leftX + " " + baseY + " L " + apexX + " " + apexY +
        " L " + rightX + " " + baseY + '" fill="none" stroke="currentColor" ' +
        'stroke-width="3.5" opacity="0.9" ' + STROKE + "/>"
      );
      /* Each crisis is a beat that dips and recovers on the way up: the story
         loses ground before it gains it. Their count is the parameter, so no
         notch is drawn when the shape claims none. */
      for (var i = 1; i <= crises; i++) {
        var t = (i / (crises + 1)) * peakX;
        var cx = leftX + (rightX - leftX) * t;
        var cy = baseY + (apexY - baseY) * (t / peakX);
        out.push(line(cx - 9, cy + 10, cx, cy - 6, 2, 0.75));
        out.push(circle(cx, cy, 5, { hollow: true, opacity: 0.55, width: 1.5 }));
      }
      out.push(circle(apexX, apexY, 9));
      out.push(label(apexX, apexY - 18, "TURN", { size: 9 }));
      out.push(label(leftX + 22, baseY - 12, riseLabel, { size: 9, anchor: "start", opacity: 0.6 }));
      out.push(label(rightX - 22, baseY - 12, fallLabel, { size: 9, anchor: "end", opacity: 0.6 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* A progression that returns to its starting point: the beats are numbered
       around one ring, so the last step and the first are neighbours. Sector
       count and starting angle place the marks; the labels name the beats. */
    "story-circle": function (p) {
      var sectors = p.sectors == null ? 8 : p.sectors;
      var startAngle = p.startAngle == null ? -90 : p.startAngle;
      var labels = p.labels || [];
      var caption = p.caption || "";
      var out = [];
      var cx = 200;
      var cy = 185;
      var r = 105;
      out.push(
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" ' +
        'stroke="currentColor" stroke-width="2.5" opacity="0.75" ' + "/>"
      );
      for (var i = 0; i < sectors; i++) {
        var angle = ((startAngle + (360 / sectors) * i) * Math.PI) / 180;
        var px = cx + Math.cos(angle) * r;
        var py = cy + Math.sin(angle) * r;
        out.push(circle(px, py, 8, { hollow: false, opacity: 0.9 }));
        out.push(label(px, py + 3.5, String(i + 1), {
          size: 7, opacity: 1, weight: 700
        }));
        var name = labels[i];
        if (name) {
          var lx = cx + Math.cos(angle) * (r + 34);
          var ly = cy + Math.sin(angle) * (r + 34);
          var anchor = Math.cos(angle) > 0.3 ? "start" : Math.cos(angle) < -0.3 ? "end" : "middle";
          out.push(label(lx, ly + 3, name, { size: 8, anchor: anchor, opacity: 0.6 }));
        }
      }
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* A story in proportional parts. The bars are the acts and their widths are
       the space each is given, so a lopsided narrative is visibly lopsided; the
       marker sits where the direction changes. */
    "three-act-blocks": function (p) {
      var weights = p.weights || [1, 2, 1];
      var gap = p.gap == null ? 8 : p.gap;
      var labels = p.labels || [];
      var turn = p.turn == null ? true : p.turn;
      var caption = p.caption || "";
      var out = [];
      var leftX = 50;
      var span = 300;
      var total = 0;
      for (var i = 0; i < weights.length; i++) total += weights[i];
      var x = leftX;
      var edges = [];
      for (var k = 0; k < weights.length; k++) {
        var width = (span - gap * (weights.length - 1)) * (weights[k] / total);
        out.push(rect(x, 120, width, 160, { rx: 4, opacity: 0.35, width: 2 }));
        out.push(label(x + width / 2, 200, String(k + 1), { size: 13, weight: 700 }));
        var name = labels[k];
        if (name) {
          out.push(label(x + width / 2, 300, name, { size: 8, opacity: 0.6 }));
        }
        edges.push(x);
        x += width + gap;
      }
      /* The turning point is the boundary between the opening and the body, at
         the first edge after the first block. A structure with equal parts and
         no reversal draws none. */
      if (turn && edges.length > 1) {
        out.push(line(edges[1] - gap / 2, 100, edges[1] - gap / 2, 322, 1.5, 0.6, "4 4"));
        out.push(label(edges[1] - gap / 2, 92, "TURN", { size: 8, opacity: 0.6 }));
      }
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* A short run of values as a sparkline: no axes, no grid, the line itself
       is the whole argument. One index is marked, because the shape is usually
       drawn to say "here". */
    "sparkline": function (p) {
      var points = p.points || [2, 4, 3, 7, 5, 9];
      var peakIndex = p.peakIndex == null ? points.length - 1 : p.peakIndex;
      var caption = p.caption || "";
      var leftX = 60;
      var span = 280;
      var topY = 150;
      var bottomY = 270;
      var out = [];
      var hi = Math.max.apply(null, points);
      var lo = Math.min.apply(null, points);
      var range = hi - lo || 1;
      var coords = [];
      for (var i = 0; i < points.length; i++) {
        var x = points.length === 1 ? leftX + span / 2 : leftX + (span * i) / (points.length - 1);
        var y = bottomY - ((points[i] - lo) / range) * (bottomY - topY);
        coords.push([x, y]);
      }
      var d = "M " + coords.map(function (c) { return c[0] + " " + c[1]; }).join(" L ");
      out.push(line(leftX, bottomY + 20, leftX + span, bottomY + 20, 1, 0.25));
      out.push(
        '<path d="' + d + '" fill="none" stroke="currentColor" ' +
        'stroke-width="3.5" opacity="0.9" ' + STROKE + "/>"
      );
      var mark = coords[peakIndex];
      if (mark) {
        out.push(circle(mark[0], mark[1], 9));
        out.push(label(mark[0], mark[1] - 20, "HERE", { size: 8 }));
      }
      out.push(label(200, 130, "NO AXES, ONE LINE", { size: 9, opacity: 0.5 }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Nested rings: the inner ring is the claim every outer ring must serve.
       Ring count and the space between rings are the parameters; the labels
       name what each ring stands for. */
    "concentric-circles": function (p) {
      var rings = p.rings == null ? 3 : p.rings;
      var spread = p.spread == null ? 22 : p.spread;
      var labels = p.labels || [];
      var caption = p.caption || "";
      var out = [];
      var cx = 175;
      var cy = 190;
      var core = 34;
      for (var i = 0; i < rings; i++) {
        var r = core + spread * (rings - 1 - i);
        out.push(
          '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" ' +
          'stroke="currentColor" stroke-width="2.5" opacity="' +
          (0.85 - i * 0.12) + '"' + " " + STROKE + "/>"
        );
        var name = labels[i];
        if (name) {
          out.push(label(cx + r + 8, cy + 4, name, {
            size: 8, anchor: "start", opacity: 0.6
          }));
        }
      }
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* A story that goes down before it goes up. The baseline it starts from and
       the baseline it ends on are separate numbers on purpose: a recovery that
       merely returns to where it began has told a different story from one that
       ends higher. */
    "fall-rise-curve": function (p) {
      var startY = p.startY == null ? 120 : p.startY;
      var bottomY = p.bottomY == null ? 280 : p.bottomY;
      var endY = p.endY == null ? 90 : p.endY;
      var startLabel = p.startLabel || "BEFORE";
      var bottomLabel = p.bottomLabel || "BOTTOM";
      var endLabel = p.endLabel || "AFTER";
      var caption = p.caption || "";
      var out = [];
      out.push(line(60, 310, 340, 310, 1, 0.3));
      out.push(
        '<path d="M 60 ' + startY + " C 110 " + (bottomY + 10) + ", 150 " +
        bottomY + ", 200 " + bottomY + " C 250 " + bottomY + ", 300 " +
        (endY + 20) + ", 340 " + endY + '" fill="none" stroke="currentColor" ' +
        'stroke-width="3.5" opacity="0.9" ' + STROKE + "/>"
      );
      out.push(circle(60, startY, 9));
      out.push(circle(200, bottomY, 8, { hollow: true, opacity: 0.6, width: 1.5 }));
      out.push(circle(340, endY, 9));
      out.push(label(60, startY - 16, startLabel, { size: 9, anchor: "start" }));
      out.push(label(200, bottomY + 24, bottomLabel, { size: 9, opacity: 0.6 }));
      out.push(label(340, endY - 16, endLabel, { size: 9, anchor: "end" }));
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    },

    /* Three limits read against their caps. A limit is meaningful only against
       the ceiling it is measured by, so each row prints both numbers: the track
       is the cap, the fill is what the work actually used. */
    "limit-gauges": function (p) {
      var labels = p.labels || ["FIRST", "SECOND", "THIRD"];
      var used = p.used || [6, 12, 24];
      var caps = p.caps || [10, 20, 30];
      var caption = p.caption || "";
      var out = [];
      var x0 = 60;
      var track = 260;
      for (var i = 0; i < labels.length; i++) {
        var y = 130 + i * 70;
        var cap = caps[i] || 1;
        var fill = used[i] / cap;
        out.push(label(x0, y - 14, labels[i], { size: 9, anchor: "start" }));
        out.push(rect(x0, y, track, 26, { rx: 3, width: 1.5, opacity: 0.5 }));
        out.push(rect(x0, y, track * fill, 26, {
          rx: 3, fill: "currentColor", opacity: 0.7, width: 0
        }));
        out.push(label(x0 + track + 10, y + 18, String(used[i]) + "/" + String(caps[i]), {
          size: 8, anchor: "start", opacity: 0.6
        }));
      }
      if (caption) out.push(label(200, 350, caption, { size: 9 }));
      return out.join("");
    }
  };

  /* Coordinates inside a path are rounded to a tenth of a unit: the drawing is
     the contract, not the floating-point noise a trig call leaves behind. */
  function coord(value) {
    return Math.round(value * 10) / 10;
  }

  /* --- Order: structures that hold ------------------------------------- */

  /* A stepped citadel. Each tier is narrower than the one it stands on, so the
     silhouette is a claim about inheritance as much as a building. */
  shapes["citadel"] = function (p) {
    var tiers = p.tiers || 3;
    var columns = p.columns || 5;
    var spread = p.spread || 150;
    var merlons = p.crenellations || 4;
    var out = [];
    var baseY = 320;
    var tierH = 46;
    var topY = baseY;
    for (var t = 0; t < tiers; t++) {
      var shrink = 1 - Math.min(t * 0.18, 0.62);
      var w = spread * shrink;
      var y = baseY - (t + 1) * (tierH - 4);
      out.push(rect(200 - w / 2, y, w, tierH - 8, { rx: 3, opacity: 0.3 + t * 0.07, width: 2 }));
      topY = y;
    }
    var topW = spread * (1 - Math.min((tiers - 1) * 0.18, 0.62));
    for (var c = 0; c < columns; c++) {
      var cx = 200 - topW / 2 + (topW / (columns + 1)) * (c + 1);
      out.push(line(cx, topY + 8, cx, topY + tierH - 16, 3, 0.85));
    }
    for (var m = 0; m < merlons; m++) {
      var mx = 200 - topW / 2 + (topW / (merlons + 1)) * (m + 1);
      out.push(rect(mx - 7, topY - 16, 14, 16, { opacity: 0.8, width: 1.5 }));
    }
    out.push(line(60, baseY + 12, 340, baseY + 12, 3, 0.85));
    out.push(label(200, 360, "ONE ORDER HOLDS", { size: 9 }));
    return out.join("");
  };

  /* A drafting compass over its construction square: two legs, the arc they
     swing, and the rings of an earlier attempt still faintly there. */
  shapes["drafting-compass"] = function (p) {
    var span = p.span || 34;
    var radius = p.radius || 118;
    var rings = p.rings || 3;
    var pivot = p.pivot || 130;
    var out = [];
    var rad = (span * Math.PI) / 180;
    var lx = 200 - Math.sin(rad) * radius;
    var rx = 200 + Math.sin(rad) * radius;
    var tipY = pivot + Math.cos(rad) * radius;
    out.push(rect(200 - radius * 0.8, pivot, radius * 1.6, radius * 0.7, { rx: 2, opacity: 0.2, width: 1.5 }));
    out.push(
      '<path d="M ' + coord(lx) + " " + coord(tipY) + " A " + coord(radius) + " " + coord(radius) +
      " 0 0 1 " + coord(rx) + " " + coord(tipY) + '" fill="none" stroke="currentColor" ' +
      'stroke-width="2.5" opacity="0.55" ' + STROKE + "/>"
    );
    out.push(line(200, pivot, lx, tipY, 3.5, 0.9));
    out.push(line(200, pivot, rx, tipY, 3.5, 0.9));
    for (var i = 1; i <= rings; i++) {
      out.push(circle(200, pivot, (radius / (rings + 1)) * i, { hollow: true, width: 1.5, opacity: 0.45 }));
    }
    out.push(circle(200, pivot, 7));
    out.push(label(200, 360, "DRAWN BEFORE BUILT", { size: 9 }));
    return out.join("");
  };

  /* Nested arms around a small protected mark. The aperture is the opening a
     caregiver leaves on purpose: protection without a door is confinement. */
  shapes["embrace"] = function (p) {
    var arcs = p.arcs || 3;
    var inset = p.inset || 24;
    var aperture = p.aperture || 92;
    var depth = p.depth || 190;
    var out = [];
    for (var i = 0; i < arcs; i++) {
      var k = i * inset;
      var left = 200 - aperture / 2 - k;
      var right = 200 + aperture / 2 + k;
      out.push(
        '<path d="M ' + coord(left) + " 96 C " + coord(left - 40) + " 150 " + coord(160 - k) + " " +
        coord(depth - 30) + " 200 " + coord(depth) + " C " + coord(240 + k) + " " + coord(depth - 30) + " " +
        coord(right + 40) + " 150 " + coord(right) + ' 96" fill="none" stroke="currentColor" ' +
        'stroke-width="' + Math.max(1, 3 - i * 0.4) + '" opacity="' + Math.max(0.25, 0.85 - i * 0.16) + '" ' +
        STROKE + "/>"
      );
    }
    out.push(circle(200, depth - 60, 12, { hollow: true, width: 2.5 }));
    out.push(label(200, 360, "SHELTER WITH A DOOR", { size: 9 }));
    return out.join("");
  };

  /* --- Mastery: the mark left on the world ----------------------------- */

  /* A shield, a spear, and the chevrons of a charge. The point is that the
     guard is behind the advance, not instead of it. */
  shapes["aegis"] = function (p) {
    var half = p.halfWidth || 62;
    var drop = p.drop || 118;
    var chevrons = p.chevrons || 3;
    var reach = p.reach || 26;
    var out = [];
    var top = 104;
    var shoulder = 188;
    out.push(
      '<path d="M ' + coord(200 - half) + " " + top + " Q 200 " + (top - 18) + " " + coord(200 + half) +
      " " + top + " L " + coord(200 + half) + " " + shoulder + " Q 200 " + (shoulder + drop) + " " +
      coord(200 - half) + " " + shoulder + ' Z" fill="none" stroke="currentColor" stroke-width="3" ' +
      'opacity="0.85" ' + STROKE + "/>"
    );
    out.push(line(200, top - 34, 200, shoulder + drop - 6, 3, 0.85));
    for (var i = 0; i < chevrons; i++) {
      var y = shoulder - 18 - i * 24;
      out.push(line(200 - reach, y, 200, y - 14, 3, 0.9));
      out.push(line(200, y - 14, 200 + reach, y, 3, 0.9));
    }
    out.push(label(200, 360, "FIRST ACROSS, THEN BACK", { size: 9 }));
    return out.join("");
  };

  /* A ring cut into arcs, each gap a deliberate breach, each arc carrying its
     own outward mark. What is broken is still a ring. */
  shapes["severed-ring"] = function (p) {
    var gaps = p.gaps || 3;
    var gapAngle = p.gapAngle || 18;
    var radius = p.radius || 108;
    var offset = p.offset || 0;
    var out = [];
    var segment = 360 / gaps;
    for (var i = 0; i < gaps; i++) {
      var start = offset + i * segment + gapAngle / 2;
      var end = offset + (i + 1) * segment - gapAngle / 2;
      if (end - start < 2) continue;
      var a1 = (start * Math.PI) / 180;
      var a2 = (end * Math.PI) / 180;
      out.push(
        '<path d="M ' + coord(200 + Math.cos(a1) * radius) + " " + coord(200 + Math.sin(a1) * radius) +
        " A " + coord(radius) + " " + coord(radius) + " 0 0 1 " +
        coord(200 + Math.cos(a2) * radius) + " " + coord(200 + Math.sin(a2) * radius) +
        '" fill="none" stroke="currentColor" stroke-width="3.5" opacity="0.85" ' + STROKE + "/>"
      );
      var mid = (((start + end) / 2) * Math.PI) / 180;
      out.push(line(
        200 + Math.cos(mid) * (radius - 16), 200 + Math.sin(mid) * (radius - 16),
        200 + Math.cos(mid) * (radius + 14), 200 + Math.sin(mid) * (radius + 14), 3, 0.8
      ));
    }
    out.push(circle(200, 200, 12, { hollow: true, width: 2 }));
    out.push(label(200, 360, "THE RING IS THE ARGUMENT", { size: 9 }));
    return out.join("");
  };

  /* Two triangles sharing a centre, one turned against the other, and the
     orbit of marks that watch them. Turn one and the same points point
     elsewhere. */
  shapes["hexagram"] = function (p) {
    var size = p.size || 110;
    var spin = p.spin || 30;
    var dots = p.dots || 6;
    var orbit = p.orbit || 148;
    var out = [];
    function triangle(rotation, opacity) {
      var pts = [];
      for (var v = 0; v < 3; v++) {
        var a = ((rotation + v * 120 - 90) * Math.PI) / 180;
        pts.push(coord(200 + Math.cos(a) * size) + "," + coord(200 + Math.sin(a) * size));
      }
      return (
        '<polygon points="' + pts.join(" ") + '" fill="none" stroke="currentColor" ' +
        'stroke-width="3" opacity="' + opacity + '" ' + STROKE + "/>"
      );
    }
    out.push(triangle(0, 0.85));
    out.push(triangle(spin, 0.65));
    for (var d = 0; d < dots; d++) {
      var da = ((d * 360) / dots + spin) * (Math.PI / 180);
      out.push(circle(200 + Math.cos(da) * orbit, 200 + Math.sin(da) * orbit, 6, { opacity: 0.8 }));
    }
    out.push(circle(200, 200, 9, { hollow: true, width: 2 }));
    out.push(label(200, 360, "TURN IT AND THE MARK MOVES", { size: 9 }));
    return out.join("");
  };

  /* --- Belonging: the links that make a group -------------------------- */

  /* A row of rings that only holds because each overlaps the next. */
  shapes["interlock"] = function (p) {
    var rings = p.rings || 4;
    var radius = p.radius || 58;
    var overlap = p.overlap || 26;
    var y = p.y || 195;
    var out = [];
    var step = radius * 2 - overlap;
    var startX = 200 - (step * (rings - 1)) / 2;
    for (var i = 0; i < rings; i++) {
      out.push(circle(startX + i * step, y, radius, { hollow: true, width: 3, opacity: 0.85 }));
    }
    out.push(label(200, 360, "NO RING CLOSES ON ITS OWN", { size: 9 }));
    return out.join("");
  };

  /* Two circles and the lens between them: the shared ground, drawn again and
     again inside it, is the only part neither circle owns. */
  shapes["vesica"] = function (p) {
    var radius = p.radius || 96;
    var separation = p.separation || 92;
    var petals = p.petals || 3;
    var cy = p.cy || 200;
    var out = [];
    var dx = separation / 2;
    out.push(circle(200 - dx, cy, radius, { hollow: true, width: 3, opacity: 0.85 }));
    out.push(circle(200 + dx, cy, radius, { hollow: true, width: 3, opacity: 0.85 }));
    var half = Math.sqrt(Math.max(1, radius * radius - dx * dx));
    for (var i = 1; i <= petals; i++) {
      var k = (i / (petals + 1)) * half;
      out.push(
        '<path d="M 200 ' + coord(cy - k) + " Q " + coord(200 + dx * 0.8) + " " + coord(cy) + " 200 " +
        coord(cy + k) + " Q " + coord(200 - dx * 0.8) + " " + coord(cy) + " 200 " + coord(cy - k) +
        '" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.6" ' + STROKE + "/>"
      );
    }
    out.push(label(200, 360, "THE SHARED GROUND IS THE POINT", { size: 9 }));
    return out.join("");
  };

  /* A fool's staff that bends, with the bells hanging off the bend. */
  shapes["bells"] = function (p) {
    var bells = p.bells || 3;
    var curl = p.curl || 90;
    var swing = p.swing || 34;
    var length = p.length || 240;
    var out = [];
    var x0 = 200 - length / 2;
    var x1 = 200 + length / 2;
    out.push(
      '<path d="M ' + coord(x0) + " 300 Q 200 " + coord(300 - curl) + " " + coord(x1) +
      ' 108" fill="none" stroke="currentColor" stroke-width="3" opacity="0.85" ' + STROKE + "/>"
    );
    for (var i = 0; i < bells; i++) {
      var t = (i + 0.5) / bells;
      var mt = 1 - t;
      var bx = mt * mt * x0 + 2 * mt * t * 200 + t * t * x1;
      var by = mt * mt * 300 + 2 * mt * t * (300 - curl) + t * t * 108;
      out.push(line(bx, by, bx, by + swing, 1.5, 0.6));
      out.push(circle(bx, by + swing + 6, 7, { hollow: true, width: 2 }));
    }
    out.push(label(200, 360, "THE STAFF BENDS; THE JOKE LANDS", { size: 9 }));
    return out.join("");
  };

  /* --- Independence: the outward journey ------------------------------- */

  /* A ring of petals around an open core. The light is offered, not argued. */
  shapes["sun-petals"] = function (p) {
    var petals = p.petals || 8;
    var length = p.length || 128;
    var core = p.core || 30;
    var tilt = p.tilt || 0;
    var out = [];
    for (var i = 0; i < petals; i++) {
      var a = ((i * 360) / petals + tilt) * (Math.PI / 180);
      var ux = Math.cos(a);
      var uy = Math.sin(a);
      var tipX = 200 + ux * length;
      var tipY = 200 + uy * length;
      var baseX = 200 + ux * core;
      var baseY = 200 + uy * core;
      var nx = -uy * 16;
      var ny = ux * 16;
      out.push(
        '<path d="M ' + coord(baseX) + " " + coord(baseY) + " Q " + coord(baseX + nx) + " " +
        coord(baseY + ny) + " " + coord(tipX) + " " + coord(tipY) + " Q " + coord(baseX - nx) + " " +
        coord(baseY - ny) + " " + coord(baseX) + " " + coord(baseY) +
        ' Z" fill="currentColor" opacity="0.55" ' + STROKE + "/>"
      );
    }
    out.push(circle(200, 200, core, { hollow: true, width: 3 }));
    out.push(label(200, 360, "WARMTH WITHOUT ARGUMENT", { size: 9 }));
    return out.join("");
  };

  /* A lens between two rings and a ray that bends to a measured point: the
     reading is only as good as the instrument that made it. */
  shapes["lens"] = function (p) {
    var rings = p.rings || 3;
    var radius = p.radius || 74;
    var split = p.split || 32;
    var focal = p.focal || 128;
    var out = [];
    for (var i = 1; i <= rings; i++) {
      out.push(circle(200, 196, (radius / rings) * i, { hollow: true, width: 1.5, opacity: 0.45 }));
    }
    out.push(
      '<path d="M 200 112 Q 258 196 200 280 Q 142 196 200 112 Z" fill="none" ' +
      'stroke="currentColor" stroke-width="3" opacity="0.85" ' + STROKE + "/>"
    );
    out.push(line(40, 196, 200, 196, 2.5, 0.8));
    var a = (split * Math.PI) / 180;
    var fx = 200 + Math.cos(a) * focal;
    var fy = 196 + Math.sin(a) * focal;
    out.push(line(200, 196, fx, fy, 2.5, 0.8));
    out.push(circle(fx, fy, 7));
    out.push(label(200, 360, "MEASURE, THEN SAY WHY", { size: 9 }));
    return out.join("");
  };

  /* A compass rose with the needle off the cardinal axes, over the line where
     the known map ends. */
  shapes["compass-needle"] = function (p) {
    var bearing = p.bearing || 32;
    var needle = p.needle || 104;
    var horizon = p.horizon || 268;
    var ticks = p.ticks || 8;
    var out = [];
    out.push(circle(200, 186, 118, { hollow: true, width: 2.5, opacity: 0.8 }));
    for (var i = 0; i < ticks; i++) {
      var a = ((i * 360) / ticks) * (Math.PI / 180);
      out.push(line(
        200 + Math.cos(a) * 104, 186 + Math.sin(a) * 104,
        200 + Math.cos(a) * 118, 186 + Math.sin(a) * 118, 2, 0.6
      ));
    }
    var b = ((bearing - 90) * Math.PI) / 180;
    var tipX = 200 + Math.cos(b) * needle;
    var tipY = 186 + Math.sin(b) * needle;
    out.push(line(200, 186, tipX, tipY, 3.5, 0.95));
    out.push(circle(tipX, tipY, 8));
    out.push(line(40, horizon, 360, horizon, 2.5, 0.6, "6 5"));
    out.push(label(200, 360, "THE EDGE OF THE KNOWN MAP", { size: 9 }));
    return out.join("");
  };

  /* --- Narrative functions: the roles a scene runs on ------------------ */

  /* A gate: two posts, bars that stop short of the middle, and the keystone
     over the gap. The passage is the point of the blockage. */
  shapes["gate"] = function (p) {
    var bars = p.bars || 5;
    var aperture = p.aperture || 84;
    var spread = p.postSpread || 132;
    var keystone = p.keystone || 54;
    var out = [];
    var left = 200 - spread / 2;
    var right = 200 + spread / 2;
    out.push(rect(left - 10, 96, 10, 212, { opacity: 0.85, width: 2 }));
    out.push(rect(right, 96, 10, 212, { opacity: 0.85, width: 2 }));
    for (var i = 0; i < bars; i++) {
      var y = 120 + i * (168 / bars);
      out.push(line(left, y, 200 - aperture / 2, y, 2.5, 0.75));
      out.push(line(200 + aperture / 2, y, right, y, 2.5, 0.75));
    }
    out.push(
      '<path d="M ' + coord(200 - keystone) + " 96 L " + coord(200 + keystone) + " 96 L " +
      coord(200 + keystone * 0.6) + " 66 L " + coord(200 - keystone * 0.6) +
      ' 66 Z" fill="none" stroke="currentColor" stroke-width="3" opacity="0.9" ' + STROKE + "/>"
    );
    out.push(label(200, 360, "NOT EVERYONE CROSSES", { size: 9 }));
    return out.join("");
  };

  /* A call from one point outward: the arcs arrive before anything has been
     explained. */
  shapes["clarion"] = function (p) {
    var waves = p.waves || 3;
    var spread = p.spread || 54;
    var steps = p.steps || 44;
    var origin = p.origin || 120;
    var out = [];
    var ox = 200 - origin;
    var oy = 250;
    for (var i = 1; i <= waves; i++) {
      var r = steps * i;
      var a1 = (-spread * Math.PI) / 180;
      var a2 = (spread * Math.PI) / 180;
      out.push(
        '<path d="M ' + coord(ox + Math.cos(a1) * r) + " " + coord(oy + Math.sin(a1) * r) + " A " +
        coord(r) + " " + coord(r) + " 0 0 1 " + coord(ox + Math.cos(a2) * r) + " " +
        coord(oy + Math.sin(a2) * r) + '" fill="none" stroke="currentColor" stroke-width="' +
        Math.max(1.5, 3 - i * 0.3) + '" opacity="' + Math.max(0.3, 0.9 - i * 0.12) + '" ' + STROKE + "/>"
      );
    }
    out.push(circle(ox, oy, 9));
    out.push(label(200, 360, "THE CALL COMES BEFORE THE REASON", { size: 9 }));
    return out.join("");
  };

  /* The same mask drawn more than once, each copy turned and displaced, with
     the eyes held in one place: which face answered is the question. */
  shapes["mask"] = function (p) {
    var layers = p.layers || 3;
    var drift = p.drift || 14;
    var rotation = p.rotation || 8;
    var eye = p.eye || 30;
    var out = [];
    for (var i = layers - 1; i >= 0; i--) {
      var cx = 200 + i * drift;
      var cy = 190 + i * drift * 0.6;
      var turn = (rotation * i * Math.PI) / 180;
      out.push(
        '<rect x="' + coord(cx - 78) + '" y="' + coord(cy - 96) + '" width="156" height="192" rx="34" ' +
        'fill="none" stroke="currentColor" stroke-width="' + Math.max(1, 3 - i * 0.4) + '" opacity="' +
        Math.max(0.2, 0.85 - i * 0.16) + '" transform="rotate(' + coord((turn * 180) / Math.PI) + " " +
        coord(cx) + " " + coord(cy) + ')" ' + STROKE + "/>"
      );
    }
    out.push(rect(200 - eye - 26, 170, 24, 12, { rx: 6, opacity: 0.9, width: 2 }));
    out.push(rect(200 + eye, 170, 24, 12, { rx: 6, opacity: 0.9, width: 2 }));
    out.push(label(200, 360, "WHICH FACE ANSWERED", { size: 9 }));
    return out.join("");
  };

  /* Two forms standing in the same direction with the load shared between
     them: the braces are what makes it a pair rather than a crowd. */
  shapes["flank"] = function (p) {
    var braces = p.braces || 3;
    var gap = p.gap || 96;
    var height = p.height || 208;
    var lean = p.lean || 0;
    var out = [];
    var left = 200 - gap / 2;
    var right = 200 + gap / 2;
    var top = 300 - height;
    out.push(
      '<path d="M ' + coord(left - 22 + lean) + " 300 L " + coord(left - 22 - lean) + " " + coord(top) +
      " L " + coord(left + 6 - lean) + " " + coord(top) + " L " + coord(left + 6 + lean) +
      ' 300 Z" fill="none" stroke="currentColor" stroke-width="3" opacity="0.85" ' + STROKE + "/>"
    );
    out.push(
      '<path d="M ' + coord(right - 6 + lean) + " 300 L " + coord(right - 6 - lean) + " " + coord(top) +
      " L " + coord(right + 22 - lean) + " " + coord(top) + " L " + coord(right + 22 + lean) +
      ' 300 Z" fill="none" stroke="currentColor" stroke-width="3" opacity="0.85" ' + STROKE + "/>"
    );
    for (var i = 0; i < braces; i++) {
      var y = braces === 1 ? top + height / 2 : top + 20 + (i * (height - 40)) / (braces - 1);
      out.push(line(left + 6, y, right - 6, y, 2.5, 0.7));
    }
    out.push(label(200, 360, "SAME DIRECTION, SHARED LOAD", { size: 9 }));
    return out.join("");
  };

  /* Direction claims live on the shape, beside the drawing that must honour
     them. The acceptance gate holds a shape to the claim it makes here; a
     shape with no entry claims nothing. SVG y grows downward, so
     monotoneDown means each later sample is lower on the card (a larger y). */
  shapes["decay-curve"].traits = { monotoneDown: false };
  shapes["decline-curve"].traits = { monotoneDown: true };
  shapes["power-curve"].traits = { monotoneDown: true };

  /* A bounded field with one vector inside it: the stage's work is deciding
     what is inside the frame and which way the room will push. */
  shapes["framing-square"] = function (p) {
    var bounds = p.bounds || 90;
    var angle = p.angle || 35;
    var reach = p.reach || 95;
    var grid = p.grid || 4;
    var out = [];
    var cx = 200;
    var cy = 190;
    out.push(rect(cx - bounds, cy - bounds, bounds * 2, bounds * 2, { rx: 4, width: 2, opacity: 0.45 }));
    for (var i = 1; i <= grid; i++) {
      var t = (bounds * 2 * i) / (grid + 1);
      out.push(line(cx - bounds, cy - bounds + t, cx + bounds, cy - bounds + t, 1, 0.22));
      out.push(line(cx - bounds + t, cy - bounds, cx - bounds + t, cy + bounds, 1, 0.22));
    }
    var rad = (angle * Math.PI) / 180;
    var tx = cx + Math.cos(rad) * reach;
    var ty = cy - Math.sin(rad) * reach;
    out.push(line(cx, cy, tx, ty, 2.5, 0.95));
    out.push(circle(cx, cy, 4, { width: 1.5, opacity: 0.9, fill: "currentColor" }));
    var head = 9;
    out.push(line(tx, ty, tx - head * Math.cos(rad - 0.5), ty + head * Math.sin(rad - 0.5), 2, 0.95));
    out.push(line(tx, ty, tx - head * Math.cos(rad + 0.5), ty + head * Math.sin(rad + 0.5), 2, 0.95));
    return out.join("");
  };

  /* Rays from one point that broaden as they travel: the spread of options
     before anything is chosen. */
  shapes["divergent-fan"] = function (p) {
    var rays = p.rays || 7;
    var spread = p.spread || 96;
    var length = p.length || 130;
    var offset = p.offset || 0;
    var out = [];
    var ox = 200 + offset;
    var oy = 310;
    var half = (spread * Math.PI) / 360;
    out.push(circle(ox, oy, 5, { width: 1.5, fill: "currentColor", opacity: 0.9 }));
    for (var i = 0; i < rays; i++) {
      var t = rays === 1 ? 0.5 : i / (rays - 1);
      var a = -Math.PI / 2 - half + t * half * 2;
      var x = ox + Math.cos(a) * length;
      var y = oy + Math.sin(a) * length;
      out.push(line(ox, oy, x, y, 1.6, 0.55 + t * 0.35));
      out.push(circle(x, y, 4, { width: 1.4, opacity: 0.9 }));
    }
    return out.join("");
  };

  /* Many ways in, one way out, and one path carrying more weight than the
     rest: convergence with a visible choice. */
  shapes["convergent-funnel"] = function (p) {
    var inlets = p.inlets || 6;
    var width = p.width || 180;
    var depth = p.depth || 140;
    var chosen = p.chosen || 1;
    var out = [];
    var top = 90;
    var apexY = top + depth;
    out.push(circle(200, apexY, 6, { width: 2, fill: "currentColor", opacity: 0.95 }));
    for (var i = 0; i < inlets; i++) {
      var x = 200 - width / 2 + (width / (inlets - 1 || 1)) * i;
      var heavy = i === (chosen - 1) % inlets;
      out.push(circle(x, top, heavy ? 5 : 3.5, { width: heavy ? 2 : 1.2, opacity: heavy ? 0.95 : 0.5 }));
      out.push(line(x, top, 200, apexY, heavy ? 2.4 : 1.1, heavy ? 0.95 : 0.32));
    }
    return out.join("");
  };

  /* Concentric rings with a doorway cut through every one of them, and people
     placed around the outer ring: a structure that is meant to be entered. */
  shapes["liberating-rings"] = function (p) {
    var rings = p.rings || 3;
    var gap = p.gap || 34;
    var dots = p.dots || 5;
    var tilt = p.tilt || 0;
    var out = [];
    var cx = 200;
    var cy = 195;
    var start = (gap * Math.PI) / 360;
    var end = Math.PI * 2 - start;
    for (var r = 0; r < rings; r++) {
      var radius = 48 + r * 34;
      var x1 = cx + Math.cos(start) * radius;
      var y1 = cy + Math.sin(start) * radius;
      var x2 = cx + Math.cos(end) * radius;
      var y2 = cy + Math.sin(end) * radius;
      out.push(
        '<path d="M ' + coord(x1) + " " + coord(y1) + " A " + coord(radius) + " " + coord(radius) +
        " 0 1 0 " + coord(x2) + " " + coord(y2) + '" fill="none" stroke="currentColor" ' +
        'stroke-width="' + (2 - r * 0.3) + '" stroke-linecap="round"' + STROKE + "/>"
      );
    }
    var offset = (tilt * Math.PI) / 180;
    for (var d = 0; d < dots; d++) {
      var a = offset + (Math.PI * 2 * d) / dots;
      out.push(circle(cx + Math.cos(a) * 44, cy + Math.sin(a) * 44, 4, { width: 1.4, fill: "currentColor", opacity: 0.8 }));
    }
    return out.join("");
  };

  /* Steps that climb, a line tracing the climb, and a marker on the one the
     room committed to: planning as a sequence with a first commitment. */
  shapes["action-steps"] = function (p) {
    var steps = p.steps || 4;
    var rise = p.rise || 26;
    var run = p.run || 58;
    var marker = p.marker || 1;
    var out = [];
    var baseY = 310;
    var startX = 200 - (run * (steps - 1)) / 2 - 22;
    var tops = [];
    for (var i = 0; i < steps; i++) {
      var h = 34 + i * rise;
      var x = startX + i * run;
      var y = baseY - h;
      out.push(rect(x, y, run - 14, h, { rx: 3, width: 1.8, opacity: 0.35 + i * 0.06 }));
      tops.push([x + (run - 14) / 2, y]);
    }
    out.push(
      '<path d="M ' + tops.map(function (t) { return coord(t[0]) + " " + coord(t[1]); }).join(" L ") +
      '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"' + STROKE + "/>"
    );
    var chosen = tops[(marker - 1) % steps];
    out.push(line(chosen[0], chosen[1], chosen[0], chosen[1] - 28, 2, 0.9));
    out.push(
      '<path d="M ' + coord(chosen[0]) + " " + coord(chosen[1] - 28) + " L " +
      coord(chosen[0] + 18) + " " + coord(chosen[1] - 22) + " L " +
      coord(chosen[0]) + " " + coord(chosen[1] - 16) + '" fill="currentColor" stroke="none"/>'
    );
    out.push(line(40, baseY + 6, 360, baseY + 6, 2, 0.5));
    return out.join("");
  };

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
