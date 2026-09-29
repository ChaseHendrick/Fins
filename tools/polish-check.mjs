/* Real browser checks for the water, people and town presentation.
   Run from the repository root: node tools/polish-check.mjs --out /path/to/shots
   Uses an installed Chrome on macOS, or Playwright's Chromium elsewhere.
   FINS_BROWSER_PATH can point at another locally installed Chromium browser. */
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { chromium } from "playwright";
import { Buffer } from "node:buffer";
import { clearTimeout } from "node:timers";

const ROOT = resolve("game");
const at = process.argv.indexOf("--out");
const OUT = at >= 0 ? resolve(process.argv[at + 1]) : null;
if (OUT) await mkdir(OUT, { recursive: true });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent((req.url || "/").split("?")[0]);
  if (rel === "/favicon.ico" && !existsSync(join(ROOT, "favicon.ico"))) return res.writeHead(204).end();
  const path = resolve(ROOT, "." + (rel === "/" ? "/index.html" : rel));
  if (!path.startsWith(ROOT + sep)) return res.writeHead(403).end();
  try {
    const body = await readFile(path);
    res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const macChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath = process.env.FINS_BROWSER_PATH || (existsSync(macChrome) ? macChrome : undefined);
let browser;
const failures = [];
const report = { viewport: { width: 1440, height: 900 }, scenes: {}, errors: [], requests: [] };
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = "1";
const runDeadline = setTimeout(() => {
  console.error("Polish: browser verification exceeded its three minute deadline.");
  process.exit(1);
}, 180000);
function check(ok, message) { if (!ok) failures.push(message); }

try {
  browser = await chromium.launch({ executablePath, args: ["--autoplay-policy=no-user-gesture-required", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--mute-audio"] });
  const page = await browser.newPage({ viewport: report.viewport });
  // Exercise the actual fallback font layout and avoid external font waits.
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|net::ERR_/.test(m.text())) report.errors.push(m.text());
  });
  page.on("response", (r) => { if (r.url().startsWith(`http://127.0.0.1:${port}`) && r.status() >= 400) report.requests.push(r.url()); });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  report.loadedScripts = await page.evaluate(() => [...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")));
  await page.click("#ttNew");
  await page.click("text=Open the shop");
  await page.waitForTimeout(1000);
  const skip = page.locator("button", { hasText: /^Skip the story$/ });
  if (await skip.count()) await skip.first().click();
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const fn = window.paintTownMap;
    window.paintTownMap = function (...args) {
      window.__polishTownArgs = args;
      if (args[0]?.canvas?.id === "swmap") window.__polishPanelSelected = args[6];
      return fn.apply(this, args);
    };
  });
  const timings = async () => {
    await page.bringToFront();
    return page.evaluate(() => new Promise((done) => {
      const values = []; let last = window.performance.now(), ended = false;
      const finish = (reason) => {
        if (ended) return;
        ended = true; window.clearTimeout(deadline); values.sort((a, b) => a - b);
        done({ frames: values.length, p50: values[Math.floor(values.length * 0.5)] ?? null, p95: values[Math.floor(values.length * 0.95)] ?? null, max: values.at(-1) ?? null, reason, visibility: document.visibilityState });
      };
      const deadline = window.setTimeout(() => finish("deadline"), 8000);
      function frame(t) {
        if (ended) return;
        values.push(t - last); last = t;
        if (values.length < 30) window.requestAnimationFrame(frame); else finish("complete");
      }
      window.requestAnimationFrame(frame);
    }));
  };
  const shot = async (name) => {
    if (OUT) await page.screenshot({ path: join(OUT, name + ".png"), timeout: 60000 });
    console.log("Polish: captured " + name + ".");
  };
  for (const [name, scene] of [["tank", "tank"], ["shop", "shop"], ["map", "street"]]) {
    await page.evaluate((s) => window.__finsGo(s), scene);
    await page.waitForTimeout(500);
    check(await page.evaluate((s) => window.sceneNow() === s, scene), name + " navigation failed");
    if (scene === "tank") {
      report.currents = await page.evaluate(() => {
        const samples = [];
        for (const x of [0.15, 0.5, 0.85]) for (const y of [0.15, 0.5, 0.85]) {
          const out = { x: 0, y: 0 };
          window.currentAt(window.W * x, window.waterTop + (window.floorY - window.waterTop) * y, out);
          samples.push(out);
        }
        return samples;
      });
      check(report.currents.every((v) => Number.isFinite(v.x) && Number.isFinite(v.y)), "native current sampler returned nonfinite velocities");
      check(report.currents.some((v) => Math.abs(v.x) + Math.abs(v.y) > 0.00001), "native current sampler returned only zero velocities");
      const before = await page.evaluate(() => window.G.stats.fed);
      const feedingPoint = await page.evaluate(() => ({ x: window.G.fish[0].x, y: window.waterTop + 24 }));
      await page.mouse.click(feedingPoint.x, feedingPoint.y);
      await page.mouse.click(feedingPoint.x + 24, feedingPoint.y + 8);
      await page.waitForTimeout(800);
      report.feeding = await page.evaluate(() => ({ fed: window.G.stats.fed, water: window.finsWater.stats(), finite: window.G.fish.every((f) => [f.x, f.y, f.vx, f.vy].every(Number.isFinite)) && window.food.every((f) => [f.x, f.y, f.vy].every(Number.isFinite)) }));
      check(report.feeding.fed > before && report.feeding.water.fed > 0, "feeding did not couple to the water layer");
      check(report.feeding.water.coupled > 0 && report.feeding.finite, "fish and food coupling returned invalid positions");
      report.tankSwitch = await page.evaluate(() => {
        const old = { backroom: window.G.tech.backroom, extra: window.G.up.extra, count: window.G.fish.length };
        window.G.tech.backroom = 1; window.G.up.extra = 1;
        window.switchView(1); const empty = window.G.view === 1 && window.G.fish.length === 0;
        window.switchView(0);
        if (old.backroom === undefined) delete window.G.tech.backroom; else window.G.tech.backroom = old.backroom;
        window.G.up.extra = old.extra;
        return { empty, returned: window.G.view === 0 && window.G.fish.length === old.count };
      });
      check(report.tankSwitch.empty && report.tankSwitch.returned, "switching through an empty back tank lost fish or failed");
    }
    if (scene === "shop") {
      report.shopGeometry = await page.evaluate(() => window.__shopWall.map((wall, i) => {
        const p = window.shopPlayTank(i, window.W, window.__shopTanks?.[0]?.top || 88, window.H);
        const center = { x: (p.q[0] + p.q[2] + p.q[4] + p.q[6]) / 4, y: (p.q[1] + p.q[3] + p.q[5] + p.q[7]) / 4 };
        return { id: wall.id, key: p.key, q: p.q, center, finite: p.q.every(Number.isFinite), doorClear: Math.max(p.q[0], p.q[2], p.q[4], p.q[6]) < window.W * 0.86 };
      }));
      check(report.shopGeometry.length === 8 && report.shopGeometry.every((p) => p.finite && p.doorClear), "shop projected tanks were invalid or covered the door");
      await page.evaluate(() => {
        window.__polishKeeperSamples = [];
        const original = window.folkDraw;
        window.__polishRestoreFolk = () => { window.folkDraw = original; };
        window.folkDraw = function (...args) {
          const ctx = args[0], look = args[9];
          if (!String(look?.id || "").startsWith("fin:")) return original.apply(this, args);
          const sample = { time: window.performance.now(), canvas: ctx.canvas?.id, id: look.id, x: args[1], y: args[2], size: args[3], moving: args[8], walk: args[5], anchor: null };
          const translate = ctx.translate;
          ctx.translate = function (x, y) {
            if (!sample.anchor) sample.anchor = { x, y };
            return translate.call(this, x, y);
          };
          try { return original.apply(this, args); }
          finally { ctx.translate = translate; if (window.__polishKeeperSamples.length < 5000) window.__polishKeeperSamples.push(sample); }
        };
      });
      await page.waitForTimeout(8000);
      const keeper = await page.evaluate(() => { window.__polishRestoreFolk(); return window.__polishKeeperSamples; });
      const seen = keeper.filter((s) => s.canvas === "tank" && s.anchor);
      const settled = seen.filter((s) => s.time - seen[0].time > 1000);
      const residuals = settled.map((s) => ({ x: s.anchor.x - s.x, y: s.anchor.y - s.y }));
      const maxOffset = Math.max(0, ...residuals.map((p) => Math.hypot(p.x, p.y)));
      const maxJump = Math.max(0, ...residuals.slice(1).map((p, i) => Math.hypot(p.x - residuals[i].x, p.y - residuals[i].y)));
      report.keeperMotion = { samples: seen.length, seconds: seen.length > 1 ? (seen.at(-1).time - seen[0].time) / 1000 : 0, maxOffset, maxResidualJump: maxJump, trace: keeper };
      check(seen.length >= 15 && settled.every((s) => [s.x, s.y, s.anchor.x, s.anchor.y].every(Number.isFinite)), "keeper motion did not produce enough finite live frames");
      check(maxOffset < 12 && maxJump < 12, "keeper painted position oscillated away from its scene position");
    }
    await shot(name);
    report.scenes[name] = { timing: await timings(), water: await page.evaluate(() => window.finsWater?.stats()), tech: await page.evaluate(() => window.__techTest?.()) };
    check(report.scenes[name].timing.frames >= 15, name + " did not produce enough live animation frames");
    check(!report.scenes[name].tech?.err, name + " technology overlay failed: " + report.scenes[name].tech?.err);
  }
  const back = await page.evaluate(() => {
    const hit = window.sceneHits.find((h) => /back|inside|door/i.test(h.tip || h.id));
    return hit ? { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 } : null;
  });
  check(!!back, "Map's Back inside control was not clickable");
  if (back) await page.mouse.click(back.x, back.y);
  check(await page.evaluate(() => window.sceneNow() === "shop"), "Map's Back inside control did not return to Shop");

  // Use the same town panel and click forwarding that players use.
  await page.evaluate(() => { window.openTab("atlas"); window.atlSetView("map"); });
  await page.waitForTimeout(700);
  // The live drawer replaces its canvas on updates. Paint, scroll and sample
  // the same current node in one evaluation, then allow a replacement to retry.
  let pick = null;
  for (let attempt = 0; attempt < 5 && !pick; attempt++) {
    pick = await page.evaluate(() => {
      const canvas = document.getElementById("swmap");
      if (!canvas) return null;
      window.swDrawMap(canvas);
      canvas.scrollIntoView({ block: "center", inline: "nearest" });
      const r = canvas.getBoundingClientRect();
      for (let y = 10; y < canvas.height - 10; y += 5) for (let x = 10; x < canvas.width - 10; x += 5) {
        const index = window.townPickAt(canvas, x, y);
        if (index < 0) continue;
        // The first grid hit lies on the circle's edge. Find that person's
        // hit-area interior so integer native pointer coordinates stay inside.
        const points = [];
        for (let yy = Math.max(0, y - 18); yy <= Math.min(canvas.height, y + 18); yy++) {
          for (let xx = Math.max(0, x - 18); xx <= Math.min(canvas.width, x + 18); xx++) {
            if (window.townPickAt(canvas, xx, yy) === index) points.push({ x: xx, y: yy });
          }
        }
        if (!points.length) continue;
        const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        const clientX = Math.round(r.left + cx / canvas.width * r.width);
        const clientY = Math.round(r.top + cy / canvas.height * r.height);
        const nativeX = (clientX - r.left) / r.width * canvas.width;
        const nativeY = (clientY - r.top) / r.height * canvas.height;
        if (document.elementFromPoint(clientX, clientY) === canvas &&
            [[0, 0], [-3, 0], [3, 0], [0, -3], [0, 3]].every(([dx, dy]) => window.townPickAt(canvas, nativeX + dx, nativeY + dy) === index)) {
          return { index, x: clientX, y: clientY, canvasX: nativeX, canvasY: nativeY };
        }
      }
      return null;
    });
    if (!pick) await page.waitForTimeout(150);
  }
  check(!!pick, "town panel did not expose a clickable visible person");
  if (pick) {
    await page.mouse.click(pick.x, pick.y); await page.waitForTimeout(500);
    report.townPick = { ...pick, ...await page.evaluate(() => ({ selected: window.__polishPanelSelected, screen: window.townScreen })) };
    check(report.townPick.selected === pick.index, "clicking a rendered town person selected a different record");
    check(report.townPick.screen?.width > 0 && report.townPick.screen?.height > 0, "main Map viewport was not exposed to the window layer");
    await shot("town-person");
  }
  await page.evaluate(() => window.openTab("atlas"));

  // Render every actual sheet through the production renderer for visual review.
  const sprites = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 1100; canvas.height = 450;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#182430"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const types = [
      ["fin", { id: "fin:polish" }], ["staff", { id: "staff:polish" }],
      ["woman_coat", { fem: true, lapels: true, seed: 2 }], ["woman_casual", { fem: true, seed: 3 }],
      ["woman_dress", { fem: true, seed: 5 }], ["man_coat", { lapels: true, seed: 1 }],
      ["man_casual", { seed: 3 }], ["man_suit", { kit: "suit", seed: 3 }],
      ["man_work", { kit: "work", seed: 3 }], ["elder", { kit: "elder", seed: 3 }], ["kid", { kit: "kid", seed: 3 }]
    ];
    const results = [];
    for (let i = 0; i < types.length; i++) {
      const [name, look] = types[i]; const x = 50 + i * 100;
      ctx.fillStyle = "#f2dfb6"; ctx.font = "12px system-ui"; ctx.textAlign = "center"; ctx.fillText(name, x, 30);
      const idleLook = { ...look, id: look.id ? look.id + ":idle" : name + ":idle" };
      const movingLook = { ...look, id: look.id ? look.id + ":moving" : name + ":moving" };
      const idle = window.folkDraw(ctx, x, 210, 145, "#5893a1", 0, true, 1, false, idleLook);
      const moving = window.folkDraw(ctx, x, 420, 145, "#5893a1", 0.45, true, 1, true, movingLook);
      results.push({ name, idle, moving });
    }
    return { png: canvas.toDataURL("image/png"), results };
  });
  for (const sprite of sprites.results) check(sprite.idle && sprite.moving, sprite.name + " sprite did not render");
  if (OUT) await writeFile(join(OUT, "people.png"), Buffer.from(sprites.png.split(",")[1], "base64"));
  report.sprites = sprites.results;

  await page.evaluate(() => window.toggleWork()); await page.waitForTimeout(300); await shot("work-light");
  check(await page.evaluate(() => document.body.classList.contains("work")), "Work mode did not open");
  await page.evaluate(() => window.toggleWorkDark()); await page.waitForTimeout(300); await shot("work-dark");
  check(await page.evaluate(() => document.body.classList.contains("workdark")), "Work dark theme did not open");
  await page.evaluate(() => { window.toggleWorkDark(); window.toggleWork(); });

  await page.setViewportSize({ width: 760, height: 820 });
  await page.evaluate(() => window.__finsGo("street"));
  await page.waitForTimeout(700);
  await shot("map-narrow");
  report.narrow = await page.evaluate(() => ({ width: window.W, height: window.H, scene: window.sceneNow(), mapCaptured: !!window.__polishTownArgs }));
  check(report.narrow.mapCaptured && report.narrow.scene === "street", "narrow Map did not draw");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => { window.G.reduceMotion = true; window.__finsGo("tank"); });
  await page.waitForTimeout(500);
  await shot("tank-reduced");
  report.reduced = await page.evaluate(() => ({ media: window.matchMedia("(prefers-reduced-motion: reduce)").matches, water: window.finsWater?.stats(), tech: window.__techTest?.() }));
  check(report.reduced.media, "reduced-motion preference was not active");

  const saved = await page.evaluate(() => { window.G.name = "Polish check"; window.save(); return { name: window.G.name, fish: window.G.fish.length }; });
  await page.reload({ waitUntil: "load" });
  await page.click("#ttContinue");
  const welcome = page.locator("#wok");
  if (await welcome.isVisible()) await welcome.click();
  await page.waitForTimeout(700);
  report.reload = await page.evaluate(() => ({ name: window.G.name, fish: window.G.fish.length, water: !!window.finsWater, tech: window.__techTest?.() }));
  check(report.reload.name === saved.name && report.reload.fish === saved.fish && report.reload.water, "save/reload lost the shop, fish or water layer");
  check(report.errors.length === 0, report.errors.join("; "));
  check(report.requests.length === 0, "local assets failed to load: " + report.requests.join(", "));
  report.failures = failures;
  if (OUT) await writeFile(join(OUT, "report.json"), JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
  clearTimeout(runDeadline);
}
if (failures.length) { for (const f of failures) console.error("Polish: " + f); process.exit(1); }
console.log("Polish: Tank, Shop, Map, return control, 11 person sheets, narrow viewport, reduced motion and local assets passed. No page errors.");
console.log(JSON.stringify({ scenes: report.scenes, narrow: report.narrow, reduced: report.reduced }, null, 2));
