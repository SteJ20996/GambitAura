// 黑白棋 Reversi rules. Pure functions on a 64-cell Int8Array (-1 empty, 0 black, 1 white).
// Cell index = row * 8 + col; row 0..7 is 1..8, col 0..7 is a..h. Black moves first.
// A side with no legal move passes; the game ends when neither side can move.

export const BLACK = 0;
export const WHITE = 1;
export const N = 8;
const DR = [-1, -1, -1, 0, 0, 1, 1, 1];
const DC = [-1, 0, 1, -1, 1, -1, 0, 1];

export const cellName = (i) => 'abcdefgh'[i % 8] + (Math.floor(i / 8) + 1);

export function initialBoard() {
  const b = new Int8Array(64).fill(-1);
  b[27] = WHITE; b[28] = BLACK; b[35] = BLACK; b[36] = WHITE;   // d4 e4 / d5 e5
  return b;
}

// Discs that playing `side` at `i` would flip (empty array if illegal).
export function flipsFor(b, side, i) {
  if (b[i] !== -1) return [];
  const out = [];
  const r0 = i >> 3, c0 = i & 7, opp = 1 - side;
  for (let d = 0; d < 8; d++) {
    let r = r0 + DR[d], c = c0 + DC[d];
    const run = [];
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === opp) {
      run.push(r * 8 + c);
      r += DR[d]; c += DC[d];
    }
    if (run.length && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === side) out.push(...run);
  }
  return out;
}

export function legalMoves(b, side) {
  const out = [];
  for (let i = 0; i < 64; i++) if (b[i] === -1 && flipsFor(b, side, i).length) out.push(i);
  return out;
}

export function count(b) {
  let k = 0, w = 0;
  for (let i = 0; i < 64; i++) { if (b[i] === BLACK) k++; else if (b[i] === WHITE) w++; }
  return [k, w];
}

export function initialState() {
  return { board: initialBoard(), turn: BLACK, over: false, winner: null, last: null, ply: 0 };
}

// Play `i` for the side to move. Returns the next state; a forced pass for the
// following side is applied at once and reported as `passed`.
export function play(s, i) {
  const fl = flipsFor(s.board, s.turn, i);
  if (!fl.length) throw new Error('illegal move');
  const b = s.board.slice();
  b[i] = s.turn;
  for (const f of fl) b[f] = s.turn;
  let turn = 1 - s.turn, passed = false, over = false;
  if (!legalMoves(b, turn).length) {
    if (legalMoves(b, 1 - turn).length) { passed = true; turn = 1 - turn; }
    else over = true;
  }
  let winner = null;
  if (over) {
    const [k, w] = count(b);
    winner = k > w ? BLACK : w > k ? WHITE : -1;   // -1 = draw
  }
  return { board: b, turn, over, winner, last: i, flipped: fl, passed, ply: s.ply + 1 };
}

// Leaf count to a fixed depth, a pass counting as one move (standard Othello perft).
export function perft(b, side, d, passedBefore = false) {
  if (d === 0) return 1;
  const ms = legalMoves(b, side);
  if (!ms.length) {
    if (passedBefore) return 1;          // game over
    return perft(b, 1 - side, d - 1, true);
  }
  let t = 0;
  for (const m of ms) {
    const nb = b.slice();
    nb[m] = side;
    for (const f of flipsFor(b, side, m)) nb[f] = side;
    t += perft(nb, 1 - side, d - 1, false);
  }
  return t;
}
