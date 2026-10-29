// Read the solver's table (solver --dump) from Node. Index layout matches solver.c:
// ((config * (cells + 1) + last flipped cell) * 2 + side to move), last = cells when none.
// Values: 0 draw; odd: the side to move loses in (v-1)/2 plies; even: it wins in (v-1)/2.
import { readFileSync } from 'node:fs';
import { CELLS } from '../engine.js';

export function loadTable(path) {
  const buf = readFileSync(path);
  return new Uint16Array(buf.buffer, buf.byteOffset, buf.length / 2);
}
export const index = (s) => ((s.cfg * (CELLS + 1)) + (s.ban === null ? CELLS : s.ban)) * 2 + s.turn;
export const kind = (v) => (v === 0 ? 'draw' : v & 1 ? 'loss' : 'win');
export const plies = (v) => (v === 0 ? -1 : (v - 1) >> 1);
