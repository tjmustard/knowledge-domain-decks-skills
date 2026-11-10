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
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./lib/deck.mjs";

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

const url = `file://${join(ROOT, "packages", "web", "index.html")}`;
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
      versoHasChecklist: card.querySelector('.back').innerText.includes('OPERATIONAL CHECKLIST')
    };
  })()`);

  const filter = await evaluate(`(() => {
    const buttons = [...document.querySelectorAll('.filter')];
    const button = buttons.find((b) => b.dataset.filter === 'Gestalt & Visual Perception');
    button.click();
    return {
      visible: [...document.querySelectorAll('.card')].filter((c) => !c.hidden).length,
      pressed: buttons.filter((b) => b.getAttribute('aria-pressed') === 'true').length
    };
  })()`);

  const failures = [];
  if (layout.clientWidth !== 390) failures.push(`viewport is ${layout.clientWidth}px, expected 390`);
  if (layout.scrollWidth > layout.clientWidth) failures.push(`horizontal overflow: scrollWidth ${layout.scrollWidth}`);
  if (layout.cards !== 12) failures.push(`${layout.cards} cards rendered, expected 12`);
  if (!flip.flipped || flip.pressed !== "true") failures.push("flip did not toggle aria-pressed");
  if (!flip.versoVisible || !flip.versoHasChecklist) failures.push("verso fields not exposed after flip");
  if (filter.visible !== 1 || filter.pressed !== 1) failures.push("category filter did not reduce to one card");

  if (failures.length > 0) {
    console.error("FAIL web smoke at 390 px:");
    failures.forEach((failure) => console.error(`  - ${failure}`));
    process.exitCode = 1;
  } else {
    console.log(
      `OK: 390 px viewport, no horizontal overflow, ${layout.cards} cards ` +
      `(${layout.cardWidth} px wide), flip exposes verso, filter narrows to 1.`
    );
  }
} finally {
  if (ws) ws.close();
  if (proc) proc.kill("SIGKILL");
}
