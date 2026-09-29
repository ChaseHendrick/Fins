/* Deterministic physics guards, run with node tools/water-check.mjs. This loads
   the same layer the browser runs, including its fish and food coupling. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { performance } from "node:perf_hooks";
import { URL } from "node:url";

const source = await readFile(new URL("../src/layers/water.js", import.meta.url), "utf8");
function harness() {
  const game = { t: 0, title: false, view: 0, fish: [] };
  const window = {
    G: game, W: 1280, H: 800, S: 1, waterTop: 120, floorY: 730,
    __scene: "tank", paused: false, food: [], clogged: false,
    fishRadius: () => 20,
    matchMedia: () => ({ matches: false }),
    currentAt: (x, y, out) => { out.x = 18; out.y = -4; return out; },
  };
  const document = { hidden: false };
  runInNewContext(source, { window, document });
  return { water: window.finsWater, window, document, game };
}

const { water } = harness();
const surface = water.createSurface(480, 64);
surface.kick(0.5, 1);
for (let i = 0; i < 30; i++) surface.advance(1 / 60);
assert(Math.abs(surface.sample(0.62)) > 0.01, "a local splash must propagate to neighboring water");
const disturbedEnergy = surface.energy();
for (let i = 0; i < 600; i++) surface.advance(1 / 60);
assert(surface.energy() < disturbedEnergy * 0.001, "unforced water must settle after a splash");

const rateSurfaces = [30, 60, 144].map((fps) => {
  const model = water.createSurface(480, 64);
  model.kick(0.33, 1.3);
  for (let i = 0; i < fps * 3; i++) model.advance(1 / fps);
  return model;
});
for (const model of rateSurfaces.slice(1)) {
  for (let i = 0; i < model.height.length; i++) {
    assert(Math.abs(model.height[i] - rateSurfaces[0].height[i]) < 1e-5,
      "surface physics must be independent of the painted frame rate");
  }
}
assert(surface.advance(86400) <= 12, "a wake from a sleeping tab must have bounded catch-up");
for (const hostile of [NaN, Infinity, -1, "abc", null, {}, 1e308]) {
  surface.kick(hostile, hostile);
  surface.advance(hostile);
}
assert([...surface.height, ...surface.velocity].every(Number.isFinite), "hostile input cannot poison surface state");

const flow = water.createFlow();
flow.add(300, 250, 20, -6, 32, 0);
const initial = flow.at(300, 250);
assert(initial.x > 0 && initial.y < 0, "a wake carries the direction of the impulse");
assert.equal(flow.at(900, 700).x, 0, "a local wake must not move distant water");
for (let i = 0; i < 120; i++) flow.advance(1 / 60);
assert(flow.at(300, 250).x < initial.x * 0.02, "wake energy must dissipate");
flow.clear();
flow.add(300, 250, 0, 0, 40, 15);
assert(flow.at(300, 270).x < 0 && flow.at(300, 230).x > 0,
  "a fin vortex must turn water in opposite directions across its center");
flow.clear();
flow.add(300, 250, 20, 0, 32, 0);
flow.advance(0.1, (x, y, out) => { out.x = 50; out.y = 0; });
assert(flow.at(302.25, 250).x > flow.at(300, 250).x, "wakes must travel with the tank's existing current");
for (let i = 0; i < 50000; i++) flow.add(i % 1200, 300, 10, 2, 20, 6);
assert.equal(flow.wakes.length, 48, "long sessions must reuse a fixed wake pool");
assert(flow.count() <= 48, "active wakes cannot exceed the pool budget");
for (const hostile of [NaN, Infinity, "abc", null, {}, 1e308]) {
  flow.add(hostile, 250, 0, 0, 20, 0);
  flow.advance(hostile);
  const sample = flow.at(hostile, hostile);
  assert(Number.isFinite(sample.x) && Number.isFinite(sample.y));
}

const runtime = harness();
const fish = { x: 400, y: 350, vx: 0, vy: 0 };
const food = { x: 400, y: 350, vy: 0, floor: false };
runtime.game.fish.push(fish);
runtime.window.food.push(food);
runtime.water.frame(1 / 60);
runtime.water.disturb(400, 350, 1);
runtime.game.t += 1 / 60;
runtime.water.frame(1 / 60);
assert(fish.vy > 0, "a feeding disturbance must actually affect a nearby fish's motion");
assert(food.vy > 0, "food must follow the same disturbed water as the fish");
assert.equal(runtime.water.stats().fed, 1, "a pellet must disturb the water once, even across frames");
const fishVelocity = fish.vy, foodVelocity = food.vy;
runtime.window.paused = true;
runtime.game.t += 1 / 60;
runtime.water.frame(1 / 60);
assert.equal(fish.vy, fishVelocity, "pausing must stop fish coupling");
assert.equal(food.vy, foodVelocity, "pausing must stop food coupling");
runtime.window.paused = false;
runtime.document.hidden = true;
runtime.game.t += 1 / 60;
runtime.water.frame(1 / 60);
assert.equal(fish.vy, fishVelocity, "a hidden tab must stop visual wake coupling");
runtime.document.hidden = false;
runtime.window.__scene = "shop";
runtime.game.t += 1 / 60;
runtime.water.frame(1 / 60);
assert.equal(fish.vy, fishVelocity, "a shop overlay must not move the active tank's fish");
assert.equal(runtime.water.disturb(400, 350, 1), false, "clicks outside the tank scene cannot disturb water");
runtime.window.__scene = "tank";
assert.equal(runtime.water.disturb(400, 20, 1), false, "HUD clicks above water cannot disturb it");
const surfaceLines = [];
const context = {
  save() {}, restore() {}, beginPath() {}, stroke() {},
  moveTo(x, y) { surfaceLines.push(y); },
  lineTo(x, y) { surfaceLines.push(y); },
};
runtime.water.paintSurface(context, [0, 0, 300, 120], 0, 0);
runtime.water.disturb(400, 350, 1);
for (let i = 0; i < 12; i++) {
  runtime.game.t += 1 / 60;
  runtime.water.frame(1 / 60);
}
runtime.window.matchMedia = () => ({ matches: true });
surfaceLines.length = 0;
runtime.water.paintSurface(context, [0, 0, 300, 120], 0, 0);
assert(surfaceLines.slice(0, 49).every((y) => y === surfaceLines[0]),
  "reduced motion must flatten animated shop waterlines");
runtime.window.matchMedia = () => ({ matches: false });

runtime.game.view = 1;
runtime.game.t += 1 / 60;
runtime.water.frame(1 / 60);
assert(runtime.water.stats().wakes < 3, "switching tanks cannot carry another tank's wakes across");

/* The hot loop has a constant memory budget. Time is reported as evidence,
   without a flaky CI threshold tied to the machine running the check. */
const benchmark = water.createFlow();
for (let i = 0; i < 48; i++) benchmark.add(i * 20, 200 + i * 3, 14, -3, 28, 4);
const scratch = { x: 0, y: 0 };
const start = performance.now();
for (let i = 0; i < 10000; i++) benchmark.at(i % 1280, 200 + (i % 400), scratch);
const milliseconds = performance.now() - start;
console.log(`Water: propagation, settling, 30/60/144 Hz parity, bounded catch-up, wake advection, fish/food coupling and pause/scene guards passed. 10,000 wake samples: ${milliseconds.toFixed(1)} ms; capacity 48.`);
