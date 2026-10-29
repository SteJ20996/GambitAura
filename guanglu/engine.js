// 光路 Guanglu rules engine. Pure functions, no DOM; runs in the browser, in a Web Worker and in
// Node. The board is R x C cells, cell = row * C + col, row 0 at the top. Every cell holds a
// two-sided mirror: bit 0 is '/', bit 1 is '\'. A configuration is an R*C-bit number.
// Ports are the openings on the rim: top 0..C-1, right C..C+R-1, bottom C+R..2C+R-1 (left to
// right) and left 2C+R..2C+2R-1 (top to bottom). A beam enters at its source port, turns 90
// degrees in every cell, and leaves at some port. Mint (side 0) moves first; Coral's source and
// target are Mint's turned half way round.

export const R = 4;
export const C = 5;
export const CELLS = R * C;
export const MINT = 0;
export const CORAL = 1;
export const PORTS = 2 * (R + C);

// The chosen design (see analysis/): sources, targets and the starting mirrors.
// Mint's light enters at the middle of the bottom edge (under c1, port 11) and must leave through the
// lowest opening of the left wall (port 17); Coral's is the same turned half way round: in at the
// middle of the top (above c4, port 2), out through the highest opening of the right wall (port 5).
// Start: every mirror '/', except '\' on d3 e3 and a2 b2 (bits 8, 9, 10, 11), a half-turn symmetric layout.
export const DESIGN = { src: [11, 2], tgt: [17, 5], start: 3840 };

const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];          // N E S W
const REFL = [[1, 0, 3, 2], [3, 2, 1, 0]];               // '/', '\'

export function rotPort(p) {
  if (p < C) return C + R + (C - 1 - p);
  if (p < C + R) return 2 * C + R + (R - 1 - (p - C));
  if (p < 2 * C + R) return C - 1 - (p - C - R);
  return C + (R - 1 - (p - 2 * C - R));
}
export function portSide(p) { return p < C ? 'top' : p < C + R ? 'right' : p < 2 * C + R ? 'bottom' : 'left'; }
export function portIndex(p) { return p < C ? p : p < C + R ? p - C : p < 2 * C + R ? p - C - R : p - 2 * C - R; }
export const cellName = (i) => 'abcdefghij'[i % C] + (R - Math.floor(i / C));

// Follow a beam from a port. Returns the exit port and the cells it passes, in order, with the
// direction it enters and leaves each one (for drawing).
export function trace(cfg, port) {
  let r, c, d;
  if (port < C) { r = 0; c = port; d = 2; }
  else if (port < C + R) { r = port - C; c = C - 1; d = 3; }
  else if (port < 2 * C + R) { r = R - 1; c = port - C - R; d = 0; }
  else { r = port - 2 * C - R; c = 0; d = 1; }
  const steps = [];
  let mask = 0;
  for (let n = 0; n < 4 * CELLS + 4; n++) {
    const i = r * C + c, din = d;
    d = REFL[(cfg >> i) & 1][d];
    steps.push({ i, din, dout: d });
    mask |= 1 << i;
    r += DR[d]; c += DC[d];
    let exit = -1;
    if (r < 0) exit = c; else if (c >= C) exit = C + r; else if (r >= R) exit = C + R + c; else if (c < 0) exit = 2 * C + R + r;
    if (exit >= 0) return { exit, steps, mask };
  }
  throw new Error('beam loop');   // never: a beam from the rim always leaves again
}

export function beams(cfg, design = DESIGN) {
  return [0, 1].map((side) => {
    const t = trace(cfg, design.src[side]);
    return { ...t, hit: t.exit === design.tgt[side] };
  });
}

export function initialState(first = MINT, design = DESIGN) {
  const s = { cfg: design.start, turn: first, ban: null, winner: null, draw: false, ply: 0, history: new Map(), last: null, first, design };
  s.history.set(positionKey(s), 1);
  return s;
}

export function positionKey(s) { return s.cfg + ',' + s.turn + ',' + (s.ban === null ? '-' : s.ban); }
export function hashKey(s) { return (s.cfg * 2 + s.turn) * 32 + (s.ban === null ? 31 : s.ban); }

// A turn flips one mirror that a beam (either one) passes through, except the mirror the other
// side flipped on the move just played. With no such mirror the side passes.
export function legalMoves(s) {
  const [a, b] = beams(s.cfg, s.design);
  const m = (a.mask | b.mask) & ~(s.ban === null ? 0 : 1 << s.ban);
  const out = [];
  for (let i = 0; i < CELLS; i++) if ((m >> i) & 1) out.push({ t: 'flip', i });
  if (!out.length) out.push({ t: 'pass' });
  return out;
}

// Apply a move without history bookkeeping. If the mover's beam reaches its target the mover
// wins; otherwise, if only the other beam reaches its target, the other side wins.
export function step(s, m) {
  const A = s.turn, B = 1 - A;
  const cfg = m.t === 'flip' ? s.cfg ^ (1 << m.i) : s.cfg;
  const bm = beams(cfg, s.design);
  let winner = null;
  if (bm[A].hit) winner = A; else if (bm[B].hit) winner = B;
  return { cfg, turn: B, ban: m.t === 'flip' ? m.i : null, winner, design: s.design };
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
export const moveText = (m) => (m.t === 'flip' ? cellName(m.i) : 'pass');

// Leaf count to a fixed depth; a won position counts as 1 (same as the C solver).
export function perft(s, d) {
  if (s.winner !== null && s.winner !== undefined) return 1;
  if (d === 0) return 1;
  let t = 0;
  for (const m of legalMoves(s)) t += perft(step(s, m), d - 1);
  return t;
}
