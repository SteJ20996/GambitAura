# 罡曜 GambitAura

A series of small two-player strategy games: open information, no dice, no timer.
Chinese name 罡曜 (gāng yào): 罡 as in 罡氣, an aura of power; 曜, radiance.
Domain: gambitaura.com (not yet pointed at this repo).

| # | Game | Folder | State |
|---|------|--------|-------|
| 01 | 借路 Jielu | `jielu/` | Playable demo; rules v0.4, proposed v0.5 opening as the default |

## Layout

- `index.html`: series page. `assets/ga.css`: the shared "Aura Noir" theme. `favicon.svg`.
- `jielu/index.html`, `jielu/app.js`: the game page (zh-Hant / English, vs computer or two players on one device).
- `jielu/engine.js`: the rules as pure functions, shared by the page, the Web Worker and the Node checks.
- `jielu/ai.js`, `jielu/ai-worker.js`: the computer player (alpha-beta with a fixed node budget, so it is deterministic).
- `jielu/docs/mechanics-v0.4.md`: the mechanics document as supplied.
- `jielu/analysis/`: the rules review (`index.html`) and the solver behind it (`solver.c` plus Node cross-checks).
- `tests/e2e.cjs`: browser test of all three pages (Playwright).

No build step: every page is static HTML, CSS and ES modules.

## Run locally

```
npx http-server -p 8765 -c-1 .
open http://127.0.0.1:8765/
node tests/e2e.cjs          # with the server running; screenshots land in tests/out/
```

## Key result

The v0.4 opening (water on B2 D2 B4 D4) is a forced win for the second player within 22 moves.
The proposed v0.5 opening (water on A2 E2 A4 E4) is a theoretical draw and plays close to 50/50
between equal players. Details and reproduction steps: `jielu/analysis/index.html`.

## Before changing the rules or the opening

1. `gcc -O3 -march=native -fopenmp -o solver jielu/analysis/solver.c`
2. `./solver check 200000` and `./solver perft 7` (must match `perft()` in `jielu/engine.js`)
3. `./solver solve table.bin && ./solver analyze table.bin` (about 4 minutes, 4 GB RAM, 3.7 GB file)
4. `./solver dump 3000 300 > games.txt && node jielu/analysis/replay.mjs games.txt ./jielu/engine.js`

The solver covers every terrain with four water squares and the pieces anywhere. A change to the
board size, the number of water squares, the flags or the move rules needs the solver updated first.

## Hosting (not set up yet)

GitHub Pages from `main` works as is (all links are relative). For gambitaura.com: add the DNS
records at the registrar first, then add a `CNAME` file containing `gambitaura.com`, then turn on
"Enforce HTTPS" in Settings → Pages. Adding `CNAME` before DNS resolves would break the site.
