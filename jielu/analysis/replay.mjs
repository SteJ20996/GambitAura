// Usage: node replay.mjs games.txt ../engine.js   (games.txt from `solver dump`; set the layout below)
import fs from 'fs';
const E = await import(process.argv[3]);
const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n');
const desc = (m) => m.t === 'pass' ? 'pass' : m.t === 'walk' ? `w${m.from}-${m.to}` : `f${m.src}-${m.dst}`;
let s = null, pos = 0, bad = 0, wins = 0, banned = 0;
for (const ln of lines) {
  if (ln.startsWith('G ')) { s = E.initialState(+ln.slice(2), E.LAYOUTS.v04); continue; }
  if (ln === 'WIN') {
    if (!E.legalMoves(s).some((m) => m.win)) { bad++; console.log('JS sees no win'); }
    wins++; continue;
  }
  if (ln.startsWith('M ')) {
    const [lst, ch] = ln.slice(2).split(' | ');
    const ms = E.legalMoves(s);
    if (ms.some((m) => m.win)) { bad++; console.log('JS sees a win C missed'); }
    if (s.ban && E.effectiveBan(s)) banned++;
    const js = ms.map(desc).sort().join(' ');
    if (js !== lst) { bad++; if (bad < 10) console.log('mismatch at pos', pos, '\n C:', lst, '\nJS:', js); }
    const m = ms.find((x) => desc(x) === ch);
    if (!m) { console.log('chosen move missing'); process.exit(1); }
    s = E.applyMove(s, m); pos++;
  }
}
console.log({ positions: pos, wins, enforceableBans: banned, mismatches: bad });
