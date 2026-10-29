// Computer player for 轉環 Zhuanhuan. Deterministic: iterative-deepening alpha-beta with a node
// budget (not a clock), so the same position always gets the same reply on any device.
import { legalMoves, step, hashKey, positionKey, RINGS } from './engine.js';

const WIN = 100000;
const INF = 1e9;

export const LEVELS = {
  easy: { maxDepth: 1, budget: Infinity },
  normal: { maxDepth: 3, budget: Infinity },
  hard: { maxDepth: 40, budget: 200000 },
};

const popcount = (x) => { let c = 0; for (; x; x &= x - 1) c++; return c; };
const spotsOf = (m) => { const out = []; for (let x = m; x; x &= x - 1) out.push(31 - Math.clz32(x & -x)); return out; };
const ringDist = (a, b) => { const d = Math.abs((a % 8) - (b % 8)); return d > 4 ? 8 - d : d; };

// Winning moves for `side` if it were to move now (ignoring the ban, which only ever removes one).
function winsFor(s, side) {
  const t = { masks: s.masks, turn: side, ban: side === s.turn ? s.ban : null };
  let n = 0;
  for (const m of legalMoves(t)) if (step(t, m).winner === side) n++;
  return n;
}

// How close a side's pieces are to a line: pairs on one spoke or near it, pairs close on a ring.
const SAME_RING = [0, 12, 6, 2, 0];
const CROSS_RING = [12, 6, 2, 0, 0];
function shape(m) {
  const p = spotsOf(m);
  let v = 0;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
    const d = ringDist(p[i], p[j]);
    v += (p[i] >> 3) === (p[j] >> 3) ? SAME_RING[d] : CROSS_RING[d];
  }
  // one piece per ring keeps every spoke line open
  let rings = 0;
  for (let r = 0; r < RINGS; r++) if ((m >> (8 * r)) & 0xff) rings++;
  return v + 4 * rings;
}

// Score for the side to move.
export function evaluate(s, ply = 0) {
  const A = s.turn, B = 1 - A;
  if (winsFor(s, A)) return WIN - ply - 1;
  const tb = winsFor(s, B);
  return shape(s.masks[A]) - shape(s.masks[B]) - 40 * tb + 8;
}

const sameMove = (a, b) =>
  a.t === b.t && (a.t === 'turn' ? a.ring === b.ring && a.dir === b.dir : a.from === b.from && a.to === b.to);

function orderScore(s, m, ttMove) {
  if (ttMove && sameMove(m, ttMove)) return 1e6;
  const n = step(s, m);
  if (n.winner === s.turn) return 5e5;
  if (n.winner !== null) return -5e5;
  return shape(n.masks[s.turn]) - shape(n.masks[1 - s.turn]);
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

  // value of a child for the side that moved into it
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
    const moves = legalMoves(s);
    const keyed = moves.map((m) => [orderScore(s, m, ttMove), m]).sort((x, y) => y[0] - x[0]);
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
    const flag = best <= alpha0 ? 2 : best >= beta ? 1 : 0;
    tt.set(key, { depth, score: best, flag, move: bestMove });
    return best;
  }

  const rootMoves = legalMoves(rootState);
  for (const m of rootMoves) if (step(rootState, m).winner === rootState.turn) return { move: m, score: WIN, depth: 0, nodes: 0 };

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

void popcount;
