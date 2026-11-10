/* Static card viewer. Data is bundled by scripts/generate-web-data.mjs. */
(function () {
  "use strict";

  var DECK = window.UX_DECK;
  var deckEl = document.getElementById("deck");
  var filtersEl = document.getElementById("filters");
  var emptyEl = document.getElementById("empty");

  if (!DECK || !DECK.cards) {
    deckEl.textContent = "deck-data.js is missing or empty. Run npm run build:web.";
    return;
  }

  var ACCENTS = {
    "Heuristic & Mental Models": "#1e3a8a",
    "Gestalt & Visual Perception": "#065f46",
    "Decision-Making & Cognitive Load": "#78350f",
    "Time, Motion & Ergonomics": "#831843",
    "Memory, Perception & Attention": "#312e81"
  };

  var categories = [];
  DECK.cards.forEach(function (card) {
    if (categories.indexOf(card.category) === -1) categories.push(card.category);
  });

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function citation(origin) {
    var authors = origin.authors.join(", ");
    return authors + " (" + origin.year + "). " + origin.title + ". " +
      origin.publication + ".";
  }

  function cardMarkup(card) {
    var accent = ACCENTS[card.category] || "#334155";
    var items = card.checklist.map(function (item) {
      return "<li>" + esc(item) + "</li>";
    }).join("");
    return (
      '<article class="card" tabindex="0" role="button" aria-pressed="false" ' +
      'aria-label="' + esc(card.name) + " — activate to flip" + '" ' +
      'data-category="' + esc(card.category) + '" style="--accent:' + accent + '">' +
        '<div class="card-inner">' +
          '<section class="face front">' +
            '<div class="card-head"><span class="card-id">' + esc(card.id) +
              '</span><span class="card-cat">' + esc(card.category) + "</span></div>" +
            "<h2>" + esc(card.name) + "</h2>" +
            '<p class="axiom">' + esc(card.axiom) + "</p>" +
            '<div class="figure" aria-hidden="true">' + card.svg + "</div>" +
            '<p class="trigger"><strong>When to apply.</strong> ' + esc(card.trigger) + "</p>" +
            '<span class="hint">Tap or press Enter to see the checklist</span>' +
          "</section>" +
          '<section class="face back" aria-hidden="true">' +
            '<div class="card-head"><span class="card-id">' + esc(card.id) +
              '</span><span class="card-cat">' + esc(card.category) + "</span></div>" +
            "<h2>" + esc(card.name) + "</h2>" +
            "<h3>Operational checklist</h3>" +
            "<ul>" + items + "</ul>" +
            "<h3>Anti-pattern</h3>" +
            '<p class="violation">' + esc(card.antiPattern.violation) + "</p>" +
            "<h3>Fix</h3>" +
            '<p class="fix">' + esc(card.antiPattern.remediation) + "</p>" +
            '<p class="source">' + esc(citation(card.academicOrigin)) + "</p>" +
          "</section>" +
        "</div>" +
      "</article>"
    );
  }

  var lede = document.getElementById("lede");
  if (lede) {
    lede.textContent = DECK.cards.length + " public-domain principles for " +
      "interface reviews. Tap a card to flip it and read the checklist and remediation.";
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
