# Contributing to Fin's

Thanks for looking. Fin's is a game you serve from a folder, and the checks below are the whole of what keeps a change from turning into a black page.

## Run it

- **In a browser:** serve `game/` with any static server (for example `npx serve game`) and open the page. Or play the published copy at [chasehendrick.github.io/Fins](https://chasehendrick.github.io/Fins/).
- **As the desktop app:** `npm install`, then `npm start`.

## Where things live

- `src/layers/` holds the layers: one strict IIFE per file. `src/pre.mjs` and `src/post.mjs` list them in load order.
- `game/layers-pre.js` and `game/layers-post.js` are built from `src/` by `npm run build`. They are committed, so never edit them by hand.
- `game/fins.js` is built elsewhere and is not edited here.
- `game/art/` holds the painted art. `tools/key-sprite.py` and `tools/key-fish-atlas.py` cut painted objects out of their backgrounds.
- `desktop/` holds the Electron wrapper.

## Before you open a pull request

```bash
npm run check:install   # once: eslint, esbuild and a headless Chromium
npm run build           # after any change in src/, or after replacing fins.js
npm run check
```

`npm run check` is what GitHub Actions runs on every pull request. The README's "What has to be true before you push" section says what each check catches.

Keep a pull request to one change you can describe in a sentence. Say what you checked and how, and include a screenshot for anything visible. The README's agent rules apply to everyone: keep the name Fin's, do not add a second HUD, and if a change does not affect odds, speech, the till or the chord, it does not ship.

## Reporting a bug

Open an issue with what happened, what you expected, and your browser or the desktop app with its version. Include the scene you were in (Tank, Shop or Map), and any red lines from the console.

## License

By contributing you agree that your contribution is licensed under the project's [PolyForm Small Business License 1.0.0](LICENSE).

Open work, with what was measured and where to start, is in [docs/next-steps.md](docs/next-steps.md).
