// Computer player for 五子棋 Gomoku. Deterministic: no Math.random and no clock. Every search
// stops on a node budget, so the same position and game number always get the same reply on
// any device; the little variety the easier levels have is derived from the game number.
//
// How it thinks:
//  - Candidates are empty points within two steps (along a line) of any stone.
//  - Each candidate is scored by the shapes a stone there would make for either colour in the
//    four directions (five, open four, four, open three, broken three, closed three, twos),
//    read from a table built once for all 3^8 neighbourhoods of a point.
//  - A position is scored by counting every run of five cells that holds stones of one colour
//    only (more stones, more weight). The counts are updated move by move, so a leaf is cheap.
//  - Fours are always answered: complete our five, or block theirs. When the opponent has a
//    three, our replies narrow to blocks and our own fours.
//  - Victory by continuous fours (VCF): a chain of fours the opponent must keep blocking.
//    Normal looks for its own; hard also refuses moves that leave the opponent one.
//  - Iterative-deepening alpha-beta over the best few candidates, bounded by a node budget.
import { N, SIZE, BLACK, WHITE } from './engine.js';

export const LEVELS = {
  // depth 1 plus a wobble in its judgement: it takes wins and blocks fours and open threes, but
  // never looks ahead, so double threats and slow plans beat it
  easy: { maxDepth: 1, budget: 3000, beam: 8, rootBeam: 12, vcf: 0, vcfBudget: 0, guard: 0, defend: true, noise: 70 },
  normal: { maxDepth: 4, budget: 12000, beam: 9, rootBeam: 12, vcf: 9, vcfBudget: 3000, guard: 0, defend: true, noise: 18 },
  hard: { maxDepth: 16, budget: 60000, beam: 11, rootBeam: 16, vcf: 25, vcfBudget: 25000, guard: 17, guardBudget: 5000, defend: true, noise: 0 },
};

// ---------- geometry ----------
const DR = [0, 1, 1, 1], DC = [1, 0, 1, -1];
const OFF = [-4, -3, -2, -1, 1, 2, 3, 4];
const P3 = [1, 3, 9, 27, 81, 243, 729, 2187];
// LINE[p * 32 + d * 8 + j]: the cell OFF[j] steps from p along direction d, or -1 off the board.
const LINE = new Int16Array(SIZE * 32).fill(-1);
// NEAR[p * 16 + k]: cells one or two steps from p along the eight lines (-1 off the board).
const NEAR = new Int16Array(SIZE * 16).fill(-1);
for (let p = 0; p < SIZE; p++) {
  const r = (p / N) | 0, c = p % N;
  let k = 0;
  for (let d = 0; d < 4; d++) {
    for (let j = 0; j < 8; j++) {
      const rr = r + DR[d] * OFF[j], cc = c + DC[d] * OFF[j];
      const q = rr >= 0 && rr < N && cc >= 0 && cc < N ? rr * N + cc : -1;
      LINE[p * 32 + d * 8 + j] = q;
      if (j >= 2 && j <= 5) NEAR[p * 16 + k++] = q;
    }
  }
}
// Every run of five cells on the board, and the runs through each cell.
const WCELLS = [];
const cellWins = Array.from({ length: SIZE }, () => []);
for (let d = 0; d < 4; d++) {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const er = r + 4 * DR[d], ec = c + 4 * DC[d];
      if (er < 0 || er >= N || ec < 0 || ec >= N) continue;
      const id = WCELLS.length / 5;
      for (let k = 0; k < 5; k++) { const q = (r + k * DR[d]) * N + c + k * DC[d]; WCELLS.push(q); cellWins[q].push(id); }
    }
  }
}
const NWIN = WCELLS.length / 5;
const WC = Int16Array.from(WCELLS);
const CW_START = new Int32Array(SIZE + 1);
for (let p = 0; p < SIZE; p++) CW_START[p + 1] = CW_START[p] + cellWins[p].length;
const CW = Int16Array.from(cellWins.flat());

