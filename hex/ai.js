// Computer player for 六角連線 Hex. Deterministic: Monte Carlo tree search (UCT with
// RAVE / all-moves-as-first statistics) driven by a seeded generator whose seed is a
// hash of the position, and a fixed number of playouts instead of a clock. The same
// position therefore always gets the same reply, on any device.
// A playout fills every empty cell at random, the two sides alternating, and checks
// the full board once: Hex has no draws and stones never leave, so the side joined on
// the full board is the side that would have joined first. One pattern sharpens the
// fill (normal and hard): when a cell lands inside the opponent's bridge, two of its
// stones (or a stone and its edge) joined through two empty cells, the opponent takes
// the other cell next, as any player would. In self-play at equal time this won 18 of
// 24 games against the plain fill.
import { JADE, AGATE, neighbours, winningCells } from './engine.js';

// Playouts per move, tuned for a 9×9 board; other sizes scale by board area so the
// time per move stays about the same. Easy is plain UCT on a small budget and a plain fill.
export const LEVELS = {
  easy: { sims: 300, rave: false, bridges: false, c: 0.9 },
  normal: { sims: 3000, rave: true, bridges: true, c: 0.2 },
  hard: { sims: 42000, rave: true, bridges: true, c: 0.2 },
};

// Jade's first stone when the computer opens: a3, on Agate's edge two cells from the
// sharp corner. It is a classic swap-rule opening, neither too strong nor too weak,
// and the swap test below scores it close to even on every size.
export const OPENINGS = { 7: 'a3', 9: 'a3', 11: 'a3' };

const SWAP_LINE = 0.52;          // see the swap test in chooseMove
const RAVE_B2 = 4 * 0.1 * 0.1;   // 4·b² in β = ñ / (n + ñ + 4b²nñ)
const EXPAND = 3;                // a child becomes a tree node after this many visits

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a over everything that decides the reply.
export function positionHash(board, n, turn, swapOk, level) {
  let h = 0x811c9dc5;
  const mix = (v) => { h ^= v & 0xff; h = Math.imul(h, 0x01000193); };
  mix(n); mix(turn); mix(swapOk ? 1 : 0);
  for (const ch of level) mix(ch.charCodeAt(0));
  for (let i = 0; i < board.length; i++) mix(board[i] + 1);
  return h >>> 0;
}

const parseCell = (n, name) => (Number(name.slice(1)) - 1) * n + (name.charCodeAt(0) - 97);

