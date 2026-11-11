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

  // One vendored face first, not a stack that resolves differently per machine:
  // packages/prepress/fonts/JetBrainsMono is passed to Typst with --font-path,
  // so the print build embeds it and a redistributed PDF carries no Apple font.
  // The fallbacks after it are for web viewers that do not load the face; the
  // print pipeline does not use them, and the gate checks the PDF's embedded
  // face so a silent fallback cannot pass.
  //
  // Monospace is load-bearing beyond appearance: diagram labels are bounded by
  // character count, because the advance is fixed (600/1000 em, 5.4 units at
  // size 9, 1.75 pt on the 1.8 in figure). The decline-curve end label is
  // centred at x=340, so 22 characters (118.8 units) is what reaches the box
  // edge and 23 overruns it - measured by lengthening the label and rebuilding.
  // If this becomes proportional, character count stops being width and that
  // bound must be deleted, not retuned.
  var FONT = "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace";
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

  /* A geometry number is printed to at most six decimals. Beyond that the
     digits are the platform's trig, not the drawing: Apple's libm and glibc
     differ in the last bit of Math.sin/cos, and a raw double prints that
     difference into the committed bundle - where the gate reads it as a stale
     artifact on Linux and the committed bytes stop matching a rebuild on
     macOS. Six decimals is 0.000001 of a unit on a 400-unit page, far below
     anything ink can show, and it is applied to the whole body rather than to
     each emitter because two shapes write their circles out by hand. */
  var GEOMETRY = /\b(x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|d)="([^"]*)"/g;
  function canonical(body) {
    return body.replace(GEOMETRY, function (whole, name, value) {
      return name + '="' + value.replace(/-?\d+\.\d+/g, function (n) {
        return String(Math.round(Number(n) * 1e6) / 1e6);
      }) + '"';
    });
  }

  function wrap(body) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" ' +
      'width="100%" height="100%" preserveAspectRatio="xMidYMid meet" ' +
      'role="img" aria-label="Parametric diagram of the card principle">' +
      canonical(body) + "</svg>"
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
      // The chosen inlet is a position, so a value past the last inlet means
      // the last one. Taking it modulo instead would turn 6 into the third
      // inlet of six and make the parameter's meaning depend on its range.
      var heavy = i === Math.min(Math.max(chosen, 1), inlets) - 1;
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
        'stroke-width="' + (2 - r * 0.3) + '" stroke-linecap="round" ' + STROKE + "/>"
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
      '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' + STROKE + "/>"
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

  /* A retrospective canvas, drawn as the topology the card names. `kind`
     chooses the arrangement; `columns` and `rows` divide it, and every kind
     reads both counts - a shape that ignored one would offer a knob it never
     turns, which is the failure the gate exists to catch. A kind the shape does
     not know falls back to a plainly marked frame, deliberately unlike every
     real kind, so the gate's string probe ("columnsX") still moves the drawing. */
  shapes["retro-canvas"] = function (p) {
    var kind = p.kind || "columns";
    var cols = Math.max(1, Math.round(p.columns || 3));
    var rows = Math.max(1, Math.round(p.rows || 1));
    var left = 40;
    var top = 40;
    var w = 320;
    var h = 320;
    var right = left + w;
    var bottom = top + h;
    var out = [];

    function frame() {
      out.push(rect(left, top, w, h, { rx: 6, width: 1.6, opacity: 0.5 }));
    }

    function grid(colsN, rowsN, dash) {
      for (var c = 1; c < colsN; c++) {
        var x = left + (w * c) / colsN;
        out.push(line(x, top, x, bottom, 1, 0.3, dash || null));
      }
      for (var r = 1; r < rowsN; r++) {
        var y = top + (h * r) / rowsN;
        out.push(line(left, y, right, y, 1, 0.3, dash || null));
      }
    }

    if (kind === "columns") {
      frame();
      for (var c = 0; c < cols; c++) {
        var x0 = left + (w * c) / cols;
        var colW = w / cols;
        for (var r = 0; r < rows; r++) {
          var cellH = h / rows;
          var noteH = Math.min(18, cellH - 14);
          out.push(rect(x0 + 8, top + r * cellH + (cellH - noteH) / 2, colW - 16, noteH, {
            rx: 3, width: 1.2, opacity: 0.55
          }));
        }
      }
      for (var d = 1; d < cols; d++) {
        out.push(line(left + (w * d) / cols, top, left + (w * d) / cols, bottom, 1.2, 0.45));
      }
      out.push(line(left, bottom + 10, right, bottom + 10, 1.5, 0.35));
    } else if (kind === "quadrants") {
      // A four-quadrant board is always four quadrants. The two counts say how
      // densely each quadrant fills with notes, not how many quadrants there
      // are, so a 4Ls board and a KALM board differ without redrawing the frame.
      frame();
      grid(2, 2, "5 5");
      for (var qr = 0; qr < 2; qr++) {
        for (var qc = 0; qc < 2; qc++) {
          var qx = left + (w * qc) / 2;
          var qy = top + (h * qr) / 2;
          for (var nr = 0; nr < rows; nr++) {
            for (var nc = 0; nc < cols; nc++) {
              out.push(circle(
                qx + ((w / 2) * (nc + 1)) / (cols + 1),
                qy + ((h / 2) * (nr + 1)) / (rows + 1),
                3.2, { width: 1.1, opacity: 0.55 }
              ));
            }
          }
        }
      }
    } else if (kind === "zones") {
      frame();
      for (var zr = 0; zr < rows; zr++) {
        var zy = top + (h * (zr + 1)) / rows;
        if (zr < rows - 1) {
          out.push(line(left, zy, right, zy, 1.6, 0.4, "7 5"));
        }
        // Each band is cut into its slots at a different offset, the way a
        // metaphorical canvas staggers its zones instead of ruling a table.
        for (var zc = 1; zc < cols; zc++) {
          var zx = left + (w * zc) / cols + (zr % 2 === 0 ? 8 : -8);
          out.push(line(zx, zy - 34, zx, zy - 8, 1.2, 0.3, "3 4"));
        }
      }
    } else if (kind === "rings") {
      var cx = 200;
      var cy = 200;
      for (var rr = 1; rr <= rows; rr++) {
        out.push(circle(cx, cy, 28 + (108 * rr) / rows, { hollow: true, width: 1.6, opacity: 0.28 + rr * 0.08 }));
      }
      for (var rc = 0; rc < cols; rc++) {
        var ra = -Math.PI / 2 + (Math.PI * 2 * rc) / cols;
        out.push(line(cx, cy, cx + Math.cos(ra) * 136, cy + Math.sin(ra) * 136, 1.2, 0.35));
      }
      out.push(circle(cx, cy, 5, { width: 1.5, fill: "currentColor", opacity: 0.9 }));
    } else if (kind === "timeline") {
      var laneH = h / (rows + 1);
      for (var tr = 0; tr < rows; tr++) {
        var ty = top + laneH * (tr + 1);
        out.push(line(left, ty, right - 12, ty, 1.6, 0.5));
        for (var tc = 0; tc < cols; tc++) {
          var tx = left + 18 + ((w - 36) * tc) / Math.max(1, cols - 1);
          out.push(circle(tx, ty, 4.5, { width: 1.3, opacity: 0.85 }));
        }
      }
      out.push(
        '<path d="M ' + coord(right - 22) + " " + coord(top + laneH) + " L " + coord(right) + " " + coord(top + laneH) +
        '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' + STROKE + "/>"
      );
    } else if (kind === "matrix") {
      frame();
      var headX = left + 26;
      var headY = top + 26;
      out.push(line(headX, top, headX, bottom, 2, 0.6));
      out.push(line(left, headY, right, headY, 2, 0.6));
      for (var mr = 0; mr < rows; mr++) {
        for (var mc = 0; mc < cols; mc++) {
          var mx = headX + ((w - 26) * (mc + 0.5)) / cols;
          var my = headY + ((h - 26) * (mr + 0.5)) / rows;
          out.push(circle(mx, my, 3.5, { width: 1.2, opacity: 0.55 }));
        }
      }
      grid(cols, rows, "4 4");
    } else if (kind === "fishbone") {
      var spineY = 200;
      out.push(line(left, spineY, right - 26, spineY, 2.2, 0.85));
      out.push(
        '<path d="M ' + coord(right - 26) + " " + coord(spineY - 9) + " L " + coord(right) + " " + coord(spineY) +
        " L " + coord(right - 26) + " " + coord(spineY + 9) + '" fill="currentColor" stroke="none"/>'
      );
      for (var fc = 0; fc < cols; fc++) {
        var fx = left + 30 + ((w - 90) * fc) / Math.max(1, cols - 1);
        var dir = fc % 2 === 0 ? -1 : 1;
        out.push(line(fx, spineY, fx - 34, spineY + dir * 78, 1.8, 0.6));
        for (var fr = 0; fr < rows; fr++) {
          var ft = (fr + 1) / (rows + 1);
          var bx = fx - 34 * ft;
          var by = spineY + dir * 78 * ft;
          out.push(line(bx, by, bx - 22, by + dir * 10, 1.1, 0.35));
        }
      }
    } else if (kind === "tree") {
      var rootX = 200;
      var rootY = bottom - 6;
      var crownY = top + 44;
      out.push(line(rootX, rootY, rootX, rootY - 92, 2.2, 0.8));
      for (var lc = 0; lc < cols; lc++) {
        var lx = left + 30 + ((w - 60) * lc) / Math.max(1, cols - 1);
        out.push(line(rootX, rootY - 92, lx, crownY, 1.4, 0.45));
        for (var lr = 0; lr < rows; lr++) {
          var ly = crownY + ((rootY - 92 - crownY) * lr) / Math.max(1, rows - 1);
          out.push(circle(lx, Math.min(ly, rootY - 100), 4, { width: 1.2, opacity: 0.7 }));
        }
      }
      out.push(circle(rootX, rootY - 6, 5, { width: 1.5, fill: "currentColor", opacity: 0.85 }));
    } else if (kind === "bands") {
      var bandH = h / (rows + 1);
      for (var br = 0; br < rows; br++) {
        var by2 = top + bandH * (br + 0.5);
        out.push(line(left, by2, right, by2, 7, 0.32));
        for (var bc = 0; bc < cols; bc++) {
          var bx2 = left + 20 + ((w - 40) * (bc + 0.5)) / cols + (br % 2 === 0 ? 10 : -10);
          out.push(circle(bx2, by2, 9, { hollow: true, width: 2.2, opacity: 0.95 }));
        }
      }
      frame();
    } else {
      // An unknown topology still reads both counts, so no record can declare a
      // knob this shape ignores even if its kind is misspelled. The marked
      // frame is unlike every real kind, which is what keeps the kind probe
      // honest.
      frame();
      out.push(line(left + 26, top + 26, right - 26, bottom - 26, 1.6, 0.4, "7 6"));
      out.push(line(left + 26, bottom - 26, right - 26, top + 26, 1.6, 0.4, "7 6"));
      out.push(circle(200, 200, 18, { hollow: true, width: 1.6, opacity: 0.45 }));
      for (var uc = 0; uc < cols; uc++) {
        var ux = left + (w * (uc + 0.5)) / cols;
        out.push(line(ux, top, ux, top + 10, 1.4, 0.4));
      }
      for (var ur = 0; ur < rows; ur++) {
        var uy = top + (h * (ur + 0.5)) / rows;
        out.push(line(left, uy, left + 10, uy, 1.4, 0.4));
      }
    }
    return out.join("");
  };

  /* A strategy canvas. `treatment` is the drawing: the six layout types the
     source's schema defines, plus refinements its schematic tags name - curve
     families, a node-link network, a two-column bipartite diagram, a wedge, a
     five-domain topology, a column board, a scatter, an enclosure and lanes.
     `columns` and `rows` count stages, tracks, nodes, marks or ticks inside the
     drawing. Every treatment reads both counts - a shape that ignored one would
     offer a knob it never turns - and an unknown treatment falls back to a
     marked frame unlike every real treatment, so the gate's string probe still
     moves the drawing. */
  shapes["strategy-canvas"] = function (p) {
    var treatment = p.treatment || "2x2";
    var cols = Math.max(1, Math.round(p.columns || 2));
    var rows = Math.max(1, Math.round(p.rows || 2));
    var left = 40;
    var top = 40;
    var w = 320;
    var h = 320;
    var right = left + w;
    var bottom = top + h;
    var out = [];

    function frame() {
      out.push(rect(left, top, w, h, { rx: 6, width: 1.6, opacity: 0.5 }));
    }

    function arrow(x1, y1, x2, y2) {
      out.push(line(x1, y1, x2, y2, 1.6, 0.55));
      var a = Math.atan2(y2 - y1, x2 - x1);
      var head = 7;
      out.push(line(x2, y2, x2 - head * Math.cos(a - 0.5), y2 - head * Math.sin(a - 0.5), 1.4, 0.7));
      out.push(line(x2, y2, x2 - head * Math.cos(a + 0.5), y2 - head * Math.sin(a + 0.5), 1.4, 0.7));
    }

    // A plot area for the curve and scatter treatments: an L of axes whose
    // tick counts are the two declared parameters, so neither stops moving.
    var plotLeft = left + 24;
    var plotRight = right - 24;
    var plotTop = top + 24;
    var plotBottom = bottom - 28;
    function X(t) {
      return plotLeft + t * (plotRight - plotLeft);
    }
    function Y(v) {
      return plotBottom - v * (plotBottom - plotTop);
    }
    function polyline(fn, steps) {
      var prev = null;
      for (var i = 0; i <= steps; i++) {
        var q = fn(i / steps);
        if (prev) out.push(line(prev[0], prev[1], q[0], q[1], 2, 0.65));
        prev = q;
      }
    }
    function axes() {
      out.push(line(plotLeft, plotTop, plotLeft, plotBottom, 1.6, 0.7));
      out.push(line(plotLeft, plotBottom, plotRight, plotBottom, 1.6, 0.7));
      for (var ixc = 0; ixc < cols; ixc++) {
        var tx = X((ixc + 0.5) / cols);
        out.push(line(tx, plotBottom, tx, plotBottom - 6, 1.2, 0.5));
      }
      for (var iyr = 0; iyr < rows; iyr++) {
        var ty = Y((iyr + 0.5) / rows);
        out.push(line(plotLeft, ty, plotLeft + 6, ty, 1.2, 0.5));
      }
    }

    if (treatment === "curve_trajectory") {
      // Performance against time: one trajectory per row, the last the
      // disruptive one that steepens and crosses the rest.
      frame();
      axes();
      var traj = Math.max(2, rows);
      for (var tr = 0; tr < traj; tr++) {
        (function (idx) {
          var steepest = idx === traj - 1;
          polyline(function (t) {
            var v = steepest ? 0.12 + 0.88 * t * t : 0.2 + 0.5 * t * (0.6 + 0.2 * idx);
            return [X(t), Y(v)];
          }, 24);
        })(tr);
      }
    } else if (treatment === "curve_multis") {
      // Overlapping S-curves: one per row, offset along the time axis.
      frame();
      axes();
      for (var ms = 0; ms < rows; ms++) {
        (function (idx) {
          var off = 0.15 + idx * (0.55 / Math.max(1, rows));
          polyline(function (t) {
            return [X(t), Y(1 / (1 + Math.exp(-(t - off) * 14)))];
          }, 28);
        })(ms);
      }
    } else if (treatment === "curve_bell") {
      // A bell curve with a chasm: two halves, the gap between them widening
      // with the row count and moving with the column count.
      frame();
      axes();
      var chasm = 0.3 + 0.05 * cols;
      var gap = 0.02 + 0.015 * rows;
      polyline(function (t) {
        var x = t * (chasm - gap);
        return [X(x), Y(Math.exp(-Math.pow((x - 0.3) / 0.15, 2)))];
      }, 20);
      polyline(function (t) {
        var x = chasm + gap + t * (1 - chasm - gap);
        return [X(x), Y(Math.exp(-Math.pow((x - 0.68) / 0.16, 2)))];
      }, 20);
      out.push(line(X(chasm - gap), Y(-0.02), X(chasm - gap), Y(0.55), 1.3, 0.4, "5 5"));
      out.push(line(X(chasm + gap), Y(-0.02), X(chasm + gap), Y(0.55), 1.3, 0.4, "5 5"));
      out.push(line(X(chasm - gap), Y(0.02), X(chasm + gap), Y(0.02), 1.8, 0.7));
    } else if (treatment === "curve_sigmoid") {
      frame();
      axes();
      var steep = 6 + rows * 3;
      polyline(function (t) {
        return [X(t), Y(1 / (1 + Math.exp(-(t - 0.5) * steep)))];
      }, 36);
    } else if (treatment === "curve_wave") {
      // Expectation wave: peak, trough, plateau. Its amplitude reads rows.
      frame();
      axes();
      var amp = 0.8 + 0.15 * rows;
      polyline(function (t) {
        var hump = amp * Math.exp(-Math.pow((t - 0.25) / 0.13, 2));
        var trough = -0.3 * Math.exp(-Math.pow((t - 0.53) / 0.12, 2));
        var plateau = t > 0.7 ? 0.25 + 0.12 * Math.min(1, (t - 0.7) / 0.25) : 0;
        return [X(t), Y(Math.max(-0.05, hump + trough + plateau))];
      }, 40);
    } else if (treatment === "curve_decay") {
      frame();
      axes();
      var decay = 2.5 + rows;
      polyline(function (t) {
        return [X(t), Y(0.9 * Math.exp(-decay * t) + 0.04)];
      }, 32);
    } else if (treatment === "scatter") {
      frame();
      axes();
      for (var sxc = 0; sxc < cols; sxc++) {
        for (var syr = 0; syr < rows; syr++) {
          var px = ((sxc * 7 + syr * 3 + 1) % 11) / 11;
          var py = ((sxc * 5 + syr * 7 + 2) % 13) / 13;
          var rr = 3 + ((sxc + syr) % 3) * 2;
          out.push(circle(X(0.08 + 0.84 * px), Y(0.08 + 0.84 * py), rr, { width: 1.2, opacity: 0.6 }));
        }
      }
    } else if (treatment === "topology") {
      // A centre domain and its neighbours on a ring, with inner marks per ring.
      frame();
      out.push(circle(200, 200, 26, { width: 1.6, opacity: 0.6 }));
      out.push(circle(200, 200, 7, { width: 1.2, opacity: 0.8 }));
      for (var dc = 0; dc < cols; dc++) {
        var da = (Math.PI * 2 * dc) / cols - Math.PI / 2;
        var dx = 200 + Math.cos(da) * 105;
        var dy = 200 + Math.sin(da) * 105;
        out.push(line(200 + Math.cos(da) * 33, 200 + Math.sin(da) * 33, 200 + Math.cos(da) * 85, 200 + Math.sin(da) * 85, 1.3, 0.4));
        out.push(circle(dx, dy, 20, { hollow: true, width: 1.4, opacity: 0.5 }));
        for (var dr = 0; dr < rows; dr++) {
          out.push(circle(dx + Math.cos(da) * (5 + dr * 6), dy + Math.sin(da) * (5 + dr * 6), 2.5, { width: 1, opacity: 0.7 }));
        }
      }
    } else if (treatment === "wedge") {
      // Value above price: the gap between two lines is the surplus wedge,
      // with one dashed band per row and one divider per column.
      frame();
      axes();
      polyline(function (t) {
        return [X(t), Y(0.28 + 0.6 * t)];
      }, 20);
      polyline(function (t) {
        return [X(t), Y(0.15 + 0.35 * t)];
      }, 20);
      for (var wc = 0; wc < cols; wc++) {
        var wt = (wc + 0.5) / cols;
        out.push(line(X(wt), Y(0.28 + 0.6 * wt), X(wt), Y(0.15 + 0.35 * wt), 1, 0.35));
      }
      for (var wr = 0; wr < rows; wr++) {
        var wb = (wr + 1) / (rows + 1);
        out.push(line(X(wb), Y(0.28 + 0.6 * wb), X(wb) + 10, Y(0.15 + 0.35 * wb), 1, 0.4, "3 3"));
      }
    } else if (treatment === "column_board") {
      // A board of columns, each divided into rows: the six-column macro board.
      frame();
      var cw = w / cols;
      var ch = h / rows;
      for (var cc = 0; cc < cols; cc++) {
        out.push(rect(left + cc * cw + 4, top + 6, cw - 8, h - 12, { rx: 3, width: 1.3, opacity: 0.35 }));
        for (var cr = 0; cr < rows; cr++) {
          out.push(rect(left + cc * cw + 10, top + 14 + cr * (ch - 12), cw - 20, ch - 24, { rx: 2, width: 1.4, opacity: 0.45 }));
        }
      }
      for (var cl = 1; cl < cols; cl++) out.push(line(left + cl * cw, top, left + cl * cw, bottom, 1.1, 0.3));
    } else if (treatment === "network") {
      // A centre and its connected neighbours: the diamond relational network.
      frame();
      out.push(circle(200, 200, 14, { width: 1.6, opacity: 0.8 }));
      for (var nc = 0; nc < cols; nc++) {
        var na = (Math.PI * 2 * nc) / cols - Math.PI / 2;
        var nx = 200 + Math.cos(na) * 112;
        var ny = 200 + Math.sin(na) * 112;
        out.push(line(200 + Math.cos(na) * 16, 200 + Math.sin(na) * 16, nx - Math.cos(na) * 10, ny - Math.sin(na) * 10, 1.4, 0.45));
        out.push(circle(nx, ny, 9, { width: 1.4, opacity: 0.7 }));
        for (var nr = 0; nr < rows; nr++) {
          out.push(circle(nx + Math.cos(na + 0.5) * (16 + nr * 7), ny + Math.sin(na + 0.5) * (16 + nr * 7), 3, { width: 1, opacity: 0.55 }));
        }
      }
    } else if (treatment === "forces") {
      // Driving arrows point in, resisting arrows point out: the four forces.
      frame();
      out.push(circle(200, 200, 30, { hollow: true, width: 1.6, opacity: 0.6 }));
      for (var fc = 0; fc < cols; fc++) {
        var fa = (Math.PI * 2 * fc) / cols - Math.PI / 2;
        arrow(200 + Math.cos(fa) * 118, 200 + Math.sin(fa) * 118, 200 + Math.cos(fa) * 40, 200 + Math.sin(fa) * 40);
      }
      for (var fr = 0; fr < rows; fr++) {
        var fb = (Math.PI * 2 * fr) / rows - Math.PI / 2 + Math.PI / Math.max(2, cols);
        arrow(200 + Math.cos(fb) * 44, 200 + Math.sin(fb) * 44, 200 + Math.cos(fb) * 124, 200 + Math.sin(fb) * 124);
      }
    } else if (treatment === "bipartite") {
      // Two columns of nodes with edges across: org topology mirrored in code.
      frame();
      var lx = left + 70;
      var rx = right - 70;
      for (var bc = 0; bc < cols; bc++) {
        var by1 = top + (h * (bc + 0.5)) / cols;
        out.push(circle(lx, by1, 7, { width: 1.4, opacity: 0.75 }));
        for (var br = 0; br < rows; br++) {
          var by2 = top + (h * (br + 0.5)) / rows;
          if (bc === 0) out.push(circle(rx, by2, 7, { width: 1.4, opacity: 0.75 }));
          out.push(line(lx + 8, by1, rx - 8, by2, 1, 0.3));
        }
      }
    } else if (treatment === "enclosure") {
      // An asset held inside a boundary: the cornered resource.
      frame();
      out.push(rect(left + 34, top + 34, w - 68, h - 68, { rx: 10, width: 1.8, opacity: 0.6 }));
      out.push(rect(left + 46, top + 46, w - 92, h - 92, { rx: 8, width: 1, opacity: 0.3 }));
      out.push(circle(200, 200, 24, { width: 1.6, opacity: 0.8 }));
      for (var ec = 0; ec < cols; ec++) {
        var ea = (Math.PI * 2 * ec) / cols - Math.PI / 2;
        out.push(line(200 + Math.cos(ea) * 27, 200 + Math.sin(ea) * 27, 200 + Math.cos(ea) * 66, 200 + Math.sin(ea) * 66, 1.2, 0.35));
        out.push(circle(200 + Math.cos(ea) * 72, 200 + Math.sin(ea) * 72, 4, { width: 1.1, opacity: 0.6 }));
      }
      for (var er = 0; er < rows; er++) {
        out.push(circle(200, 200, 36 + er * 10, { hollow: true, width: 1, opacity: 0.28 }));
      }
    } else if (treatment === "tracks") {
      // Parallel transformation tracks, each cut into stages.
      frame();
      var lane = h / rows;
      for (var tk = 0; tk < rows; tk++) {
        var ly = top + lane * (tk + 0.5);
        out.push(rect(left + 16, ly - 14, w - 32, 28, { rx: 4, width: 1.5, opacity: 0.35 }));
        for (var tc = 1; tc < cols; tc++) {
          var tx2 = left + 16 + ((w - 32) * tc) / cols;
          out.push(line(tx2, ly - 14, tx2, ly + 14, 1.1, 0.3, "4 4"));
        }
        for (var tn = 0; tn < cols; tn++) {
          out.push(circle(left + 16 + ((w - 32) * (tn + 0.5)) / cols, ly, 3, { width: 1, opacity: 0.7 }));
        }
      }
    } else if (treatment === "2x2") {
      frame();
      out.push(line(200, top, 200, bottom, 1.4, 0.4, "5 5"));
      out.push(line(left, 200, right, 200, 1.4, 0.4, "5 5"));
      for (var c2 = 0; c2 < cols; c2++) {
        var tx3 = left + (w * (c2 + 0.5)) / cols;
        out.push(line(tx3, top, tx3, top + 8, 1.4, 0.5));
        out.push(line(tx3, bottom - 8, tx3, bottom, 1.4, 0.5));
      }
      for (var r2 = 0; r2 < rows; r2++) {
        var ty2 = top + (h * (r2 + 0.5)) / rows;
        out.push(line(left, ty2, left + 8, ty2, 1.4, 0.5));
        out.push(line(right - 8, ty2, right, ty2, 1.4, 0.5));
      }
      [[120, 120], [280, 120], [120, 280], [280, 280]].forEach(function (q) {
        out.push(circle(q[0], q[1], 5, { hollow: true, width: 1.4, opacity: 0.6 }));
      });
    } else if (treatment === "stage_progression") {
      var laneH = h / rows;
      for (var sr = 0; sr < rows; sr++) {
        var baseY = top + laneH * (sr + 1) - 10;
        var stepW = (w - 30) / cols;
        var prev = null;
        for (var sc = 0; sc < cols; sc++) {
          var sh = 18 + (sc * 34) / Math.max(1, cols);
          var sx = left + 15 + sc * stepW;
          out.push(rect(sx, baseY - sh, stepW - 12, sh, { rx: 3, width: 1.6, opacity: 0.4 + sc * 0.08 }));
          if (prev) arrow(prev[0], prev[1], sx, baseY - sh / 2);
          prev = [sx + stepW - 12, baseY - sh / 2];
        }
        out.push(line(left + 10, baseY, right - 10, baseY, 1.2, 0.35));
      }
      frame();
    } else if (treatment === "value_chain") {
      var chainH = h / rows;
      for (var vr = 0; vr < rows; vr++) {
        var cy = top + chainH * (vr + 0.5);
        var boxW = (w - 40) / cols;
        var last = null;
        for (var vc = 0; vc < cols; vc++) {
          var vx = left + 20 + vc * boxW;
          out.push(rect(vx, cy - 16, boxW - 12, 32, { rx: 3, width: 1.7, opacity: 0.45 }));
          if (last) arrow(last, cy, vx, cy);
          last = vx + boxW - 12;
        }
      }
      frame();
    } else if (treatment === "feedback_loop") {
      var maxR = 128;
      for (var fr2 = 0; fr2 < rows; fr2++) {
        var rad = maxR - fr2 * 14;
        out.push(circle(200, 200, rad, { hollow: true, width: fr2 === 0 ? 2 : 1.2, opacity: fr2 === 0 ? 0.6 : 0.35 }));
        for (var fc2 = 0; fc2 < cols; fc2++) {
          var angle = (Math.PI * 2 * fc2) / cols - Math.PI / 2;
          out.push(circle(200 + Math.cos(angle) * rad, 200 + Math.sin(angle) * rad, fr2 === 0 ? 5 : 3, { width: 1.3, opacity: 0.75 }));
        }
      }
      var a1 = -Math.PI / 2;
      var a2 = -Math.PI / 2 + (Math.PI * 2 * 0.72);
      out.push(
        '<path d="M ' + coord(200 + Math.cos(a1) * maxR) + " " + coord(200 + Math.sin(a1) * maxR) +
        " A " + maxR + " " + maxR + " 0 1 1 " + coord(200 + Math.cos(a2) * maxR) + " " + coord(200 + Math.sin(a2) * maxR) +
        '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' + STROKE + "/>"
      );
    } else if (treatment === "tree") {
      var rootX = 200;
      var rootY = bottom - 10;
      var crownY = top + 40;
      out.push(line(rootX, rootY, rootX, crownY + 30, 2.2, 0.8));
      for (var tc2 = 0; tc2 < cols; tc2++) {
        var bx = cols === 1 ? rootX : left + 30 + ((w - 60) * tc2) / (cols - 1);
        out.push(line(rootX, crownY + 30, bx, crownY, 1.5, 0.5));
        for (var tr2 = 0; tr2 < rows; tr2++) {
          var ly2 = crownY + ((rootY - 60 - crownY) * tr2) / Math.max(1, rows);
          out.push(circle(bx, Math.min(ly2, rootY - 30), 4, { width: 1.2, opacity: 0.7 }));
        }
      }
      out.push(circle(rootX, rootY, 6, { width: 1.5, fill: "currentColor", opacity: 0.85 }));
    } else if (treatment === "matrix_3x3") {
      frame();
      var cw3 = w / 3;
      var ch3 = h / 3;
      for (var m = 1; m < 3; m++) {
        out.push(line(left + cw3 * m, top, left + cw3 * m, bottom, 1.2, 0.35));
        out.push(line(left, top + ch3 * m, right, top + ch3 * m, 1.2, 0.35));
      }
      for (var mr = 0; mr < 3; mr++) {
        for (var mc = 0; mc < 3; mc++) {
          for (var dr2 = 0; dr2 < rows; dr2++) {
            for (var dc2 = 0; dc2 < cols; dc2++) {
              out.push(circle(
                left + cw3 * (mc + 0.5) + (dc2 - (cols - 1) / 2) * 9,
                top + ch3 * (mr + 0.5) + (dr2 - (rows - 1) / 2) * 9,
                2.4,
                { width: 1, opacity: 0.6 }
              ));
            }
          }
        }
      }
    } else {
      // An unknown treatment still reads both counts, so a misspelling cannot
      // declare a knob this shape ignores.
      frame();
      out.push(line(left + 26, top + 26, right - 26, bottom - 26, 1.6, 0.4, "7 6"));
      out.push(line(left + 26, bottom - 26, right - 26, top + 26, 1.6, 0.4, "7 6"));
      out.push(circle(200, 200, 18, { hollow: true, width: 1.6, opacity: 0.45 }));
      for (var uc = 0; uc < cols; uc++) {
        var ux = left + (w * (uc + 0.5)) / cols;
        out.push(line(ux, top, ux, top + 10, 1.4, 0.4));
      }
      for (var ur = 0; ur < rows; ur++) {
        var uy = top + (h * (ur + 0.5)) / rows;
        out.push(line(left, uy, left + 10, uy, 1.4, 0.4));
      }
    }
    return out.join("");
  };

  /* A team-development figure. The source ships four drawn assets - a culture
     continuum, a candour quadrant, a developmental arc and a five-axis safety
     radar - and every card's figure is one of them. `family` names the asset;
     `divisions` is how many parts that asset is divided into (segments on the
     gauge, ticks per axis, stages on the arc, axes on the radar); `mark` is
     where the card's situation sits inside those divisions. Every family reads
     both numbers, so neither is a knob its drawing ignores, and an unknown
     family draws a marked frame rather than passing as one of the four. */
  shapes["team-figure"] = function (p) {
    var family = p.family || "continuum";
    var div = Math.max(1, Math.round(p.divisions || 3));
    var mark = Math.max(1, Math.round(p.mark || 1));
    var out = [];

    function at(cx, cy, r, a) {
      return [coord(cx + Math.cos(a) * r), coord(cy + Math.sin(a) * r)];
    }

    function arc(cx, cy, r, from, to, width, opacity, dash) {
      var s = at(cx, cy, r, from);
      var e = at(cx, cy, r, to);
      var large = to - from > Math.PI ? 1 : 0;
      out.push(
        '<path d="M ' + s[0] + " " + s[1] + " A " + r + " " + r + " 0 " + large +
        " 1 " + e[0] + " " + e[1] + '" fill="none" stroke="currentColor" stroke-width="' +
        width + '" stroke-linecap="round"' +
        (dash ? ' stroke-dasharray="' + dash + '"' : "") +
        ' opacity="' + opacity + '" ' + STROKE + "/>"
      );
    }

    function polygon(cx, cy, r, sides, width, opacity, dash, fill) {
      var pts = [];
      for (var k = 0; k < sides; k++) {
        pts.push(at(cx, cy, r, -Math.PI / 2 + (Math.PI * 2 * k) / sides));
      }
      var d = "M " + pts.map(function (q) { return q[0] + " " + q[1]; }).join(" L ") + " Z";
      out.push(
        '<path d="' + d + '" fill="' + (fill || "none") + '" stroke="currentColor" stroke-width="' +
        width + '" stroke-linejoin="round"' +
        (dash ? ' stroke-dasharray="' + dash + '"' : "") +
        ' opacity="' + opacity + '" ' + STROKE + "/>"
      );
    }

    if (family === "continuum") {
      // A 180-degree gauge: `div` equal segments, the pointer in the one the
      // team sits in. The reading is the segment, so the segment is drawn.
      var cx = 200;
      var cy = 252;
      var r = 148;
      arc(cx, cy, r, Math.PI, Math.PI * 2, 2.4, 0.75);
      arc(cx, cy, r - 24, Math.PI, Math.PI * 2, 1.2, 0.45);
      for (var ci = 0; ci <= div; ci++) {
        var ca = Math.PI + (Math.PI * ci) / div;
        var c0 = at(cx, cy, r - 24, ca);
        var c1 = at(cx, cy, r, ca);
        out.push(line(c0[0], c0[1], c1[0], c1[1], 1.4, 0.55));
      }
      var am = Math.PI + (Math.PI * (mark - 0.5)) / div;
      var tip = at(cx, cy, r - 30, am);
      out.push(line(cx, cy, tip[0], tip[1], 3, 0.9));
      out.push(circle(cx, cy, 7, { width: 1.6, fill: "currentColor", opacity: 0.9 }));
      out.push(line(cx - r - 6, cy, cx + r + 6, cy, 1.6, 0.4));
    } else if (family === "quadrant") {
      // Two axes crossing: `div` ticks along each, and the marked quadrant
      // shaded. Cell order is reading order - top-left, top-right, bottom-left,
      // bottom-right - so the number on the map means what a reader sees.
      var left = 56;
      var top = 56;
      var side = 288;
      var right = left + side;
      var bottom = top + side;
      var mx = left + side / 2;
      var my = top + side / 2;
      var cell = ((mark - 1) % 4 + 4) % 4;
      var cellRect = [
        [left, top],
        [mx, top],
        [left, my],
        [mx, my]
      ][cell];
      out.push(rect(cellRect[0], cellRect[1], side / 2, side / 2, {
        fill: "currentColor",
        opacity: 0.14,
        width: 0
      }));
      out.push(rect(left, top, side, side, { rx: 4, width: 1.2, opacity: 0.35 }));
      out.push(line(left - 8, my, right + 8, my, 1.8, 0.7));
      out.push(line(mx, bottom + 8, mx, top - 8, 1.8, 0.7));
      for (var qi = 0; qi < div; qi++) {
        var qt = (qi + 0.5) / div;
        out.push(line(left + side * qt, my, left + side * qt, my - 7, 1.2, 0.45));
        out.push(line(mx, top + side * qt, mx + 7, top + side * qt, 1.2, 0.45));
      }
      out.push(circle(mx, my, 4, { width: 1.3, fill: "currentColor", opacity: 0.8 }));
    } else if (family === "arc") {
      // A developmental arc over `div` stage columns: down through the friction
      // trough, up past the peak, settling at handover. The marked stage sits on
      // the curve, so the number on the map is a position on the arc.
      var aLeft = 52;
      var aRight = 348;
      var baseY = 322;
      var peakY = 96;

      function value(t) {
        var trough = 0.34 * Math.exp(-Math.pow((t - 0.3) / 0.17, 2));
        var rise = 0.52 * Math.exp(-Math.pow((t - 0.72) / 0.22, 2));
        return 0.5 - trough + rise - 0.08 * t;
      }

      for (var di = 0; di <= div; di++) {
        var dx = aLeft + ((aRight - aLeft) * di) / div;
        out.push(line(dx, baseY, dx, baseY - 8, 1.2, 0.45));
      }
      out.push(line(aLeft, baseY, aRight, baseY, 1.8, 0.6));
      var prev = null;
      var steps = Math.max(24, div * 6);
      for (var si = 0; si <= steps; si++) {
        var st = si / steps;
        var ptq = [coord(aLeft + (aRight - aLeft) * st), coord(baseY - value(st) * (baseY - peakY))];
        if (prev) out.push(line(prev[0], prev[1], ptq[0], ptq[1], 2.4, 0.75));
        prev = ptq;
      }
      var mt = (mark - 0.5) / div;
      var mX = aLeft + (aRight - aLeft) * mt;
      var mY = baseY - value(mt) * (baseY - peakY);
      out.push(line(mX, baseY, mX, mY, 1.2, 0.4, "5 5"));
      out.push(circle(mX, mY, 6, { width: 1.8, fill: "currentColor", opacity: 0.9 }));
    } else if (family === "radar") {
      // `div` axes from a centre that means dysfunction; the plotted polygon at
      // `mark` of the way out. Three grid rings and a dashed baseline, so the
      // distance between the team and the baseline is the reading.
      var rcx = 200;
      var rcy = 198;
      var rr = 148;
      for (var ring = 1; ring <= 3; ring++) {
        polygon(rcx, rcy, (rr * ring) / 3, div, 1.1, 0.32);
      }
      for (var ra = 0; ra < div; ra++) {
        var av = -Math.PI / 2 + (Math.PI * 2 * ra) / div;
        var avp = at(rcx, rcy, rr, av);
        out.push(line(rcx, rcy, avp[0], avp[1], 1.3, 0.5));
        out.push(circle(avp[0], avp[1], 2.6, { width: 1, opacity: 0.6 }));
      }
      polygon(rcx, rcy, rr * 0.62, div, 1.5, 0.5, "6 5");
      var level = Math.min(1.6, mark / Math.max(1, div));
      polygon(rcx, rcy, rr * level, div, 2.2, 0.85);
    } else {
      // An unknown family still reads both numbers, so a misspelling cannot
      // declare knobs this shape ignores.
      out.push(rect(56, 56, 288, 288, { rx: 6, width: 1.6, opacity: 0.5 }));
      out.push(line(82, 82, 318, 318, 1.6, 0.4, "7 6"));
      out.push(line(82, 318, 318, 82, 1.6, 0.4, "7 6"));
      for (var ui = 0; ui < div; ui++) {
        var ux = 56 + (288 * (ui + 0.5)) / div;
        out.push(line(ux, 56, ux, 66, 1.4, 0.4));
      }
      out.push(circle(56 + (288 * ((mark - 0.5) % div + 0.5)) / Math.max(1, div), 200, 8, {
        width: 1.6,
        opacity: 0.7
      }));
    }
    return out.join("");
  };

  /*
   * The innovation deck's four drawings. Every family reads a datum the
   * record already holds, and the label the card prints names the drawing
   * rather than the tactic: a ladder of `divisions` rungs with the tactic's
   * confidence band marked; a funnel of the tactic's own conversion stages
   * with the stage where the evidence is read marked; a time curve of
   * `divisions` periods with the decision horizon marked; a strip of the
   * three plan stages with the step that carries the commitment marked.
   */
  shapes["innovation-figure"] = function (p) {
    var family = p.family || "ladder";
    var div = Math.max(1, Math.round(p.divisions || 3));
    var mark = Math.max(1, Math.round(p.mark || 1));
    var out = [];

    if (family === "ladder") {
      // `div` stacked bands, lowest confidence at the foot; the marked band is
      // the tactic's confidence rank, shaded the way the strip shades its
      // marked step. The two families then share one grammar: bands upright,
      // boxes on their side. A marker centred on a rung hung half outside the
      // frame at the top and bottom ranks and read as a rendering fault.
      var lx0 = 112;
      var lx1 = 288;
      var top = 76;
      var bottom = 328;
      var bandH = (bottom - top) / div;
      for (var li = 0; li < div; li++) {
        var by = bottom - bandH * (li + 1);
        var marked = li === Math.min(mark, div) - 1;
        out.push(
          rect(lx0, by, lx1 - lx0, bandH, {
            width: marked ? 2.2 : 1.3,
            opacity: marked ? 0.9 : 0.4,
            fill: marked ? "currentColor" : "none",
            fillOpacity: marked ? 0.14 : undefined
          })
        );
      }
    } else if (family === "funnel") {
      // `div` stacked stages narrowing from wide to narrow; the stage where
      // the evidence is read is shaded, so the drawing is the path and the
      // mark is the reading point.
      var fTop = 64;
      var fBottom = 324;
      var fh = (fBottom - fTop) / div;
      var wide = 150;
      var narrow = 44;
      var half = function (t) { return wide - (wide - narrow) * t; };
      for (var fi = 0; fi < div; fi++) {
        var t0 = fi / div;
        var t1 = (fi + 1) / div;
        var y0 = fTop + fh * fi;
        var y1 = y0 + fh;
        var h0 = half(t0);
        var h1 = half(t1);
        var marked = fi === Math.min(mark, div) - 1;
        var cx = 200;
        var d =
          "M " + coord(cx - h0) + " " + coord(y0) +
          " L " + coord(cx + h0) + " " + coord(y0) +
          " L " + coord(cx + h1) + " " + coord(y1) +
          " L " + coord(cx - h1) + " " + coord(y1) + " Z";
        out.push(
          '<path d="' + d + '" fill="' + (marked ? "currentColor" : "none") +
          '" fill-opacity="' + (marked ? "0.14" : "0") +
          '" stroke="currentColor" stroke-width="' + (marked ? 2.2 : 1.4) +
          '" stroke-linejoin="round" opacity="' + (marked ? 0.9 : 0.45) + '" ' + STROKE + "/>"
        );
        if (marked) out.push(circle(cx, y0 + fh / 2, 6, { width: 1.6, opacity: 0.9 }));
      }
    } else if (family === "curve") {
      // A falling curve over `div` periods: retention decays, and the marker
      // is the period by which the decision is due.
      var cx0 = 62;
      var cx1 = 348;
      var cy0 = 320;
      var cy1 = 76;
      function value(t) {
        return 0.16 + 0.74 * Math.exp(-2.1 * t);
      }
      for (var pi = 0; pi <= div; pi++) {
        var px = cx0 + ((cx1 - cx0) * pi) / div;
        out.push(line(px, cy0, px, cy0 - 8, 1.2, 0.4));
      }
      out.push(line(cx0, cy0, cx1, cy0, 1.8, 0.6));
      var prev = null;
      var steps = Math.max(24, div * 8);
      for (var si = 0; si <= steps; si++) {
        var st = si / steps;
        var pt = [coord(cx0 + (cx1 - cx0) * st), coord(cy0 - value(st) * (cy0 - cy1))];
        if (prev) out.push(line(prev[0], prev[1], pt[0], pt[1], 2.4, 0.75));
        prev = pt;
      }
      var mt = (Math.min(mark, div) - 0.5) / div;
      var mx = cx0 + (cx1 - cx0) * mt;
      var myy = cy0 - value(mt) * (cy0 - cy1);
      out.push(line(mx, cy0, mx, myy, 1.2, 0.4, "5 5"));
      out.push(circle(mx, myy, 6, { width: 1.8, fill: "currentColor", opacity: 0.9 }));
    } else if (family === "strip") {
      // `div` stages in a row, joined; the marked stage is the one that
      // carries the commitment or the reading, so the strip is the plan and
      // the fill is where it lands.
      var left = 46;
      var right = 354;
      var gap = 12;
      var boxW = (right - left - gap * (div - 1)) / div;
      var boxTop = 150;
      var boxH = 110;
      for (var bi = 0; bi < div; bi++) {
        var bx = left + bi * (boxW + gap);
        var on = bi === Math.min(mark, div) - 1;
        out.push(
          rect(bx, boxTop, boxW, boxH, {
            rx: 5,
            width: on ? 2.2 : 1.3,
            opacity: on ? 0.9 : 0.4,
            fill: on ? "currentColor" : "none",
            fillOpacity: on ? 0.14 : undefined
          })
        );
        if (on) out.push(circle(bx + boxW / 2, boxTop + boxH / 2 - 10, 7, { width: 1.6, opacity: 0.9 }));
        // The three stages of the plan, named inside their own boxes, so the
        // marked step points at something the reader can see rather than at
        // an empty square.
        if (div === 3) {
          out.push(
            label(bx + boxW / 2, boxTop + boxH - 14, ["PREP", "EXEC", "COLLECT"][bi], {
              size: 20,
              weight: 700,
              opacity: 0.6
            })
          );
        }
        if (bi < div - 1) {
          out.push(line(bx + boxW, boxTop + boxH / 2, bx + boxW + gap, boxTop + boxH / 2, 1.6, 0.5));
        }
      }
      out.push(line(left, boxTop - 14, right, boxTop - 14, 1.2, 0.25));
    } else {
      // An unknown family still reads both numbers, so a misspelling cannot
      // declare knobs this shape ignores.
      out.push(rect(56, 56, 288, 288, { rx: 6, width: 1.6, opacity: 0.5 }));
      for (var ui = 0; ui < div; ui++) {
        var ux = 56 + (288 * (ui + 0.5)) / div;
        out.push(line(ux, 56, ux, 66, 1.4, 0.4));
      }
      out.push(circle(56 + (288 * ((mark - 0.5) % div + 0.5)) / Math.max(1, div), 200, 8, {
        width: 1.6,
        opacity: 0.7
      }));
    }
    return out.join("");
  };

  /* --- Ideation: the shape of the move -------------------------------- */

  /* An ideation card's figure reads its own record twice: the family is the
     structure the mechanism states (it reverses, separates, removes, changes
     scale, recombines, constrains, or substitutes), and the mark is the
     tactic's position inside its phase. Every drawing shows the phase as
     `div` positions and marks one, so the label under it - "Removal at
     position 6 of 16" - is a claim a reader can check against the picture.

     The source ships thirty abstract provocations; none of them assigns a
     card. A figure that came from the companion document's ordering would be
     a drawing the record cannot justify, which is the deck-six defect. */
  shapes["ideation-figure"] = function (p) {
    var family = p.family || "reflection";
    var div = Math.max(1, Math.round(p.divisions || 4));
    var mark = Math.max(1, Math.min(div, Math.round(p.mark || 1)));
    var out = [];
    var x0 = 56;
    var span = 288;
    var posX = function (i) {
      return x0 + (span * (i - 0.5)) / div;
    };
    var dashed = function (x, y, w, h) {
      return (
        '<rect x="' + coord(x) + '" y="' + coord(y) + '" width="' + coord(w) +
        '" height="' + coord(h) + '" rx="3" fill="none" stroke="currentColor" ' +
        'stroke-width="1.9" stroke-dasharray="7 6" opacity="0.85" ' + STROKE + "/>"
      );
    };

    if (family === "reflection") {
      // The marked position is where the axis is crossed: two chevrons meet
      // at the mirror line, so the drawing is the reversal and the mark is
      // where it happens.
      var ay = 200;
      var mx = posX(mark);
      out.push(line(x0 - 8, ay, x0 + span + 8, ay, 1.2, 0.35, "6 6"));
      for (var ri = 1; ri <= div; ri++) {
        var rx = posX(ri);
        out.push(line(rx, ay - 5, rx, ay + 5, 1.1, 0.3));
      }
      out.push(
        '<path d="M ' + coord(mx - 18) + " " + coord(ay - 52) +
        " L " + coord(mx) + " " + coord(ay) +
        " L " + coord(mx + 18) + " " + coord(ay - 52) +
        '" fill="none" stroke="currentColor" stroke-width="2.4" opacity="0.9" ' + STROKE + "/>"
      );
      out.push(
        '<path d="M ' + coord(mx - 18) + " " + coord(ay + 52) +
        " L " + coord(mx) + " " + coord(ay) +
        " L " + coord(mx + 18) + " " + coord(ay + 52) +
        '" fill="none" stroke="currentColor" stroke-width="2.4" opacity="0.9" ' + STROKE + "/>"
      );
      out.push(circle(mx, ay, 5, { hollow: true, width: 1.6, opacity: 0.9 }));
    } else if (family === "separation") {
      // One origin fanning into `div` separated paths; the marked path is
      // the mode this card separates out.
      var ox = 200;
      var oy = 64;
      var ey = 336;
      for (var si = 1; si <= div; si++) {
        var sx = div > 1 ? x0 + (span * (si - 1)) / (div - 1) : ox;
        var on = si === mark;
        out.push(line(ox, oy, sx, ey, on ? 2.4 : 1.2, on ? 0.9 : 0.28));
        if (on) out.push(circle(sx, ey, 5, { hollow: true, width: 1.6, opacity: 0.9 }));
      }
    } else if (family === "removal") {
      // A stack of `div` cells with one slot emptied: the removal is drawn,
      // not named, and the dashed cell is the position the card takes.
      var cellTop = 64;
      var cellBottom = 336;
      var cellH = (cellBottom - cellTop) / div;
      var cellW = 136;
      var cellX = 200 - cellW / 2;
      for (var ci = 1; ci <= div; ci++) {
        var cy = cellTop + cellH * (ci - 1);
        if (ci === mark) {
          out.push(dashed(cellX, cy, cellW, cellH - 4));
        } else {
          out.push(rect(cellX, cy, cellW, cellH - 4, { rx: 3, width: 1.2, opacity: 0.32 }));
        }
      }
    } else if (family === "scale") {
      // `div` nested frames growing outward; the marked ring is the scale the
      // card pushes to.
      var cx = 200;
      var cy2 = 200;
      var inner = 44;
      var outer = 300;
      for (var ki = 1; ki <= div; ki++) {
        var side = div > 1 ? inner + ((outer - inner) * (ki - 1)) / (div - 1) : inner;
        var onRing = ki === mark;
        out.push(
          rect(cx - side / 2, cy2 - side / 2, side, side, {
            rx: 3,
            width: onRing ? 2.4 : 1.1,
            opacity: onRing ? 0.9 : 0.28,
            fill: onRing ? "currentColor" : "none",
            fillOpacity: onRing ? 0.07 : undefined
          })
        );
      }
    } else if (family === "recombination") {
      // Two rows of `div` nodes joined one to one; at the mark the join
      // crosses to a second node, which is what recombination means.
      var topY = 112;
      var botY = 288;
      for (var ni = 1; ni <= div; ni++) {
        var nx = posX(ni);
        out.push(line(nx, topY, nx, botY, 1, 0.2));
      }
      for (var nj = 1; nj <= div; nj++) {
        var nxj = posX(nj);
        out.push(circle(nxj, topY, 3.2, { hollow: true, width: 1.2, opacity: 0.45 }));
        out.push(circle(nxj, botY, 3.2, { hollow: true, width: 1.2, opacity: 0.45 }));
      }
      var mx2 = posX(mark);
      var nextX = posX(mark === div ? 1 : mark + 1);
      out.push(line(mx2, topY, mx2, botY, 2.4, 0.9));
      out.push(line(mx2, topY, nextX, botY, 1.8, 0.65));
      out.push(circle(mx2, topY, 5, { width: 1.6, opacity: 0.9 }));
      out.push(circle(mx2, botY, 5, { width: 1.6, opacity: 0.9 }));
    } else if (family === "constraint") {
      // A channel narrowing over `div` bars; at the mark the bar leaves a
      // gap, so the constraint is the passage the card opens.
      var topC = 64;
      var botC = 336;
      var halfAt = function (y) {
        return 150 - (110 * (y - topC)) / (botC - topC);
      };
      out.push(line(200 - halfAt(topC), topC, 200 - halfAt(botC), botC, 1.6, 0.5));
      out.push(line(200 + halfAt(topC), topC, 200 + halfAt(botC), botC, 1.6, 0.5));
      for (var bi2 = 1; bi2 <= div; bi2++) {
        var by2 = topC + ((botC - topC) * (bi2 - 0.5)) / div;
        var bh = halfAt(by2);
        var open = bi2 === mark;
        if (open) {
          out.push(line(200 - bh, by2, 200 - 24, by2, 2.4, 0.9));
          out.push(line(200 + 24, by2, 200 + bh, by2, 2.4, 0.9));
          out.push(circle(200, by2, 5, { hollow: true, width: 1.6, opacity: 0.9 }));
        } else {
          out.push(line(200 - bh, by2, 200 + bh, by2, 1.1, 0.28));
        }
      }
    } else if (family === "substitution") {
      // A column of `div` slots; at the mark the square slot is emptied and a
      // round element takes its place, joined by a short arrow.
      var colTop = 64;
      var colBot = 336;
      var slotX = 168;
      for (var ui2 = 1; ui2 <= div; ui2++) {
        var uy = colTop + ((colBot - colTop) * (ui2 - 0.5)) / div;
        if (ui2 === mark) {
          out.push(dashed(slotX - 9, uy - 9, 18, 18));
          out.push(circle(slotX + 62, uy, 9, { width: 1.8, opacity: 0.9 }));
          out.push(line(slotX + 12, uy, slotX + 50, uy, 1.4, 0.55));
        } else {
          out.push(rect(slotX - 9, uy - 9, 18, 18, { rx: 2, width: 1.2, opacity: 0.3 }));
        }
      }
    } else if (family === "perspective") {
      // The phase's viewpoints set on a ring; the card sights one of them
      // from the centre, so the mark is the point of view and not the angle.
      var pcx = 200;
      var pcy = 200;
      var ring = 118;
      for (var vi = 1; vi <= div; vi++) {
        var va = (2 * Math.PI * (vi - 1)) / div - Math.PI / 2;
        var vx = pcx + ring * Math.cos(va);
        var vy = pcy + ring * Math.sin(va);
        var seen = vi === mark;
        if (seen) {
          out.push(line(pcx, pcy, vx, vy, 2.4, 0.9));
          out.push(circle(vx, vy, 6, { width: 1.8, opacity: 0.9 }));
        } else {
          out.push(circle(vx, vy, 3.4, { hollow: true, width: 1.2, opacity: 0.35 }));
        }
      }
      out.push(circle(pcx, pcy, 4, { hollow: true, width: 1.4, opacity: 0.6 }));
    } else if (family === "mapping") {
      // The source row and the target row, with one arrow at the mark: the
      // mechanism is carried across, not merely joined.
      var mTop = 128;
      var mBot = 272;
      for (var mi = 1; mi <= div; mi++) {
        var mxs = posX(mi);
        out.push(circle(mxs, mTop, 3.2, { hollow: true, width: 1.2, opacity: 0.3 }));
        out.push(circle(mxs, mBot, 3.2, { hollow: true, width: 1.2, opacity: 0.3 }));
      }
      var mmx = posX(mark);
      out.push(circle(mmx, mTop, 6, { width: 1.8, opacity: 0.9 }));
      out.push(circle(mmx, mBot, 6, { width: 1.8, opacity: 0.9 }));
      out.push(
        '<path d="M ' + coord(mmx) + " " + coord(mTop + 8) +
        " L " + coord(mmx) + " " + coord(mBot - 14) +
        '" fill="none" stroke="currentColor" stroke-width="2.4" opacity="0.9" ' + STROKE + "/>"
      );
      out.push(
        '<path d="M ' + coord(mmx - 7) + " " + coord(mBot - 17) +
        " L " + coord(mmx) + " " + coord(mBot - 8) +
        " L " + coord(mmx + 7) + " " + coord(mBot - 17) +
        '" fill="none" stroke="currentColor" stroke-width="2.4" opacity="0.9" ' + STROKE + "/>"
      );
    } else if (family === "provocation") {
      // A framed field with the phase's positions along its foot and a strike
      // entering from outside at the marked one: the stimulus comes from
      // beyond the frame, which is what makes it a provocation.
      var pTop = 56;
      var pSide = 288;
      out.push(rect(200 - pSide / 2, pTop, pSide, pSide, { rx: 8, width: 1.5, opacity: 0.4 }));
      for (var qi = 1; qi <= div; qi++) {
        var qx = posX(qi);
        var lit = qi === mark;
        out.push(line(qx, pTop + pSide, qx, pTop + pSide + (lit ? 12 : 7), lit ? 2.4 : 1.1, lit ? 0.9 : 0.3));
        if (lit) {
          out.push(
            '<path d="M 356 32 L 322 96 L 344 112 L ' + coord(qx) + " " + coord(pTop + pSide - 8) +
            '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" opacity="0.9" ' + STROKE + "/>"
          );
          out.push(circle(qx, pTop + pSide - 8, 5.5, { width: 1.7, opacity: 0.9 }));
        }
      }
    } else if (family === "timing") {
      // A timeline of the phase's positions, with the marked moment lifted
      // off the line: the move is about when, and the lift is where.
      var tLine = 240;
      out.push(line(48, tLine, 352, tLine, 1.8, 0.6));
      for (var ti = 1; ti <= div; ti++) {
        var tx = posX(ti);
        var when = ti === mark;
        out.push(line(tx, tLine - (when ? 0 : 5), tx, tLine + (when ? 0 : 5), when ? 2.4 : 1.1, when ? 0.9 : 0.3));
        if (when) {
          out.push(line(tx, tLine - 82, tx, tLine, 1.4, 0.5, "6 6"));
          out.push(circle(tx, tLine - 90, 6, { width: 1.8, opacity: 0.9 }));
          out.push(line(tx - 16, tLine - 90, tx + 16, tLine - 90, 1.2, 0.45));
        }
      }
    } else {
      // An unknown family still reads both numbers, so a misspelling cannot
      // declare knobs this shape ignores.
      out.push(rect(56, 56, 288, 288, { rx: 6, width: 1.6, opacity: 0.5 }));
      for (var fi2 = 0; fi2 < div; fi2++) {
        var fx = 56 + (288 * (fi2 + 0.5)) / div;
        out.push(line(fx, 56, fx, 66, 1.4, 0.4));
      }
      out.push(circle(posX(mark), 200, 8, { width: 1.6, opacity: 0.7 }));
    }
    return out.join("");
  };

  /* --- Copywriting: the shape of the move ------------------------------ */

  /* A copy card's figure reads its own record twice: the family is the
     structural move its mechanism states (a sequence walked, a loss weighed,
     a gap left open, evidence stacked, identity named, friction removed, two
     states contrasted, a value anchored, a rhythm set, control handed over, a
     loop closed), and the mark is the card's position in its surface. Every
     drawing shows `div` positions and marks one, so the label under it -
     "Gap at position 2 of 12" - is a claim a reader can check against the
     picture. */
  shapes["copywriting-figure"] = function (p) {
    var family = p.family || "sequence";
    var div = Math.max(1, Math.round(p.divisions || 12));
    var mark = Math.max(1, Math.min(div, Math.round(p.mark || 1)));
    var out = [];
    var x0 = 56;
    var span = 288;
    var posX = function (i) {
      return x0 + (span * (i - 0.5)) / div;
    };

    if (family === "sequence") {
      // Stones stepping up across the surface; the marked stage is the filled
      // one, and the connecting line is the order the reader is walked in.
      var sy0 = 312;
      var sy1 = 96;
      for (var si = 1; si <= div; si++) {
        var sx = posX(si);
        var sy = div > 1 ? sy0 - ((sy0 - sy1) * (si - 1)) / (div - 1) : sy0;
        var on = si === mark;
        out.push(
          rect(sx - 9, sy - 9, 18, 18, {
            rx: 2,
            width: on ? 2.4 : 1.2,
            opacity: on ? 0.95 : 0.3,
            fill: on ? "currentColor" : "none",
            fillOpacity: on ? 0.16 : undefined
          })
        );
        if (si < div) {
          var nx = posX(si + 1);
          var ny = div > 1 ? sy0 - ((sy0 - sy1) * si) / (div - 1) : sy0;
          out.push(line(sx + 9, sy, nx - 9, ny, 1.4, on ? 0.75 : 0.3));
        }
      }
    } else if (family === "aversion") {
      // A beam held level on a fulcrum, with the marked weight hanging where
      // the loss is counted.
      out.push(line(64, 130, 336, 130, 1.8, 0.6));
      out.push(
        '<path d="M 200 130 L 186 166 L 214 166 Z" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.6" ' +
          STROKE + "/>"
      );
      out.push(line(200, 166, 200, 210, 1.4, 0.45));
      for (var ai = 1; ai <= div; ai++) {
        var ax = posX(ai);
        out.push(line(ax, 130, ax, 138, 1.1, 0.3));
      }
      var wx = posX(mark);
      out.push(line(wx, 130, wx, 216, 1.6, 0.7));
      out.push(
        rect(wx - 13, 216, 26, 20, {
          rx: 3,
          width: 2.2,
          opacity: 0.9,
          fill: "currentColor",
          fillOpacity: 0.14
        })
      );
      out.push(line(64, 258, 336, 258, 1.2, 0.25));
    } else if (family === "gap") {
      // A ring with one arc missing; the opening sits at the mark, and the two
      // ends of the arc lean toward each other.
      var cx = 200;
      var cy = 200;
      var r = 116;
      var gapHalf = Math.PI / Math.max(4, div);
      var centerAngle = ((mark - 0.5) / div) * Math.PI * 2 - Math.PI / 2;
      var start = centerAngle + gapHalf;
      var end = centerAngle + Math.PI * 2 - gapHalf;
      var pt = function (t) {
        return [coord(cx + r * Math.cos(t)), coord(cy + r * Math.sin(t))];
      };
      var s0 = pt(start);
      var e0 = pt(end);
      var large = end - start > Math.PI ? 1 : 0;
      out.push(
        '<path d="M ' + s0[0] + " " + s0[1] + " A " + r + " " + r + " 0 " + large + " 1 " + e0[0] + " " + e0[1] +
          '" fill="none" stroke="currentColor" stroke-width="2.4" opacity="0.85" ' + STROKE + "/>"
      );
      for (var gi = 1; gi <= div; gi++) {
        var ang = ((gi - 0.5) / div) * Math.PI * 2 - Math.PI / 2;
        var gx = cx + (r - 16) * Math.cos(ang);
        var gy = cy + (r - 16) * Math.sin(ang);
        out.push(circle(gx, gy, gi === mark ? 4.5 : 2.2, { width: 1.2, opacity: gi === mark ? 0.95 : 0.35 }));
      }
      out.push(circle(cx, cy, 5, { hollow: true, width: 1.4, opacity: 0.6 }));
    } else if (family === "proof") {
      // Evidence stacked in `div` bars; the marked bar is the solid one.
      var top = 64;
      var bottom = 336;
      var barH = (bottom - top) / div;
      for (var pi = 1; pi <= div; pi++) {
        var py = bottom - barH * pi;
        var pon = pi === mark;
        out.push(
          rect(96, py + 2, 208, Math.max(6, barH - 6), {
            rx: 2,
            width: pon ? 2.2 : 1.1,
            opacity: pon ? 0.9 : 0.28,
            fill: pon ? "currentColor" : "none",
            fillOpacity: pon ? 0.14 : undefined
          })
        );
      }
      out.push(line(86, 64, 86, 336, 1.4, 0.4));
    } else if (family === "identity") {
      // Concentric rings around the reader; the marked ring is the one the
      // copy names.
      var icx = 200;
      var icy = 200;
      for (var ii = 1; ii <= div; ii++) {
        var ir = 12 + (128 * ii) / div;
        var ion = ii === mark;
        // The marked ring is drawn heavy, not filled: a filled circle is a
        // disc at every radius, and it would hide the rings inside it.
        out.push(circle(icx, icy, ir, { hollow: true, width: ion ? 6 : 1.1, opacity: ion ? 0.95 : 0.26 }));
      }
      out.push(circle(icx, icy, 4, { width: 1.4, opacity: 0.7 }));
    } else if (family === "ease") {
      // A rough path that resolves into a straight run; the mark is where the
      // reader's way smooths.
      var seg = Math.max(2, div);
      var pts = [];
      for (var ei = 0; ei <= seg; ei += 1) {
        var ex = x0 + (span * ei) / seg;
        var rough = ei / seg < 0.5 ? 34 : 6;
        var ey = 200 + (ei % 2 === 0 ? -rough : rough);
        pts.push([ex, ey]);
      }
      var path = "M " + pts.map((q) => coord(q[0]) + " " + coord(q[1])).join(" L ");
      out.push('<path d="' + path + '" fill="none" stroke="currentColor" stroke-width="2.2" opacity="0.7" ' + STROKE + "/>");
      var mx = posX(mark);
      var my = 200 + (mark % 2 === 0 ? -6 : 6);
      out.push(line(mx, 64, mx, 336, 1.1, 0.18, "6 8"));
      out.push(circle(mx, my, 6, { width: 1.8, opacity: 0.95, fill: "currentColor" }));
    } else if (family === "contrast") {
      // Two panels split by a divider; the panel holding the mark is filled.
      var split = 200;
      var markedLeft = mark <= Math.ceil(div / 2);
      out.push(
        rect(72, 96, split - 72 - 6, 208, {
          rx: 4,
          width: 1.4,
          opacity: markedLeft ? 0.85 : 0.3,
          fill: markedLeft ? "currentColor" : "none",
          fillOpacity: markedLeft ? 0.12 : undefined
        })
      );
      out.push(
        rect(split + 6, 96, 328 - split - 6, 208, {
          rx: 4,
          width: 1.4,
          opacity: markedLeft ? 0.3 : 0.85,
          fill: markedLeft ? "none" : "currentColor",
          fillOpacity: markedLeft ? undefined : 0.12
        })
      );
      out.push(line(split, 80, split, 320, 1.6, 0.55));
      for (var ci2 = 1; ci2 <= div; ci2++) {
        var cx2 = posX(ci2);
        out.push(line(cx2, 320, cx2, 328, 1.1, ci2 === mark ? 0.9 : 0.3));
      }
    } else if (family === "anchor") {
      // A weight hung at the marked notch: the value set before the reader
      // chooses.
      out.push(line(64, 120, 336, 120, 1.8, 0.6));
      for (var ni2 = 1; ni2 <= div; ni2++) {
        var nx2 = posX(ni2);
        out.push(line(nx2, 120, nx2, 130, 1.1, 0.3));
      }
      var anx = posX(mark);
      out.push(line(anx, 120, anx, 236, 1.6, 0.75));
      out.push(rect(anx - 18, 236, 36, 24, { rx: 3, width: 2.2, opacity: 0.9, fill: "currentColor", fillOpacity: 0.14 }));
      out.push(line(64, 292, 336, 292, 1.2, 0.25));
    } else if (family === "cadence") {
      // A run of bars, tall and short in turn; the marked bar is the beat the
      // card sets.
      var base = 300;
      for (var bi2 = 1; bi2 <= div; bi2++) {
        var bx2 = posX(bi2);
        var tall = bi2 % 2 === 1;
        var h = bi2 === mark ? 150 : tall ? 96 : 44;
        out.push(
          rect(bx2 - 6, base - h, 12, h, {
            rx: 1,
            width: bi2 === mark ? 2.2 : 1.1,
            opacity: bi2 === mark ? 0.9 : 0.3,
            fill: bi2 === mark ? "currentColor" : "none",
            fillOpacity: bi2 === mark ? 0.16 : undefined
          })
        );
      }
      out.push(line(48, base, 352, base, 1.4, 0.45));
    } else if (family === "agency") {
      // An arrow from the reader to the marked target: the copy hands control
      // over rather than asking for it. The reader and the target sit on
      // different rows so the arrow stays a gesture at every mark, and the
      // surface's twelve positions run underneath, so "position N of 12" is
      // readable from the drawing rather than only from its label.
      var tx2 = posX(mark);
      var sx2 = 76;
      var sy2 = 272;
      var sr2 = 15;
      var ty2 = 120;
      var tr2 = 21;
      out.push(circle(sx2, sy2, sr2, { hollow: true, width: 2, opacity: 0.8 }));
      var dx2 = tx2 - sx2;
      var dy2 = ty2 - sy2;
      var len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      var ux2 = dx2 / len2;
      var uy2 = dy2 / len2;
      var ax1 = sx2 + ux2 * (sr2 + 4);
      var ay1 = sy2 + uy2 * (sr2 + 4);
      var ax2 = tx2 - ux2 * (tr2 + 8);
      var ay2 = ty2 - uy2 * (tr2 + 8);
      out.push(line(ax1, ay1, ax2, ay2, 2, 0.75));
      var bx1 = ax2 - ux2 * 15;
      var by1 = ay2 - uy2 * 15;
      var wpx = -uy2 * 7;
      var wpy = ux2 * 7;
      out.push(
        '<path d="M ' + coord(ax2) + " " + coord(ay2) + " L " + coord(bx1 + wpx) + " " + coord(by1 + wpy) +
          " L " + coord(bx1 - wpx) + " " + coord(by1 - wpy) + ' Z" fill="currentColor" opacity="0.75" ' + STROKE + "/>"
      );
      out.push(circle(tx2, ty2, tr2, { width: 2.4, opacity: 0.9 }));
      out.push(circle(tx2, ty2, 7, { width: 1.6, opacity: 0.85 }));
      for (var gi2 = 1; gi2 <= div; gi2++) {
        var gx2 = posX(gi2);
        out.push(line(gx2, 312, gx2, gi2 === mark ? 300 : 318, 1.1, gi2 === mark ? 0.9 : 0.3));
      }
      out.push(line(x0, 330, x0 + span, 330, 1.2, 0.25));
    } else if (family === "loop") {
      // A returning arc; the marked segment is drawn heavy, and the arrowhead
      // closes the circle.
      var lcx = 200;
      var lcy = 200;
      var lr = 112;
      var lstart = -Math.PI / 2;
      out.push(
        '<path d="M ' + coord(lcx) + " " + coord(lcy - lr) +
          " A " + lr + " " + lr + " 0 1 1 " + coord(lcx - 6) + " " + coord(lcy - lr + 2) +
          '" fill="none" stroke="currentColor" stroke-width="2.2" opacity="0.7" ' + STROKE + "/>"
      );
      var la = lstart + ((mark - 0.5) / div) * Math.PI * 2;
      var la2 = la + (Math.PI * 2) / div;
      var lp1 = [lcx + lr * Math.cos(la), lcy + lr * Math.sin(la)];
      var lp2 = [lcx + lr * Math.cos(la2), lcy + lr * Math.sin(la2)];
      var llarge = la2 - la > Math.PI ? 1 : 0;
      out.push(
        '<path d="M ' + coord(lp1[0]) + " " + coord(lp1[1]) + " A " + lr + " " + lr + " 0 " + llarge + " 1 " +
          coord(lp2[0]) + " " + coord(lp2[1]) +
          '" fill="none" stroke="currentColor" stroke-width="3.4" opacity="0.95" ' + STROKE + "/>"
      );
      out.push(
        '<path d="M ' + coord(lcx) + " " + coord(lcy - lr - 10) + " L " + coord(lcx + 10) + " " + coord(lcy - lr + 2) +
          " L " + coord(lcx - 10) + " " + coord(lcy - lr + 2) + ' Z" fill="currentColor" opacity="0.8" ' + STROKE + "/>"
      );
    } else {
      // An unknown family still reads both numbers, so a misspelling cannot
      // declare knobs this shape ignores.
      out.push(rect(56, 56, 288, 288, { rx: 6, width: 1.6, opacity: 0.5 }));
      for (var fi3 = 0; fi3 < div; fi3++) {
        var fx3 = x0 + (span * (fi3 + 0.5)) / div;
        out.push(line(fx3, 56, fx3, 66, 1.4, 0.4));
      }
      out.push(circle(posX(mark), 200, 8, { width: 1.6, opacity: 0.7 }));
    }
    return out.join("");
  };

  /*
   * Productivity Architecture: eight structural families over the same three
   * knobs every family shape carries - which structure, how many parts, and
   * which part is the move. The family is the shape of the move, not the
   * deck's domain: the front's kicker already prints the domain, so a shape
   * per domain would draw the same distinction twice. Every family reads all
   * three numbers, so a record cannot declare a position the drawing ignores;
   * the layout map fixes family, divisions, mark and the printed label
   * together, and the label is the card's own schematic line.
   */
  shapes["productivity-figure"] = function (p) {
    var family = String(p.family || "pipeline");
    var div = Math.max(1, Math.round(p.divisions || 4));
    var mark = Math.max(1, Math.min(div, Math.round(p.mark || 1)));
    var out = [];

    // A sampled arc: points are rounded by coord() and by the canonical pass,
    // so the committed bundle matches across platforms. An SVG arc flag would
    // carry platform trig in its endpoints instead.
    function arc(cx0, cy0, r, a0, a1, width, opacity, steps) {
      var n = steps || 28;
      var d = [];
      for (var i = 0; i <= n; i += 1) {
        var a = a0 + ((a1 - a0) * i) / n;
        d.push((i === 0 ? "M " : "L ") + coord(cx0 + r * Math.cos(a)) + " " + coord(cy0 + r * Math.sin(a)));
      }
      return (
        '<path d="' + d.join(" ") + '" fill="none" stroke="currentColor" stroke-width="' + width +
        '" opacity="' + opacity + '" ' + STROKE + "/>"
      );
    }

    if (family === "pipeline") {
      // Ordered stages on one rail; the marked stage is the filled stone.
      var railY = 200;
      var posX = function (i) { return 56 + (288 * (i - 0.5)) / div; };
      out.push(line(posX(1), railY, posX(div), railY, 1.6, 0.28));
      for (var i = 1; i <= div; i += 1) {
        var sx = posX(i);
        var on = i === mark;
        out.push(
          rect(sx - 12, railY - 12, 24, 24, {
            rx: 3,
            width: on ? 2.6 : 1.3,
            opacity: on ? 0.95 : 0.32,
            fill: on ? "currentColor" : "none",
            fillOpacity: on ? 0.22 : undefined
          })
        );
      }
    } else if (family === "gate") {
      // A decision diamond with `div` routes; the marked route is drawn solid
      // and carries the arrowhead.
      var dx = 118;
      var dy = 200;
      var dr = 30;
      var px = 312;
      var portY = function (i) { return div === 1 ? dy : 92 + (216 * (i - 1)) / (div - 1); };
      out.push(
        '<path d="M ' + dx + " " + (dy - dr) + " L " + (dx + dr) + " " + dy + " L " + dx + " " + (dy + dr) +
          " L " + (dx - dr) + " " + dy + ' Z" fill="none" stroke="currentColor" stroke-width="2" opacity="0.8" ' + STROKE + "/>"
      );
      for (var g = 1; g <= div; g += 1) {
        var py = portY(g);
        var vx = px - dx;
        var vy = py - dy;
        var len = Math.sqrt(vx * vx + vy * vy) || 1;
        var ux = vx / len;
        var uy = vy / len;
        var gOn = g === mark;
        out.push(line(dx + ux * (dr + 4), dy + uy * (dr + 4), px, py, gOn ? 2.6 : 1.2, gOn ? 0.85 : 0.16));
        if (gOn) {
          var bx = px - ux * 14;
          var by = py - uy * 14;
          var nx = -uy;
          var ny = ux;
          out.push(
            '<path d="M ' + coord(px) + " " + coord(py) + " L " + coord(bx + nx * 6) + " " + coord(by + ny * 6) +
              " L " + coord(bx - nx * 6) + " " + coord(by - ny * 6) + ' Z" fill="currentColor" opacity="0.85" ' + STROKE + "/>"
          );
          out.push(circle(px, py, 6, { width: 2.4, opacity: 0.95 }));
        } else {
          out.push(circle(px, py, 3.6, { hollow: true, width: 1.2, opacity: 0.38 }));
        }
      }
    } else if (family === "matrix") {
      // Two axes, one occupied cell. The grid is square-ish; the cell index is
      // read left to right, top to bottom.
      var cols = Math.ceil(Math.sqrt(div));
      var rows = Math.ceil(div / cols);
      var side = 240;
      var left = 80;
      var top = 80;
      var gap = 8;
      for (var m = 1; m <= div; m += 1) {
        var col = (m - 1) % cols;
        var row = Math.floor((m - 1) / cols);
        var mOn = m === mark;
        out.push(
          rect(left + col * (side / cols) + gap / 2, top + row * (side / rows) + gap / 2, side / cols - gap, side / rows - gap, {
            rx: 4,
            width: mOn ? 2.8 : 1.2,
            opacity: mOn ? 0.95 : 0.28,
            fill: mOn ? "currentColor" : "none",
            fillOpacity: mOn ? 0.22 : undefined
          })
        );
      }
    } else if (family === "gauge") {
      // A quantity against a cap: the arc fills to the marked level, and one
      // tick marks each level boundary.
      var gcy = 286;
      var gr = 130;
      out.push(arc(200, gcy, gr, Math.PI, Math.PI * 2, 1.2, 0.22, 36));
      out.push(arc(200, gcy, gr, Math.PI, Math.PI + (mark / div) * Math.PI, 3.2, 0.92, Math.max(6, Math.round((36 * mark) / div))));
      for (var t = 1; t <= div; t += 1) {
        var ta = Math.PI + ((t - 0.5) / div) * Math.PI;
        out.push(
          line(
            200 + (gr - 12) * Math.cos(ta), gcy + (gr - 12) * Math.sin(ta),
            200 + (gr + 6) * Math.cos(ta), gcy + (gr + 6) * Math.sin(ta), 1.1, 0.3
          )
        );
      }
      out.push(line(200 - gr - 8, gcy, 200 + gr + 8, gcy, 1.2, 0.25));
    } else if (family === "rhythm") {
      // Repeated intervals on a dial; the marked beat is the heavy sector and
      // the hand that reaches into it.
      var rcy = 198;
      var rr = 118;
      out.push('<circle cx="200" cy="' + rcy + '" r="' + rr + '" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.35" ' + STROKE + "/>");
      for (var b = 1; b <= div; b += 1) {
        var ba = -Math.PI / 2 + ((b - 0.5) / div) * Math.PI * 2;
        out.push(
          line(
            200 + (rr - 12) * Math.cos(ba), rcy + (rr - 12) * Math.sin(ba),
            200 + (rr + 10) * Math.cos(ba), rcy + (rr + 10) * Math.sin(ba),
            b === mark ? 2.4 : 1.2, b === mark ? 0.9 : 0.3
          )
        );
      }
      var ra0 = -Math.PI / 2 + ((mark - 1) / div) * Math.PI * 2;
      var ra1 = ra0 + (Math.PI * 2) / div;
      out.push(arc(200, rcy, rr, ra0, ra1, 3.4, 0.9, 12));
      var rah = ra0 + (ra1 - ra0) / 2;
      out.push(line(200, rcy, 200 + rr * 0.72 * Math.cos(rah), rcy + rr * 0.72 * Math.sin(rah), 2.2, 0.75));
      out.push(circle(200, rcy, 4.5, { width: 1.6, opacity: 0.8 }));
    } else if (family === "loop") {
      // A cycle that returns to its start: one arrowhead per step, and the
      // marked node carries the weight.
      var lr = 112;
      var pt = function (i) {
        var a = -Math.PI / 2 + ((i - 1) / div) * Math.PI * 2;
        return [200 + lr * Math.cos(a), 200 + lr * Math.sin(a), a];
      };
      out.push('<circle cx="200" cy="200" r="' + lr + '" fill="none" stroke="currentColor" stroke-width="1.3" opacity="0.3" ' + STROKE + "/>");
      for (var q = 1; q <= div; q += 1) {
        // The arrow sits between two nodes, not on one: an arrowhead whose tip
        // lands on a node reads as a bowtie, not as direction.
        var qa = -Math.PI / 2 + ((q - 0.5) / div) * Math.PI * 2;
        var qx = 200 + lr * Math.cos(qa);
        var qy = 200 + lr * Math.sin(qa);
        var tx = -Math.sin(qa);
        var ty = Math.cos(qa);
        var qbx = qx - tx * 12;
        var qby = qy - ty * 12;
        out.push(
          '<path d="M ' + coord(qx) + " " + coord(qy) + " L " + coord(qbx - ty * 5) + " " + coord(qby + tx * 5) +
            " L " + coord(qbx + ty * 5) + " " + coord(qby - tx * 5) + ' Z" fill="currentColor" opacity="0.55" ' + STROKE + "/>"
        );
      }
      for (var n2 = 1; n2 <= div; n2 += 1) {
        var np = pt(n2);
        out.push(
          n2 === mark
            ? circle(np[0], np[1], 10, { width: 2.8, opacity: 0.95 })
            : circle(np[0], np[1], 6, { hollow: true, width: 1.3, opacity: 0.4 })
        );
      }
    } else if (family === "ladder") {
      // Ranked rungs with a cutoff: every rung up to and including the marked
      // one is held, the rest are faded.
      var lx1 = 148;
      var lx2 = 252;
      var ly0 = 64;
      var ly1 = 336;
      out.push(line(lx1, ly0, lx1, ly1, 1.6, 0.35));
      out.push(line(lx2, ly0, lx2, ly1, 1.6, 0.35));
      for (var r = 1; r <= div; r += 1) {
        var ry = div === 1 ? 200 : ly0 + ((ly1 - ly0) * (r - 1)) / (div - 1);
        var held = r <= mark;
        out.push(line(lx1, ry, lx2, ry, r === mark ? 3 : held ? 1.8 : 1, r === mark ? 0.95 : held ? 0.55 : 0.14));
      }
    } else if (family === "threshold") {
      // A curve that steps at the marked point: flat until the change, level
      // again after it.
      var tx0 = 72;
      var tx1 = 328;
      var tbase = 286;
      var ttop = 152;
      var txm = tx0 + ((tx1 - tx0) * mark) / div;
      out.push(
        '<path d="M ' + tx0 + " " + tbase + " L " + coord(txm) + " " + tbase + " L " + coord(txm) + " " + ttop +
          " L " + tx1 + " " + ttop + '" fill="none" stroke="currentColor" stroke-width="2.6" opacity="0.9" ' + STROKE + "/>"
      );
      var ticks = div <= 16 ? div : 10;
      for (var k = 0; k <= ticks; k += 1) {
        var txx = tx0 + ((tx1 - tx0) * k) / ticks;
        out.push(line(txx, tbase, txx, tbase + 8, 1, 0.25));
      }
      out.push(line(tx0, tbase, tx1, tbase, 1.1, 0.22));
      out.push(circle(txm, tbase, 5.5, { width: 2.2, opacity: 0.95 }));
    } else {
      // An unknown family still reads all three knobs, so a misspelling cannot
      // declare parameters this shape ignores.
      out.push(rect(56, 56, 288, 288, { rx: 6, width: 1.6, opacity: 0.5 }));
      for (var u = 0; u < div; u += 1) {
        var ux2 = 56 + (288 * (u + 0.5)) / div;
        out.push(line(ux2, 56, ux2, 66, 1.4, 0.4));
      }
      out.push(circle(56 + (288 * mark) / div, 200, 8, { width: 1.6, opacity: 0.7 }));
    }
    return out.join("");
  };

  /* --- Brand: eleven families, one figure ------------------------------ */

  /* The brand deck's forty-two frameworks are each drawn as one of eleven
     families, parameterised by {family, divisions, mark}. The divisions are
     drawn in the order the card's artifact lists them and the mark is the
     listed position, never a claim that the marked one matters most: BRA-24
     lists Purpose first, so Purpose is level 1, and the drawing does not say
     purpose is the foundation. Rings are the one geometric exception, numbered
     from the outer edge inward, because one concentric shape cannot be
     numbered two ways. Every family reads all three knobs, so a misspelling
     cannot declare a parameter its drawing ignores. */
  shapes["brand-figure"] = function (p) {
    var family = String(p.family || "ledger");
    var div = Math.max(2, Math.min(12, Math.round(p.divisions || 4)));
    var mark = Math.max(1, Math.min(div, Math.round(p.mark || 1)));
    var cx = 200;
    var cy = 200;
    var out = [];

    function at(cx0, cy0, r, a) {
      return [coord(cx0 + r * Math.cos(a)), coord(cy0 + r * Math.sin(a))];
    }

    if (family === "ledger") {
      // Ordered columns on one baseline; the marked column is the filled one.
      var top = 104;
      var base = 296;
      var gap = 6;
      var colW = (288 - gap * (div - 1)) / div;
      for (var i = 1; i <= div; i += 1) {
        var colX = 56 + (i - 1) * (colW + gap);
        out.push(
          rect(colX, top, coord(colW), base - top, i === mark
            ? { fill: "currentColor", width: 2, opacity: 0.88 }
            : { width: 1.1, opacity: 0.3 })
        );
      }
      out.push(line(56, base + 10, 344, base + 10, 1.1, 0.28));
    } else if (family === "matrix") {
      // Cells read row by row from the top-left; the marked cell is filled.
      // Two edges of the grid extend past it, which is what makes it a grid
      // of two axes rather than a table of values.
      var cols = Math.ceil(Math.sqrt(div));
      var rows = Math.ceil(div / cols);
      var gx = 80;
      var gy = 80;
      var cw = 240 / cols;
      var ch = 240 / rows;
      for (var m = 1; m <= div; m += 1) {
        var mc = (m - 1) % cols;
        var mr = Math.floor((m - 1) / cols);
        out.push(
          rect(coord(gx + mc * cw), coord(gy + mr * ch), coord(cw), coord(ch), m === mark
            ? { fill: "currentColor", width: 2.4, opacity: 0.86 }
            : { width: 1.2, opacity: 0.3 })
        );
      }
      out.push(line(gx, gy - 14, gx, gy + 240 + 14, 1.4, 0.45));
      out.push(line(gx - 14, gy + 240, gx + 240 + 14, gy + 240, 1.4, 0.45));
    } else if (family === "axes") {
      // One bipolar line per axis; the marked axis is the heavy one.
      var ay0 = 104;
      var ay1 = 296;
      var half = div > 8 ? 5 : 7;
      for (var a = 1; a <= div; a += 1) {
        var ay = ay0 + ((ay1 - ay0) * (a - 1)) / (div - 1);
        var aon = a === mark;
        out.push(line(76, coord(ay), 324, coord(ay), aon ? 3 : 1.2, aon ? 0.95 : 0.34));
        out.push(line(76, coord(ay - half), 76, coord(ay + half), aon ? 2.2 : 1.1, aon ? 0.9 : 0.3));
        out.push(line(324, coord(ay - half), 324, coord(ay + half), aon ? 2.2 : 1.1, aon ? 0.9 : 0.3));
        out.push(
          aon
            ? circle(200, coord(ay), 4.5, { width: 1.6, opacity: 0.9 })
            : circle(200, coord(ay), 2.4, { hollow: true, width: 1, opacity: 0.3 })
        );
      }
    } else if (family === "score") {
      // A radar of equal scores: the marked dimension's spoke is heavy and its
      // node filled. The scores are equal because the artifact states none.
      var sr = 132;
      var rim = [];
      for (var s = 1; s <= div; s += 1) {
        var sa = -Math.PI / 2 + ((s - 1) / div) * Math.PI * 2;
        var sEnd = at(cx, cy, sr, sa);
        out.push(line(cx, cy, sEnd[0], sEnd[1], s === mark ? 2.2 : 1, s === mark ? 0.8 : 0.2));
        var sNode = at(cx, cy, sr * 0.62, sa);
        rim.push(sNode);
        out.push(
          s === mark
            ? circle(sNode[0], sNode[1], 6.5, { width: 2.4, opacity: 0.95 })
            : circle(sNode[0], sNode[1], 3.2, { hollow: true, width: 1.1, opacity: 0.35 })
        );
      }
      var rimD = "M " + rim[0][0] + " " + rim[0][1];
      for (var sv = 1; sv < rim.length; sv += 1) rimD += " L " + rim[sv][0] + " " + rim[sv][1];
      out.push('<path d="' + rimD + ' Z" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.4" ' + STROKE + "/>");
      out.push(circle(cx, cy, 3, { width: 1.4, opacity: 0.55 }));
    } else if (family === "arc") {
      // A single lifted curve with the stages as nodes on it, in listed order.
      var ax0 = 64;
      var ax1 = 336;
      var ayb = 300;
      var ayt = 96;
      var curve = function (t) {
        return [
          coord(ax0 + (ax1 - ax0) * t),
          coord(ayb - (ayb - ayt) * (0.92 * Math.sin(Math.PI * t) + 0.08 * t))
        ];
      };
      var arcD = [];
      for (var tq = 0; tq <= 40; tq += 1) {
        var cp = curve(tq / 40);
        arcD.push((tq === 0 ? "M " : "L ") + cp[0] + " " + cp[1]);
      }
      out.push('<path d="' + arcD.join(" ") + '" fill="none" stroke="currentColor" stroke-width="2" opacity="0.5" ' + STROKE + "/>");
      for (var g = 1; g <= div; g += 1) {
        var gn = curve((g - 0.5) / div);
        out.push(
          g === mark
            ? circle(gn[0], gn[1], 8, { width: 2.8, opacity: 0.95 })
            : circle(gn[0], gn[1], 3.6, { hollow: true, width: 1.2, opacity: 0.35 })
        );
      }
      out.push(line(ax0, ayb, ax1, ayb, 1.1, 0.22));
    } else if (family === "tiers") {
      // Stacked bands with level 1 at the top, so the stack reads downward in
      // the order the artifact lists its levels.
      var ty0 = 88;
      var ty1 = 312;
      var tgap = 4;
      var bh = (ty1 - ty0 - tgap * (div - 1)) / div;
      for (var lv = 1; lv <= div; lv += 1) {
        var by = ty0 + (lv - 1) * (bh + tgap);
        out.push(
          rect(96, coord(by), 208, coord(bh), lv === mark
            ? { fill: "currentColor", width: 2.2, opacity: 0.86 }
            : { width: 1.1, opacity: 0.3 })
        );
      }
    } else if (family === "manifest") {
      // One row per key: a key mark and its line, in the order the schema
      // declares them. The marked key is the filled row.
      var my0 = 96;
      var my1 = 304;
      var fracs = [0.34, 0.26, 0.3, 0.22, 0.28, 0.32, 0.24, 0.3, 0.26, 0.34, 0.22, 0.28];
      for (var k = 1; k <= div; k += 1) {
        var ky = div === 1 ? cy : my0 + ((my1 - my0) * (k - 1)) / (div - 1);
        var kon = k === mark;
        out.push(
          rect(72, coord(ky - 7), 14, 14, kon
            ? { fill: "currentColor", width: 1.8, opacity: 0.9 }
            : { width: 1, opacity: 0.28 })
        );
        var kw = 288 * fracs[(k - 1) % fracs.length];
        out.push(line(96, coord(ky), coord(96 + kw), coord(ky), kon ? 3.4 : 1.6, kon ? 0.95 : 0.34));
      }
    } else if (family === "facets") {
      // Identity facets as wedges of one shape; the marked facet is filled.
      var fr = 132;
      for (var f = 1; f <= div; f += 1) {
        var fa0 = -Math.PI / 2 + ((f - 1) / div) * Math.PI * 2;
        var fa1 = -Math.PI / 2 + (f / div) * Math.PI * 2;
        var fs = at(cx, cy, fr, fa0);
        var fe = at(cx, cy, fr, fa1);
        var flarge = fa1 - fa0 > Math.PI ? 1 : 0;
        out.push(
          f === mark
            ? '<path d="M ' + cx + " " + cy + " L " + fs[0] + " " + fs[1] + " A " + fr + " " + fr +
              " 0 " + flarge + " 1 " + fe[0] + " " + fe[1] + ' Z" fill="currentColor" opacity="0.85" ' + STROKE + "/>"
            : '<path d="M ' + cx + " " + cy + " L " + fs[0] + " " + fs[1] + '" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.32" ' + STROKE + "/>"
        );
      }
      out.push(circle(cx, cy, fr, { hollow: true, width: 1.4, opacity: 0.45 }));
    } else if (family === "rings") {
      // Ring 1 is the outer edge and ring `div` the centre; the marked ring is
      // the heavy one. The numbers are printed in the drawing because "ring 3
      // of 3" otherwise reads as the outer ring to anyone who has not read the
      // map: each numeral sits in its own band on the vertical axis, so the
      // label and the drawing agree without the map.
      var rmax = 148;
      var rmin = 22;
      var rspace = div === 1 ? 0 : (rmax - rmin) / (div - 1);
      var rsize = div <= 6 ? 18 : Math.max(6.5, Math.min(13, rspace * 0.62));
      for (var rg = 1; rg <= div; rg += 1) {
        var rr = div === 1 ? rmax : rmax - rspace * (rg - 1);
        out.push(
          circle(cx, cy, coord(rr), rg === mark
            ? { hollow: true, width: 3.2, opacity: 0.95 }
            : { hollow: true, width: 1.2, opacity: 0.26 })
        );
        var bandMid = rg < div ? rr - rspace / 2 : rmin / 2;
        out.push(label(cx, coord(cy - bandMid + rsize * 0.35), String(rg), {
          size: rsize,
          weight: rg === mark ? 800 : 600,
          opacity: rg === mark ? 0.95 : 0.62
        }));
      }
    } else if (family === "statement") {
      // A constrained syntax on one line: one block per clause; the marked
      // clause is filled and taller. Clause widths vary, so the line reads as
      // a sentence with slots rather than a row of equal cells.
      var frac = [1.4, 0.9, 1.2, 1, 1.1, 0.8, 1.3, 0.95, 1.15, 1, 1.05, 0.85];
      var sgaps = 10;
      var avail = 288 - sgaps * (div - 1);
      var total = 0;
      for (var tf = 0; tf < div; tf += 1) total += frac[tf % frac.length];
      var unit = avail / total;
      var sx2 = 56;
      for (var cl = 1; cl <= div; cl += 1) {
        var cw2 = frac[(cl - 1) % frac.length] * unit;
        var con = cl === mark;
        out.push(
          rect(coord(sx2), con ? 184 : 190, coord(cw2), con ? 32 : 20, con
            ? { fill: "currentColor", width: 2, opacity: 0.85 }
            : { width: 1.1, opacity: 0.32 })
        );
        sx2 += cw2 + sgaps;
      }
      out.push(line(48, 224, 352, 224, 1.1, 0.2));
    } else if (family === "network") {
      // Nodes with a hub and ring links; the marked node is the heavy one.
      var nr = 122;
      var nodes = [];
      for (var nd = 1; nd <= div; nd += 1) {
        nodes.push(at(cx, cy, nr, -Math.PI / 2 + ((nd - 1) / div) * Math.PI * 2));
      }
      for (var h = 0; h < nodes.length; h += 1) {
        out.push(line(cx, cy, nodes[h][0], nodes[h][1], 1, 0.18));
      }
      for (var e2 = 0; e2 < nodes.length; e2 += 1) {
        var nx = nodes[(e2 + 1) % nodes.length];
        out.push(line(nodes[e2][0], nodes[e2][1], nx[0], nx[1], 1, 0.22));
      }
      for (var v = 0; v < nodes.length; v += 1) {
        out.push(
          v === mark - 1
            ? circle(nodes[v][0], nodes[v][1], 9, { width: 2.8, opacity: 0.95 })
            : circle(nodes[v][0], nodes[v][1], 5, { hollow: true, width: 1.2, opacity: 0.35 })
        );
      }
      out.push(circle(cx, cy, 3.5, { width: 1.4, opacity: 0.55 }));
    } else {
      // An unknown family still reads all three knobs, so a misspelling cannot
      // declare parameters this shape ignores.
      out.push(rect(56, 56, 288, 288, { rx: 6, width: 1.6, opacity: 0.5 }));
      for (var u = 0; u < div; u += 1) {
        var ux = 56 + (288 * (u + 0.5)) / div;
        out.push(line(coord(ux), 56, coord(ux), 66, 1.4, 0.4));
      }
      out.push(circle(coord(56 + (288 * mark) / div), 200, 8, { width: 1.6, opacity: 0.7 }));
    }
    return out.join("");
  };

  /* --- Negotiation: eleven families, one figure ------------------------- */

  /* The negotiation deck's forty-four tactics are each drawn as one of eleven
     families, parameterised by {family, divisions, mark}. Divisions are the
     positions the card's own record names, in the order it names them; the
     mark is the position the card's move rides on, never a claim that it is
     the best of them. The deck prints no numbers in the drawing: the label
     says "cue 3 of 3" and the picture holds three cues because the text
     listed three, so the drawing and the line cannot disagree. Every family
     reads all three knobs, so a misspelling cannot declare a parameter its
     drawing ignores. */
  shapes["negotiation-figure"] = function (p) {
    var family = String(p.family || "label");
    var div = Math.max(2, Math.min(12, Math.round(p.divisions || 3)));
    var mark = Math.max(1, Math.min(div, Math.round(p.mark || 1)));
    var cx = 200;
    var cy = 200;
    var out = [];

    // One arrowhead at (x, y) pointing along (dx, dy).
    function head(x, y, dx, dy) {
      var len = Math.hypot(dx, dy) || 1;
      var ux = dx / len;
      var uy = dy / len;
      var bx = x - ux * 13;
      var by = y - uy * 13;
      return (
        '<path d="M ' + coord(x) + " " + coord(y) + " L " + coord(bx - uy * 5) + " " +
        coord(by + ux * 5) + " L " + coord(bx + uy * 5) + " " + coord(by - ux * 5) +
        ' Z" fill="currentColor" opacity="0.8" ' + STROKE + "/>"
      );
    }

    if (family === "label") {
      // Named phrases on one spine; the held phrase is the filled chip.
      var ly0 = 104;
      var ly1 = 296;
      out.push(line(84, ly0 - 12, 84, ly1 + 12, 1.4, 0.3));
      for (var lp = 1; lp <= div; lp += 1) {
        var lpy = ly0 + ((ly1 - ly0) * (lp - 1)) / (div - 1);
        out.push(line(84, coord(lpy), 108, coord(lpy), lp === mark ? 2.4 : 1.1, lp === mark ? 0.9 : 0.3));
        out.push(
          rect(108, coord(lpy - 13), 184, 26, lp === mark
            ? { rx: 4, fill: "currentColor", width: 2, opacity: 0.86 }
            : { rx: 4, width: 1.1, opacity: 0.3 })
        );
      }
    } else if (family === "range") {
      // A bounded span with its points along it, ordered low to high. The
      // end stops are the bounds; the marked point is the filled node.
      var rx0 = 72;
      var rx1 = 328;
      var ry = 208;
      out.push(line(rx0, ry, rx1, ry, 2, 0.55));
      out.push(line(rx0, ry - 26, rx0, ry + 26, 2.4, 0.75));
      out.push(line(rx1, ry - 26, rx1, ry + 26, 2.4, 0.75));
      for (var rp = 1; rp <= div; rp += 1) {
        var rpx = div === 1 ? (rx0 + rx1) / 2 : rx0 + ((rx1 - rx0) * (rp - 1)) / (div - 1);
        out.push(
          rp === mark
            ? circle(coord(rpx), ry, 9, { width: 2.8, opacity: 0.95 })
            : circle(coord(rpx), ry, 5, { hollow: true, width: 1.2, opacity: 0.35 })
        );
      }
    } else if (family === "split") {
      // One bar divided into its halves; the marked half is filled.
      var sx0 = 72;
      var sw = 256;
      var sy0 = 168;
      var sh = 64;
      out.push(rect(sx0, sy0, sw, sh, { rx: 4, width: 2.2, opacity: 0.75 }));
      for (var sp = 1; sp <= div; sp += 1) {
        var spw = sw / div;
        if (sp > 1) out.push(line(coord(sx0 + spw * (sp - 1)), sy0, coord(sx0 + spw * (sp - 1)), sy0 + sh, 1.2, 0.35));
        if (sp === mark) {
          out.push(rect(coord(sx0 + spw * (sp - 1) + 3), sy0 + 3, coord(spw - 6), sh - 6, {
            rx: 3, fill: "currentColor", width: 1.6, opacity: 0.85
          }));
        }
      }
    } else if (family === "step") {
      // An ordered sequence climbing left to right; the marked step is heavy.
      var st0 = 72;
      var syb = 296;
      var stw = 256 / div;
      var stri = 168 / div;
      for (var sp2 = 1; sp2 <= div; sp2 += 1) {
        var sy = syb - stri * (sp2 - 1);
        var sx = st0 + stw * (sp2 - 1);
        out.push(line(coord(sx), coord(sy), coord(sx + stw), coord(sy), sp2 === mark ? 4 : 1.6, sp2 === mark ? 0.95 : 0.4));
        out.push(line(coord(sx + stw), coord(sy), coord(sx + stw), coord(sy - stri), sp2 === mark ? 3.2 : 1.4, sp2 === mark ? 0.9 : 0.35));
        out.push(
          circle(coord(sx + stw / 2), coord(sy), sp2 === mark ? 7 : 3.6, sp2 === mark
            ? { width: 2.4, opacity: 0.95 }
            : { hollow: true, width: 1.1, opacity: 0.35 })
        );
      }
      out.push(line(st0, syb, st0 + stw * div, syb, 1.1, 0.2));
    } else if (family === "exchange") {
      // The items in a multi-issue trade, one per row, each moving between the
      // two sides. The marked item is the filled pair; the arrows show that
      // each item is offered or asked for, not merely held.
      var ey0 = 112;
      var ey1 = 296;
      for (var ep = 1; ep <= div; ep += 1) {
        var eyp = ey0 + ((ey1 - ey0) * (ep - 1)) / (div - 1);
        var eon = ep === mark;
        var leftward = ep % 2 === 0;
        out.push(
          rect(88, coord(eyp - 11), 34, 22, eon
            ? { rx: 3, fill: "currentColor", width: 1.8, opacity: 0.86 }
            : { rx: 3, width: 1.1, opacity: 0.32 })
        );
        out.push(
          rect(278, coord(eyp - 11), 34, 22, eon
            ? { rx: 3, fill: "currentColor", width: 1.8, opacity: 0.86 }
            : { rx: 3, width: 1.1, opacity: 0.32 })
        );
        var ex0 = leftward ? 130 : 274;
        var ex1 = leftward ? 126 : 270;
        out.push(line(ex0, coord(eyp), ex1, coord(eyp), eon ? 3 : 1.4, eon ? 0.95 : 0.38));
        out.push(head(ex1, eyp, ex1 - ex0, 0));
      }
    } else if (family === "signal") {
      // Cues radiating from their source; the marked cue is the heavy arc.
      // The arcs sweep +/-0.95 rad and bulge to the right, so the drawable
      // radius is bounded by the frame on two sides, not one: the centre plus
      // the radius must stay inside the right edge, and the centre plus the
      // radius times sin(0.95) inside the bottom. At the frame centre that is
      // 200 for x; 190 leaves the stroke its margin at the right edge and has
      // every endpoint inside 0..400.
      var sgy = 200;
      var sgx = 200;
      out.push(circle(sgx, sgy, 6, { width: 2.2, opacity: 0.9 }));
      var sgmax = 190;
      var sgmin = 58;
      for (var gp = 1; gp <= div; gp += 1) {
        var gr = div === 1 ? sgmax : sgmin + ((sgmax - sgmin) * (gp - 1)) / (div - 1);
        var ga = 0.95;
        var gx1 = coord(sgx + gr * Math.cos(-ga));
        var gy1 = coord(sgy + gr * Math.sin(-ga));
        var gx2 = coord(sgx + gr * Math.cos(ga));
        var gy2 = coord(sgy + gr * Math.sin(ga));
        out.push(
          '<path d="M ' + gx1 + " " + gy1 + " A " + coord(gr) + " " + coord(gr) + " 0 0 1 " + gx2 + " " + gy2 +
            '" fill="none" stroke="currentColor" stroke-width="' + (gp === mark ? 3.8 : 1.5) +
            '" stroke-linecap="round" opacity="' + (gp === mark ? 0.95 : 0.28) + '" ' + STROKE + "/>"
        );
        out.push(line(coord(sgx + gr * Math.cos(ga)), coord(sgy + gr * Math.sin(ga)), coord(sgx + gr * Math.cos(-ga)), coord(sgy + gr * Math.sin(-ga)), 0.8, 0.12));
      }
    } else if (family === "alternative") {
      // Candidate moves fanning from one point; the taken one is heavy and
      // carries the arrowhead.
      var agx = 100;
      var agy = 200;
      var arad = 148;
      out.push(circle(agx, agy, 6, { width: 2.2, opacity: 0.9 }));
      for (var ap = 1; ap <= div; ap += 1) {
        var aa = -0.85 + (1.7 * (ap - 1)) / (div - 1);
        var ax2 = agx + arad * Math.cos(aa);
        var ay2 = agy + arad * Math.sin(aa);
        out.push(line(agx, agy, coord(ax2), coord(ay2), ap === mark ? 3.4 : 1.4, ap === mark ? 0.95 : 0.3));
        if (ap === mark) out.push(head(ax2, ay2, ax2 - agx, ay2 - agy));
        out.push(
          ap === mark
            ? circle(coord(ax2), coord(ay2), 7, { width: 2.4, opacity: 0.95 })
            : circle(coord(ax2), coord(ay2), 4, { hollow: true, width: 1.1, opacity: 0.35 })
        );
      }
    } else if (family === "stake") {
      // A position standing on its base, with what it costs held against it:
      // the marked cost is the filled bar.
      var kx = 176;
      out.push(line(kx, 104, kx, 296, 2.4, 0.75));
      out.push(
        '<path d="M ' + kx + " 296 L " + (kx - 26) + " 320 L " + (kx + 26) + ' 320 Z" fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.45" ' + STROKE + "/>"
      );
      out.push(circle(kx, 104, 7, { width: 2.4, opacity: 0.9 }));
      var ky0 = 128;
      var ky1 = 280;
      for (var kp = 1; kp <= div; kp += 1) {
        var kyp = ky0 + ((ky1 - ky0) * (kp - 1)) / (div - 1);
        var kw = 132 - (88 * (kp - 1)) / Math.max(1, div - 1);
        out.push(
          rect(coord(kx + 18), coord(kyp - 8), coord(kw), 16, kp === mark
            ? { rx: 3, fill: "currentColor", width: 1.6, opacity: 0.86 }
            : { rx: 3, width: 1, opacity: 0.3 })
        );
      }
    } else if (family === "layer") {
      // Stacked levels; each sits a little wider than the one above it, and the
      // marked level is the filled band.
      var lay0 = 96;
      var lay1 = 304;
      var lgap = 4;
      var lh = (lay1 - lay0 - lgap * (div - 1)) / div;
      for (var lvp = 1; lvp <= div; lvp += 1) {
        var ly2 = lay0 + (lvp - 1) * (lh + lgap);
        var lw = 168 + 12 * (lvp - 1);
        out.push(
          rect(coord(cx - lw / 2), coord(ly2), coord(lw), coord(lh), lvp === mark
            ? { rx: 3, fill: "currentColor", width: 2, opacity: 0.85 }
            : { rx: 3, width: 1.1, opacity: 0.3 })
        );
      }
    } else if (family === "choice") {
      // One stem to a fork, then a branch per option; the taken branch is
      // heavy and carries the arrowhead.
      out.push(line(cx, 312, cx, 244, 2.4, 0.75));
      out.push(circle(cx, 244, 5.5, { width: 1.8, opacity: 0.85 }));
      for (var chp = 1; chp <= div; chp += 1) {
        var cha = -1 + (2 * (chp - 1)) / (div - 1);
        var chx = cx + 132 * Math.sin(cha);
        var chy = 244 - 132 * Math.cos(cha);
        out.push(line(cx, 244, coord(chx), coord(chy), chp === mark ? 3.4 : 1.4, chp === mark ? 0.95 : 0.3));
        if (chp === mark) out.push(head(chx, chy, chx - cx, chy - 244));
        out.push(
          chp === mark
            ? circle(coord(chx), coord(chy), 7, { width: 2.4, opacity: 0.95 })
            : circle(coord(chx), coord(chy), 4, { hollow: true, width: 1.1, opacity: 0.35 })
        );
      }
    } else if (family === "expand") {
      // Frames widening beyond the first; the marked frame is the heavy one.
      var ep0 = 46;
      var ep1 = 128;
      for (var xp = 1; xp <= div; xp += 1) {
        var er = div === 1 ? ep1 : ep0 + ((ep1 - ep0) * (xp - 1)) / (div - 1);
        out.push(
          rect(coord(cx - er), coord(cy - er), coord(2 * er), coord(2 * er), xp === mark
            ? { rx: 6, width: 3.4, opacity: 0.95 }
            : { rx: 6, width: 1.2, opacity: 0.28 })
        );
      }
      out.push(circle(cx, cy, 4.5, { width: 1.6, opacity: 0.7 }));
    } else {
      // An unknown family still reads all three knobs, so a misspelling cannot
      // declare parameters this shape ignores.
      out.push(rect(56, 56, 288, 288, { rx: 6, width: 1.6, opacity: 0.5 }));
      for (var u = 0; u < div; u += 1) {
        var ux = 56 + (288 * (u + 0.5)) / div;
        out.push(line(coord(ux), 56, coord(ux), 66, 1.4, 0.4));
      }
      out.push(circle(coord(56 + (288 * mark) / div), 200, 8, { width: 1.6, opacity: 0.7 }));
    }
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
