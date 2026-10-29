// Computer player for 黑白棋 Reversi. Deterministic: alpha-beta with a node budget
// (no clock, no randomness) and an exact endgame search when few squares are left.
import { legalMoves } from './engine.js';

export const LEVELS = {
  easy: { depth: 1, budget: Infinity, exact: 0 },
  normal: { depth: 3, budget: Infinity, exact: 8 },
  hard: { depth: 14, budget: 120000, exact: 11 },
};

// Square values: corners are gold, the squares next to an empty corner are traps.
const W0 = [
  120, -22, 18, 6, 6, 18, -22, 120,
  -22, -42, -4, -4, -4, -4, -42, -22,
  18, -4, 14, 3, 3, 14, -4, 18,
  6, -4, 3, 2, 2, 3, -4, 6,
  6, -4, 3, 2, 2, 3, -4, 6,
  18, -4, 14, 3, 3, 14, -4, 18,
  -22, -42, -4, -4, -4, -4, -42, -22,
  120, -22, 18, 6, 6, 18, -22, 120,
];
const CORNERS = [[0, 1, 8, 9], [7, 6, 15, 14], [56, 57, 48, 49], [63, 62, 55, 54]];
const DR = [-1, -1, -1, 0, 0, 1, 1, 1];
const DC = [-1, 0, 1, -1, 1, -1, 0, 1];
const ORDER = [...Array(64).keys()].sort((a, b) => W0[b] - W0[a] || a - b);

function weights(b) {
  const w = W0.slice();
  for (const [c, a1, a2, x] of CORNERS) if (b[c] !== -1) { w[a1] = 8; w[a2] = 8; w[x] = 4; }
  return w;
}

// Apply a move in place; returns the flipped squares so it can be undone.
function make(b, side, i) {
  const r0 = i >> 3, c0 = i & 7, opp = 1 - side, flipped = [];
  for (let d = 0; d < 8; d++) {
    let r = r0 + DR[d], c = c0 + DC[d], n = 0;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === opp) { r += DR[d]; c += DC[d]; n++; }
    if (n && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === side) {
      let rr = r0 + DR[d], cc = c0 + DC[d];
      for (let k = 0; k < n; k++) { const j = rr * 8 + cc; b[j] = side; flipped.push(j); rr += DR[d]; cc += DC[d]; }
    }
  }
  b[i] = side;
  return flipped;
}
function unmake(b, side, i, flipped) {
  b[i] = -1;
  for (const j of flipped) b[j] = 1 - side;
}

function canMove(b, side, i) {
  if (b[i] !== -1) return false;
  const r0 = i >> 3, c0 = i & 7, opp = 1 - side;
  for (let d = 0; d < 8; d++) {
    let r = r0 + DR[d], c = c0 + DC[d], n = 0;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === opp) { r += DR[d]; c += DC[d]; n++; }
    if (n && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === side) return true;
  }
  return false;
}
function moves(b, side) {
  const out = [];
  for (const i of ORDER) if (canMove(b, side, i)) out.push(i);
  return out;
}

function discDiff(b, side) {
  let d = 0;
  for (let i = 0; i < 64; i++) if (b[i] === side) d++; else if (b[i] === 1 - side) d--;
  return d;
}

function evaluate(b, side) {
  const w = weights(b);
  let pos = 0;
  for (let i = 0; i < 64; i++) if (b[i] === side) pos += w[i]; else if (b[i] === 1 - side) pos -= w[i];
  const mob = moves(b, side).length - moves(b, 1 - side).length;
  return pos + 9 * mob;
}

const WIN = 100000;

export function search(board, side, level = 'hard') {
  const cfg = LEVELS[level] || LEVELS.hard;
  const b = Int8Array.from(board);
  let empties = 0;
  for (let i = 0; i < 64; i++) if (b[i] === -1) empties++;
  let nodes = 0, aborted = false;
  const exact = empties <= cfg.exact;

  function negamax(s, depth, alpha, beta, passed) {
    nodes++;
    if (!exact && nodes > cfg.budget) { aborted = true; return 0; }
    const ms = moves(b, s);
    if (!ms.length) {
      if (passed) { const d = discDiff(b, s); return d > 0 ? WIN + d : d < 0 ? -WIN + d : 0; }
      return -negamax(1 - s, depth, -beta, -alpha, true);
    }
    if (depth <= 0) return evaluate(b, s);
    let best = -Infinity;
    for (const m of ms) {
      const f = make(b, s, m);
      const v = -negamax(1 - s, depth - 1, -beta, -alpha, false);
      unmake(b, s, m, f);
      if (aborted) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }

  const root = moves(b, side);
  if (!root.length) return { move: null, score: 0, depth: 0, nodes: 0 };
  if (root.length === 1) return { move: root[0], score: 0, depth: 0, nodes: 0 };

  let bestMove = root[0], bestScore = 0, reached = 0;
  const maxDepth = exact ? empties : cfg.depth;
  const startDepth = exact ? empties : 1;
  let order = root.slice();
  for (let depth = startDepth; depth <= maxDepth; depth++) {
    let alpha = -Infinity, curBest = order[0], curScore = -Infinity;
    const scored = [];
    for (const m of order) {
      const f = make(b, side, m);
      const v = -negamax(1 - side, depth - 1, -Infinity, -alpha, false);
      unmake(b, side, m, f);
      if (aborted) break;
      scored.push([m, v]);
      if (v > curScore) { curScore = v; curBest = m; }
      if (v > alpha) alpha = v;
    }
    if (aborted) break;
    bestMove = curBest; bestScore = curScore; reached = depth;
    // search the best move first next time
    order = [curBest, ...order.filter((m) => m !== curBest)];
    if (Math.abs(curScore) >= WIN) break;
  }
  return { move: bestMove, score: bestScore, depth: reached, nodes, exact };
}

export { legalMoves };
