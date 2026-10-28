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
  (31 checks: moves, tile moves, draw dialog and overlay, scoreboard, language, phone widths, no
  console errors). Look at the screenshots in `tests/out/`.
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
- 罡曜 has not been checked against trademarks (e.g. TIPO in Taiwan) or app stores yet. Other
  candidates considered on 2026-10-28: 鋼曜, 罡奧, 罡闢奧, 罡比特.
