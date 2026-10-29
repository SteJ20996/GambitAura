// Read the solver's table (solver --dump) from Node. The index is hashKey() in ../engine.js:
// ((sum cell[t] * 25^t) * 8 + sun) * 2 + side to move, towers in the order Mint short, Mint tall,
// Coral short, Coral tall. Values: 0 draw; even 2d: the side to move wins in d plies; odd 2d+1:
// it loses in d plies.
import { readFileSync } from 'node:fs';
import { hashKey } from '../engine.js';

export function loadTable(path) {
  const buf = readFileSync(path);
  return new Uint16Array(buf.buffer, buf.byteOffset, buf.length / 2);
}
export const index = hashKey;
export const kind = (v) => (v === 0 ? 'draw' : v & 1 ? 'loss' : 'win');
export const plies = (v) => (v === 0 ? -1 : v >> 1);
