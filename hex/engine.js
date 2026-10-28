// 六角連線 Hex rules. Pure functions on an n×n rhombus of hexagons, n in 7, 9, 11.
// Cell index = row * n + col; row 0..n-1 is 1..n, col 0..n-1 is a..k.
// Each row sits half a cell to the right of the row above, so the neighbours of
// (r, c) are (r-1, c) (r-1, c+1) (r, c-1) (r, c+1) (r+1, c-1) (r+1, c).
// Jade (0) joins the top and bottom rows; Agate (1) joins the left and right columns.
// Jade moves first. Swap rule (modern form): on Agate's first turn only, Agate may
// take Jade's first stone instead of placing one. The stone is reflected across the
// long diagonal, (r, c) -> (c, r), turns Agate, and Jade moves again.
// A full board always has exactly one winner, so there is no draw.

export const JADE = 0;
export const AGATE = 1;
export const SIZES = [7, 9, 11];
export const FILES = 'abcdefghijk';

export const cellName = (n, i) => FILES[i % n] + (Math.floor(i / n) + 1);
export const reflect = (n, i) => (i % n) * n + Math.floor(i / n);

const NB_CACHE = new Map();
// Neighbour lists for an n×n board (cached; shared with the computer player).
export function neighbours(n) {
  let nb = NB_CACHE.get(n);
  if (nb) return nb;
  nb = [];
  const DR = [-1, -1, 0, 0, 1, 1], DC = [0, 1, -1, 1, -1, 0];
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n), c = i % n, list = [];
    for (let d = 0; d < 6; d++) {
      const rr = r + DR[d], cc = c + DC[d];
      if (rr >= 0 && rr < n && cc >= 0 && cc < n) list.push(rr * n + cc);
    }
    nb.push(list);
  }
  NB_CACHE.set(n, nb);
  return nb;
}

// Is cell i on side's start edge (top for Jade, left for Agate) or end edge?
export const onStart = (n, side, i) => (side === JADE ? Math.floor(i / n) === 0 : i % n === 0);
export const onEnd = (n, side, i) => (side === JADE ? Math.floor(i / n) === n - 1 : i % n === n - 1);

export function initialState(n = 9) {
  return { n, board: new Int8Array(n * n).fill(-1), turn: JADE, ply: 0, moves: [], last: null, winner: null, chain: null };
}

export const canSwap = (s) => s.winner === null && s.moves.length === 1 && s.moves[0].t === 'place';

export function emptyCells(board) {
  const out = [];
  for (let i = 0; i < board.length; i++) if (board[i] === -1) out.push(i);
  return out;
}

// Does side join its two edges on this board (empty cells allowed elsewhere)?
export function connected(board, n, side) {
  const nb = neighbours(n);
  const seen = new Uint8Array(n * n);
  const stack = [];
  for (let k = 0; k < n; k++) {
    const i = side === JADE ? k : k * n;
    if (board[i] === side) { seen[i] = 1; stack.push(i); }
  }
  while (stack.length) {
    const i = stack.pop();
    if (onEnd(n, side, i)) return true;
    for (const j of nb[i]) if (!seen[j] && board[j] === side) { seen[j] = 1; stack.push(j); }
  }
  return false;
}

// Does the group through cell i touch both of its owner's edges?
export function winsAt(board, n, i) {
  const side = board[i];
  if (side < 0) return false;
  const nb = neighbours(n);
  const seen = new Uint8Array(n * n);
  const stack = [i];
  seen[i] = 1;
  let a = false, b = false;
  while (stack.length) {
    const x = stack.pop();
    if (onStart(n, side, x)) a = true;
    if (onEnd(n, side, x)) b = true;
    if (a && b) return true;
    for (const j of nb[x]) if (!seen[j] && board[j] === side) { seen[j] = 1; stack.push(j); }
  }
  return false;
}

// The shortest chain of side's stones from its start edge to its end edge, or null.
// Breadth-first from every start-edge stone in index order, so the result is stable.
export function winningChain(board, n, side) {
  const nb = neighbours(n);
  const prev = new Int16Array(n * n).fill(-2);
  const queue = [];
  for (let k = 0; k < n; k++) {
    const i = side === JADE ? k : k * n;
    if (board[i] === side) { prev[i] = -1; queue.push(i); }
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    if (onEnd(n, side, i)) {
      const path = [];
      for (let x = i; x !== -1; x = prev[x]) path.push(x);
      return path.reverse();
    }
    for (const j of nb[i]) if (prev[j] === -2 && board[j] === side) { prev[j] = i; queue.push(j); }
  }
  return null;
}

// 0, 1, or null when neither side is joined yet.
export function winnerOf(board, n) {
  if (connected(board, n, JADE)) return JADE;
  if (connected(board, n, AGATE)) return AGATE;
  return null;
}

// Place a stone for the side to move. Returns the next state.
export function place(s, i) {
  if (s.winner !== null) throw new Error('game over');
  if (!(i >= 0 && i < s.n * s.n) || s.board[i] !== -1) throw new Error('illegal move');
  const board = s.board.slice();
  board[i] = s.turn;
  const won = winsAt(board, s.n, i);
  return {
    n: s.n, board, turn: 1 - s.turn, ply: s.ply + 1,
    moves: [...s.moves, { t: 'place', i, side: s.turn }],
    last: i,
    winner: won ? s.turn : null,
    chain: won ? winningChain(board, s.n, s.turn) : null,
  };
}

// Agate takes Jade's first stone: reflected across the long diagonal, it turns Agate.
export function swap(s) {
  if (!canSwap(s)) throw new Error('swap not allowed');
  const from = s.moves[0].i, to = reflect(s.n, from);
  const board = s.board.slice();
  board[from] = -1;
  board[to] = AGATE;
  return {
    n: s.n, board, turn: JADE, ply: s.ply + 1,
    moves: [...s.moves, { t: 'swap', from, to, side: AGATE }],
    last: to, winner: null, chain: null,
  };
}

// Apply { t: 'place', i } or { t: 'swap' }.
export function applyMove(s, m) {
  return m.t === 'swap' ? swap(s) : place(s, m.i);
}

// Cells where `side` would join its edges with one more stone.
export function winningCells(board, n, side) {
  const out = [];
  const b = board.slice();
  for (let i = 0; i < b.length; i++) {
    if (b[i] !== -1) continue;
    b[i] = side;
    if (winsAt(b, n, i)) out.push(i);
    b[i] = -1;
  }
  return out;
}
