// Computer player for 取石子 Nim. Deterministic: "variety" comes from a hash of the
// position and the game number, never from Math.random.
import { nimSum, total, winningMoves } from './engine.js';

const hash = (piles, salt = 0) => piles.reduce((h, p) => ((h * 31) ^ (p + 7)) >>> 0, 2166136261 ^ salt);

// A move that keeps things going when no winning move exists: take one from the largest pile.
function stall(piles) {
  let i = 0;
  piles.forEach((p, j) => { if (p > piles[i]) i = j; });
  return [i, 1];
}

function perfect(piles) {
  const w = winningMoves(piles);
  return w.length ? w[0] : stall(piles);
}

// easy: plays any legal move; normal: exact only once the heap is small; hard: exact.
export function chooseMove(piles, level, salt = 0) {
  if (level === 'hard') return perfect(piles);
  if (level === 'normal' && total(piles) <= 8) return perfect(piles);
  const nonEmpty = piles.map((p, i) => [p, i]).filter(([p]) => p > 0);
  const h = hash(piles, salt);
  const [p, i] = nonEmpty[h % nonEmpty.length];
  if (level === 'normal') {
    // halfway sensible: try to even out the two biggest piles
    const sorted = nonEmpty.slice().sort((a, b) => b[0] - a[0]);
    if (sorted.length > 1 && sorted[0][0] > sorted[1][0]) return [sorted[0][1], sorted[0][0] - sorted[1][0]];
  }
  return [i, 1 + (h >>> 3) % p];
}

// Chooser: go first exactly when the position is a win for the side to move.
export function chooseOrder(piles, level) {
  const firstWins = nimSum(piles) !== 0;
  if (level === 'hard') return firstWins ? 'first' : 'second';
  if (level === 'normal' && total(piles) <= 10) return firstWins ? 'first' : 'second';
  return 'first';
}

// Setter: the hard computer lays out balanced-looking piles whose nim-sum is zero,
// so a chooser who goes first without checking loses.
export const TRAPS = [[1, 4, 5], [2, 5, 7], [3, 5, 6], [1, 2, 5, 6], [2, 3, 6, 7], [1, 3, 5, 7], [2, 4, 6, 7, 7], [3, 4, 7]];
export const PLAIN = [[3, 4, 5], [2, 4, 6], [1, 3, 6], [2, 5, 6], [1, 4, 6, 7], [3, 5, 7]];
export function chooseSetup(level, gameNo) {
  const list = level === 'easy' ? PLAIN : level === 'normal' ? (gameNo % 2 ? TRAPS : PLAIN) : TRAPS;
  return list[(gameNo * 3) % list.length].slice();
}
