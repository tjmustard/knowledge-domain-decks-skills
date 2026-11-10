/* Static card viewer. Data is bundled by scripts/generate-web-data.mjs. */
(function () {
  "use strict";

  // The page names its own deck bundle before this script runs, so the viewer
  // holds no deck of its own: build:web writes both the bundle and that line.
  var DECK = window[window.DECK_GLOBAL || ""];
  var deckEl = document.getElementById("deck");
  var filtersEl = document.getElementById("filters");
  var emptyEl = document.getElementById("empty");

  if (!DECK || !DECK.cards) {
    deckEl.textContent = "deck-data.js is missing or empty. Run npm run build:web.";
    return;
  }

  var ACCENTS = window[window.DECK_ACCENTS || ""] || {};
  // Which key carries the group a card belongs to, and what to call it. The
  // deck declares this; the viewer has no idea which deck it is showing.
  var FIELDS = window.DECK_FIELDS || {};
  var GROUP = FIELDS.group || "category";
  var ITEMS = FIELDS.items || "checklist";
  var ATTRIBUTION = FIELDS.attribution || "academicOrigin";
  var PROMPT = FIELDS.prompt || "prompt";
  var PROMPT_LABEL = FIELDS.labelPrompt || "Prompt";
  var ITEM_LABEL = FIELDS.labelItems || "Operational checklist";
  var ITEM_STYLE = FIELDS.itemStyle || "checklist";
  var BACK_HINT = FIELDS.backHint || "Tap or press Enter to see the checklist";
  // A deck may print the back of its cards as named blocks instead of a
  // checklist and an anti-pattern. The blocks are declared by the deck, so the
  // viewer still knows nothing about which deck it is showing; a deck that
  // declares none keeps the face it always had.
  var BLOCKS = FIELDS.blocks || [];
  var HEADLINE = FIELDS.headline || "axiom";
  var CONTEXT = FIELDS.context || "trigger";
  var CONTEXT_LABEL = FIELDS.labelContext || "When to apply";
  var groupOf = function (card) { return card[GROUP]; };

  var categories = [];
  DECK.cards.forEach(function (card) {
    if (categories.indexOf(groupOf(card)) === -1) categories.push(groupOf(card));
  });

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // A card's provenance is uneven between decks: a named author with a work and
  // a year, sometimes a bare work, sometimes a tradition with nothing else. Each
  // part prints only when it is there, and the full case reads exactly as before.
  function citation(origin) {
    if (!origin) return "";
    // The bundle carries signed years, where a negative value means BCE.
    var year = origin.year === undefined || origin.year === null
      ? ""
      : origin.year < 0 ? " (" + (-origin.year) + " BCE)" : " (" + origin.year + ")";
    var by = origin.authorsLabel
      ? origin.authorsLabel + year
      : year === "" ? "" : year.trim();
    var parts = [];
    if (by) parts.push(by + ".");
    // The title carries its own stop, so the full stop after the publication is
    // added only when there is one; otherwise the work would end "Tale..".
    if (origin.title) {
      var work = origin.title + origin.titleStop;
      parts.push(origin.publication ? work + " " + origin.publication + "." : work);
    } else if (origin.publication) {
      parts.push(origin.publication + ".");
    }
    return parts.join(" ");
  }

  // One declared block, laid out the way the deck asked for it. A block whose
  // field the record does not carry prints nothing at all: no heading over an
  // empty space.
  function blockMarkup(card) {
    return BLOCKS.map(function (block) {
      var value = card[block.field];
      if (value === undefined || value === null || value === "") return "";
      if (Array.isArray(value) && value.length === 0) return "";
      var body;
      if (block.style === "traits" || block.style === "words") {
        body = "<p>" + esc(Array.isArray(value) ? value.join(" · ") : value) + "</p>";
      } else if (block.style === "quotes") {
        body = "<p>" + esc(Array.isArray(value) ? value.join("  ") : value) + "</p>";
      } else if (block.style === "prose") {
        body = "<p>" + esc(value) + "</p>";
      } else if (block.style === "list") {
        body = "<ul>" + value.map(function (entry) {
          return "<li>" + esc(entry) + "</li>";
        }).join("") + "</ul>";
      } else {
        body = '<p class="example">' + esc(value) + "</p>";
      }
      return "<h3>" + esc(block.label) + "</h3>" + body;
    }).join("");
  }

  function cardMarkup(card) {
    var accent = ACCENTS[groupOf(card)] || "#334155";
    var items = (card[ITEMS] || []).map(function (item) {
      return "<li>" + esc(item.text) + "</li>";
    }).join("");
    var listTag = ITEM_STYLE === "steps" ? "ol" : "ul";
    // The prompt is a fill-in-the-blank line, and most records have none, so
    // the heading goes with it rather than standing empty above nothing.
    var prompt = card[PROMPT];
    var promptBlock = prompt
      ? "<h3>" + esc(PROMPT_LABEL) + '</h3><p class="prompt">' + esc(prompt) + "</p>"
      : "";
    // A block deck's front carries its own heading over the second line, and its
    // back is the declared blocks rather than a checklist and an anti-pattern.
    var blocks = BLOCKS.length > 0;
    var front = blocks
      ? '<p class="axiom">' + esc(card[HEADLINE]) + "</p>" +
        '<div class="figure" aria-hidden="true">' + card.svg + "</div>" +
        '<p class="trigger"><strong>' + esc(CONTEXT_LABEL) + ".</strong> " + esc(card[CONTEXT]) + "</p>"
      : '<p class="axiom">' + esc(card.axiom) + "</p>" +
        '<div class="figure" aria-hidden="true">' + card.svg + "</div>" +
        '<p class="trigger"><strong>When to apply.</strong> ' + esc(card.trigger) + "</p>";
    var verso = blocks
      ? blockMarkup(card) + promptBlock
      : "<h3>" + esc(ITEM_LABEL) + "</h3>" +
        "<" + listTag + ">" + items + "</" + listTag + ">" +
        "<h3>Anti-pattern</h3>" +
        '<p class="violation">' + esc(card.antiPattern.violation) + "</p>" +
        "<h3>Fix</h3>" +
        '<p class="fix">' + esc(card.antiPattern.remediation) + "</p>" +
        promptBlock;
    var source = citation(card[ATTRIBUTION]);
    var sourceBlock = source ? '<p class="source">' + esc(source) + "</p>" : "";
    return (
      '<article class="card" tabindex="0" role="button" aria-pressed="false" ' +
      'id="card-' + esc(card.id) + '" ' +
      'aria-label="' + esc(card.name) + " — activate to flip" + '" ' +
      'data-category="' + esc(groupOf(card)) + '" style="--accent:' + accent + '">' +
        '<div class="card-inner">' +
          '<section class="face front">' +
            '<div class="card-head"><span class="card-id">' + esc(card.id) +
              '</span><span class="card-cat">' + esc(groupOf(card)) + "</span></div>" +
            "<h2>" + esc(card.name) + "</h2>" +
            front +
            '<span class="hint">' + esc(BACK_HINT) + "</span>" +
          "</section>" +
          '<section class="face back" aria-hidden="true">' +
            '<div class="card-head"><span class="card-id">' + esc(card.id) +
              '</span><span class="card-cat">' + esc(groupOf(card)) + "</span></div>" +
            "<h2>" + esc(card.name) + "</h2>" +
            verso +
            sourceBlock +
            "</section>" +
        "</div>" +
      "</article>"
    );
  }

  // The lede is the deck's own sentence; it may name the card count as
  // {cards}, which the engine fills, the same placeholder the skill uses.
  var lede = document.getElementById("lede");
  if (lede) {
    lede.textContent = lede.textContent.replace("{cards}", String(DECK.cards.length));
  }

  deckEl.innerHTML = DECK.cards.map(cardMarkup).join("");

  function setFlipped(cardEl, flipped) {
    cardEl.classList.toggle("is-flipped", flipped);
    cardEl.setAttribute("aria-pressed", String(flipped));
    var front = cardEl.querySelector(".front");
    var back = cardEl.querySelector(".back");
    front.setAttribute("aria-hidden", String(flipped));
    back.setAttribute("aria-hidden", String(!flipped));
  }

  deckEl.addEventListener("click", function (event) {
    var cardEl = event.target.closest(".card");
    if (!cardEl) return;
    setFlipped(cardEl, !cardEl.classList.contains("is-flipped"));
  });

  deckEl.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    var cardEl = event.target.closest(".card");
    if (!cardEl) return;
    event.preventDefault();
    setFlipped(cardEl, !cardEl.classList.contains("is-flipped"));
  });

  function renderFilters() {
    var all = ['<button class="filter" type="button" data-filter="*" aria-pressed="true">All</button>'];
    categories.forEach(function (category) {
      all.push(
        '<button class="filter" type="button" data-filter="' + esc(category) +
        '" aria-pressed="false">' + esc(category) + "</button>"
      );
    });
    filtersEl.innerHTML = all.join("");
  }

  filtersEl.addEventListener("click", function (event) {
    var button = event.target.closest(".filter");
    if (!button) return;
    var wanted = button.getAttribute("data-filter");
    filtersEl.querySelectorAll(".filter").forEach(function (item) {
      item.setAttribute("aria-pressed", String(item === button));
    });
    var visible = 0;
    deckEl.querySelectorAll(".card").forEach(function (cardEl) {
      var show = wanted === "*" || cardEl.getAttribute("data-category") === wanted;
      cardEl.hidden = !show;
      if (show) visible += 1;
    });
    emptyEl.hidden = visible !== 0;
  });

  renderFilters();
})();
