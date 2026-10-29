# GambitAura

The owner's series of small two-player strategy games: open information, no dice, no timer.
Chinese name **罡曜** (gāng yào, ㄍㄤ ㄧㄠˋ; chosen by the owner 2026-10-28): 罡 as in 罡氣, the
protective aura of martial-arts fiction, and 曜, radiance; the two syllables echo Gam- and -Aura.
Owner: Yizhen (Stephen) Jia (also runs stephenjia.com, Quidence and Qidolab; those live in other
repos and are not part of this one). Working name before 2026-10-28: "NeoChess". Domain
gambitaura.com (bought 2026-10-28 on Cloudflare). Live as www.gambitaura.com via GitHub Pages from
`main`; the apex redirects to www (setup and DNS in README). This file is the repo's
persistent memory; keep it current when decisions change.

## History

Built first inside the portfolio repo (SteJ20996/SteJ20996.github.io, folder `gambitaura/`, branch
`claude/happy-dirac-od45bx`, never merged to its main) as `gambitaura#1` (2026-10-28: rules review,
solver, first demo). Moved here as `gambitaura#2` (2026-10-28) with the "Aura Noir" redesign. The
portfolio repo keeps only a pointer in its CLAUDE.md; do not copy this repo back there.

## Game 01: 借路 Jielu

5×5 board, two pieces per side. A turn is one step (up, down, left, right onto empty floor, never
onto the other side's flag) or one tile move (an empty floor tile next to one of your pieces goes
into a water square next to the same piece; the piece stays). First piece onto its own flag wins
(Mint → C1, Coral → C5). After any tile move each side must keep a piece joined to its own flag by
floor (pieces ignored). The tile just moved cannot go straight back on the very next move. Pass only
with no legal move. Threefold repetition draws. Source: `jielu/docs/mechanics-v0.4.md` (v0.4,
2026-10-26; an earlier build lived at this-floor-is-mine.stej.chatgpt.site).

**Solved (2026-10-28).** `jielu/analysis/solver.c` solves every position with four water squares
(456,515,280 states). The v0.4 opening (water B2 D2 B4 D4) is a forced win for the SECOND player
within 22 plies; proven again by `verify_strategy.mjs` replaying the exported strategy in the JS
engine. Proposed v0.5 opening, **pending the owner's decision**: water A2 E2 A4 E4, everything else
unchanged; theoretical draw, about 50/50 between equal players in random-slip simulation, 56-ply
games at high skill (runner-up C2 B3 D3 C4). The demo defaults to v0.5 and keeps v0.4 selectable.
The reversal ban only bites after a diagonal tile move with an opponent piece on the 2×2 block's
fourth corner (about 1.3% of positions), never forces a pass, and counts in the repetition key only
when it bites. **Any change to the board, opening or win rule must be re-solved before it ships.**

**Code.** `engine.js` is the single source of rules (pure functions). `ai.js` is iterative-deepening
alpha-beta with a node budget (easy depth 1, normal depth 3, hard 250k nodes), so replies are
deterministic. `app.js` is the UI: a piece first means a step, a tile first means a tile move (in
v0.4 the same square can be both a step target and a liftable tile). The C solver and the JS engine
must agree on `perft` and on `replay.mjs`; run both after touching move rules.

## Game 02: 轉環 Zhuanhuan (gambitaura#5, 2026-10-29)

Owner, 2026-10-29: of the two Game 02 concepts (concentric rings; light paths), "兩個都可以保留，先做
concentric rings". So 轉環 is Game 02 and **light paths** (25 two-sided mirror tiles; a turn flips one
mirror, not the one just flipped; first to steer your own beam to your target wins; every flip
changes both beams) is kept as the Game 03 candidate. The name 轉環 Zhuanhuan is a working name the
owner has not confirmed yet (alternatives offered: 星軌, 連星).