// ---------- shapes ----------
// The shape a stone on the centre point makes in one direction, given the four cells on either
// side (0 empty, 1 own, 2 opponent or edge). Each level is defined by what one more stone
// can turn it into, so the table builds itself from fives downwards.
const FIVE = 9, OPEN4 = 8, FOUR = 7, OPEN3 = 6, THREE = 5, SLEEP3 = 4, OPEN2 = 3, TWO = 2, SLEEP2 = 1;
const SHAPE = new Int8Array(6561).fill(-1);
function shapeOf(key) {
  if (SHAPE[key] >= 0) return SHAPE[key];
  const cell = [0, 0, 0, 0, 1, 0, 0, 0, 0];
  for (let j = 0; j < 8; j++) cell[j < 4 ? j : j + 1] = Math.floor(key / P3[j]) % 3;
  let l = 4, r = 4;
  while (l > 0 && cell[l - 1] === 1) l--;
  while (r < 8 && cell[r + 1] === 1) r++;
  let res;
  if (r - l + 1 >= 5) res = FIVE;
  else {
    let n5 = 0, n4o = 0, n4 = 0, n3 = 0, n3s = 0;
    for (let j = 0; j < 8; j++) {
      if (cell[j < 4 ? j : j + 1] !== 0) continue;
      const s = shapeOf(key + P3[j]);
      if (s === FIVE) n5++;
      else if (s === OPEN4) n4o++;
      else if (s === FOUR) n4++;
      else if (s === OPEN3 || s === THREE) n3++;
      else if (s === SLEEP3) n3s++;
    }
    res = n5 >= 2 ? OPEN4 : n5 ? FOUR : n4o >= 2 ? OPEN3 : n4o ? THREE : n4 ? SLEEP3
      : n3 >= 2 ? OPEN2 : n3 ? TWO : n3s ? SLEEP2 : 0;
  }
  SHAPE[key] = res;
  return res;
}
for (let k = 0; k < 6561; k++) shapeOf(k);

// Point value of each shape, and threat levels for a whole point (all four directions).
const SW = [0, 2, 6, 14, 30, 70, 100, 240, 4000, 200000];
const L_THREE = 1, L_33 = 2, L_FOUR = 3, L_43 = 4, L_OPEN4 = 5, L_FIVE = 6;
const BONUS = [0, 0, 600, 0, 1500, 3000, 0];

// ---------- the board the search works on ----------
const b = new Uint8Array(SIZE);          // 0 empty, 1 black, 2 white
const near = new Uint8Array(SIZE);
const cnt = new Uint8Array(NWIN * 3);     // stones of colour 1 / 2 in each run of five
const S = [0, 0, 0];                      // run score per colour
const F = [0, 0, 0];                      // runs with four of a colour and an empty fifth cell
const WW = [0, 1, 8, 45, 200, 0];
let stones = 0;
// Zobrist keys from a fixed seed, so hashing is the same everywhere.
const ZL = new Uint32Array(SIZE * 3), ZH = new Uint32Array(SIZE * 3);
{
  let x = 0x9e3779b9;
  const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
  for (let i = 0; i < SIZE * 3; i++) { ZL[i] = rnd(); ZH[i] = rnd() & 0x1fffff; }
}
let hl = 0, hh = 0;
const hashKey = () => hh * 4294967296 + (hl >>> 0);

function make(p, c) {
  b[p] = c; stones++;
  const o = 3 - c;
  for (let k = CW_START[p], e = CW_START[p + 1]; k < e; k++) {
    const w = CW[k] * 3;
    const a = cnt[w + c], x = cnt[w + o];
    if (x === 0) {
      S[c] += WW[a + 1] - WW[a];
      if (a === 3) F[c]++; else if (a === 4) F[c]--;
    } else if (a === 0) {
      S[o] -= WW[x];
      if (x === 4) F[o]--;
    }
    cnt[w + c] = a + 1;
  }
  const base = p * 16;
  for (let k = 0; k < 16; k++) { const q = NEAR[base + k]; if (q >= 0) near[q]++; }
  hl ^= ZL[p * 3 + c]; hh ^= ZH[p * 3 + c];
}

