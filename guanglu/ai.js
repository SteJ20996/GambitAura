// Computer player for 光路 Guanglu. Deterministic: iterative-deepening alpha-beta with a node
// budget (not a clock), so the same position always gets the same reply on any device.
import { legalMoves, step, hashKey, positionKey, beams, PORTS, R, C } from './engine.js';

const WIN = 100000;
const INF = 1e9;

export const LEVELS = {
  easy: { maxDepth: 1, budget: Infinity },
  normal: { maxDepth: 2, budget: Infinity },
  hard: { maxDepth: 40, budget: 80000 },
};

// Distance between two ports going round the rim (0 = the same port).
const rimPos = (p) => {
  if (p < C) return p;                                   // top, left to right
  if (p < C + R) return C + (p - C);                     // right, top to bottom
  if (p < 2 * C + R) return C + R + (C - 1 - (p - C - R)); // bottom, right to left
  return 2 * C + R + (R - 1 - (p - 2 * C - R));          // left, bottom to top
};
const rimDist = (a, b) => { const d = Math.abs(rimPos(a) - rimPos(b)); return Math.min(d, PORTS - d); };

// Winning flips for `side` if it were to move now (ignoring the ban, which only removes one).
function threats(s, side) {
  const t = { ...s, turn: side, ban: side === s.turn ? s.ban : null };
  let n = 0;
  for (const m of legalMoves(t)) if (m.t === 'flip' && step(t, m).winner === side) n++;
  return n;
}

// Score for the side to move.
export function evaluate(s, ply = 0) {
  const A = s.turn, B = 1 - A;
  if (threats(s, A)) return WIN - ply - 1;
  const tb = threats(s, B);
  const bm = beams(s.cfg, s.design);
  const da = rimDist(bm[A].exit, s.design.tgt[A]), db = rimDist(bm[B].exit, s.design.tgt[B]);
  // shared mirrors are where a side can touch the other beam
  return 12 * (db - da) - 60 * tb + 10;
}

export const sameMove = (a, b) => a.t === b.t && (a.t === 'pass' || a.i === b.i);

function orderScore(s, m, ttMove) {
  if (ttMove && sameMove(m, ttMove)) return 1e6;
  const n = step(s, m);
  if (n.winner === s.turn) return 5e5;
  if (n.winner !== null) return -5e5;
  const bm = beams(n.cfg, n.design);
  return -rimDist(bm[s.turn].exit, n.design.tgt[s.turn]) + rimDist(bm[1 - s.turn].exit, n.design.tgt[1 - s.turn]);
}

export function search(rootState, level = 'hard', history = null) {
  const cfg = LEVELS[level] || LEVELS.hard;
  const tt = new Map();
  let nodes = 0;
  let aborted = false;
  // positions already seen twice in the game count as draws if reached again
  const hot = new Set();
  if (history) for (const [k, c] of history) if (c >= 2) hot.add(k);
  const path = [];

  function child(s, m, depth, alpha, beta, ply) {
    const n = step(s, m);
    if (n.winner === s.turn) return WIN - ply - 1;
    if (n.winner !== null) return -(WIN - ply - 1);
    if (hot.size && hot.has(positionKey(n))) return 0;
    return -negamax(n, depth - 1, -beta, -alpha, ply + 1);
  }

  function negamax(s, depth, alpha, beta, ply) {
    nodes++;
    if (nodes > cfg.budget) { aborted = true; return 0; }
    const key = hashKey(s);
    if (path.includes(key)) return 0;
    if (depth <= 0) return evaluate(s, ply);
    const alpha0 = alpha;
    const ent = tt.get(key);
    let ttMove = null;
    if (ent) {
      ttMove = ent.move;
      if (ent.depth >= depth) {
        if (ent.flag === 0) return ent.score;
        if (ent.flag === 1 && ent.score >= beta) return ent.score;
        if (ent.flag === 2 && ent.score <= alpha) return ent.score;
      }
    }
    const keyed = legalMoves(s).map((m) => [orderScore(s, m, ttMove), m]).sort((x, y) => y[0] - x[0]);
    let best = -INF, bestMove = keyed[0][1];
    path.push(key);
    for (const [, m] of keyed) {
      const sc = child(s, m, depth, alpha, beta, ply);
      if (aborted) { path.pop(); return 0; }
      if (sc > best) { best = sc; bestMove = m; }
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) break;
    }
    path.pop();
    tt.set(key, { depth, score: best, flag: best <= alpha0 ? 2 : best >= beta ? 1 : 0, move: bestMove });
    return best;
  }

  const rootMoves = legalMoves(rootState);
  for (const m of rootMoves) if (step(rootState, m).winner === rootState.turn) return { move: m, score: WIN, depth: 0, nodes: 0 };
  if (rootMoves.length === 1) return { move: rootMoves[0], score: 0, depth: 0, nodes: 0 };

  let bestMove = rootMoves[0], bestScore = 0, reached = 0;
  const rootKey = hashKey(rootState);
  for (let depth = 1; depth <= cfg.maxDepth; depth++) {
    let alpha = -INF, curBest = null, curScore = -INF;
    const ent = tt.get(rootKey);
    const ttMove = ent ? ent.move : bestMove;
    const ordered = rootMoves.map((m) => [orderScore(rootState, m, ttMove), m]).sort((x, y) => y[0] - x[0]);
    path.length = 0;
    path.push(rootKey);
    for (const [, m] of ordered) {
      const sc = child(rootState, m, depth, alpha, INF, 0);
      if (aborted) break;
      if (sc > curScore) { curScore = sc; curBest = m; }
      if (sc > alpha) alpha = sc;
    }
    if (aborted) break;
    bestMove = curBest; bestScore = curScore; reached = depth;
    tt.set(rootKey, { depth, score: curScore, flag: 0, move: curBest });
    if (Math.abs(curScore) > WIN - 1000) break;   // forced result found
  }
  return { move: bestMove, score: bestScore, depth: reached, nodes };
}
