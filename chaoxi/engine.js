// 潮汐 Chaoxi rules engine. Pure functions, no DOM; runs in the browser, in a Web Worker and in
// Node. The board is 5 x 5, cell = row * 5 + col, row 0 at the top (rank 5). Every square has a
// ground height 0..3; both home rows are 3. The tide goes 0, 1, 2, 3, 2, 1 and round again, one step
// after every move. A square is water while its height is below the tide. Each side has two pieces.
// A turn steps one piece one square (up, down, left or right) onto an empty square that is dry
// now. A piece standing in water cannot move until the water falls. A side with no move passes. A
// piece that reaches the middle of the far edge wins (Mint c5, Coral c1). Threefold repetition is a
// draw.

export const R = 5;
export const C = 5;
export const CELLS = R * C;
export const MINT = 0;
export const CORAL = 1;
// Ground heights, rank 5 first. A channel across the middle (rank 3) and four rocks (c4 e4 a2 c2).
export const HEIGHTS = [
  3, 3, 3, 3, 3,
  2, 1, 3, 2, 3,
  1, 0, 1, 0, 1,
  3, 2, 3, 1, 2,
  3, 3, 3, 3, 3,
];
export const TIDE = [0, 1, 2, 3, 2, 1];
export const TARGET = [2, 22];           // c5 for Mint, c1 for Coral
// The opening (see analysis/): Mint d1 e1, Coral a5 b5, low tide.
export const START = { pieces: [23, 24, 0, 1], phase: 0 };
const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];   // N E S W

export const cellName = (i) => 'abcde'[i % C] + (R - Math.floor(i / C));
export const wet = (cell, phase) => HEIGHTS[cell] < TIDE[phase];
export const rising = (phase) => TIDE[(phase + 1) % TIDE.length] > TIDE[phase];
// each side's two squares in increasing order, so equal positions look equal
const norm = (p) => [Math.min(p[0], p[1]), Math.max(p[0], p[1]), Math.min(p[2], p[3]), Math.max(p[2], p[3])];

export function initialState(first = MINT) {
  const s = { pieces: START.pieces.slice(), phase: START.phase, turn: first, winner: null, draw: false, ply: 0, history: new Map(), lastMove: null, first };
  s.history.set(positionKey(s), 1);
  return s;
}

export function positionKey(s) { return s.pieces.join(',') + '|' + s.phase + '|' + s.turn; }
// the solver's state index: (pos * 6 + phase) * 2 + side, pos = ((c1*26 + c0)*26 + m1)*26 + m0
export function hashKey(s) {
  const [m0, m1, c0, c1] = s.pieces;
  return ((((c1 * 26 + c0) * 26 + m1) * 26 + m0) * TIDE.length + s.phase) * 2 + s.turn;
}
// pieces standing in water right now
export const stranded = (s) => s.pieces.map((c) => wet(c, s.phase));

// Moves for the side to move, in the solver's order: its first piece, then its second, each N E S
// W. A move is { t: 'step', from, to }, or { t: 'pass' } when nothing can move.
export function legalMoves(s) {
  const out = [];
  for (let k = 0; k < 2; k++) {
    const from = s.pieces[s.turn * 2 + k];
    if (wet(from, s.phase)) continue;
    for (let d = 0; d < 4; d++) {
      const r = Math.floor(from / C) + DR[d], c = (from % C) + DC[d];
      if (r < 0 || r >= R || c < 0 || c >= C) continue;
      const to = r * C + c;
      if (s.pieces.includes(to) || wet(to, s.phase)) continue;
      out.push({ t: 'step', from, to });
    }
  }
  if (!out.length) out.push({ t: 'pass' });
  return out;
}

// Apply a move without history bookkeeping.
export function step(s, mv) {
  const A = s.turn;
  let pieces = s.pieces.slice();
  if (mv.t === 'step') pieces[pieces.indexOf(mv.from)] = mv.to;
  pieces = norm(pieces);
  const n = { pieces, phase: (s.phase + 1) % TIDE.length, turn: 1 - A, winner: null };
  if (mv.t === 'step' && mv.to === TARGET[A]) n.winner = A;
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
export const sameMove = (a, b) => a.t === b.t && (a.t === 'pass' || (a.from === b.from && a.to === b.to));
export const moveText = (mv) => (mv.t === 'step' ? cellName(mv.from) + '-' + cellName(mv.to) : 'pass');

// Leaf count to a fixed depth; a finished game counts as 1 (same as the C solver).
export function perft(s, d) {
  if (s.winner !== null && s.winner !== undefined) return 1;
  if (d === 0) return 1;
  let t = 0;
  for (const mv of legalMoves(s)) t += perft(step(s, mv), d - 1);
  return t;
}