function unmake(p) {
  const c = b[p], o = 3 - c;
  for (let k = CW_START[p], e = CW_START[p + 1]; k < e; k++) {
    const w = CW[k] * 3;
    const a = cnt[w + c] - 1, x = cnt[w + o];
    cnt[w + c] = a;
    if (x === 0) {
      S[c] -= WW[a + 1] - WW[a];
      if (a === 3) F[c]--; else if (a === 4) F[c]++;
    } else if (a === 0) {
      S[o] += WW[x];
      if (x === 4) F[o]++;
    }
  }
  const base = p * 16;
  for (let k = 0; k < 16; k++) { const q = NEAR[base + k]; if (q >= 0) near[q]--; }
  b[p] = 0; stones--;
  hl ^= ZL[p * 3 + c]; hh ^= ZH[p * 3 + c];
}

// board: engine board (-1 empty, 0 black, 1 white)
function load(board) {
  b.fill(0); near.fill(0); cnt.fill(0);
  S[1] = S[2] = F[1] = F[2] = 0;
  stones = 0; hl = 0; hh = 0;
  for (let p = 0; p < SIZE; p++) if (board[p] >= 0) make(p, board[p] + 1);
}

// Did the stone on p complete five?
function fiveAt(p) {
  const c = b[p];
  for (let k = CW_START[p], e = CW_START[p + 1]; k < e; k++) if (cnt[CW[k] * 3 + c] === 5) return true;
  return false;
}

// Distinct empty cells that would give colour c five right now.
function completions(c) {
  const o = 3 - c, out = [];
  for (let w = 0; w < NWIN; w++) {
    if (cnt[w * 3 + c] !== 4 || cnt[w * 3 + o] !== 0) continue;
    for (let k = 0; k < 5; k++) { const q = WC[w * 5 + k]; if (b[q] === 0 && !out.includes(q)) out.push(q); }
  }
  return out;
}

// The same, looking only at runs through p (enough right after c played p with no four before).
function completionsAt(p, c) {
  const o = 3 - c, out = [];
  for (let k = CW_START[p], e = CW_START[p + 1]; k < e; k++) {
    const w = CW[k];
    if (cnt[w * 3 + c] !== 4 || cnt[w * 3 + o] !== 0) continue;
    for (let j = 0; j < 5; j++) { const q = WC[w * 5 + j]; if (b[q] === 0 && !out.includes(q)) out.push(q); }
  }
  return out;
}

// Shapes at empty point p for both colours. Results in PT: [score1, level1, score2, level2].
const PT = new Int32Array(4);
function evalPoint(p) {
  let n5a = 0, n4oa = 0, n4a = 0, n3a = 0, sa = 0;
  let n5b = 0, n4ob = 0, n4b = 0, n3b = 0, sb = 0;
  const base = p * 32;
  for (let d = 0; d < 4; d++) {
    let k1 = 0, k2 = 0;
    for (let j = 0; j < 8; j++) {
      const q = LINE[base + d * 8 + j];
      if (q < 0) { k1 += 2 * P3[j]; k2 += 2 * P3[j]; }
      else {
        const v = b[q];
        if (v === 1) { k1 += P3[j]; k2 += 2 * P3[j]; }
        else if (v === 2) { k1 += 2 * P3[j]; k2 += P3[j]; }
      }
    }
    const s1 = SHAPE[k1], s2 = SHAPE[k2];
    sa += SW[s1]; sb += SW[s2];
    if (s1 === FIVE) n5a++; else if (s1 === OPEN4) n4oa++; else if (s1 === FOUR) n4a++; else if (s1 === OPEN3 || s1 === THREE) n3a++;
    if (s2 === FIVE) n5b++; else if (s2 === OPEN4) n4ob++; else if (s2 === FOUR) n4b++; else if (s2 === OPEN3 || s2 === THREE) n3b++;
  }
  const la = n5a ? L_FIVE : n4oa || n4a >= 2 ? L_OPEN4 : n4a && n3a ? L_43 : n4a ? L_FOUR : n3a >= 2 ? L_33 : n3a ? L_THREE : 0;
  const lb = n5b ? L_FIVE : n4ob || n4b >= 2 ? L_OPEN4 : n4b && n3b ? L_43 : n4b ? L_FOUR : n3b >= 2 ? L_33 : n3b ? L_THREE : 0;
  PT[0] = sa + BONUS[la]; PT[1] = la; PT[2] = sb + BONUS[lb]; PT[3] = lb;
}

