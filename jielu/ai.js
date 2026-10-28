// Computer player for Jielu. Deterministic: iterative-deepening alpha-beta
// with a node budget (not a clock), so the same position always gets the
// same reply on any device.
import { legalMoves, step, hashKey, NB, GOAL, OPP_GOAL } from './engine.js';

const WIN = 100000;
const INF = 1e9;
const ALL = (1 << 25) - 1;

export const LEVELS = {
  easy: { maxDepth: 1, budget: Infinity },
  normal: { maxDepth: 3, budget: Infinity },
  hard: { maxDepth: 40, budget: 250000 },
};

// Weighted distance from every cell to `side`'s flag. Entering a hole costs 2
// (one turn to fill it, one to step in), an enemy piece 3, a friendly piece 2.
function distField(s, side) {
  const goal = GOAL[side], opp = OPP_GOAL[side];
  const own = s.pieces[side], foe = s.pieces[1 - side];
  const cost = new Int8Array(25);
  for (let c = 0; c < 25; c++) {
    if (c === opp) cost[c] = 0;
    else if ((s.holes >> c) & 1) cost[c] = 2;
    else cost[c] = 1;
  }
  cost[foe[0]] = 3; cost[foe[1]] = 3;
  cost[own[0]] = 2; cost[own[1]] = 2;
  cost[goal] = 1;
  const d = new Int16Array(25).fill(99);
  const done = new Uint8Array(25);
  d[goal] = 0;
  for (let it = 0; it < 25; it++) {
    let u = -1, best = 99;
    for (let c = 0; c < 25; c++) if (!done[c] && d[c] < best) { best = d[c]; u = c; }
    if (u < 0) break;
    done[u] = 1;
    // a piece on v reaches the flag by stepping into u first, paying u's cost
    const nd = d[u] + cost[u];
    for (const v of NB[u]) {
      if (v === opp || done[v]) continue;
      if (nd < d[v]) d[v] = nd;
    }
  }
  return d;
}

function sideDist(s, side) {
  const d = distField(s, side);
  const a = d[s.pieces[side][0]], b = d[s.pieces[side][1]];
  return a < b ? [a, b] : [b, a];
}

const nextToGoal = (s, side) =>
  NB[GOAL[side]].includes(s.pieces[side][0]) || NB[GOAL[side]].includes(s.pieces[side][1]);

// Score for the side to move.
export function evaluate(s, ply = 0) {
  const A = s.turn, B = 1 - A;
  if (nextToGoal(s, A)) return WIN - ply - 1;
  if (nextToGoal(s, B)) return -(WIN - ply - 2);
  const [a1, a2] = sideDist(s, A);
  const [b1, b2] = sideDist(s, B);
  return 100 * (b1 - a1) + 15 * (b2 - a2) + 40;
}

function orderScore(s, m, ttMove) {
  if (m.win) return 1e6;
  if (ttMove && sameMove(m, ttMove)) return 5e5;
  if (m.t === 'walk') {
    const g = GOAL[s.turn];
    const before = Math.abs(Math.floor(m.from / 5) - Math.floor(g / 5)) + Math.abs((m.from % 5) - (g % 5));
    const after = Math.abs(Math.floor(m.to / 5) - Math.floor(g / 5)) + Math.abs((m.to % 5) - (g % 5));
    return 100 + (before - after) * 10;
  }
  return 50;
}

export const sameMove = (a, b) =>
  a.t === b.t && (a.t === 'pass' || (a.t === 'walk' ? a.from === b.from && a.to === b.to : a.src === b.src && a.dst === b.dst));

export function search(rootState, level = 'hard', history = null) {
  const cfg = LEVELS[level] || LEVELS.hard;
  const tt = new Map();
  let nodes = 0;
  let aborted = false;
  // positions already seen twice in the game count as draws if reached again
  const hot = new Set();
  if (history) for (const [k, c] of history) if (c >= 2) hot.add(k);
  const path = [];

  function negamax(s, depth, alpha, beta, ply) {
    nodes++;
    if (nodes > cfg.budget) { aborted = true; return 0; }
    const moves = legalMoves(s);
    for (const m of moves) if (m.win) return WIN - ply;
    const key = hashKey(s);
    if (ply > 0 && path.includes(key)) return 0;
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
    moves.sort((x, y) => orderScore(s, y, ttMove) - orderScore(s, x, ttMove));
    let best = -INF, bestMove = moves[0];
    path.push(key);
    for (const m of moves) {
      const n = step(s, m);
      let sc;
      if (hot.has(posKeyLite(n))) sc = 0;
      else sc = -negamax(n, depth - 1, -beta, -alpha, ply + 1);
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
  const win = rootMoves.find((m) => m.win);
  if (win) return { move: win, score: WIN, depth: 0, nodes: 0 };
  if (rootMoves.length === 1) return { move: rootMoves[0], score: 0, depth: 0, nodes: 0 };

  let bestMove = rootMoves[0], bestScore = 0, reached = 0;
  for (let depth = 1; depth <= cfg.maxDepth; depth++) {
    let alpha = -INF, beta = INF, curBest = null, curScore = -INF;
    const ent = tt.get(hashKey(rootState));
    const ttMove = ent ? ent.move : bestMove;
    const ordered = rootMoves.slice().sort((x, y) => orderScore(rootState, y, ttMove) - orderScore(rootState, x, ttMove));
    path.length = 0;
    path.push(hashKey(rootState));
    for (const m of ordered) {
      const n = step(rootState, m);
      const sc = hot.has(posKeyLite(n)) ? 0 : -negamax(n, depth - 1, -beta, -alpha, 1);
      if (aborted) break;
      if (sc > curScore) { curScore = sc; curBest = m; }
      if (sc > alpha) alpha = sc;
    }
    if (aborted) break;
    bestMove = curBest; bestScore = curScore; reached = depth;
    tt.set(hashKey(rootState), { depth, score: curScore, flag: 0, move: curBest });
    if (Math.abs(curScore) > WIN - 1000) break;   // forced result found
  }
  return { move: bestMove, score: bestScore, depth: reached, nodes };
}

// Same text key the engine uses for repetition counting.
function posKeyLite(s) {
  let b = null;
  if (s.ban) {
    for (const p of s.pieces[s.turn]) {
      if (NB[p].includes(s.ban.src) && NB[p].includes(s.ban.dst)) { b = s.ban; break; }
    }
  }
  return s.holes.toString(36) + '|' + s.pieces[0].join(',') + '|' + s.pieces[1].join(',') +
    '|' + s.turn + '|' + (b ? b.src + '>' + b.dst : '-');
}

void ALL;