// Monte Carlo tree search from (board, turn). `roots` limits the first move.
// Returns { best, value, visits } with value = best move's win rate for `turn`.
export function mcts(board0, n, turn0, opts, roots = null) {
  const { sims, rave, bridges, c: C } = opts;
  const N2 = n * n;
  const nb = neighbours(n);
  const rand = mulberry32(opts.seed >>> 0);
  // a light preference for the middle, used only to break early ties
  const mid = (n - 1) / 2;
  const prior = new Float32Array(N2);
  for (let i = 0; i < N2; i++) {
    const r = Math.floor(i / n), q = i % n;
    const dq = q - mid, dr = r - mid;
    const d = (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;   // hex distance
    prior[i] = 0.02 * (1 - d / n);
  }

  // node pool (tree nodes) and child pool (one entry per move from a node)
  let nodeCap = 1024, childCap = 1 << 16;
  let nStart = new Int32Array(nodeCap), nLen = new Int32Array(nodeCap), nTurn = new Int8Array(nodeCap), nVis = new Int32Array(nodeCap);
  let cMove = new Int16Array(childCap), cN = new Int32Array(childCap), cW = new Float32Array(childCap),
    cAN = new Int32Array(childCap), cAW = new Float32Array(childCap), cKid = new Int32Array(childCap);
  let nodes = 0, used = 0;
  const grow = (a, cap) => { const b = new a.constructor(cap); b.set(a); return b; };

  function newNode(board, turn, only) {
    if (nodes === nodeCap) {
      nodeCap *= 2;
      nStart = grow(nStart, nodeCap); nLen = grow(nLen, nodeCap); nTurn = grow(nTurn, nodeCap); nVis = grow(nVis, nodeCap);
    }
    const moves = only || [];
    if (!only) for (let i = 0; i < N2; i++) if (board[i] === -1) moves.push(i);
    if (used + moves.length > childCap) {
      while (used + moves.length > childCap) childCap *= 2;
      cMove = grow(cMove, childCap); cN = grow(cN, childCap); cW = grow(cW, childCap);
      cAN = grow(cAN, childCap); cAW = grow(cAW, childCap); cKid = grow(cKid, childCap);
    }
    const id = nodes++;
    nStart[id] = used; nLen[id] = moves.length; nTurn[id] = turn; nVis[id] = 0;
    for (let k = 0; k < moves.length; k++) {
      const j = used + k;
      cMove[j] = moves[k]; cN[j] = 0; cW[j] = 0; cAN[j] = 0; cAW[j] = 0; cKid[j] = -1;
    }
    used += moves.length;
    return id;
  }

  function select(id) {
    const s = nStart[id], e = s + nLen[id];
    const logV = Math.log(nVis[id] + 1);
    let best = s, bestV = -Infinity;
    for (let j = s; j < e; j++) {
      const v = cN[j], av = cAN[j];
      let q = v ? cW[j] / v : 0.5;
      if (rave && av) {
        const beta = av / (av + v + RAVE_B2 * av * v);
        q = (1 - beta) * q + beta * (cAW[j] / av);
      }
      const score = q + C * Math.sqrt(logV / (v + 1)) + prior[cMove[j]] / (v + 1);
      if (score > bestV) { bestV = score; best = j; }
    }
    return best;
  }

  const board = new Int8Array(N2);
  const empties = new Int16Array(N2);
  const where = new Int16Array(N2);
  // the six neighbours of each cell in clockwise order; off the board: -1 beyond the
  // top or bottom (Jade's edges), -2 beyond the left or right (Agate's), -3 both
  const ring = new Int16Array(N2 * 6);
  const RD = [-1, -1, 0, 1, 1, 0], RC = [0, 1, 1, 0, -1, -1];
  for (let i = 0; i < N2; i++) {
    const r = Math.floor(i / n), q = i % n;
    for (let k = 0; k < 6; k++) {
      const rr = r + RD[k], cc = q + RC[k];
      const ro = rr < 0 || rr >= n, co = cc < 0 || cc >= n;
      ring[i * 6 + k] = ro && co ? -3 : ro ? -1 : co ? -2 : rr * n + cc;
    }
  }
  const owns = (cell, side) => (cell >= 0 ? board[cell] === side : cell === -3 || cell === (side === JADE ? -1 : -2));
  // x was just taken by the opponent of `side`. If x was one of the two empty cells
  // between two of side's stones (or a stone and side's edge), return the other one.
  // Two cells next to each other share exactly two neighbours: the ring slots on
  // either side of y around x.
  function saveBridge(x, side) {
    const o = x * 6;
    for (let k = 0; k < 6; k++) {
      const y = ring[o + k];
      if (y < 0 || board[y] !== -1) continue;
      if (owns(ring[o + ((k + 5) % 6)], side) && owns(ring[o + ((k + 1) % 6)], side)) return y;
    }
    return -1;
  }
  const stack = new Int16Array(N2);
  const seen = new Uint8Array(N2);
  const pathNode = new Int32Array(N2 + 2), pathKid = new Int32Array(N2 + 2);

  // Jade joined top to bottom on a full board? (otherwise Agate is)
  function jadeWins() {
    seen.fill(0);
    let sp = 0;
    for (let i = 0; i < n; i++) if (board[i] === JADE) { seen[i] = 1; stack[sp++] = i; }
    const lastRow = N2 - n;
    while (sp) {
      const i = stack[--sp];
      if (i >= lastRow) return true;
      const L = nb[i];
      for (let k = 0; k < L.length; k++) {
        const j = L[k];
        if (!seen[j] && board[j] === JADE) { seen[j] = 1; stack[sp++] = j; }
      }
    }
    return false;
  }

  const root = newNode(board0, turn0, roots ? roots.slice() : null);
  for (let it = 0; it < sims; it++) {
    board.set(board0);
    let turn = turn0, id = root, depth = 0, len = 0;
    for (;;) {
      const j = select(id);
      pathNode[depth] = id; pathKid[depth] = j; depth++;
      board[cMove[j]] = turn;
      turn ^= 1;
      const kid = cKid[j];
      if (kid >= 0) { id = kid; continue; }
      if (cN[j] >= EXPAND) {
        // grow the tree by one node, then play out from it
        let any = false;
        for (let i = 0; i < N2; i++) if (board[i] === -1) { any = true; break; }
        if (any) { const k = newNode(board, turn, null); cKid[j] = k; pathNode[depth] = k; pathKid[depth] = -1; depth++; }
      }
      break;
    }
    // random fill, the two sides alternating from the side to move
    len = 0;
    for (let i = 0; i < N2; i++) if (board[i] === -1) { where[i] = len; empties[len++] = i; }
    let side = turn, reply = -1;
    while (len) {
      const x = reply >= 0 ? reply : empties[Math.floor(rand() * len)];
      const at = where[x], last = empties[--len];
      empties[at] = last; where[last] = at;
      board[x] = side;
      side ^= 1;
      reply = bridges ? saveBridge(x, side) : -1;
    }
    const winner = jadeWins() ? JADE : AGATE;
    // back up: plain statistics along the path, AMAF statistics for every move
    // the side at that node ended up owning on the full board
    for (let d = 0; d < depth; d++) {
      const nid = pathNode[d], t = nTurn[nid], win = winner === t ? 1 : 0;
      nVis[nid]++;
      const j = pathKid[d];
      if (j >= 0) { cN[j]++; cW[j] += win; }
      if (rave) {
        const s = nStart[nid], e = s + nLen[nid];
        for (let q = s; q < e; q++) if (board[cMove[q]] === t) { cAN[q]++; cAW[q] += win; }
      }
    }
  }

  // most visited, then most wins, then lowest index: stable
  const s = nStart[root], e = s + nLen[root];
  let best = s;
  for (let j = s + 1; j < e; j++) if (cN[j] > cN[best] || (cN[j] === cN[best] && cW[j] > cW[best])) best = j;
  const visits = [];
  for (let j = s; j < e; j++) visits.push([cMove[j], cN[j], cN[j] ? cW[j] / cN[j] : 0]);
  return { best: cMove[best], value: cN[best] ? cW[best] / cN[best] : 0.5, visits, nodes };
}

function budget(level, n) {
  const L = LEVELS[level] || LEVELS.normal;
  return { ...L, sims: Math.max(100, Math.round(L.sims * 81 / (n * n))) };
}

// The move for the side to move. pos: { board (array or Int8Array), n, turn, swap }.
// Returns { move: { t: 'place', i } | { t: 'swap' }, value, why }.
export function chooseMove(pos, level = 'normal') {
  const n = pos.n;
  const board = Int8Array.from(pos.board);
  const turn = pos.turn;
  const swapOk = !!pos.swap;
  let stones = 0;
  for (let i = 0; i < board.length; i++) if (board[i] !== -1) stones++;
  // an opening for Jade on an empty board
  if (stones === 0 && OPENINGS[n]) return { move: { t: 'place', i: parseCell(n, OPENINGS[n]) }, value: 0.5, why: 'opening' };
  const wins = winningCells(board, n, turn);
  if (wins.length) return { move: { t: 'place', i: wins[0] }, value: 1, why: 'win' };
  const threats = winningCells(board, n, turn ^ 1);
  if (threats.length === 1) return { move: { t: 'place', i: threats[0] }, value: 0.5, why: 'block' };
  const opts = budget(level, n);
  opts.seed = positionHash(board, n, turn, swapOk, level);
  if (swapOk && turn === AGATE) {
    // Swap test, once per game. Reflecting the board and trading colours turns "take the
    // stone" into "the opponent replies to it", so taking it leaves the opponent exactly
    // the chances we would have by replying. Swap when our best reply wins less than
    // half the time. The best of many noisy estimates reads high (about two points at
    // this budget, more on small budgets), so the line sits at SWAP_LINE and every
    // level runs this one search at the hard budget.
    const deep = budget('hard', n);
    deep.seed = opts.seed;
    const r = mcts(board, n, turn, deep);
    if (r.value < SWAP_LINE) return { move: { t: 'swap' }, value: 1 - r.value, why: 'swap' };
    if (level === 'hard') return { move: { t: 'place', i: r.best }, value: r.value, why: 'search' };
  }
  const r = mcts(board, n, turn, opts, threats.length ? threats : null);
  return { move: { t: 'place', i: r.best }, value: r.value, why: 'search' };
}