// Does a stone of colour c on p make a four (or better) in some direction?
function makesFour(p, c) {
  const base = p * 32;
  for (let d = 0; d < 4; d++) {
    let k = 0;
    for (let j = 0; j < 8; j++) {
      const q = LINE[base + d * 8 + j];
      if (q < 0) k += 2 * P3[j];
      else if (b[q] === c) k += P3[j];
      else if (b[q] !== 0) k += 2 * P3[j];
    }
    if (SHAPE[k] >= FOUR) return true;
  }
  return false;
}

// ---------- move generation ----------
const GP = new Int16Array(SIZE), GA = new Int32Array(SIZE), GD = new Int32Array(SIZE);
const GLA = new Int8Array(SIZE), GLD = new Int8Array(SIZE), GPR = new Float64Array(SIZE);
let genWin = -1;   // set when the side to move has an open four (or four-four) to make

// Ordered candidate moves for colour c (assumes neither side can make five at once).
function genMoves(c, limit, defend, first) {
  const ai = c === 1 ? 0 : 2, di = c === 1 ? 2 : 0;
  let n = 0, maxLa = 0, maxLd = 0;
  for (let p = 0; p < SIZE; p++) {
    if (b[p] !== 0 || near[p] === 0) continue;
    evalPoint(p);
    GP[n] = p; GA[n] = PT[ai]; GLA[n] = PT[ai + 1]; GD[n] = PT[di]; GLD[n] = PT[di + 1];
    if (GLA[n] > maxLa) maxLa = GLA[n];
    if (GLD[n] > maxLd) maxLd = GLD[n];
    n++;
  }
  genWin = -1;
  if (n === 0) {
    for (let p = 0; p < SIZE; p++) if (b[p] === 0) return [p];
    return [];
  }
  const idx = [];
  if (maxLa >= L_OPEN4) {
    let best = -1;
    for (let k = 0; k < n; k++) if (GLA[k] >= L_OPEN4 && (best < 0 || GA[k] > GA[best])) best = k;
    genWin = maxLd >= L_FOUR ? -1 : GP[best];   // a sure win unless they can answer with fours
    return [GP[best]];
  }
  const narrow = defend && maxLd >= L_OPEN4;
  for (let k = 0; k < n; k++) {
    if (narrow && GLA[k] < L_FOUR && GLD[k] < L_FOUR) continue;
    GPR[k] = GA[k] + GD[k] * 0.9 + (GP[k] === first ? 1e9 : 0);
    idx.push(k);
  }
  idx.sort((x, y) => GPR[y] - GPR[x] || GP[x] - GP[y]);
  const out = [];
  const lim = narrow ? limit + 6 : limit;
  for (let k = 0; k < idx.length && out.length < lim; k++) out.push(GP[idx[k]]);
  return out;
}

// Our moves that make a four, strongest first.
function fourMoves(c) {
  const list = [];
  const ai = c === 1 ? 0 : 2;
  for (let p = 0; p < SIZE; p++) {
    if (b[p] !== 0 || near[p] === 0) continue;
    if (!makesFour(p, c)) continue;
    evalPoint(p);
    list.push([p, PT[ai]]);
  }
  list.sort((x, y) => y[1] - x[1] || x[0] - y[0]);
  return list.map((x) => x[0]);
}

function hasFourMove(c) {
  for (let p = 0; p < SIZE; p++) if (b[p] === 0 && near[p] > 0 && makesFour(p, c)) return true;
  return false;
}

