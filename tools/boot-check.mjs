/* Open the shop in a real browser and see whether it opens.

   There is no build step here, so the only thing standing between a typo in a
   layer and a black page is somebody loading it. This does that: serves game/,
   starts a run, walks past the opening cards, and fails on any error the page
   raised on the way. It also asserts the things a silent regression would take
   away first, which is how the layers have broken before: a cue that reaches
   for a context nobody handed it plays nothing, and nothing says so.

   Needs Chromium via Playwright. CI installs it; locally:
     npm install --no-save playwright && npx playwright install chromium */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = "game";
const PORT = Number(process.env.BOOT_PORT || 8899);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("boot-check needs Playwright:");
  console.error("  npm install --no-save playwright && npx playwright install chromium");
  process.exit(1);
}

const server = createServer(async (req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const path = join(ROOT, rel === "/" ? "index.html" : rel);
  try {
    const body = await readFile(path);
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const fatal = [];
const browser = await chromium.launch({
  executablePath: process.env.FINS_BROWSER_PATH || undefined,
  args: [
    "--autoplay-policy=no-user-gesture-required",
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    "--mute-audio",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

page.on("pageerror", (e) => fatal.push(`uncaught: ${e.message}`));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  /* A font or an image that did not arrive is the sandbox's network, not the
     game's code. Anything the page itself threw is ours. */
  if (/Failed to load resource|net::ERR_/.test(t)) return;
  fatal.push(`console: ${t}`);
});

/* Count the nodes the game builds, so "a cue played nothing" is visible. */
await page.addInitScript(() => {
  window.__nodes = 0;
  const Native = window.AudioContext || window.webkitAudioContext;
  if (!Native) return;
  const Wrapped = function (...a) {
    const c = new Native(...a);
    const osc = c.createOscillator.bind(c);
    const buf = c.createBufferSource.bind(c);
    c.createOscillator = () => (window.__nodes++, osc());
    c.createBufferSource = () => (window.__nodes++, buf());
    return c;
  };
  Wrapped.prototype = Native.prototype;
  window.AudioContext = Wrapped;
  window.webkitAudioContext = Wrapped;
});

const step = async (label, fn) => {
  try {
    await fn();
  } catch (e) {
    fatal.push(`${label}: ${e.message.split("\n")[0]}`);
  }
};

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(3000);

const title = await page.evaluate(() => ({
  titling: document.body.classList.contains("titling"),
  hasTitle: !!document.getElementById("title"),
}));
if (!title.hasTitle) fatal.push("no title screen rendered");

await step("new game", () => page.click("#ttNew", { timeout: 10000 }));
await page.waitForTimeout(1000);
await step("open the shop", () => page.click("text=Open the shop", { timeout: 15000 }));
await page.waitForTimeout(1500);
const skip = page.locator("button", { hasText: /^Skip the story$/ });
if (await skip.count()) await step("skip the story", () => skip.first().click({ timeout: 10000 }));
await page.waitForTimeout(6000);

const state = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {
    titling: document.body.classList.contains("titling"),
    scene: document.body.getAttribute("data-scene"),
    globals: {},
    canvases: [...document.querySelectorAll("canvas")].map((c) => c.id),
    cues: (window.feel && window.feel.list && window.feel.list().length) || 0,
  };
  for (const n of ["feel", "finsAudio", "sceneNow", "gameState", "sfx", "folkStep"]) {
    out.globals[n] = typeof window[n];
  }
  /* The regression this guards: a synthesised cue that produces no audio at
     all, because the layer had no context to build it on.

     Measured with no wait in between. The nodes go up synchronously inside the
     cue, and the engine's own ambience fires every 420 ms, so anything slept
     through here counts the room's noise as the cue's and the check passes on
     a layer that played nothing. */
  out.cueNodes = 0;
  for (const name of ["gravel", "wood", "foot", "cash", "register"]) {
    const before = window.__nodes;
    try {
      window.feel.play(name);
    } catch (e) {
      out.cueThrew = `${name}: ${e.message}`;
      break;
    }
    out.cueNodes += window.__nodes - before;
    await wait(140);
  }
  out.totalNodes = window.__nodes;
  return out;
});

if (state.titling) fatal.push("still on the title screen after starting a run");
if (state.globals.feel !== "object") fatal.push("window.feel is missing");
if (state.globals.finsAudio !== "object") fatal.push("window.finsAudio is missing");
if (state.globals.gameState !== "object") fatal.push("window.gameState is missing");
if (state.globals.folkStep !== "function") fatal.push("window.folkStep is missing");
if (state.cues < 100) fatal.push(`only ${state.cues} named cues; expected the full catalog`);
if (!state.canvases.includes("tank")) fatal.push("the tank canvas is not there");
if (!state.canvases.includes("feelfx")) fatal.push("the effects overlay is not there");
if (state.cueThrew) fatal.push(`playing a cue threw: ${state.cueThrew}`);
if (state.totalNodes > 0 && state.cueNodes === 0) {
  fatal.push("the game is making sound but a synthesised cue made none: the layer has no audio context");
}

/* Written whether or not the checks passed: on a failure it is the only view
   of what the shop actually looked like. */
const shotAt = process.argv.indexOf("--shot");
if (shotAt !== -1 && process.argv[shotAt + 1]) {
  try {
    await page.screenshot({ path: process.argv[shotAt + 1] });
  } catch (e) {
    console.error(`  (could not write the screenshot: ${e.message})`);
  }
}

await browser.close();
server.close();

if (fatal.length) {
  console.error("Boot: the shop did not open clean.");
  for (const f of fatal) console.error(`  ${f}`);
  process.exit(1);
}
console.log(
  `Boot: opened, ran, scene "${state.scene}", ${state.cues} cues, ` +
    `${state.canvases.length} canvases, ${state.totalNodes} audio nodes built. No page errors.`
);
