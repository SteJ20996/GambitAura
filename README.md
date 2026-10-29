# 罡曜 GambitAura

A series of small two-player strategy games: open information, no dice, no timer.
Chinese name 罡曜 (gāng yào): 罡 as in 罡氣, an aura of power; 曜, radiance.
Live address: www.gambitaura.com (gambitaura.com redirects there).

The homepage is a game hub with two shelves. **Originals** are games designed here; their
openings are solved by computer before they go live. **Classics** are well-known games; each
uses an accepted balancing rule and its page says plainly how fair it is.

| Shelf | Game | Folder | Fairness, as the page states it |
|-------|------|--------|---------------------------------|
| Original 01 | 借路 Jielu | `jielu/` | Solved: the standard opening is a draw with perfect play (the original opening, a second-player win, stays selectable) |
| Original 02 | 轉環 Zhuanhuan | `zhuanhuan/` | Solved: the spiral opening is a draw with perfect play; 12 of the 16 first moves hold |
| Original 03 | 光路 Guanglu | `guanglu/` | Solved: the opening is a draw with perfect play; 8 of the 16 first moves hold |
| Original 04 | 日影 Riying | `riying/` | Solved: the opening is a draw whoever moves first; 2 of the 5 first moves hold |
| Classic | 六角連線 Hex | `hex/` | No draws, so the first player has a forced win; the swap rule takes that edge away |
| Classic | 黑白棋 Reversi | `reversi/` | 8 × 8 was weakly solved in 2023 (Takizawa): a draw with perfect play |
| Classic | 五子棋 Gomoku | `gomoku/` | Casual by default (free-style is a first-player win, Allis 1994; Black alternates each game). Pro options: gomoku as at the Gomoku World Championship (Swap2, exactly five) and renju as at the Renju World Championship (Black's forbidden moves, Taraguchi-10 opening) |
| Classic | 取石子 Nim | `nim/` | Every position is solved (Bouton 1901); fairness comes from the format: one sets up, the other picks the order, roles swap |

## Layout

- `index.html`: the game hub. `assets/ga.css`: the shared "Ling Mo" (靈墨) theme. `favicon.svg`.
- `assets/game.css`: the shared game page (scoreboard, board frame, mist, result overlay, status,
  side panel, move list). `assets/shell.js`: the shared page helpers (language, settings store,
  scoreboard, status, move list, overlay, and `AIClient`, which runs a computer player in a module
  Web Worker). The classics use both; 借路 uses `game.css` and keeps its own page logic.
- Each classic folder has `engine.js` (rules as pure functions), `ai.js` (deterministic computer
  player), `index.html` and `app.js`; Reversi, Hex and Gomoku run their AI in `ai-worker.js`.
- `jielu/index.html`, `jielu/app.js`: the game page (zh-Hant / English, vs computer or two players on one device).
- `jielu/engine.js`: the rules as pure functions, shared by the page, the Web Worker and the Node checks.
- `jielu/ai.js`, `jielu/ai-worker.js`: the computer player (alpha-beta with a fixed node budget, so it is deterministic).
- `jielu/docs/mechanics-v0.4.md`: the mechanics document as supplied.
- `jielu/analysis/`: the rules review (`index.html`) and the solver behind it (`solver.c` plus Node cross-checks).
- `zhuanhuan/`: Game 02 (`index.html`, `app.js`, `engine.js`, `ai.js`, `ai-worker.js`).
  `zhuanhuan/analysis/`: how its rules and opening were chosen (`index.html`), the solver (`solver.c`)
  and the Node cross-checks (`check_table.mjs`, `probe_ai.mjs`, `table.mjs`).
- `guanglu/`: Game 03, same files as 轉環. `guanglu/analysis/`: how its rules, light placement and
  opening were chosen (`index.html`), the solver (`solver.c`) and the same three Node cross-checks.
- `riying/`: Game 04, same files as 轉環. `riying/analysis/`: how its rules and opening were chosen
  (`index.html`), the solver (`solver.c`) and the same three Node cross-checks.
- `lab/qingpan/solver.c`: 傾盤, a solved Game 05 candidate (not built, not linked from the site).
- `tests/e2e.cjs`: browser test of the hub, 借路 and its fairness page, plus a guard against version
  numbers and proposal wording on every original game's pages. `tests/zhuanhuan.cjs`: 轉環.
  `tests/guanglu.cjs`: 光路. `tests/riying.cjs`: 日影.
  `tests/hex.cjs`, `tests/reversi.cjs`, `tests/gomoku.cjs`, `tests/nim.cjs`: one browser test per classic.

No build step: every page is static HTML, CSS and ES modules.

## Run locally

```
npx http-server -p 8765 -c-1 .
open http://127.0.0.1:8765/
node tests/e2e.cjs          # with the server running; screenshots land in tests/out/
for t in zhuanhuan guanglu riying hex reversi gomoku nim; do node tests/$t.cjs; done
```

## Key result

借路's original opening (water on B2 D2 B4 D4) is a forced win for the second player within 22
moves. The standard opening (water on A2 E2 A4 E4) is a theoretical draw and plays close to 50/50
between equal players. Details and reproduction steps: `jielu/analysis/index.html`.

轉環 Zhuanhuan (Game 02): every one of its 18,843,440 positions is solved. From the spiral opening
(Mint d1 e2 f3, Coral h1 a2 b3) neither side can force a win; 4 of the first player's 16 first moves
lose. The first draft (only three on a spoke wins) had no forced wins at all, because turning a ring
always defends; adding three side by side on a ring fixed that. Details: `zhuanhuan/analysis/index.html`.

光路 Guanglu (Game 03): a 4 × 5 field of two-sided mirrors; a turn flips one mirror that either beam
passes through, never the one just flipped. All 44,040,192 positions are solved. From the opening
(every mirror / except d3 e3 a2 b2) neither side can force a win; 8 of the first player's 16 first
moves lose within 7 moves. Earlier drafts were shallow (any mirror: longest forced win 7 moves) or a
pure race (own beam only: 5% draws); without the no-flip-back rule every attack is undone at once
(longest forced win 2). Details: `guanglu/analysis/index.html`.

日影 Riying (Game 04): a sun goes round a 5 × 5 board one place per move; a tower shades 1 or 2
squares away from the sun, and any tower in any shade cannot move. All 4,857,600 positions are
solved. From the opening (Mint a1 short, d1 tall; Coral e5, b5; sun in the south) neither side can
force a win, whoever moves first. Earlier drafts were a race (any far-row square wins: 1.3% draws,
no fair start) or fair only in theory (a side with no move passed: every fair start gave one side
9 or more points in simulated games). Details: `riying/analysis/index.html`.

## Before changing the rules or the opening

1. `gcc -O3 -march=native -fopenmp -o solver jielu/analysis/solver.c`
2. `./solver check 200000` and `./solver perft 7` (must match `perft()` in `jielu/engine.js`)
3. `./solver solve table.bin && ./solver analyze table.bin` (about 4 minutes, 4 GB RAM, 3.7 GB file)
4. `./solver dump 3000 300 > games.txt && node jielu/analysis/replay.mjs games.txt ./jielu/engine.js`

For 轉環: `cd zhuanhuan/analysis && gcc -O3 -march=native -fopenmp -o solver solver.c`, then
`./solver --perft d1,e2,f3 h1,a2,b3 6` (must match `perft()` in `zhuanhuan/engine.js`),
`./solver --show d1,e2,f3 h1,a2,b3 --dump table.bin` (about 10 seconds) and
`node check_table.mjs table.bin 3000`.

For 光路: `cd guanglu/analysis && gcc -O3 -march=native -fopenmp -o solver solver.c`, then
`./solver --design 11 17 --start 3840 --perft 6` (must match `perft()` in `guanglu/engine.js`),
`./solver --design 11 17 --start 3840 --dump table.bin` (about 15 seconds, 88 MB) and
`node check_table.mjs table.bin 3000`. The design and start numbers are `DESIGN` in the engine.

For 日影: `cd riying/analysis && gcc -O3 -march=native -fopenmp -o solver solver.c`, then
`./solver --start a1,d1 --sunat S --perft 6` (must match `perft()` in `riying/engine.js` for both
first players), `./solver --dump table.bin` (about 5 seconds, 12 MB) and
`node check_table.mjs table.bin 3000`. The opening is `START` in the engine.

The 借路 solver covers every terrain with four water squares and the pieces anywhere. A change to the
board size, the number of water squares, the flags or the move rules needs the solver updated first.

## Hosting: GitHub Pages at www.gambitaura.com

The `CNAME` file holds `www.gambitaura.com` (set from Settings → Pages on 2026-10-28). With the
DNS records below for both names, GitHub redirects `gambitaura.com` to `www.gambitaura.com` by
itself; GitHub's docs recommend this www-first setup. No redirect rule is needed at Cloudflare.

DNS for gambitaura.com on Cloudflare (DNS → Records), every record "DNS only" (grey cloud):

| Type | Name | Content |
|------|------|---------|
| A | `@` | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (four records) |
| AAAA | `@` | `2606:50c0:8000::153`, `…8001::153`, `…8002::153`, `…8003::153` (four records) |
| CNAME | `www` | `stej20996.github.io` |
| TXT | `_github-pages-challenge-SteJ20996` | the code from account Settings → Pages (domain verification; keep it) |

Settings → Pages (in this repository's Settings, not the account's): Source "Deploy from a branch",
`main`, `/ (root)`. "Enforce HTTPS" turns on by ticking it once GitHub has issued the certificate.

Keep the repository public: the fairness pages point readers to the solvers in it. On 2026-10-29
the repository was private for a while on GitHub Free, which cannot publish Pages from a private
repository: merges stopped deploying and gambitaura.com showed GitHub's 404 "There isn't a GitHub
Pages site here". Making it public again did not bring the site back by itself; Pages had to be
turned on again in this repository's Settings → Pages (source `main`, `/ (root)`, custom domain
`www.gambitaura.com`, then "Enforce HTTPS"). The account has been on GitHub Pro since that day,
which would also allow Pages from a private repository.

Keep the records "DNS only". Cloudflare's dashboard suggests proxying and a www-to-root redirect
rule; ignore both. Redirect rules only run on proxied records, and a www-to-root rule would loop
against GitHub's root-to-www redirect. If the proxy is ever turned on, SSL/TLS must be
"Full (strict)" and no redirect rule may fight GitHub's.
