// Read the solver's table (solver --dump) from Node. Index layout matches solver.c:
// ((rank24(mover) * 1330 + rank21(other squeezed past mover)) * 7 + last).
// Values: 0 draw; odd: the side to move loses in (v-1)/2 plies; even: it wins in (v-1)/2.
import { readFileSync } from 'node:fs';

const R24 = new Map(), R21 = new Map();
let k = 0;
for (let c = 2; c < 24; c++) for (let b = 1; b < c; b++) for (let a = 0; a < b; a++) R24.set((1 << a) | (1 << b) | (1 << c), k++);
k = 0;
for (let c = 2; c < 21; c++) for (let b = 1; b < c; b++) for (let a = 0; a < b; a++) R21.set((1 << a) | (1 << b) | (1 << c), k++);

function squeeze(o, m) {
  let out = 0, j = 0;
  for (let p = 0; p < 24; p++) {
    if ((m >> p) & 1) continue;
    if ((o >> p) & 1) out |= 1 << j;
    j++;
  }
  return out;
}

export function loadTable(path) {
  const buf = readFileSync(path);
  return new Uint16Array(buf.buffer, buf.byteOffset, buf.length / 2);
}

// Code of the turn the previous mover made (solver's "last"): 0 none, else 1 + ring*2 + (dir > 0).
export function lastCode(s) {
  if (!s.ban) return 0;
  return 1 + s.ban.ring * 2 + (s.ban.dir < 0 ? 1 : 0);   // the ban is the reverse of that turn
}

export function index(s) {
  const M = s.masks[s.turn], O = s.masks[1 - s.turn];
  return (R24.get(M) * 1330 + R21.get(squeeze(O, M))) * 7 + lastCode(s);
}

export const kind = (v) => (v === 0 ? 'draw' : v & 1 ? 'loss' : 'win');
export const plies = (v) => (v === 0 ? -1 : (v - 1) >> 1);
