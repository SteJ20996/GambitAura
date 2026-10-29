// Jielu (借路) rules engine. Pure functions, no DOM; runs in the browser, in a
// Web Worker and in Node. Cells are numbered row * 5 + col: row 0..4 is rank
// 1..5, col 0..4 is file A..E. Mint (side 0) aims at C1; Coral (side 1) at C5.

export const MINT = 0;
export const CORAL = 1;
export const GOAL = [2, 22];
export const OPP_GOAL = [22, 2];
const FLAGS = (1 << 2) | (1 << 22);
const ALL = (1 << 25) - 1;

export const NB = [];
for (let c = 0; c < 25; c++) {
  const r = Math.floor(c / 5), k = c % 5, n = [];
  if (r > 0) n.push(c - 5);
  if (r < 4) n.push(c + 5);
  if (k > 0) n.push(c - 1);
  if (k < 4) n.push(c + 1);
  NB.push(n);
}

export const cellName = (c) => 'ABCDE'[c % 5] + (Math.floor(c / 5) + 1);
export const cellOf = (s) => (s.charCodeAt(1) - 49) * 5 + (s.charCodeAt(0) - 65);
const bit = (c) => 1 << c;
const has = (m, c) => (m >> c) & 1;

// Starting layouts. Everything else in the rules is shared.
// v05 is the standard opening: its start is a theoretical draw. v04 is the
// original layout; the solver shows the side to move there is lost (the second
// player wins in at most 22 plies), so the standard one moves the four holes
// one file outward. The ids are internal (and stored in settings), never shown.
export const LAYOUTS = {
  v05: { id: 'v05', holes: [5, 9, 15, 19], pieces: [[21, 23], [1, 3]] },   // A2 E2 A4 E4
  v04: { id: 'v04', holes: [6, 8, 16, 18], pieces: [[21, 23], [1, 3]] },   // B2 D2 B4 D4
};

function sortPair(p) { return p[0] < p[1] ? [p[0], p[1]] : [p[1], p[0]]; }
const pairMask = (p) => bit(p[0]) | bit(p[1]);

const COL_A = 0b0000100001000010000100001;
const COL_E = COL_A << 4;

// Cells joined to `goal` by floor, never passing through `excl` (bit-parallel flood fill).
export function reachMask(holes, goal, excl) {
  const allowed = ALL & ~holes & ~bit(excl);
  let r = bit(goal);
  for (;;) {
    const n = (r | (r >> 5) | ((r << 5) & ALL) | ((r & ~COL_A) >> 1) | ((r & ~COL_E) << 1)) & allowed;
    if (n === r) return r;
    r = n;
  }
}

// Both sides keep at least one piece joined to their own flag by floor
// (pieces ignored; a side's path may not pass through the other flag).
export function terrainOk(holes, pieces) {
  return (pairMask(pieces[MINT]) & reachMask(holes, GOAL[MINT], OPP_GOAL[MINT])) !== 0 &&
         (pairMask(pieces[CORAL]) & reachMask(holes, GOAL[CORAL], OPP_GOAL[CORAL])) !== 0;
}

export function initialState(first = MINT, layout = LAYOUTS.v05) {
  let holes = 0;
  for (const h of layout.holes) holes |= bit(h);
  const s = {
    holes,
    pieces: [sortPair(layout.pieces[0]), sortPair(layout.pieces[1])],
    turn: first,
    ban: null,          // {src, dst}: the floor move the side to move may not make
    winner: null,
    draw: false,
    ply: 0,
    history: new Map(),
    last: null,
    layout: layout.id,
    first,
  };
  s.history.set(positionKey(s), 1);
  return s;
}

// The ban only ever bites after a diagonal floor move whose fourth corner holds
// a piece of the side to move. Elsewhere it changes nothing, so it is left out
// of the position for repetition purposes.
export function effectiveBan(s) {
  if (!s.ban) return null;
  const { src, dst } = s.ban;
  for (const p of s.pieces[s.turn]) {
    if (NB[p].includes(src) && NB[p].includes(dst)) return s.ban;
  }
  return null;
}

export function positionKey(s) {
  const b = effectiveBan(s);
  return s.holes.toString(36) + '|' + s.pieces[0].join(',') + '|' + s.pieces[1].join(',') +
    '|' + s.turn + '|' + (b ? b.src + '>' + b.dst : '-');
}

