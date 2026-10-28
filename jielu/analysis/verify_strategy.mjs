// Usage: node verify_strategy.mjs coral_strategy.txt ../engine.js   (file from `solver strategy`)
// Independent check: the JS engine plays every Mint reply; Coral answers from the exported table.
import fs from 'fs';
const E = await import(process.argv[3]);
const strat = new Map();
for (const ln of fs.readFileSync(process.argv[2], 'utf8').split('\n')) {
  if (!ln) continue;
  const i = ln.lastIndexOf(' ');
  strat.set(ln.slice(0, i), ln.slice(i + 1));
}
const key = (s) => {
  const b = E.effectiveBan(s);
  return s.holes.toString(16) + '|' + s.pieces[0].join(',') + '|' + s.pieces[1].join(',') + '|' + s.turn + '|' + (b ? b.src + '>' + b.dst : '-');
};
const desc = (m) => m.t === 'pass' ? 'pass' : m.t === 'walk' ? `w${m.from}-${m.to}` : `f${m.src}-${m.dst}`;
let leaves = 0, maxPly = 0, nodes = 0;
const memo = new Map();
function explore(s) {
  // returns max plies until Coral wins; throws on any failure
  const k = key(s);
  if (memo.has(k)) return memo.get(k);
  nodes++;
  const ms = E.legalMoves(s);
  let res;
  if (s.turn === E.MINT) {
    if (ms.some((m) => m.win)) throw new Error('Mint can win at ' + k);
    res = 0;
    for (const m of ms) {
      const n = E.applyMove(s, m);
      if (n.draw) throw new Error('repetition draw reachable at ' + k);
      res = Math.max(res, 1 + explore(n));
    }
  } else {
    const want = strat.get(k);
    if (!want) throw new Error('no strategy entry for ' + k);
    const m = ms.find((x) => desc(x) === want);
    if (!m) throw new Error('strategy move illegal in JS: ' + want + ' at ' + k);
    const n = E.applyMove(s, m);
    if (n.winner === E.CORAL) { leaves++; res = 1; }
    else { if (n.draw) throw new Error('draw'); res = 1 + explore(n); }
  }
  memo.set(k, res);
  return res;
}
const s0 = E.initialState(E.MINT, E.LAYOUTS.v04);
const plies = explore(s0);
console.log({ verified: true, coralWinsWithin: plies, distinctPositions: nodes, winningLeaves: leaves });
