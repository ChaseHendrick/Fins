# The neighborhood map

The map keeps Fin's existing North End place coordinates, camera bounds, aerial image and travel
chains. Clearer labels, drawn landmarks and moving people make the neighborhood easier to read.
Clicking a person in the panel follows the person shown on the map to the existing selection panel.

![Fin's neighborhood map showing named North End destinations, people, a church, market stalls and the shop.](screenshots/map.png)

*Fin's sits among its existing neighborhood destinations. The storefront, church, stalls, trees
and travel links are game symbols placed over the existing aerial background.*

The changes do not add a coastline, building footprint, bridge, street or real residential address.

## Rendering and scale

The storefront, church, market stalls, and trees are drawn map symbols at existing place anchors.
They are illustrative symbols, not surveyed buildings. Their common symbol size is
`clamp(mapWidth * 0.045, 18, 36)` pixels, using a 32-pixel drawing coordinate system. This is an
explicit enlargement for readability at neighborhood zoom. The people and cars are similarly
exaggerated, as in the existing map, and must not be read as physical dimensions.

Labels have a shared font size, rounded backgrounds, and priority-based collision avoidance. The
shop is placed first, followed by the church, market, parks, and other places. On small maps a
lower-priority label can be omitted rather than painted over a neighbor. The original travel
chains get a thin light line over a darker edge. Those lines show the game's connections between
place anchors, not a new street survey.

The evening glow uses one cached small canvas, reused at the landmark anchors. Reduced-motion
preferences freeze decorative pedestrian and car interpolation, walking cycles, story-window
fish, and cruiser movement. Simulation time and the underlying town systems continue.

## Interactions and story windows

The panel map's existing person-selection handler expects the old 1000-by-1000 world coordinates.
`townPickAt(canvas, x, y)` resolves the person actually drawn at a map pixel. A capture listener on
`#swmap` forwards that person's original coordinates to the same engine handler. Clicking empty
map space clears its existing selection. The selection halo uses the person's displayed position.

`townScreen` describes where the neighborhood canvas was last drawn in the main scene. The story
windows use these screen bounds, rather than stretching the map projection to the whole browser.
The shop fish pane fits the storefront symbol's window, so Fin's no longer receives a second
floating sign. Sold-fish windows use their already assigned neighborhood places. These are story
markers for fictional households, not records of actual Boston residences. Their existing fish,
death, click, speech, and choir behavior remains in place. The window overlay releases its backing
canvas when the player leaves the map.

## Source boundary

Geographic constants and place coordinates are inherited from the repository. No new geographic
data was imported in this pass. The screenshot shows a local game scene, not a newly surveyed map.
A future vector map still needs independently verified coastline, street geometry, footprints
and data attribution. The current symbols are not a substitute for that work.

The browser check exercises panel selection and checks that the selected record matches the
person drawn under the click. It also checks that the main map exposes its display bounds for
the window layer, alongside narrow-layout and reduced-motion smoke checks. It does not establish
the geographic accuracy of the inherited aerial image or every household's position.
