#!/usr/bin/env node
// Headless-Chrome harness for measuring the local build of the Rivnay Group site.
//   node scripts/shot.mjs <url> [--width 1440] [--height 900] [--mobile] [--touch] [--dark] [--reduce]
//                         [--scroll N] [--click "css"] [--wait ms] [--eval "js"] [--full] [--shot out.png]
// --eval runs the body of an async function after load + fonts.ready and prints the return value as JSON.
// --full scrolls the whole page first (the scroll reveal is one-shot and would otherwise capture blank),
// then captures everything; without it the capture is the viewport as a visitor sees it.
// Chrome's plain --screenshot ignores widths under ~500px, which is why this exists.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const url = argv[0];
const opt = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const has = (k) => argv.includes(k);
const width = +opt("--width", 1440), height = +opt("--height", 900);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dir = mkdtempSync(join(tmpdir(), "shot-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${dir}`, "--remote-debugging-port=0", `--window-size=${width},${height}`, "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
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
if (!ws) { chrome.kill(); throw new Error("Chrome did not start"); }

const sock = new WebSocket(ws);
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

await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: has("--mobile") });
if (has("--touch")) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
const features = [];
if (has("--dark")) features.push({ name: "prefers-color-scheme", value: "dark" });
if (has("--reduce")) features.push({ name: "prefers-reduced-motion", value: "reduce" });
if (features.length) await send("Emulation.setEmulatedMedia", { features });
await send("Page.navigate", { url });
await new Promise((r) => { const t = setInterval(() => { if (events.some((e) => e.method === "Page.loadEventFired")) { clearInterval(t); r(); } }, 50); });
await evaluate("document.fonts ? document.fonts.ready.then(() => true) : true");
await sleep(400);

const scroll = opt("--scroll", null);
if (scroll !== null) { await scrollTo(+scroll); await sleep(500); }
const click = opt("--click", null);
if (click) { await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(click)}); if (!e) throw new Error("no match for " + ${JSON.stringify(click)}); e.click(); return true; })()`); await sleep(500); }
const wait = +opt("--wait", 0); if (wait) await sleep(wait);

const code = opt("--eval", null);
if (code) { const v = await evaluate(`(async () => { ${code} })()`); console.log(JSON.stringify(v, null, 1)); }

const shot = opt("--shot", null);
if (shot) {
  let params = { format: "png" };
  if (has("--full")) {
    const total = await evaluate("document.documentElement.scrollHeight");
    for (let y = 0; y < total; y += Math.floor(height * 0.5)) { await scrollTo(y); await sleep(200); }
    await evaluate("document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-visible', 'no-anim')); true");
    await scrollTo(scroll !== null ? +scroll : 0);
    await sleep(700);
    const h = await evaluate("Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))");
    params = { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: h, scale: 1 } };
  }
  const { data } = await send("Page.captureScreenshot", params);
  writeFileSync(shot, Buffer.from(data, "base64"));
  console.error("wrote", shot);
}
sock.close(); chrome.kill();
