// How well does the computer play? Compares its moves with the solved table.
// Usage: node probe_ai.mjs table.bin [positions]
import { initialState, legalMoves, step, applyMove } from '../engine.js';
import { search } from '../ai.js';
import { loadTable, index } from './table.mjs';

const T = loadTable(process.argv[2]);
const N = +(process.argv[3] || 300);
let seed = 777;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) >>> 0; return seed % n; };
// Does move m keep the mover's result (win stays win, draw stays at least a draw)?
function keeps(s, m) {
  const v = T[index(s)], w = T[index(step(s, m))];
  if (v === 0) return w === 0 || (w & 1) === 1;
  if (!(v & 1)) return w !== 0 && (w & 1) === 1;
  return true;
}
// sample positions from random play where the side to move is not already lost
const pos = [];
while (pos.length < N) {
  let s = initialState();
  const len = rnd(40);
  for (let i = 0; i < len && s.winner === null; i++) { const ms = legalMoves(s); s = step(s, ms[rnd(ms.length)]); }
  if (s.winner !== null) continue;
  const v = T[index(s)];
  if (v & 1) continue;
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

// Full games against perfect play from the opening.
function perfect(s) {
  let best = null, bs = -1e9;
  for (const m of legalMoves(s)) {
    const w = T[index(step(s, m))];
    const sc = w === 0 ? 0 : w & 1 ? 1000 - (w >> 1) : -1000 + (w >> 1);
    if (sc > bs) { bs = sc; best = m; }
  }
  return best;
}
for (const level of ['normal', 'hard']) for (const aiSide of [0, 1]) {
  let s = initialState();
  while (s.winner === null && !s.draw && s.ply < 200) {
    const m = s.turn === aiSide ? search(s, level, s.history).move : perfect(s);
    s = applyMove(s, m);
  }
  const res = s.winner === null ? 'draw' : s.winner === aiSide ? 'computer wins' : 'perfect play wins';
  console.log(`${level} as ${aiSide ? 'Coral' : 'Mint'} vs perfect play: ${res} after ${s.ply} plies`);
}
