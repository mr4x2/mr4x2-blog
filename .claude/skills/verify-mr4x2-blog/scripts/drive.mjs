#!/usr/bin/env node
// Drive one page of a running verify instance in headless Chromium over CDP, with no npm dependencies.
// usage: drive.mjs --run RUN_ID --name JOURNEY [--no-js] [--width 1280] [--height 900] STEPS.json|-
// Writes .verify/runs/RUN_ID/JOURNEY/{NN-label.png, NN-label.html, results.json, console.log}.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? (args.splice(i, 1), true) : false; };
const run = opt("--run"), name = opt("--name"), noJs = flag("--no-js");
const width = +opt("--width", 1280), height = +opt("--height", 900);
const stepsArg = args[0];
if (!run || !name || !stepsArg) { console.error("usage: drive.mjs --run RUN_ID --name JOURNEY [--no-js] STEPS.json|-"); process.exit(2); }

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const runDir = join(repo, ".verify/runs", run);
const env = Object.fromEntries(readFileSync(join(runDir, "instance.env"), "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const out = join(runDir, name);
mkdirSync(out, { recursive: true });
const steps = JSON.parse(stepsArg === "-" ? readFileSync(0, "utf8") : readFileSync(stepsArg, "utf8"));

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = join(homedir(), ".cache/ms-playwright");
  const dirs = existsSync(base) ? readdirSync(base).filter((d) => d.startsWith("chromium-")).sort().reverse() : [];
  for (const d of dirs) { const p = join(base, d, "chrome-linux/chrome"); if (existsSync(p)) return p; }
  throw new Error("no Chromium found; set CHROME=/path/to/chrome");
}

// The real window must match the emulated viewport, or captures tile the smaller default surface.
const chrome = spawn(findChrome(), ["--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", `--window-size=${width},${height}`, "--remote-debugging-port=0",
  `--user-data-dir=${join(runDir, "chrome-profile")}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((ok, fail) => {
  let buf = "";
  chrome.stderr.on("data", (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) ok(m[1]); });
  chrome.on("exit", (c) => fail(new Error(`chrome exited ${c}: ${buf.slice(-500)}`)));
  setTimeout(() => fail(new Error("chrome did not start")), 20000);
});

const ws = new WebSocket(wsUrl);
await new Promise((ok) => ws.addEventListener("open", ok, { once: true }));
let seq = 0; const pending = new Map(); const listeners = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.fail(new Error(m.error.message)) : p.ok(m.result); }
  else listeners.forEach((f) => f(m));
});
let session;
const send = (method, params = {}) => new Promise((ok, fail) => {
  const id = ++seq;
  const timer = setTimeout(() => { pending.delete(id); fail(new Error(`CDP ${method} timed out after 30s`)); }, 30000);
  pending.set(id, { ok: (v) => { clearTimeout(timer); ok(v); }, fail: (e) => { clearTimeout(timer); fail(e); } });
  ws.send(JSON.stringify({ id, method, params, sessionId: session }));
});
const once = (methods, ms) => new Promise((ok) => { const f = (m) => { if (methods.includes(m.method)) { listeners.splice(listeners.indexOf(f), 1); ok(m.method); } }; listeners.push(f); setTimeout(() => ok("timeout"), ms); });

const consoleLines = [], pageErrors = [];
listeners.push((m) => {
  if (m.method === "Runtime.consoleAPICalled") consoleLines.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`);
  if (m.method === "Runtime.exceptionThrown") { const d = m.params.exceptionDetails; pageErrors.push(d.exception?.description || d.text); }
});

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
({ sessionId: session } = await send("Target.attachToTarget", { targetId, flatten: true }));
await send("Page.enable"); await send("Runtime.enable");
// Size the real window so its inner area equals the emulated viewport; a smaller real surface makes captures tile.
{
  const probe = async () => (await send("Runtime.evaluate", { expression: "[innerWidth, innerHeight]", returnByValue: true })).result.value;
  const { windowId } = await send("Browser.getWindowForTarget", { targetId });
  for (let i = 0; i < 3; i++) {
    const [iw, ih] = await probe();
    if (iw === width && ih === height) break;
    const { bounds } = await send("Browser.getWindowBounds", { windowId });
    await send("Browser.setWindowBounds", { windowId, bounds: { width: bounds.width + (width - iw), height: bounds.height + (height - ih) } });
  }
}
await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
if (noJs) await send("Emulation.setScriptExecutionDisabled", { value: true });