// Numeric position key (< 2^53) for search tables.
export function hashKey(s) {
  const b = effectiveBan(s);
  const banCode = b ? b.src * 25 + b.dst + 1 : 0;              // < 626, 10 bits
  const pcs = ((s.pieces[0][0] * 25 + s.pieces[0][1]) * 25 + s.pieces[1][0]) * 25 + s.pieces[1][1]; // < 390625, 19 bits
  return ((s.holes * 2 + s.turn) * 390625 + pcs) * 626 + banCode;  // 25+1+19+10 bits
}

// All legal moves for the side to move. A forced pass is returned as the only
// move when nothing else is legal. Winning walks carry win: true.
export function legalMoves(s) {
  const A = s.turn;
  const occ = pairMask(s.pieces[0]) | pairMask(s.pieces[1]);
  const fl = ALL & ~s.holes;
  const moves = [];
  for (const p of s.pieces[A]) {
    for (const x of NB[p]) {
      if (!has(fl, x) || has(occ, x) || x === OPP_GOAL[A]) continue;
      moves.push({ t: 'walk', from: p, to: x, win: x === GOAL[A] });
    }
  }
  const seen = new Map();
  for (const p of s.pieces[A]) {
    for (const src of NB[p]) {
      if (!has(fl, src) || has(occ, src) || has(FLAGS, src)) continue;
      for (const dst of NB[p]) {
        if (!has(s.holes, dst)) continue;
        const key = src * 25 + dst;
        if (seen.has(key)) {
          const prev = seen.get(key);
          if (prev) prev.pivots.push(p);
          continue;
        }
        let m = null;
        const nh = (s.holes & ~bit(dst)) | bit(src);
        if (!(s.ban && s.ban.src === src && s.ban.dst === dst) && terrainOk(nh, s.pieces)) {
          m = { t: 'floor', src, dst, pivots: [p] };
          moves.push(m);
        }
        seen.set(key, m);
      }
    }
  }
  if (moves.length === 0) moves.push({ t: 'pass' });
  return moves;
}

// Apply a move without history bookkeeping (used by search).
export function step(s, m) {
  const A = s.turn;
  const n = {
    holes: s.holes,
    pieces: [s.pieces[0], s.pieces[1]],
    turn: 1 - A,
    ban: null,
    winner: null,
  };
  if (m.t === 'walk') {
    const p = s.pieces[A];
    n.pieces[A] = sortPair(p[0] === m.from ? [m.to, p[1]] : [p[0], m.to]);
    if (m.to === GOAL[A]) n.winner = A;
  } else if (m.t === 'floor') {
    n.holes = (s.holes & ~bit(m.dst)) | bit(m.src);
    n.ban = { src: m.dst, dst: m.src };
  }
  return n;
}

// Apply a legal move with repetition bookkeeping. Returns a new state.
export function applyMove(s, m) {
  const n = step(s, m);
  n.draw = false;
  n.ply = s.ply + 1;
  n.history = new Map(s.history);
  n.last = { ...m, side: s.turn };
  n.layout = s.layout;
  n.first = s.first;
  if (n.winner !== null) return n;
  const key = positionKey(n);
  const c = (n.history.get(key) || 0) + 1;
  n.history.set(key, c);
  if (c >= 3) n.draw = true;
  return n;
}

// Would this move make the third repetition?
export function makesDraw(s, m) {
  if (m.t === 'walk' && m.win) return false;
  const n = step(s, m);
  return (s.history.get(positionKey(n)) || 0) >= 2;
}

export function repeatCount(s) { return s.history.get(positionKey(s)) || 0; }

export function moveText(m) {
  if (m.t === 'walk') return cellName(m.from) + '→' + cellName(m.to);
  if (m.t === 'floor') return cellName(m.src) + '⇢' + cellName(m.dst);
  return 'pass';
}

// Leaf count to a fixed depth; a position where the mover can win at once counts as 1.
export function perft(s, d) {
  if (d === 0) return 1;
  const ms = legalMoves(s);
  if (ms.some((m) => m.win)) return 1;
  let t = 0;
  for (const m of ms) t += perft(step(s, m), d - 1);
  return t;
}
