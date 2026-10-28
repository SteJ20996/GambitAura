# GambitAura

The owner's series of small two-player strategy games: open information, no dice, no timer.
Chinese name **罡曜** (gāng yào, ㄍㄤ ㄧㄠˋ; chosen by the owner 2026-10-28): 罡 as in 罡氣, the
protective aura of martial-arts fiction, and 曜, radiance; the two syllables echo Gam- and -Aura.
Owner: Yizhen (Stephen) Jia (also runs stephenjia.com, Quidence and Qidolab; those live in other
repos and are not part of this one). Working name before 2026-10-28: "NeoChess". Domain
gambitaura.com (bought 2026-10-28; GitHub Pages from `main` with a `CNAME` file since gambitaura#3,
DNS steps in README). This file is the repo's
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

## Design system: "Aura Noir" (`assets/ga.css`, 2026-10-28)

Owner's brief: 霸氣, 科技感, Aura 感. Dark void #05070c with a faint grid, glass cards, two side
auras: mint #2ef2b5 (glow rgba(46,242,181,.45)) and coral #ff5f6d, gold accent #ffd166. Text #eef3fb
/ body #c3ccda / muted #8d98ab (all ≥ 4.5:1 on the void). Fonts: Unbounded (wordmark, display),
Space Grotesk (UI), Noto Sans TC 900 (Chinese titles), JetBrains Mono (labels, coordinates).
Brand mark: a gradient hexagon (mint → gold → coral) around a gold core with a dark chevron. The
lockup stacks 罡曜 (Noto Sans TC 900, gradient) over GAMBITAURA (Unbounded, small, wide tracking) in
every header, in both languages; the series hero sets 罡曜 large over GAMBITAURA with a reading line
(罡曜 · gāng yào · ㄍㄤ ㄧㄠˋ) because 罡 is a rare character. Page titles read "… · 罡曜 GambitAura".
Board:
obsidian tiles with corner ticks, water as a drifting dark field with faint sockets, flags as
rotating hex sigils, pieces as glowing orbs (mint ▲, coral ▼). The board's outer glow follows the
side to move; the selected piece gets a spinning gold ring, the anchor of a tile move a steady one.
The result appears as an overlay on the board; a session-only scoreboard counts games ("Next game"
swaps the first move, a reload starts over). Dark only. `[hidden]` is forced to `display: none`
because `.ga-btn` and `.row` set a display. `html { overflow-x: clip }` keeps the hero aura from
causing sideways scroll on phones.

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
- gambitaura.com going live (gambitaura#3, 2026-10-28): owner to add the DNS records, merge the
  CNAME PR, turn on Pages from `main`, then enforce HTTPS. Cloud sessions cannot reach
  gambitaura.com (network policy), so the owner confirms it loads. Play-testing with people.
- 罡曜 has not been checked against trademarks (e.g. TIPO in Taiwan) or app stores yet. Other
  candidates considered on 2026-10-28: 鋼曜, 罡奧, 罡闢奧, 罡比特.
