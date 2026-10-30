// 傾盤 Qingpan rules engine. Pure functions, no DOM; runs in the browser, in a Web Worker and in
// Node. The board is 5 x 5, cell = row * 5 + col, row 0 at the top (rank 5). Two pillars, and two
// holes a half turn apart: Mint's on a4, Coral's on e2. Each side has three pieces, kept as a 25-bit
// mask. A turn tilts the board N, E, S or W (every piece of both sides slides until it meets the
// edge, a pillar, another piece or the other side's hole; a piece that slides into its own hole
// falls in) or steps one own piece one square (into an empty square, or into its own hole). A tilt
// must move something, and may not go straight back the way the other side just tilted. After a
// move: if one of the mover's pieces fell in, the mover wins; otherwise, if one of the other side's
// did, the other side wins. Threefold repetition is a draw. A side with no move passes.

export const R = 5;
export const C = 5;
export const CELLS = R * C;
export const MINT = 0;
export const CORAL = 1;
export const PILLARS = [1, 23];          // b5, d1
export const HOLES = [5, 19];            // Mint's a4, Coral's e2
export const K = 3;
// The opening (see analysis/): Mint c2 d2 c1, Coral on the half-turn squares c4 b4 c5.
export const START = { m: (1 << 17) | (1 << 18) | (1 << 22), c: (1 << 7) | (1 << 6) | (1 << 2) };
export const DIRS = ['N', 'E', 'S', 'W'];
const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];

export const cellName = (i) => 'abcde'[i % C] + (R - Math.floor(i / C));
export const cellsOf = (mask) => { const out = []; for (let i = 0; i < CELLS; i++) if ((mask >> i) & 1) out.push(i); return out; };
const isPillar = (i) => i === PILLARS[0] || i === PILLARS[1];
const neighbour = (i, d) => {
  const r = Math.floor(i / C) + DR[d], c = (i % C) + DC[d];
  return r < 0 || r >= R || c < 0 || c >= C ? -1 : r * C + c;
};

// Tilt every piece one way. Returns the new masks, which side(s) lost a piece into its own hole,
// and each piece's path (for drawing): paths is a list of { side, from, to, fell }.
export function tilt(m, c, d) {
  const occ = new Array(CELLS).fill(-1);
  for (let i = 0; i < CELLS; i++) { if ((m >> i) & 1) occ[i] = MINT; if ((c >> i) & 1) occ[i] = CORAL; }
  // front first: for N the top row first, for S the bottom row, for E the right column, for W the left
  const order = [];
  for (let k = 0; k < CELLS; k++) {
    if (d === 0) order.push(k);
    else if (d === 2) order.push(CELLS - 1 - k);
    else { const col = d === 1 ? C - 1 - Math.floor(k / R) : Math.floor(k / R); order.push((k % R) * C + col); }
  }
  const fell = [false, false], paths = [];
  let moved = false;
  for (const start of order) {
    const p = occ[start];
    if (p < 0) continue;
    let cur = start, gone = false;
    for (;;) {
      const n = neighbour(cur, d);
      if (n < 0 || isPillar(n)) break;
      if (n === HOLES[0] || n === HOLES[1]) {
        if (n === HOLES[p]) { occ[cur] = -1; fell[p] = true; moved = true; gone = true; cur = n; }
        break;
      }
      if (occ[n] >= 0) break;
      occ[n] = p; occ[cur] = -1; cur = n; moved = true;
    }
    if (cur !== start) paths.push({ side: p, from: start, to: cur, fell: gone });
  }
  let nm = 0, nc = 0;
  for (let i = 0; i < CELLS; i++) { if (occ[i] === MINT) nm |= 1 << i; if (occ[i] === CORAL) nc |= 1 << i; }
  return { m: nm, c: nc, fell, moved, paths };
}

export function initialState(first = MINT) {
  const s = { m: START.m, c: START.c, turn: first, last: null, winner: null, reason: null, draw: false, ply: 0, history: new Map(), lastMove: null, first };
  s.history.set(positionKey(s), 1);
  return s;
}

export function positionKey(s) { return s.m + ',' + s.c + ',' + s.turn + ',' + (s.last === null ? '-' : s.last); }

