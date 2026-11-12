# Minesweeper Idle

An incremental game built on Minesweeper: blanks don't cascade, you tap them to harvest Coins.

## Run it

```
npm install
npm run dev      # play at http://localhost:5173 with hot reload
npm run build    # writes dist/index.html, one self-contained file (upload this to itch.io)
npm run sim      # balance simulation: a bot plays 2 hours and prints progress
npm test         # unit tests
```

## Publish on itch.io

1. Run `npm run itch`. It builds the game and writes `minesweeper-idle-itch.zip`.
2. On itch.io, create a new project, set Kind of project to **HTML**, and upload the zip.
3. Tick **This file will be played in the browser**, set the viewport to about 1100 × 760, and turn on the fullscreen button.

The Claude artifact link is only a preview. This project is the game.

## Where things are

- `src/config.ts`: every balance number (costs, growth, Heat, payouts, number format).
- `src/game.ts`: game rules, no UI. Used by the game, the sim and the tests.
- `src/save.ts`: autosave and save-string export/import.
- `src/main.ts`, `src/style.css`: the UI.
- `src/art.ts`: tile and icon art (inline SVG).
- `src/fx.ts`, `src/sfx.ts`: particles, shockwaves, ambient dust, and synthesized sound. Feel numbers (combo, crits, rich veins) are under `juice` in `config.ts`.
- `scripts/sim.ts`: the balance bot. Change `config.ts`, run `npm run sim`, compare.

Debug panel: press `#` in the game, or open it with `#debug` at the end of the URL.
