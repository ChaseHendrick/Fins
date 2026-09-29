/* A draw hook cannot move a person away from their simulation position.
   Exercise the actual tech.js callback at different frame rates and with
   interleaved shop, map and preview canvases, without launching a browser. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { URL } from "node:url";

const source = await readFile(new URL("../src/layers/tech.js", import.meta.url), "utf8");
const anchor = '  wrap("folkDraw", function (orig, self, args) {';
const next = '  wrap("drawShopBackdrop",';
const start = source.indexOf(anchor);
assert(start >= 0 && source.indexOf(anchor, start + anchor.length) < 0,
  "folk check must locate exactly one production person-draw hook");
const end = source.indexOf(next, start);
assert(end > start, "folk check must locate the end of the production person-draw hook");
const hookSource = source.slice(start, end);

function exercise(hookText) {
  let calls = 0;
  for (const fps of [20, 60, 144]) {
    for (const reduced of [false, true]) {
      let now = 0, around = null;
      const runtime = {
        folkDrawn: 0, reduced,
        performance: { now: () => now },
        wrap(name, callback) {
          assert.equal(name, "folkDraw", "the extracted source must install the person hook");
          assert.equal(around, null, "the extracted source must install only one hook");
          around = callback;
        },
      };
      runInNewContext(hookText, runtime);
      assert.equal(typeof around, "function", "the production person hook must execute");
      const shop = { canvas: { id: "tank" } };
      const map = { canvas: { id: "swmap" } };
      const preview = { canvas: { id: "people-preview" } };
      const owner = { id: "renderer-owner" };

      function draw(canvas, x, y, id, moving) {
        const args = [canvas, x, y, 160, "#3b5b78", 0.4, false, 1, moving,
          { id, seed: 21 }];
        const expected = args.slice();
        const result = { accepted: true };
        const answer = around(function (...received) {
          assert.equal(this, owner, "the hook must preserve the renderer's receiver");
          assert.equal(received.length, expected.length, "the hook must preserve the draw signature");
          for (let i = 0; i < received.length; i++) {
            assert.equal(received[i], expected[i],
              `person draw argument ${i} changed at ${fps} Hz (reduced motion ${reduced})`);
          }
          calls++;
          return result;
        }, owner, args);
        assert.equal(answer, result, "the hook must preserve the renderer's return value");
      }

      for (let frame = 0; frame < 600; frame++) {
        now = 100 + frame * 1000 / fps;
        /* A tiny initial move used to start a self-collision oscillation.
           Nearby people and repeated ids exercise crowd and canvas isolation. */
        draw(shop, frame === 0 ? 300 : 300.3, 400, "fin:keeper", false);
        draw(shop, 340, 400, "customer:nearby", false);
        draw(map, 300.3, 400, "fin:keeper", true);
        draw(preview, 300.3, 400, "fin:keeper", false);
        draw(shop, 300.3 + Math.sin(frame / 30) * 20, 400, "customer:walking", true);
      }
    }
  }
  return calls;
}

const calls = exercise(hookSource);
/* Prove the guard rejects a position-changing draw hook. The production file
   is left untouched; the mutation exists only in this isolated VM. */
const mutated = hookSource.replace(anchor, anchor + "\n    args[1] += 1;");
assert.notEqual(mutated, hookSource, "the planted coordinate mutation must reach the extracted hook");
assert.throws(() => exercise(mutated), /person draw argument 1 changed/,
  "the guard must reject a hook that moves a person's drawn position");
console.log(`Folk: ${calls.toLocaleString("en-US")} production-hook draws preserve coordinates, arguments and return values at 20/60/144 Hz, across shop/map/preview canvases and reduced motion. Planted displacement rejected.`);
