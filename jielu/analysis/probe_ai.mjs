// Usage: node probe_ai.mjs probes.txt .. [easy|normal|hard]   (file from `solver probe`)
import fs from 'fs';
const E = await import(process.argv[3] + '/engine.js');
const AI = await import(process.argv[3] + '/ai.js');
const level = process.argv[4] || 'hard';
const desc = (m) => m.t === 'pass' ? 'pass' : m.t === 'walk' ? `w${m.from}-${m.to}` : `f${m.src}-${m.dst}`;
let w = 0, wOk = 0, d = 0, dOk = 0, nodes = 0, t0 = Date.now(), wDepthFail = {};
for (const ln of fs.readFileSync(process.argv[2], 'utf8').split('\n')) {
  if (!ln) continue;
  const [kind, hx, m, c, side, depth, good, bad] = ln.split('|');
  const s = { holes: parseInt(hx, 16), pieces: [m.split(',').map(Number), c.split(',').map(Number)], turn: +side, ban: null, history: new Map() };
  const r = AI.search(s, level);
  nodes += r.nodes;
  const pick = desc(r.move);
  const goods = good.split(';').filter(Boolean);
  if (kind === 'W') { w++; if (goods.includes(pick)) wOk++; else wDepthFail[depth] = (wDepthFail[depth] || 0) + 1; }
  else { d++; if (!bad.split(';').includes(pick)) dOk++; }
}
console.log(`${level}: short wins found ${wOk}/${w}; misses by length ${JSON.stringify(wDepthFail)}; draws kept clear of quick traps ${dOk}/${d}; ${(nodes / (w + d)) | 0} nodes/pos, ${((Date.now() - t0) / (w + d)) | 0} ms/pos`);
