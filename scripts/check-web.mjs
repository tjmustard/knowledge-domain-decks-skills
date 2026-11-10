#!/usr/bin/env node
/*
 * Headless web smoke test at a 390 px phone viewport.
 *
 * Drives any installed Chrome/Chromium over the DevTools protocol using Node's
 * built-in WebSocket: no npm dependency. Asserts no horizontal overflow, all
 * cards render, a card flips to expose the verso, and the category filter works.
 *
 * Exits 2 when no supported browser is found (setup problem, not a code failure).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ROOT,
  deckArgs,
  listDeckSlugs,
  loadCards,
  loadDeck,
  loadDecks,
  orderCards,
  deckShape,
  resolveFromRoot
} from "../packages/core/deck.mjs";

// --deck-index checks the repository's entry page, which lists every deck and
// links to each viewer. It is not a deck, so it gets its own mode rather than a
// fake slug. The deck pages keep their own run each.
const indexMode = process.argv.includes("--deck-index");
const { only, dir } = deckArgs();
const slugs = await listDeckSlugs(dir);

// With neither a deck nor index mode selected, run every page in its own
// process: the smoke test drives a real browser session and one page, and a
// shared session would make one failure look like the next page's.
if (!indexMode && !only) {
  let ok = true;
  const index = spawnSync(
    process.execPath,
    ["scripts/check-web.mjs", "--deck-index"],
    { cwd: ROOT, stdio: "inherit" }
  );
  if (index.status !== 0) ok = false;
  for (const slug of slugs) {
    const child = spawnSync(
      process.execPath,
      ["scripts/check-web.mjs", "--deck", slug],
      { cwd: ROOT, stdio: "inherit" }
    );
    if (child.status !== 0) ok = false;
  }
  // A summary covering every page, so the last deck's line is not read as the
  // result of the whole run.
  if (ok) console.log(`OK: index and ${slugs.length} decks at 390 px, every page without horizontal overflow.`);
  process.exit(ok ? 0 : 1);
}

const deck = indexMode ? null : await loadDeck(only ? only[0] : slugs[0], dir);

const CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
].filter(Boolean);

const browser = CANDIDATES.find((path) => existsSync(path));
if (!browser) {
  console.error(
    "No Chrome/Chromium found. Set CHROME_PATH to run the web smoke check."
  );
  process.exit(2);
}

// What the index page must list: every deck in the repository, by slug, name
// and card count. Read from the same records the generators read, so the check
// cannot agree with a wrong page by sharing its mistake.
const expectedIndex = indexMode
  ? await Promise.all(
      (await loadDecks({ dir })).map(async (deck) => ({
        slug: deck.slug,
        name: deck.name,
        count: (await loadCards(deck)).length
      }))
    )
  : null;

let cards = [];
let shape = null;
let filterCategory = null;
let expectedInCategory = 0;
let versoLabel = "";

if (!indexMode) {
  cards = await loadCards(deck);
  // The group key and the word on the verso both come from the deck, so this
  // test never has to know which deck it is pointed at.
  shape = deckShape(deck);
  const categoryCounts = cards.reduce((counts, card) => {
    const group = shape.group(card);
    counts[group] = (counts[group] || 0) + 1;
    return counts;
  }, {});
  // Use the largest category that still narrows the deck, so the filter has
  // something to narrow from; neither the name nor the expected count is a
  // constant that would drift as the deck grows.
  const largest = Object.keys(categoryCounts)
    .filter((category) => categoryCounts[category] < cards.length)
    .sort((a, b) => categoryCounts[b] - categoryCounts[a]);
  filterCategory = largest[0] || shape.group(cards[0]);
  expectedInCategory = categoryCounts[filterCategory];
  // What the flip must expose. A deck that prints declared blocks on the verso
  // has no checklist heading, so the first block the first card actually carries
  // is the label to look for; the CSS uppercases it either way. A block the deck
  // keeps off the card face ("card": false) is printed by the rules file, not by
  // the viewer, so looking for its label would fail a deck that is correct.
  const carried = shape.blocks.find((block) => {
    if (block.card === false) return false;
    const value = cards[0][block.field];
    if (value === undefined || value === null || value === "") return false;
    return !(Array.isArray(value) && value.length === 0);
  });
  versoLabel = carried
    ? carried.label.toUpperCase()
    : shape.labelCardItems.toUpperCase();
}

const deckSlug = indexMode ? null : only ? only[0] : slugs[0];
// The viewer page lives where the deck says it does; the default is the
// repository's per-slug directory, which is what every shipped deck uses.
const url = indexMode
  ? `file://${join(ROOT, "packages", "web", "index.html")}`
  : `file://${join(resolveFromRoot(deck.web.dir || `packages/web/decks/${deckSlug}`), "index.html")}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A cold start under load can take longer than a fixed 9 s budget, and a check
// that flakes into FAIL is as untrustworthy as one that flakes into PASS. The
// first attempt gets a generous budget, a second attempt runs on a fresh port,
// and a timeout reports what the browser itself said.
const ATTEMPTS = 2;
const POLLS = 100;
const POLL_INTERVAL_MS = 200;

let proc = null;
let port = 0;

function startBrowser() {
  port = 9000 + Math.floor(Math.random() * 900);
  const profile = join(tmpdir(), `kdd-web-check-${Date.now()}-${port}`);
  const child = spawn(browser, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank"
  ], { stdio: ["ignore", "ignore", "pipe"] });

  // Keep the browser's own complaints: when a start times out, its last words
  // are the difference between "slow machine" and "cannot start here at all".
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-2000);
  });
  child.stderrTail = () => stderr.split("\n").filter((line) => line.trim()).slice(-3).join(" / ");
  return child;
}

async function waitForVersion() {
  for (let i = 0; i < POLLS; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return response.json();
    } catch {
      /* not up yet */
    }
    await sleep(POLL_INTERVAL_MS);
  }
  const said = proc && proc.stderrTail ? proc.stderrTail() : "";
  throw new Error(
    `browser did not expose a DevTools endpoint on port ${port}` +
      (said ? ` - browser said: ${said}` : " - browser wrote nothing to stderr")
  );
}

