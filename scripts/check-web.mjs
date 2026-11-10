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

const port = 9000 + Math.floor(Math.random() * 900);
const url = `file://${join(ROOT, "packages", "web", "index.html")}`;
const profile = join(tmpdir(), `kdd-web-check-${Date.now()}`);
const proc = spawn(browser, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "about:blank"
], { stdio: "ignore" });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForVersion() {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return response.json();
    } catch {
      /* not up yet */
    }
    await sleep(150);
  }
  throw new Error("browser did not expose a DevTools endpoint");
}

let ws;
try {
  await waitForVersion();
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
  if (layout.cards !== 6) failures.push(`${layout.cards} cards rendered, expected 6`);
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
  proc.kill("SIGKILL");
}
