// 轉環 Zhuanhuan rules engine. Pure functions, no DOM; runs in the browser, in a Web Worker
// and in Node. Spots are numbered ring * 8 + ray: ring 0..2 is the inner, middle and outer ring
// (named 1..3), ray 0..7 is the spoke a..h, with a at the top and the letters going clockwise.
// A side's pieces are a 24-bit mask. Mint (side 0) moves first.

export const MINT = 0;
export const CORAL = 1;
export const RINGS = 3;
export const RAYS = 8;
export const SPOTS = 24;

export const spotName = (s) => 'abcdefgh'[s % 8] + (Math.floor(s / 8) + 1);
export const spotOf = (n) => (n.charCodeAt(1) - 49) * 8 + (n.charCodeAt(0) - 97);
const bit = (s) => 1 << s;
const ringMask = (r) => 0xff << (8 * r);

// Neighbours: along the ring both ways, and along the spoke to the next ring in or out.
export const NB = [];
for (let s = 0; s < SPOTS; s++) {
  const r = Math.floor(s / 8), q = s % 8, n = [r * 8 + (q + 1) % 8, r * 8 + (q + 7) % 8];
  if (r > 0) n.push(s - 8);
  if (r < 2) n.push(s + 8);
  NB.push(n);
}

// The suggested opening: each side's pieces curl outward in a spiral, one per ring,
// and Coral's spiral is Mint's turned half way round. The solver shows it is a draw.
export const OPENING = [['d1', 'e2', 'f3'], ['h1', 'a2', 'b3']];

const rotl = (f, k) => ((f << k) | (f >> (8 - k))) & 0xff;

// Turn ring r one step: dir +1 moves every piece on it one spoke clockwise.
export function turnMask(m, r, dir) {
  const f = (m >> (8 * r)) & 0xff;
  const g = dir > 0 ? rotl(f, 1) : rotl(f, 7);
  return (m & ~ringMask(r) & 0xffffff) | (g << (8 * r));
}

// The spots of a line in mask m (three on one spoke, or three side by side on one ring), or null.
export function lineOf(m) {
  const spoke = m & (m >> 8) & (m >> 16) & 0xff;
  if (spoke) { const q = 31 - Math.clz32(spoke & -spoke); return [q, q + 8, q + 16]; }
  for (let r = 0; r < RINGS; r++) {
    const f = (m >> (8 * r)) & 0xff;
    const a = f & rotl(f, 7) & rotl(f, 6);       // q, q+1, q+2 all present -> bit q
    if (a) { const q = 31 - Math.clz32(a & -a); return [r * 8 + q, r * 8 + (q + 1) % 8, r * 8 + (q + 2) % 8]; }
  }
  return null;
}
export const hasLine = (m) => lineOf(m) !== null;

export function initialState(first = MINT) {
  const masks = [0, 0];
  for (let side = 0; side < 2; side++) for (const n of OPENING[side]) masks[side] |= bit(spotOf(n));
  const s = { masks, turn: first, ban: null, winner: null, line: null, draw: false, ply: 0, history: new Map(), last: null, first };
  s.history.set(positionKey(s), 1);
  return s;
}

// The ban (the ring the other side just turned may not go straight back) only matters when the
// side to move could otherwise make that turn, i.e. has a piece on that ring.
export function effectiveBan(s) {
  if (!s.ban) return null;
  return (s.masks[s.turn] & ringMask(s.ban.ring)) ? s.ban : null;
}

export function positionKey(s) {
  const b = effectiveBan(s);
  return s.masks[0] + ',' + s.masks[1] + ',' + s.turn + ',' + (b ? b.ring * 2 + (b.dir > 0 ? 1 : 0) : '-');
}

// Numeric key (< 2^53) for search tables: 24 + 24 bits of pieces, side, ban.
export function hashKey(s) {
  const b = effectiveBan(s);
  const code = b ? 1 + b.ring * 2 + (b.dir > 0 ? 1 : 0) : 0;
  return ((s.masks[0] * 16777216 + s.masks[1]) * 2 + s.turn) * 8 + code;
}

// All legal moves for the side to move. Turns come first: a ring that carries at least one of
// your pieces, either way, except straight back after the other side turned it.
// There is always a legal move, so the game never needs a pass.
export function legalMoves(s) {
  const A = s.turn, mine = s.masks[A], occ = s.masks[0] | s.masks[1];
  const moves = [];
  for (let r = 0; r < RINGS; r++) {
    if (!(mine & ringMask(r))) continue;
    for (const dir of [1, -1]) {
      if (s.ban && s.ban.ring === r && s.ban.dir === dir) continue;
      moves.push({ t: 'turn', ring: r, dir });
    }
  }
  for (let x = mine; x; x &= x - 1) {
    const p = 31 - Math.clz32(x & -x);
    for (const q of NB[p]) if (!((occ >> q) & 1)) moves.push({ t: 'step', from: p, to: q });
  }
  return moves;
}

// Apply a move without history bookkeeping (used by search). A move that lines up the mover's
// pieces wins, even if it also lines up the other side; one that lines up only the other side's
// pieces hands them the win.
export function step(s, m) {
  const A = s.turn, B = 1 - A;
  const masks = [s.masks[0], s.masks[1]];
  let ban = null;
  if (m.t === 'turn') {
    masks[0] = turnMask(masks[0], m.ring, m.dir);
    masks[1] = turnMask(masks[1], m.ring, m.dir);
    ban = { ring: m.ring, dir: -m.dir };
  } else {
    masks[A] = (masks[A] & ~bit(m.from)) | bit(m.to);
  }
  let winner = null, line = lineOf(masks[A]);
  if (line) winner = A;
  else if ((line = lineOf(masks[B]))) winner = B;
  return { masks, turn: B, ban, winner, line };
}

// Apply a legal move with repetition bookkeeping. Returns a new state.
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

// Would this move make the third repetition?
export function makesDraw(s, m) {
  const n = step(s, m);
  if (n.winner !== null) return false;
  return (s.history.get(positionKey(n)) || 0) >= 2;
}

export function repeatCount(s) { return s.history.get(positionKey(s)) || 0; }

export function moveText(m) {
  if (m.t === 'turn') return 'R' + (m.ring + 1) + (m.dir > 0 ? '↻' : '↺');
  return spotName(m.from) + '→' + spotName(m.to);
}

// Leaf count to a fixed depth; a position that is already won counts as 1 (same as the C solver).
export function perft(s, d) {
  if (s.winner !== null && s.winner !== undefined) return 1;
  if (d === 0) return 1;
  let t = 0;
  for (const m of legalMoves(s)) t += perft(step(s, m), d - 1);
  return t;
}
