// How well does the computer play? Compares its moves with the solved table.
// Usage: node probe_ai.mjs table.bin [positions]
import { initialState, legalMoves, step, applyMove, MINT, CORAL } from '../engine.js';
import { search } from '../ai.js';
import { loadTable, index } from './table.mjs';

const T = loadTable(process.argv[2]);
const N = +(process.argv[3] || 300);
let seed = 777;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) >>> 0; return seed % n; };
// value of a move for the mover: 'win' at once, else the child's table value
const after = (s, m) => { const c = step(s, m); return c.winner === s.turn ? -1 : T[index(c)]; };
function keeps(s, m) {
  const v = T[index(s)], w = after(s, m);
  if (w === -1) return true;
  if (v === 0) return w === 0 || (w & 1) === 1;
  if (!(v & 1)) return w !== 0 && (w & 1) === 1;
  return true;
}
const pos = [];
while (pos.length < N) {
  let s = initialState(pos.length % 2 ? CORAL : MINT);
  const len = rnd(40);
  for (let i = 0; i < len && s.winner === null; i++) { const ms = legalMoves(s); s = step(s, ms[rnd(ms.length)]); }
  if (s.winner !== null || !legalMoves(s).length) continue;
  if (T[index(s)] & 1) continue;
  pos.push(s);
}
for (const level of ['easy', 'normal', 'hard']) {
  let ok = 0, nodes = 0, t0 = Date.now(), worst = 0;
  for (const s of pos) {
    const t = Date.now();
    const r = search(s, level);
    worst = Math.max(worst, Date.now() - t);
    nodes += r.nodes;
    if (keeps(s, r.move)) ok++;
  }
  console.log(`${level}: keeps the result in ${(100 * ok / pos.length).toFixed(1)}% of ${pos.length} positions; ` +
    `mean ${((Date.now() - t0) / pos.length).toFixed(0)} ms, worst ${worst} ms, mean nodes ${(nodes / pos.length).toFixed(0)}`);
}
function perfect(s) {
  let best = null, bs = -1e9;
  for (const m of legalMoves(s)) {
    const w = after(s, m);
    const sc = w === -1 ? 1e6 : w === 0 ? 0 : w & 1 ? 1000 - (w >> 1) : -1000 + (w >> 1);
    if (sc > bs) { bs = sc; best = m; }
  }
  return best;
}
for (const level of ['normal', 'hard']) for (const first of [MINT, CORAL]) for (const aiSide of [MINT, CORAL]) {
  let s = initialState(first);
  while (s.winner === null && !s.draw && s.ply < 200) {
    const m = s.turn === aiSide ? search(s, level, s.history).move : perfect(s);
    s = applyMove(s, m);
  }
  const res = s.winner === null ? (s.draw ? 'draw by repetition' : 'still level') : s.winner === aiSide ? 'computer wins' : 'perfect play wins';
  console.log(`${level} as ${aiSide ? 'Coral' : 'Mint'} (${first === aiSide ? 'first' : 'second'}) vs perfect play: ${res} after ${s.ply} plies`);
}