// ---------- victory by continuous fours ----------
let vNodes = 0, vBudget = 0, vFirst = -1, vSum = 0;
const vFail = new Map();
function vcf(c, depth, ply) {
  if (++vNodes > vBudget) return false;
  const o = 3 - c;
  if (F[c] > 0) { if (ply === 0) vFirst = completions(c)[0]; return true; }
  if (depth <= 0) return false;
  let moves;
  if (F[o] > 0) {
    const cs = completions(o);
    if (cs.length > 1 || !makesFour(cs[0], c)) return false;
    moves = cs;
  } else moves = fourMoves(c);
  if (!moves.length) return false;
  const key = hashKey();   // the attacker is always to move here, and the table is per call
  const seen = vFail.get(key);
  if (seen !== undefined && seen >= depth) return false;
  for (const p of moves) {
    make(p, c);
    let win = false;
    const cs = completionsAt(p, c);
    if (cs.length >= 2) win = !hasFourMove(o);
    else if (cs.length === 1) {
      const q = cs[0];
      make(q, o);
      win = vcf(c, depth - 1, ply + 1);
      unmake(q);
    }
    unmake(p);
    if (win) { if (ply === 0) vFirst = p; return true; }
    if (vNodes > vBudget) return false;
  }
  vFail.set(key, depth);
  return false;
}

function findVcf(c, depth, limit) {
  vNodes = 0; vBudget = limit; vFirst = -1; vFail.clear();
  const won = vcf(c, depth, 0);
  vSum += vNodes;
  return won ? vFirst : -1;
}

// ---------- alpha-beta ----------
const WIN = 10000000;
const INF = 1e9;
let nodes = 0, budget = 0, aborted = false, noiseAmp = 0, seed = 0, beamN = 10, defendOn = true;
const tt = new Map();

function noise(c) {
  if (!noiseAmp) return 0;
  let x = (hl ^ Math.imul(hh, 0x85ebca6b) ^ seed) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d); x = Math.imul(x ^ (x >>> 15), 0x846ca68b); x = (x ^ (x >>> 16)) >>> 0;
  const v = (x / 4294967296 - 0.5) * 2 * noiseAmp;
  return c === 1 ? v : -v;
}

// Score for colour c to move. The side to move gets a little extra for the initiative.
function evaluate(c) {
  const o = 3 - c;
  return Math.round(S[c] * 1.2 - S[o] + noise(c));
}

function negamax(c, depth, alpha, beta, ply) {
  nodes++;
  if (nodes > budget) { aborted = true; return 0; }
  const o = 3 - c;
  if (F[c] > 0) return WIN - ply;
  if (stones >= SIZE) return 0;
  if (F[o] > 0) {
    const cs = completions(o);
    if (cs.length > 1) return -(WIN - ply - 1);
    const p = cs[0];
    make(p, c);
    const sc = -negamax(o, depth - 1, -beta, -alpha, ply + 1);
    unmake(p);
    return sc;
  }
  if (depth <= 0) return evaluate(c);
  const key = hashKey();
  const ent = tt.get(key);
  let first = -1;
  if (ent) {
    first = ent.m;
    if (ent.d >= depth) {
      if (ent.f === 0) return ent.s;
      if (ent.f === 1 && ent.s >= beta) return ent.s;
      if (ent.f === 2 && ent.s <= alpha) return ent.s;
    }
  }
  const moves = genMoves(c, beamN, defendOn, first);
  if (genWin >= 0) return WIN - ply - 2;
  const alpha0 = alpha;
  let best = -INF, bestMove = moves[0];
  for (const p of moves) {
    make(p, c);
    const sc = -negamax(o, depth - 1, -beta, -alpha, ply + 1);
    unmake(p);
    if (aborted) return 0;
    if (sc > best) { best = sc; bestMove = p; }
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) break;
  }
  tt.set(key, { d: depth, s: best, f: best <= alpha0 ? 2 : best >= beta ? 1 : 0, m: bestMove });
  return best;
}

