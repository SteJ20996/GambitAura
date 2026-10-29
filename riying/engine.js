// 日影 Riying rules engine. Pure functions, no DOM; runs in the browser, in a Web Worker and in
// Node. The board is 5 x 5, cell = row * 5 + col, row 0 at the top (rank 5). There are four towers,
// always in this order: Mint short, Mint tall, Coral short, Coral tall. A sun stands outside the
// board at one of eight places (0 = N, then clockwise: NE E SE S SW W NW) and moves one place
// clockwise after every move. A tower of height h shades the h squares behind it, away from the
// sun. A tower in any shade (its own side's too) cannot move. A turn steps one free tower one
// square up, down, left or right onto an empty square. A tower that reaches the middle of the far
// edge wins (Mint c5, Coral c1). A side left with no move loses. Threefold repetition is a draw.

export const R = 5;
export const C = 5;
export const CELLS = R * C;
export const MINT = 0;
export const CORAL = 1;
export const HEIGHTS = [1, 2, 1, 2];
export const OWNER = [MINT, MINT, CORAL, CORAL];
export const SUN_NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
// where the sun stands, as a row/col offset from the board
export const SUN_DR = [-1, -1, 0, 1, 1, 1, 0, -1];
export const SUN_DC = [0, 1, 1, 1, 0, -1, -1, -1];
export const TARGET = [2, 22];           // c5 for Mint, c1 for Coral

// The opening (see analysis/): Mint's short tower on a1 and tall tower on d1, Coral's on the
// half-turn squares (e5, b5), and the sun in the south. A draw whichever side moves first.
export const START = { towers: [20, 23, 4, 1], sun: 4 };

const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];   // N E S W, the order the solver uses

export const cellName = (i) => 'abcde'[i % C] + (R - Math.floor(i / C));
export const rot = (i) => CELLS - 1 - i;

// Squares each tower shades with the sun at place `sun`: shade[t] is a list of cells.
export function shades(towers, sun) {
  const dr = -SUN_DR[sun], dc = -SUN_DC[sun];
  return towers.map((cell, t) => {
    const out = [];
    for (let k = 1; k <= HEIGHTS[t]; k++) {
      const r = Math.floor(cell / C) + dr * k, c = (cell % C) + dc * k;
      if (r < 0 || r >= R || c < 0 || c >= C) break;
      out.push(r * C + c);
    }
    return out;
  });
}
export function shadeMask(towers, sun) {
  let m = 0;
  for (const list of shades(towers, sun)) for (const i of list) m |= 1 << i;
  return m;
}
// towers (indices 0..3) that stand in shade right now
export function frozen(s) {
  const m = shadeMask(s.towers, s.sun);
  return s.towers.map((cell) => ((m >> cell) & 1) === 1);
}

export function initialState(first = MINT) {
  const s = { towers: START.towers.slice(), sun: START.sun, turn: first, winner: null, reason: null, draw: false, ply: 0, history: new Map(), last: null, first };
  s.history.set(positionKey(s), 1);
  return s;
}

export function positionKey(s) { return s.towers.join(',') + '|' + s.sun + '|' + s.turn; }
// the solver's state index: ((sum cell[t] * 25^t) * 8 + sun) * 2 + side
export function hashKey(s) {
  let p = 0;
  for (let t = 3; t >= 0; t--) p = p * CELLS + s.towers[t];
  return (p * 8 + s.sun) * 2 + s.turn;
}

// Moves for the side to move, in the solver's order: its short tower, then its tall tower, each
// N E S W. A move is { t: tower index, from, to }.
export function legalMoves(s) {
  const fz = frozen(s);
  let occ = 0;
  for (const c of s.towers) occ |= 1 << c;
  const out = [];
  for (let t = s.turn * 2; t < s.turn * 2 + 2; t++) {
    if (fz[t]) continue;
    const from = s.towers[t];
    for (let d = 0; d < 4; d++) {
      const r = Math.floor(from / C) + DR[d], c = (from % C) + DC[d];
      if (r < 0 || r >= R || c < 0 || c >= C) continue;
      const to = r * C + c;
      if ((occ >> to) & 1) continue;
      out.push({ t, from, to });
    }
  }
  return out;
}

// Apply a move without history bookkeeping. Reaching the target wins; leaving the other side
// with no move also wins.
export function step(s, m) {
  const A = s.turn, B = 1 - A;
  const towers = s.towers.slice();
  towers[m.t] = m.to;
  const n = { towers, sun: (s.sun + 1) % 8, turn: B, winner: null, reason: null };
  if (m.to === TARGET[A]) { n.winner = A; n.reason = 'target'; }
  else if (!legalMoves(n).length) { n.winner = A; n.reason = 'stuck'; }
  return n;
}

export function applyMove(s, m) {
  const n = step(s, m);
  n.draw = false;
  n.ply = s.ply + 1;
  n.history = new Map(s.history);
  n.last = { ...m, side: s.turn };
  n.first = s.first;
  if (n.winner !== null) return n;
  const key = positionKey(n);
  const c = (n.history.get(key) || 0) + 1;
  n.history.set(key, c);
  if (c >= 3) n.draw = true;
  return n;
}

export function makesDraw(s, m) {
  const n = step(s, m);
  if (n.winner !== null) return false;
  return (s.history.get(positionKey(n)) || 0) >= 2;
}
export const repeatCount = (s) => s.history.get(positionKey(s)) || 0;
export const moveText = (m) => cellName(m.from) + '-' + cellName(m.to);
export const sameMove = (a, b) => a.t === b.t && a.to === b.to;

// Leaf count to a fixed depth; a finished game counts as 1 (same as the C solver).
export function perft(s, d) {
  if (s.winner !== null && s.winner !== undefined) return 1;
  if (d === 0) return 1;
  const ms = legalMoves(s);
  if (!ms.length) return 1;
  let t = 0;
  for (const m of ms) t += perft(step(s, m), d - 1);
  return t;
}
