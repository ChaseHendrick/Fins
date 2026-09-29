# Water, room and neighborhood polish

September 29, 2026. The tank, the shop and the neighborhood now read more clearly as parts of
one living place. Water reacts to feeding and swimming, tank overlays fit the painted room,
and the map makes destinations and people easier to find.

These screenshots show the game in a local browser. The notes below describe the implementation
and the scope of the checks, without treating a screenshot as proof of long-session performance.

## Water

![Fin's aquarium with swimming fish, one waterline, clear coral detail and suspended flecks in the current.](screenshots/tank.png)

*The main tank keeps the engine's existing flow. Feeding and swimming add short wakes that carry
nearby fish and food, while less bloom lets the glass and aquarium detail remain visible.*

The engine already solves a pressure field and a main-tank spring surface. The new
`water.js` layer samples that current for suspended flecks and adds short, local wakes
from swimming fish and feeding. Nearby fish and food respond to the same wake. The
wake pool has 48 reusable entries; the particle pool has 64 entries. They are transient
and clear when the save or viewed tank changes.

Shop tanks use a damped spring chain with reflecting ends, advanced at 120 fixed steps
per second with at most 12 catch-up steps per frame. These are small presentation models,
not a replacement for the engine's fluid solver or aquarium chemistry.

The presentation layer now follows the engine's scene and geometry. The duplicate
waterline above the tank and the extra tiled caustics are gone. A lighter bloom makes
fish and glass detail easier to read. The Guide has a searchable Water in motion entry.

## Room

![Fin's warm shop interior with lit aquarium windows, the keeper and a wooden till.](screenshots/shop.png)

*Tank overlays follow the painted glass. The keeper, staff and customers draw from individual
sprite frames, with stable anchors and complete clothing.*

The eight existing stock slots now fit the glass in `art/shop-interior.jpg?v=5`.
Corners are normalized to that 1792 by 1008 painting, using the
[recorded measurements](next-steps.md) and checked against the actual asset. Back-right and island
glass each hold two adjacent slots. Their existing keys and order are preserved so
the stock filters and tank navigation keep the same meaning.

The painted room supplies its own glass, interior and furniture. Living fish, bubbles
and surface highlights are drawn inside those glass bounds. The separate plates and
synthetic edge slabs are retained for the room's missing-image fallback.

People now use an explicit sprite-sheet grid per asset. Keeper and staff are 2 by 2;
the two large men's walk sheets are 16 by 2; the smaller walk sheets are 4 by 2.
The coat sheet is 8 by 1 and the casual sheet is 4 by 2. Each pose shares a stable frame anchor.
Standing people keep a standing pose; walking no longer cycles through work and greeting.
Contact shadows are cached, and position smoothing follows elapsed time within each canvas.
The painted shop no longer crops the keeper at the removed counter position.
The drawing layer no longer applies its own crowd displacement: it previously
treated a person's last frame as another person and pushed them back and forth.
Native movement and the renderer's elapsed-time interpolation now share one position.

The keeper and staff images were restored from the repository's `de9df10` versions.
The later black-background key had removed dark clothing and hair. The restored sheets
retain those body parts. The casual customer sheet was restored from `3c3eed9`, before a later composite
put several sizes and copies in each frame. The asset version is advanced so returning
players receive the corrected sheets.

## Neighborhood

![Fin's neighborhood map with a storefront, church, market stalls, named places, people and travel links.](screenshots/map.png)

*Destinations stay readable while people move through the neighborhood. The landmarks and links
represent the game's existing places and travel connections.*

The map preserves its existing background, geographic projection and named places.
Travel lines connect the game's simulated destinations. They describe the simulation's
links rather than surveyed street centerlines. Landmark symbols, labels, traffic and
night lights help distinguish routes, destinations and people at the displayed scale.

People, selection halos and window overlays use the same map bounds. Clicking a person
in the panel resolves their displayed position and passes the corresponding world
position to the engine's existing selection handler. Window captions and hit targets
follow the actual canvas rectangle, including after a resize.

## Other views

The [screenshot gallery](screenshots/README.md) also shows both Work Mode themes and
a contact sheet of all eleven person assets.

## Checks

`npm run check` includes `check:water`, which measures splash propagation, settling,
30/60/144 Hz agreement, bounded catch-up, directional wakes, native-current advection,
actual fish/food coupling, and pause/hidden/scene guards in the production layer.

`check:folk` calls the production person hook repeatedly at 20, 60 and 144 Hz,
with repeated identities across canvases, and rejects any changes to native positions
or renderer arguments. The checker also verifies that an injected displacement fails.

`npm run check:polish` exercises the built game in Chromium. It captures the three
rooms and checks the new behavior alongside save reload and display-mode smoke checks.
It checks live current samples, real feeding, finite fish and food state, map selection,
and an eight-second trace of the keeper's actual drawn position,
and the work themes, reduced motion and narrow layouts. These are bounded browser checks,
not an overnight endurance run or a test of every save and fish species. Headless
software-rendering timings are diagnostic evidence, not a hardware FPS promise.