// Best move for colour c (1 black, 2 white) on the loaded board.
function think(c, cfg, gameSeed) {
  const o = 3 - c;
  nodes = 0; budget = cfg.budget; aborted = false; tt.clear(); vSum = 0;
  noiseAmp = cfg.noise; seed = gameSeed >>> 0; beamN = cfg.beam; defendOn = cfg.defend;
  const done = (move, score, depth, why) => ({ move, score, depth, nodes: nodes + vSum, why });
  if (F[c] > 0) return done(completions(c)[0], WIN, 0, 'five');
  if (F[o] > 0) {
    // block; with two threats we lose anyway, so block the one that helps us most
    const cs = completions(o);
    let best = cs[0], bs = -INF;
    for (const p of cs) { evalPoint(p); const v = PT[c === 1 ? 0 : 2]; if (v > bs) { bs = v; best = p; } }
    return done(best, cs.length > 1 ? -WIN : 0, 0, 'block');
  }
  if (cfg.vcf) {
    const m = findVcf(c, cfg.vcf, cfg.vcfBudget);
    if (m >= 0) return done(m, WIN - 1, 0, 'vcf');
  }
  let moves = genMoves(c, cfg.rootBeam, cfg.defend, -1);
  if (genWin >= 0 || moves.length === 1) return done(moves[0], genWin >= 0 ? WIN - 2 : 0, 0, genWin >= 0 ? 'open4' : 'only');
  if (cfg.guard) {
    // drop moves that let the opponent win by continuous fours
    const safe = moves.filter((p) => { make(p, c); const bad = findVcf(o, cfg.guard, cfg.guardBudget) >= 0; unmake(p); return !bad; });
    if (safe.length) moves = safe;
  }
  let bestMove = moves[0], bestScore = 0, reached = 0;
  for (let depth = 1; depth <= cfg.maxDepth; depth++) {
    let alpha = -INF, curBest = -1, curScore = -INF;
    for (const p of moves) {
      make(p, c);
      const sc = fiveAt(p) ? WIN : -negamax(o, depth - 1, -INF, -alpha, 1);
      unmake(p);
      if (aborted) break;
      if (sc > curScore) { curScore = sc; curBest = p; }
      if (sc > alpha) alpha = sc;
    }
    // a cut-off iteration still counts: its first move was last iteration's best, so anything
    // that beat it here is better at the deeper depth
    if (curBest >= 0) { bestMove = curBest; bestScore = curScore; }
    if (aborted) break;
    reached = depth;
    // try last iteration's best first
    moves = [curBest, ...moves.filter((p) => p !== curBest)];
    if (curScore >= WIN - 1000 || curScore <= -(WIN - 1000)) break;
  }
  return done(bestMove, bestScore, reached, 'search');
}

// ---------- Swap2 ----------
// Openings for the computer as opener: black, white, black, as (row, col) steps from h8.
// All 75 different three-stone shapes within two points of h8 were scored by the hard search
// with White to move. Every one leans toward Black; these six lean least, so whichever side the
// other player takes, neither starts far ahead. Rotated and mirrored by game number.
export const OPENINGS = [
  [[0, 0], [-2, -1], [0, -2]],
  [[0, 0], [-2, 0], [-1, -1]],
  [[0, 0], [-1, 0], [1, -1]],
  [[0, 0], [-2, -1], [-1, -1]],
  [[0, 0], [-1, -1], [-1, 1]],
  [[0, 0], [-1, -1], [2, 2]],
];
// the eight symmetries of the square, applied to (dr, dc)
const SYM = [
  (r, c) => [r, c], (r, c) => [c, -r], (r, c) => [-r, -c], (r, c) => [-c, r],
  (r, c) => [r, -c], (r, c) => [-c, -r], (r, c) => [-r, c], (r, c) => [c, r],
];
export function openingCells(gameNo) {
  const g = Math.max(0, gameNo | 0);
  const op = OPENINGS[g % OPENINGS.length];
  const sym = SYM[Math.floor(g / OPENINGS.length) % 8];
  return op.map(([r, c]) => { const [rr, cc] = sym(r, c); return (7 + rr) * N + 7 + cc; });
}

// Score of the loaded position for White to move (positive = good for White).
function whiteScore(cfg, gameSeed) {
  const r = think(2, cfg, gameSeed);
  return r.score;
}

// Within this band the computer treats a position as level.
const LEVEL_BAND = 40;