// The solver's state index (see analysis/solver.c): colex ranks of each side's pieces among the
// free squares (every square but the pillars and holes).
const FREE = []; const FIDX = new Array(CELLS).fill(-1);
for (let i = 0; i < CELLS; i++) if (!isPillar(i) && i !== HOLES[0] && i !== HOLES[1]) { FIDX[i] = FREE.length; FREE.push(i); }
const BIN = []; for (let n = 0; n <= FREE.length; n++) { BIN[n] = [1]; for (let k = 1; k <= K; k++) BIN[n][k] = n ? BIN[n - 1][k - 1] + BIN[n - 1][k] : 0; }
const CK = BIN[FREE.length][K];
function rank(mask) {
  let r = 0, k = 0;
  for (let i = 0; i < CELLS; i++) if ((mask >> i) & 1) r += BIN[FIDX[i]][++k];
  return r;
}
export function hashKey(s) {
  return ((rank(s.m) * CK + rank(s.c)) * 5 + (s.last === null ? 4 : s.last)) * 2 + s.turn;
}

// Moves for the side to move: tilts N E S W (not straight back, not one that moves nothing), then
// each own piece's steps N E S W. A tilt is { t: 'tilt', d }, a step { t: 'step', from, to }.
export function legalMoves(s) {
  const out = [];
  for (let d = 0; d < 4; d++) {
    if (s.last !== null && d === (s.last + 2) % 4) continue;
    if (tilt(s.m, s.c, d).moved) out.push({ t: 'tilt', d });
  }
  const own = s.turn === MINT ? s.m : s.c, all = s.m | s.c;
  for (const from of cellsOf(own)) {
    for (let d = 0; d < 4; d++) {
      const to = neighbour(from, d);
      if (to < 0 || isPillar(to)) continue;
      if (to === HOLES[1 - s.turn]) continue;
      if (to !== HOLES[s.turn] && ((all >> to) & 1)) continue;
      out.push({ t: 'step', from, to });
    }
  }
  if (!out.length) out.push({ t: 'pass' });
  return out;
}

// Apply a move without history bookkeeping.
export function step(s, mv) {
  const A = s.turn, B = 1 - A;
  let m = s.m, c = s.c, fell = [false, false], last = null;
  if (mv.t === 'tilt') {
    const r = tilt(m, c, mv.d);
    m = r.m; c = r.c; fell = r.fell; last = mv.d;
  } else if (mv.t === 'step') {
    const bit = 1 << mv.from;
    if (A === MINT) m &= ~bit; else c &= ~bit;
    if (mv.to === HOLES[A]) fell[A] = true;
    else if (A === MINT) m |= 1 << mv.to; else c |= 1 << mv.to;
  }
  const n = { m, c, turn: B, last, winner: null, reason: null };
  if (fell[A]) { n.winner = A; n.reason = 'hole'; }
  else if (fell[B]) { n.winner = B; n.reason = 'gift'; }
  return n;
}

export function applyMove(s, mv) {
  const n = step(s, mv);
  n.draw = false;
  n.ply = s.ply + 1;
  n.history = new Map(s.history);
  n.lastMove = { ...mv, side: s.turn };
  n.first = s.first;
  if (n.winner !== null) return n;
  const key = positionKey(n);
  const k = (n.history.get(key) || 0) + 1;
  n.history.set(key, k);
  if (k >= 3) n.draw = true;
  return n;
}

export function makesDraw(s, mv) {
  const n = step(s, mv);
  if (n.winner !== null) return false;
  return (s.history.get(positionKey(n)) || 0) >= 2;
}
export const repeatCount = (s) => s.history.get(positionKey(s)) || 0;
export const sameMove = (a, b) => a.t === b.t && (a.t === 'pass' || (a.t === 'tilt' ? a.d === b.d : a.from === b.from && a.to === b.to));
export const moveText = (mv) => (mv.t === 'tilt' ? 'tilt ' + DIRS[mv.d] : mv.t === 'step' ? cellName(mv.from) + '-' + cellName(mv.to) : 'pass');

// Leaf count to a fixed depth; a finished game counts as 1 (same as the C solver).
export function perft(s, d) {
  if (s.winner !== null && s.winner !== undefined) return 1;
  if (d === 0) return 1;
  let t = 0;
  for (const mv of legalMoves(s)) t += perft(step(s, mv), d - 1);
  return t;
}