let ws;
try {
  let started = false;
  for (let attempt = 1; attempt <= ATTEMPTS && !started; attempt += 1) {
    proc = startBrowser();
    try {
      await waitForVersion();
      started = true;
    } catch (error) {
      proc.kill("SIGKILL");
      if (attempt === ATTEMPTS) {
        // The browser is already killed and no socket is open, so this exits
        // without leaving anything behind. A stack here would bury the reason.
        console.error(`FAIL web smoke: could not start a browser - ${error.message}`);
        process.exit(1);
      }
      console.error(`retrying the web smoke test after a slow start: ${error.message}`);
      await sleep(500);
    }
  }
  const created = await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`,
    { method: "PUT" }
  );
  const target = await created.json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let nextId = 0;
  const pending = new Map();
  const waiters = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    } else if (message.method) {
      const list = waiters.get(message.method) || [];
      waiters.set(message.method, []);
      list.forEach((resolve) => resolve(message.params));
    }
  };
  const send = (method, params = {}) => {
    const id = ++nextId;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  };
  const once = (method) => new Promise((resolve) => {
    const list = waiters.get(method) || [];
    list.push(resolve);
    waiters.set(method, list);
  });
  const evaluate = (expression) => send("Runtime.evaluate", {
    expression,
    returnByValue: true
  }).then((result) => result.result.value);

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url });
  await loaded;
  await sleep(500);

  const failures = [];

  if (indexMode) {
    const layout = await evaluate(`(() => {
      const links = [...document.querySelectorAll('.deck-link')];
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        links: links.map((a) => ({
          href: a.getAttribute('href'),
          name: (a.querySelector('.deck-name') || {}).textContent || '',
          meta: (a.querySelector('.deck-meta') || {}).textContent || ''
        }))
      };
    })()`);

    if (layout.clientWidth !== 390) failures.push(`viewport is ${layout.clientWidth}px, expected 390`);
    if (layout.scrollWidth > layout.clientWidth) failures.push(`horizontal overflow: scrollWidth ${layout.scrollWidth}`);
    if (layout.links.length !== expectedIndex.length) {
      failures.push(`${layout.links.length} decks listed, expected ${expectedIndex.length}`);
    }
    expectedIndex.forEach((entry, index) => {
      const link = layout.links[index];
      if (!link) return;
      const name = link.name.trim();
      if (link.href !== `decks/${entry.slug}/index.html`) {
        failures.push(`${entry.slug} links to ${link.href}`);
      }
      if (name !== entry.name) failures.push(`deck ${index + 1} is "${name}", expected "${entry.name}"`);
      if (!link.meta.includes(`${entry.count} cards`)) {
        failures.push(`${name} does not show its ${entry.count} cards`);
      }
    });

    if (failures.length > 0) {
      console.error("FAIL web smoke of the index at 390 px:");
      failures.forEach((failure) => console.error(`  - ${failure}`));
      process.exitCode = 1;
    } else {
      console.log(
        `OK: index: 390 px viewport, no horizontal overflow, ` +
          `${layout.links.length} decks linked with title and card count.`
      );
    }
  } else {
    const layout = await evaluate(`(() => {
      const cards = [...document.querySelectorAll('.card')];
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        cards: cards.length,
        cardWidth: cards.length ? Math.round(cards[0].getBoundingClientRect().width) : 0
      };
    })()`);

    const flip = await evaluate(`(() => {
      const card = document.querySelector('.card');
      card.click();
      return {
        flipped: card.classList.contains('is-flipped'),
        pressed: card.getAttribute('aria-pressed'),
        versoVisible: card.querySelector('.back').getAttribute('aria-hidden') === 'false',
        versoHasChecklist: card.querySelector('.back').innerText.includes(${JSON.stringify(versoLabel)})
      };
    })()`);

    const filter = await evaluate(`(() => {
      const buttons = [...document.querySelectorAll('.filter')];
      const button = buttons.find((b) => b.dataset.filter === ${JSON.stringify(filterCategory)});
      button.click();
      return {
        visible: [...document.querySelectorAll('.card')].filter((c) => !c.hidden).length,
        pressed: buttons.filter((b) => b.getAttribute('aria-pressed') === 'true').length
      };
    })()`);

    const index = await evaluate(`(() => {
      const table = document.querySelector('.card-index table');
      if (!table) return { present: false };
      const rows = [...table.querySelectorAll('tbody tr')].map((tr) => {
        const cells = [...tr.children];
        const id = cells[0].textContent.trim();
        const article = document.getElementById('card-' + id);
        const link = tr.querySelector('a');
        return {
          id,
          name: cells[1].textContent.trim(),
          group: cells[2].textContent.trim(),
          cells: cells.length,
          source: cells.length > 3 ? cells[3].textContent.trim() : null,
          target: link ? link.getAttribute('href') : null,
          article: Boolean(article),
          renderedSource: article
            ? ((article.querySelector('.source') || {}).textContent || '').trim()
            : null
        };
      });
      return {
        present: true,
        heading: ((document.getElementById('card-index-title') || {}).textContent || '').trim(),
        rows
      };
    })()`);

    if (layout.clientWidth !== 390) failures.push(`viewport is ${layout.clientWidth}px, expected 390`);
    if (layout.scrollWidth > layout.clientWidth) failures.push(`horizontal overflow: scrollWidth ${layout.scrollWidth}`);
    if (layout.cards !== cards.length) failures.push(`${layout.cards} cards rendered, expected ${cards.length}`);
    if (!flip.flipped || flip.pressed !== "true") failures.push("flip did not toggle aria-pressed");
    if (!flip.versoVisible || !flip.versoHasChecklist) failures.push("verso fields not exposed after flip");
    if (filter.visible !== expectedInCategory || filter.pressed !== 1) {
      failures.push(
        `${filterCategory} filter showed ${filter.visible} cards, expected ${expectedInCategory}`
      );
    }

    // The full card index: one row per card, in the deck's declared order, with
    // the record's own id, name and group, and a source cell that says exactly
    // what the flipped card says. The last comparison is what keeps the
    // generator's citation copy and the viewer's from drifting apart.
    const ordered = orderCards(deck, cards);
    if (!index.present) {
      failures.push("no card index table on the page");
    } else {
      if (index.heading !== `All ${cards.length} cards`) {
        failures.push(`card index heading is "${index.heading}", expected "All ${cards.length} cards"`);
      }
      if (index.rows.length !== ordered.length) {
        failures.push(`card index has ${index.rows.length} rows, expected ${ordered.length}`);
      }
      const columns = shape.fields.attribution ? 4 : 3;
      ordered.forEach((card, position) => {
        const row = index.rows[position];
        if (!row) return;
        if (row.id !== card.id) failures.push(`index row ${position + 1} is ${row.id}, expected ${card.id}`);
        if (row.name !== card.name) failures.push(`${card.id} index name is "${row.name}"`);
        if (row.group !== shape.group(card)) failures.push(`${card.id} index group is "${row.group}"`);
        if (row.cells !== columns) failures.push(`${card.id} index row has ${row.cells} cells, expected ${columns}`);
        if (row.target !== `#card-${card.id}`) failures.push(`${card.id} index link goes to ${row.target}`);
        if (!row.article) failures.push(`${card.id} index link points at no card`);
        if (columns === 4 && row.renderedSource !== null && row.source !== row.renderedSource) {
          failures.push(`${card.id} index source differs from the card's own: "${row.source}" vs "${row.renderedSource}"`);
        }
      });
    }

    if (failures.length > 0) {
      console.error("FAIL web smoke at 390 px:");
      failures.forEach((failure) => console.error(`  - ${failure}`));
      process.exitCode = 1;
    } else {
      console.log(
        `OK: ${deckSlug}: 390 px viewport, no horizontal overflow, ${layout.cards} cards ` +
          `(${layout.cardWidth} px wide), flip exposes verso, ` +
          `${filterCategory} filter shows ${expectedInCategory}, index lists all ${index.rows ? index.rows.length : 0}.`
      );
    }
  }
} finally {
  if (ws) ws.close();
  if (proc) proc.kill("SIGKILL");
}