// Second player's three options after the opening three stones.
function chooseSwap(board, cfg, gameNo, gs) {
  load(board);
  const s3 = whiteScore(cfg, gs);
  const vals = { white: s3, black: -s3 };
  // Option three hands the colour choice back, so its value is minus the best the opener can
  // then get. It can only tie the other two, so it is only worth checking when the three stones
  // already look level; then we look for a level five-stone position.
  if (Math.abs(s3) <= LEVEL_BAND) {
    const pair = bestPair(board, cfg, gs);
    if (pair) vals.two = -Math.abs(pair.score);
  }
  const top = Math.max(...Object.values(vals));
  const tied = ['white', 'black', 'two'].filter((k) => k in vals && vals[k] >= top - LEVEL_BAND);
  return { v: tied[gameNo % tied.length], score: top, vals };
}

// A short search for the pair hunt. Even depth, so it ends on White to move like the full
// search usually does and the two judge the same positions alike.
const quick = (cfg) => ({ ...cfg, maxDepth: Math.min(cfg.maxDepth, 4), budget: Math.min(cfg.budget, 4000), vcf: 0, guard: 0 });

// Two extra stones (black, then white) that leave the position as level as we can find.
function bestPair(board, cfg, gs) {
  load(board);
  const q = quick(cfg);
  const bs = genMoves(1, 5, false, -1);
  let best = null;
  for (const pb of bs) {
    const bw = board.slice(); bw[pb] = BLACK;
    const w = bestWhiteExtra(bw, q, gs);
    if (w && (!best || Math.abs(w.score) < Math.abs(best.score))) best = { b: pb, w: w.p, score: w.score };
  }
  return best;
}
function bestWhiteExtra(board, q, gs) {
  load(board);
  const ws = genMoves(2, 5, false, -1);
  let best = null;
  for (const pw of ws) {
    const bw = board.slice(); bw[pw] = WHITE;
    load(bw);
    const sc = whiteScore(q, gs);
    if (!best || Math.abs(sc) < Math.abs(best.score)) best = { p: pw, score: sc };
  }
  return best;
}

// ---------- entry point ----------
// s: engine state; returns { move, score, depth, nodes }.
const seedOf = (gameNo) => Math.imul((gameNo | 0) + 1, 0x9e3779b1);

export function decide(s, level = 'hard', gameNo = 1) {
  const cfg = LEVELS[level] || LEVELS.hard;
  const gs = seedOf(gameNo);
  if (s.phase === 'open3') {
    const cells = openingCells(gameNo - 1);
    let p = cells[s.placed];
    if (s.board[p] !== -1) p = s.board.findIndex((v) => v === -1);
    return { move: { t: 'stone', i: p }, score: 0, depth: 0, nodes: 0 };
  }
  if (s.phase === 'swap') {
    const r = chooseSwap(s.board, cfg, gameNo, gs);
    return { move: { t: 'choice', v: r.v }, score: r.score, depth: 0, nodes, vals: r.vals };
  }
  if (s.phase === 'open2') {
    if (s.placed === 0) {
      const pair = bestPair(s.board, cfg, gs);
      return { move: { t: 'stone', i: pair.b }, score: pair.score, depth: 0, nodes };
    }
    const w = bestWhiteExtra(s.board, quick(cfg), gs);
    return { move: { t: 'stone', i: w.p }, score: w.score, depth: 0, nodes };
  }
  if (s.phase === 'pick') {
    load(s.board);
    const s5 = whiteScore(cfg, gs);
    return { move: { t: 'choice', v: s5 >= 0 ? 'white' : 'black' }, score: s5, depth: 0, nodes };
  }
  load(s.board);
  const r = think(s.turn + 1, cfg, gs);
  return { move: { t: 'stone', i: r.move }, score: r.score, depth: r.depth, nodes: r.nodes, why: r.why };
}

// For tests: best move for `color` (0 black, 1 white) on an engine board.
export function bestMove(board, color, level = 'hard', gameNo = 1) {
  load(board);
  return think(color + 1, LEVELS[level] || LEVELS.hard, seedOf(gameNo));
}