Rules: 3 rings (1 inner, 2 middle, 3 outer) × 8 spokes (a at the top, clockwise), spot = ring*8+ray
in code, named like `e2`. Three pieces each. A turn: turn a ring that carries at least one of your
pieces one step either way (every piece on it rides along, both sides'), or step one of your pieces
to an empty neighbour (along its ring, or along its spoke to the next ring). The ring the other side
just turned cannot be turned straight back on the next move. Win: three on one spoke, or three side
by side on one ring. A move that lines up only the other side loses; one that lines up both wins for
the mover. Threefold repetition draws. Never a pass (a ring with your piece can always turn one way).
Opening ("spiral"): Mint d1 e2 f3 (moves first, bottom), Coral h1 a2 b3.

**Solved (2026-10-29).** `zhuanhuan/analysis/solver.c`, 18,843,440 states, about 10 s on 4 cores.
The spiral is a draw; 12 of Mint's 16 first moves hold (inner ring clockwise and outer ring
anticlockwise lose at once; inner anticlockwise and outer clockwise lose within 7 plies). Rule
design was decided by the solver: spoke-only lines gave 0 forced wins anywhere (turning a ring always
breaks a spoke line), so ring lines were added (a turn carries an arc along intact); "own rings
only" and the no-straight-back ban lengthen the longest forced win to 31 plies (15 without the ban).
Of 117 half-turn-symmetric openings, 89 are draws, 28 first-player wins, 0 losses; the spiral has
traps on move one and the shortest games among the draws. Simulated 10% slips: 48.9 / 48.5 / 2.6.
A one-move-lookahead player loses 100% to perfect play (about 30 plies). Cross-checks: perft to 6
agrees with `engine.js` (16 … 7,736,316); `check_table.mjs` re-derives 138,359 table values from the
JS engine's own move generation with 0 mismatches. **Any rule or opening change must be re-solved.**

**Code.** `engine.js` (pure rules, 24-bit masks per side), `ai.js` (alpha-beta, node budget: easy
depth 1, normal depth 3, hard 200k nodes; keeps the solved result in 88 / 94 / 99.7% of sampled
positions; hard about 0.4 s), `app.js` on `assets/shell.js`. Pieces are HTML on the board in polar
form (`rotate(a) translateY(-r) rotate(-a)`, `cqw` units), so a ring turn animates along the arc;
each ring's SVG group turns with it. In SVG with `transform-box: view-box`, `transform-origin: 0 0`
is the viewBox origin, which is the board centre here (50% 50% was the bug). Turns are made with
the row of buttons under the board; the banned direction is disabled and explained in the status.
Test: `tests/zhuanhuan.cjs` (31 checks).

## The hub and the classics (gambitaura#5, 2026-10-28)