// In-page helpers, evaluated in an isolated world so they work with page JS disabled.
const { executionContextId: ctx } = await (async () => {
  const tree = await send("Page.getFrameTree");
  return send("Page.createIsolatedWorld", { frameId: tree.frameTree.frame.id, worldName: "drive" });
})();
const HELPERS = `
  const ROLES = { button: 'button,[role=button]', link: 'a[href],[role=link]', searchbox: 'input[type=search],[role=searchbox]',
    heading: 'h1,h2,h3,h4,h5,h6,[role=heading]', status: '[role=status],output', group: '[role=group],fieldset', listitem: 'li,[role=listitem]' };
  const visible = (el) => !!el && !el.closest('[hidden]') && el.getClientRects().length > 0;
  const nameOf = (el) => (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent) || el.textContent || '').replace(/\\s+/g, ' ').trim();
  const $ = (t) => typeof t === 'string' ? document.querySelector(t)
    : [...document.querySelectorAll(ROLES[t.role] || t.role)].find((el) => (t.name === undefined || nameOf(el) === t.name) && (t.hidden || visible(el)));
  const $$ = (t) => typeof t === 'string' ? [...document.querySelectorAll(t)] : [...document.querySelectorAll(ROLES[t.role] || t.role)].filter((el) => (t.name === undefined || nameOf(el) === t.name) && (t.hidden || visible(el)));
`;
let worldCtx = ctx;
async function refreshWorld() {
  const tree = await send("Page.getFrameTree");
  worldCtx = (await send("Page.createIsolatedWorld", { frameId: tree.frameTree.frame.id, worldName: "drive" })).executionContextId;
}
// A click that navigates destroys the isolated world; re-create it on the new document and retry.
const STALE = /Cannot find context|Execution context was destroyed|Inspected target navigated/;
async function evaluate(expr, tries = 20) {
  try {
    const r = await send("Runtime.evaluate", { expression: `(() => { ${HELPERS} return (${expr}); })()`, contextId: worldCtx, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  } catch (e) {
    if (!STALE.test(String(e.message)) || tries <= 0) throw e;
    await new Promise((r) => setTimeout(r, 150));
    await refreshWorld();
    return evaluate(expr, tries - 1);
  }
}
const T = (t) => JSON.stringify(t);
const FULL_MAX = 4000;
const results = []; let n = 0; let failed = false;
const label = (s, d) => String(s.label || d).replace(/[^a-z0-9-]+/gi, "-").slice(0, 40);

for (const s of steps) {
  n++;
  const rec = { n, step: s };
  try {
    if (s.goto !== undefined) {
      const ev = once(["Page.loadEventFired", "Page.navigatedWithinDocument"], 15000);
      await send("Page.navigate", { url: new URL(s.goto, env.URL).href });
      rec.result = await ev; await refreshWorld();
    } else if (s.click !== undefined) {
      rec.result = await evaluate(`(() => { const el = $(${T(s.click)}); if (!el) throw new Error('not found: ' + ${T(T(s.click))}); el.click(); return nameOf(el); })()`);
    } else if (s.fill !== undefined) {
      rec.result = await evaluate(`(() => { const el = $(${T(s.fill)}); if (!el) throw new Error('not found: ' + ${T(T(s.fill))}); el.focus(); el.value = ${T(s.value)}; el.dispatchEvent(new Event('input', { bubbles: true })); return el.value; })()`);
    } else if (s.scroll !== undefined) {
      rec.result = await evaluate(`(() => { const el = $(${T(s.scroll)}); if (!el) throw new Error('not found: ' + ${T(T(s.scroll))}); el.scrollIntoView({ block: 'center' }); return nameOf(el).slice(0, 60); })()`);
      await new Promise((r) => setTimeout(r, 300));
    } else if (s.wait !== undefined) {
      const until = Date.now() + (s.timeout || 5000); let v;
      while (!(v = await evaluate(s.wait)) && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
      rec.result = v; if (!v) throw new Error(`timed out waiting for: ${s.wait}`);
    } else if (s.expect !== undefined) {
      rec.result = await evaluate(s.expect);
      rec.pass = s.equals !== undefined ? JSON.stringify(rec.result) === JSON.stringify(s.equals) : !!rec.result;
      if (!rec.pass) failed = true;
    } else if (s.eval !== undefined) {
      rec.result = await evaluate(s.eval);
    } else if (s.shot !== undefined) {
      // Full page: capture beyond the viewport, capped, since a long post renders every lazy photo at once and stalls Chromium.
      let params = { format: "png" };
      if (s.viewport !== true) {
        const contentH = Math.ceil((await send("Page.getLayoutMetrics")).cssContentSize.height);
        if (contentH > FULL_MAX) rec.truncatedAt = FULL_MAX;
        params = { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: Math.min(contentH, FULL_MAX), scale: 1 } };
      }
      const shot = await send("Page.captureScreenshot", params);
      const f = join(out, `${String(n).padStart(2, "0")}-${label(s, s.shot)}.png`); writeFileSync(f, Buffer.from(shot.data, "base64")); rec.result = f;
    } else if (s.dom !== undefined) {
      const f = join(out, `${String(n).padStart(2, "0")}-${label(s, s.dom)}.html`); writeFileSync(f, await evaluate("document.documentElement.outerHTML")); rec.result = f;
    } else throw new Error("unknown step");
  } catch (e) { rec.error = String(e.message || e); failed = true; }
  results.push(rec);
  const mark = rec.error ? "ERR " : rec.pass === false ? "FAIL" : rec.pass ? "PASS" : "ok  ";
  const shown = rec.error ? "— " + rec.error : rec.pass !== undefined || s.eval !== undefined ? "→ " + JSON.stringify(rec.result) : "";
  console.log(`${mark} ${String(n).padStart(2, "0")} ${s.label || Object.keys(s)[0]} ${shown}`);
}

if (pageErrors.length) failed = true;
writeFileSync(join(out, "results.json"), JSON.stringify({ run, name, url: env.URL, noJs, width, height, pageErrors, results }, null, 2));
writeFileSync(join(out, "console.log"), [...consoleLines, ...pageErrors.map((e) => "PAGE ERROR: " + e)].join("\n") + "\n");
if (pageErrors.length) console.log(`FAIL page errors: ${pageErrors.length} (see ${join(out, "console.log")})`);
console.log(`${failed ? "JOURNEY FAILED" : "JOURNEY PASSED"}: evidence in ${out}`);
ws.close(); chrome.kill();
process.exit(failed ? 1 : 0);
