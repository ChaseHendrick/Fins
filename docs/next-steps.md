# Next steps

## September 29 update

The water and neighborhood pass is described in [polish.md](polish.md). Shop items
1 through 4 below are resolved: explicit sprite grids, complete keeper and staff
art, stable single-person frames, and overlays fitted to the v5 painted glass.
The keeper's drawing layer no longer pushes against its own previous frame, which
caused visible back-and-forth sliding. The duplicate map caption is removed. The street window overlay now releases its
full-size buffers when inactive. Bloom is lighter, but the broader consolidation
of room overlays in items 6 and 8 remains open. People scale and the old shop door
hit areas in items 5 and 7 still need a separate pass.

The README and docs now contain captures of the current rooms. GitHub Pages is
live at [the current account address](https://chasehendrick.github.io/Fins/);
the older SharpMeow Pages link returned 404 and has been updated.

The neighborhood uses the existing map and coordinates with clearer symbols, routes,
labels and night lighting. A new OSM vector map has not been imported; the network
restriction described below still applies to that proposal.

## Earlier findings

Written at the end of the September 2026 improvement pass (PRs #31 and #32). Each item says what
was found, how it was checked, and where to start. Items marked "measured" were reproduced in
Playwright Chromium; items marked "not yet verified in game" come from reading files and need a
check in the running game before they are fixed.

## Setup the repo owner has to do

- **Turn on GitHub Pages.** Settings, Pages, Source: "GitHub Actions". The workflow
  (`.github/workflows/pages.yml`) is in place and deploys `game/` on every push to `main`.
- **Allow OpenStreetMap for the vector map.** The cloud environment's network policy blocked
  `overpass-api.de` and `openstreetmap.org`, so the vector North End map (below) could not be
  started. Add those domains to the environment's allowlist, or build the map locally.

## Shop scene (task in progress when the pass ended)

1. **Keeper and staff are drawn as four small copies.** `inferGrid` in `src/layers/folk.js`
   treats any square sheet as one frame. `game/folk/fin.png` and `game/folk/staff.png` are
   1408x1408 with four poses in a 2x2 grid, so each person is drawn as four half-size figures.
   Fix: give these two keys an explicit `{ cols: 2, rows: 2 }`. Measured.
2. **The keeper's and staff's clothes were keyed out of the art.** Since commit 3c3eed9 the
   figures stand on a black background, and the keying removed the near-black trousers and shirt
   with it: the legs are missing and the shoes float.
   - `fin.png`: the colour data under the cleared alpha is still there (shirt and trousers at
     RGB about 9 to 40). Re-key against pure black (background is exactly 0,0,0) with a low
     threshold, keep what connects to the figure, fill holes. `tools/spritekey.py` has the
     pieces.
   - `staff.png`: the colour under the cleared alpha is zeroed, so the legs and hair cannot be
     recovered from this file. Re-export from the source painting on a non-black background, or
     fall back to the complete (photographic) sheet from commit de9df10 until then.
3. **Customer sheets may have the same four-figures-per-frame problem.** Not yet verified in
   game. Measured from the files: `man_casual` and `man_coat` (2048x256) hold 16 columns by 2
   rows of 128 px figures, but `inferGrid` reads 8x1. `kid`, `man_suit`, `man_work`,
   `woman_dress` (512x256) hold 4x2 but read as 2x1. `elder` (1024x512) holds 4x2 but reads as
   2x1. `woman_casual` and `woman_coat` (8x1) look right. The old `inferGrid` before commit
   b74b12e read 512x256 sheets as 4x2. Check a screenshot of a customer, then replace the
   aspect-ratio guess with an explicit grid per key.
4. **Tank cards float off the painted tanks.** The `SHOP_WALL` quads in `src/layers/world.js`
   were fitted to the old v4 shop photo; commit 3c3eed9 swapped in `shop-interior.jpg?v=5`
   without refitting them (overlap with the painted glass 0 to 0.57 IoU). Suggested
   normalized quads (tl, tr, br, bl), read from a 25 px grid, about 5 to 10 px error:
   - left upper `[.1925,.1667, .3265,.2034, .3265,.3423, .1925,.3323]`
   - left lower `[.1925,.4018, .3265,.4067, .3265,.5506, .1925,.5456]`
   - back centre left `[.3348,.2758, .4743,.2758, .4743,.4167, .3348,.4167]`
   - back centre right `[.4743,.2758, .5999,.2758, .5999,.4167, .4743,.4167]`
   - back right `[.6166,.25, .8231,.25, .8231,.4315, .6166,.4315]` (split in two to keep 8 slots)
   - island `[.3376,.4762, .6362,.4762, .6362,.6647, .3376,.6647]` (split in two)

   Then set the inset to 0, stop drawing the plate inside the shop cards, and remove the fake
   slabs (world.js around lines 1000 to 1045) and tech.js's per-card floor glow.
5. **People are 2.5 to 2.9 times too small for the room.** Customers draw at `s * .52`. Calibrate
   to the painted door (about 440 px tall at y 730 at 1440x900) and the island (about 250 px at
   y 644), scaling by depth. fins.js still places speech bubbles and click boxes from the old
   size, so check those after.
6. **Ten full-screen overlay canvases use about 198 MiB at 2x.** The eight "veil" canvases redraw
   every 160 ms. Measured effect on the room: fine detail down 56 percent (mostly the techfx
   bloom), a milky haze in the top 58 percent (paneVeil), contrast down 21 percent (roomVeil).
   Plan: draw the small marks (relic, plates, cuts, ghost, cat, puddle, stains, rain) on one
   shared canvas that repaints only when something changes; turn night, rain, mood and siege
   into one colour grade; render the bloom at lower resolution as additive light
   (`mix-blend-mode: screen`); allocate feelfx only while an effect plays. Estimated 21 MiB.
7. **Click targets still assume the old photo.** The shop's click areas in fins.js (the window
   on the left, and the "door onto Salem" at x 0.82 and beyond) were placed for the v4 photo. In
   the v5 painting, the door on the right is the back-room door. The areas are defined in fins.js
   (private source), so move them there, or cover them from a layer once the tank cards are
   refitted.
8. **Three more full-screen overlays are never freed.** sillVeil (street scene), wonderVeil and
   siegeVeil (shop) are created when first needed, are the same full-screen size as the others
   (about 19.8 MiB each at 2x), and stay allocated after their effect ends. They add to the
   198 MiB in item 6 (about 257 MiB with all three). Fold them into the shared canvas from item 6,
   or release them when their effect ends.
9. **The italic story lines are faint.** The one-line story sentences (cutVeil, drawn by
   `src/layers/cut.js`) sit under the techfx bloom overlay, which blurs and greys them. Draw them
   above techfx, for example on the shared canvas from item 6 placed above it. They also fall back
   to a serif font when Google Fonts does not load; give them a sans-serif fallback stack.
10. **Done in this pass:** the room and window light now follow the engine clock (commit
   "Put the shop room and window light on the engine's clock").

## Graphics

- **Vector North End map from OSM.** Blocked on the network allowlist above.
- **Shade the vector decor, plants and gadgets.** Not started, but mapped: `docs/tank-draw-map.md`
  says how each item is drawn and how a layer can pick it out by its save, translate, scale
  bracket and position (tested with zero false matches). `src/layers/bed.js` shows the
  pattern: intercept the tank context's draw calls for one object and restyle its colours.
  Canvas `filter` is too slow (3.4x the frame time in software rendering); rewrite colours
  instead.
- **Sprite replacement layer.** `tools/key-sprite.py` cuts painted objects out of a flat
  background; `docs/real-dimensions.md` has sourced real sizes for the ids it lists (fins.js has 76 decor
  kinds, per the draw map; check the table covers them all).
  Still to do: a layer that draws a painted sprite in place of the vector object when one
  exists and falls back to vector drawing otherwise, and `docs/art-spec.md` (object list,
  sizes from the dimensions table, light from above, flat background).

## Bugs in fins.js (private source, fix there)

- The colour parser `TB` reads only hex, so hsl() colours come out wrong (the red rocks;
  `src/layers/bed.js` works around it).
- A 120 fps cap paints at 144 on a 144 Hz monitor (the cap rounds to whole monitor frames).
- The map draws the "Fin's" label twice.
- 517 of 1,107 species map by hash onto the same 9 fish paintings.

## Design questions, not bugs

- Most layers count a day as 2400 ticks of `gameState.t` (day counters in age.js, bent.js,
  guild.js and about 20 more; the hour clocks in desk.js, hook.js and going.js). The engine's
  own day is 1200 ticks. Each of those layers is consistent with itself, so "daily" layer events
  happen every second engine day. Changing it changes game pacing, so it was left alone.
- Electron: an "Unlimited" frame rate option (vsync off) could not be verified in this
  environment and was not shipped.

## Other repositories

- JustLetMeRead PR #3 and PageArm PR #23 (release ZIP workflows) are merged. Neither workflow
  runs until a `v*` tag is pushed.
- music-field-manual PR #3 (Dockerfile, compose.yaml, a CI job that builds and starts the image)
  is merged. Its CI job built and started the image on GitHub.
- **Secret in music-field-manual:** `src/lib/auth/preview.ts` line 21 holds a hardcoded OAuth
  client secret (`PREVIEW_CLIENT_SECRET`). The file calls it a low-privilege preview client.
  If the repo is public, rotate it and move it to an environment variable. The value was not
  copied anywhere.
