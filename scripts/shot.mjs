#!/usr/bin/env node
// Headless-Chrome harness for measuring the local build of the Rivnay Group site.
//   node scripts/shot.mjs <url> [--width 1440] [--height 900] [--mobile] [--touch] [--dark] [--reduce]
//                         [--settle] [--scroll N] [--click "css"] [--wait ms] [--eval "js"]
//                         [--full] [--shot out.png] [--allow-error] [--timeout 15000]
// --eval runs the body of an async function after load + fonts.ready and prints the return value as JSON.
// --full scrolls the whole page first (the scroll reveal is one-shot and would otherwise capture blank),
// then captures everything; without it the capture is the viewport as a visitor sees it.
// --settle does that reveal pass BEFORE --click/--eval: below-the-fold .reveal elements otherwise sit at
// opacity 0 and 16px low, so measure them with --settle or your geometry is off by the reveal transform.
// A failed navigation, an HTTP status >= 400 or a load that never fires is an error, not a silent
// measurement of an error page (--allow-error measures it anyway). Chrome and its profile dir are always
// cleaned up, including on failure. Chrome's plain --screenshot ignores widths under ~500px, hence this.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const url = argv[0];
if (!url || url.startsWith("--")) { console.error("usage: shot.mjs <url> [flags]"); process.exit(2); }
const has = (k) => argv.includes(k);
const opt = (k, d) => {
  const i = argv.indexOf(k);
  if (i < 0) return d;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith("--")) { console.error(`${k} needs a value`); process.exit(2); }
  return v;
};
const num = (k, d) => { const v = +opt(k, d); if (Number.isNaN(v)) { console.error(`${k} needs a number`); process.exit(2); } return v; };
const width = num("--width", 1440), height = num("--height", 900), timeout = num("--timeout", 15000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dir = mkdtempSync(join(tmpdir(), "shot-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${dir}`, "--remote-debugging-port=0", `--window-size=${width},${height}`, "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
let sock;
try {
  let ws;
  for (let i = 0; i < 100 && !ws; i++) {
    await sleep(100);
    const f = join(dir, "DevToolsActivePort");
    if (existsSync(f)) {
      const [port] = readFileSync(f, "utf8").split("\n");
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).catch(() => null);
      const page = list && list.find((t) => t.type === "page");
      if (page) ws = page.webSocketDebuggerUrl;
    }
  }
  if (!ws) throw new Error("Chrome did not start");

  sock = new WebSocket(ws);
  await new Promise((r) => (sock.onopen = r));
  let id = 0; const waiting = new Map(); const events = [];
  sock.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
    else if (msg.method) events.push(msg);
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const n = ++id; waiting.set(n, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
    sock.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception?.description || ""));
    return r.result.value;
  };
  const scrollTo = (y) => evaluate(`window.scrollTo({ top: ${y}, behavior: "instant" }); true`);   // site.js turns smooth scrolling on after load
  const settle = () => evaluate("document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-visible', 'no-anim')); true");

  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: has("--mobile") });
  if (has("--touch")) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  const features = [];
  if (has("--dark")) features.push({ name: "prefers-color-scheme", value: "dark" });
  if (has("--reduce")) features.push({ name: "prefers-reduced-motion", value: "reduce" });
  if (features.length) await send("Emulation.setEmulatedMedia", { features });

  const nav = await send("Page.navigate", { url });
  if (nav.errorText) throw new Error(`navigation failed: ${nav.errorText} (${url})`);
  const deadline = Date.now() + timeout;
  while (!events.some((e) => e.method === "Page.loadEventFired")) {
    if (Date.now() > deadline) throw new Error(`load event never fired within ${timeout} ms (${url})`);
    await sleep(50);
  }
  if (!has("--allow-error")) {
    const doc = events.filter((e) => e.method === "Network.responseReceived" && e.params.type === "Document").pop();
    const status = doc && doc.params.response.status;
    if (status >= 400) throw new Error(`HTTP ${status} (${url}) — did you forget to rebuild, or mistype the path?`);
    const href = await evaluate("location.href");
    if (!href || href.startsWith("chrome-error://")) throw new Error(`page did not load (${url})`);
  }
  await evaluate("document.fonts ? document.fonts.ready.then(() => true) : true");
  await sleep(400);

  const scroll = has("--scroll") ? num("--scroll", 0) : null;
  if (has("--settle")) { await settle(); await sleep(100); }
  if (scroll !== null) { await scrollTo(scroll); await sleep(500); }
  const click = has("--click") ? opt("--click") : null;
  if (click) { await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(click)}); if (!e) throw new Error("no match for " + ${JSON.stringify(click)}); e.click(); return true; })()`); await sleep(500); }
  const wait = num("--wait", 0); if (wait) await sleep(wait);

  const code = has("--eval") ? opt("--eval") : null;
  if (code) { const v = await evaluate(`(async () => { ${code} })()`); console.log(JSON.stringify(v === undefined ? null : v, null, 1)); }

  const shot = has("--shot") ? opt("--shot") : null;
  if (shot) {
    let params = { format: "png" };
    if (has("--full")) {
      const total = await evaluate("document.documentElement.scrollHeight");
      for (let y = 0; y < total; y += Math.floor(height * 0.5)) { await scrollTo(y); await sleep(200); }
      await settle();
      await scrollTo(scroll !== null ? scroll : 0);
      await sleep(700);
      const h = await evaluate("Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))");
      params = { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: h, scale: 1 } };
    }
    const { data } = await send("Page.captureScreenshot", params);
    writeFileSync(shot, Buffer.from(data, "base64"));
    console.error("wrote", shot);
  }
} finally {
  try { if (sock) sock.close(); } catch {}
  chrome.kill();
  /* wait for it to actually exit: kill() only sends the signal, and a Chrome still shutting down
     writes its profile back over a directory we have already deleted */
  await new Promise((r) => { chrome.once("exit", r); setTimeout(r, 3000); });
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}