Owner, 2026-10-28: put several board and strategy games on one site, the homepage as a game hub
with each game at its own address; the four classics Hex, Reversi, Gomoku and Nim, "然後主要是我們
自己構思創作平衡的棋類" (the main line stays our own originally designed, balanced games). So the
hub has two shelves: **原創 Originals** (借路, 轉環, then a Game 03 slot "in the works") above **經典
Classics** (four cards with mini boards drawn in the site's style).

Fairness copy must stay honest. A game with no draws always has a forced winner under perfect
play, so "solved so that neither side has a forced win" is only true of the originals we solve.
The hub's principle III is "公平，說清楚 / Fairness, stated plainly": originals have their openings
solved; classics use an accepted balancing rule and each page says how fair it really is:
- 六角連線 Hex (`hex/`, boards 7 · 9 · 11, Jade joins top and bottom, Agate left and right): no
  draws, first player wins in theory (Nash's strategy-stealing argument); the swap rule.
- 黑白棋 Reversi (`reversi/`, 8 × 8): weakly solved as a draw (Takizawa, 2023). Black alternates
  between the two players each game.
- 五子棋 Gomoku (`gomoku/`, 15 × 15, free-style: six or more counts): free-style is a first-player
  win (Allis, 1994); Swap2 opening (one player lays black, white, black; the other takes white,
  takes black, or lays two more and lets the opener pick). Swap2 is not proven fair, and the page
  says so; it makes the opener lay a balanced start.
- 取石子 Nim (`nim/`, 3 to 5 piles of 1 to 7): every position is solved (Bouton, 1901), so fairness
  lives in the format: one player sets up the piles, the other looks and picks first or second,
  roles swap every game. A perfect chooser wins any single game; the match is what is fair. The
  hard computer sets traps (nim-sum 0) and always reads the position right; the teaching view
  shows each pile in binary, the nim-sum and one winning move.

**Code.** `assets/game.css` holds the shared game page (extracted from 借路; `.boardframe` and `.at`
take `--n` cells per side). `assets/shell.js` holds the shared helpers and `AIClient` (module Web
Worker, replies no sooner than 520 ms, stale replies dropped). Every computer player is
deterministic (no `Math.random`): Reversi is alpha-beta with a node budget plus an exact endgame
(perft matches the published 4 12 56 244 1396 8200 55092 390216); Hex is UCT with RAVE on a fixed
playout count, seeded from a hash of the position, and decides swaps with its hard search on every
level (swap when its best reply wins under 52%); Gomoku is a shape table plus a win-by-fours (VCF)
search and alpha-beta with a node budget, opening from six fixed starts it scored as the least
lopsided (balanced in its own judgement, not proven); Nim is exact nim-sum play with weaker
levels by design. 借路 keeps its own `app.js` logic. The language key `ga-jielu-lang` is
shared by every page; other settings use `ga-<game>-<key>`.

## Design system: "Ling Mo" 靈墨 (`assets/ga.css`, 2026-10-28)

Owner's brief: 霸氣, 科技感, Aura 感 (gambitaura#2 answered it with "Aura Noir": neon gradients,
glossy orbs, grid lines, hex sigils). The owner then found it a little cheap and asked for 通靈
without 廉價感, so the look became "Ling Mo": restraint, light instead of neon, hairlines instead
of boxes. Do not bring back rainbow gradients, gradient buttons, glossy orbs or sci-fi chrome.

- Ground: ink #08090c with three faint lights drifting very slowly (`body::before`) and a fine SVG
  film grain at 5.5% (`body::after`). No grid.
- Colours: ivory text #ece6da, body #bdb7ac, muted #8e897f (5.7:1 on the ink); the sides are soft
  luminous stones, mint = celadon jade #8fd3bf, coral = ember agate #ec9a82; champagne #d9c38f is
  the only accent (underlines, rings, the drop target, the "和" seal). The CSS variable names stayed
  (--mint, --coral, --gold, --ink) so page code did not change.
- Type: Noto Serif TC (思源宋體) for Chinese display, Cormorant Garamond for Latin display, roman
  numerals and coordinates (italic), Instrument Sans for UI. Numbers are lining figures. Chinese is
  never set in the italic: the zh pages switch those spots to upright Noto Serif TC.
- Brand mark: concentric champagne rings around a glowing core (an aura), also the favicon. Lockup
  in every header: 罡曜 (Noto Serif TC 700, ivory, soft champagne glow) over GAMBITAURA (Cormorant,
  wide tracking, AURA in champagne). The series hero centres 罡曜 large inside a breathing halo with
  two slow rings and a few rising motes, then the reading line (gāng yào · ㄍㄤ ㄧㄠˋ).
- Controls: primary button is an ivory pill, secondary a hairline pill; segmented choices are plain
  words with a champagne underline; panels are sections split by hairlines, not cards.
- Board: a dark pool with light moving under it; water squares are carved recesses; floor tiles
  are matte stone with a faint grain; flags are a slowly turning dotted ring around a breathing
  core; pieces are jade and agate lit from inside, with a carved direction mark in a deeper shade
  of their own colour. The side to move is shown by mist rising from its own edge (Mint from rank
  5, Coral from rank 1) and a soft tint on the board's outer glow. Selected piece: a steady ring
  plus a ring of light opening outward; tile-move anchor: a steady ring. The result fades in over
  the board in large serif type; the scoreboard is type only, the side to move underlined.
- Kept from before: `[hidden]` forced to `display: none` (`.ga-btn`, `.row` set a display);
  `html { overflow-x: clip }` so the hero halo never causes sideways scroll on phones.

## Working rules

- Copy rules (the owner's, shared with their other sites): plain language for a general reader, no
  em dashes in site copy, short sentences. zh-Hant and English for every string.
- Test every UI change in headless Chromium: start a static server and run `node tests/e2e.cjs`
  (41 checks: the hub's game cards, 借路 moves, tile moves, draw dialog and overlay, scoreboard,
  language, phone widths, no console errors) and the test of any classic you touched
  (`tests/<game>.cjs`). Look at the screenshots in `tests/out/`.
- Owner merges PRs; work on feature branches. Work references are `gambitaura#n` (continuing from
  the portfolio repo), used as the PR title prefix `[gambitaura#n]`.
- Commit messages explain the reasoning (design or rules rationale), not just the diff.

## Open threads

- v0.5 opening adoption and the matching mechanics-doc update (§2 table, §4/§5.1 examples, §5.3 and
  §7.2 wording, §11).
- Hosting (2026-10-28): DNS records in place (DNS only), gambitaura.com verified on the account,
  Pages built from `main` with CNAME `www.gambitaura.com`. Waiting for GitHub's certificate, then
  tick "Enforce HTTPS". Do not add Cloudflare redirect rules or turn on the proxy (README explains
  why). Cloud sessions cannot reach gambitaura.com, docs.github.com or developers.cloudflare.com
  unless the environment allows them. Play-testing with people still to do.
- Originals are the main line. 轉環 is Game 02 (name to be confirmed by the owner); light paths is
  the Game 03 candidate, to be solved like the others before it ships.
- 罡曜 has not been checked against trademarks (e.g. TIPO in Taiwan) or app stores yet. Other
  candidates considered on 2026-10-28: 鋼曜, 罡奧, 罡闢奧, 罡比特.
