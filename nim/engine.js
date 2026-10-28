// 取石子 Nim rules. Normal play: whoever takes the last stone wins.
// A move takes one or more stones from a single pile.
// Theory (C. L. Bouton, 1901): XOR the pile sizes (the nim-sum). The side to move
// can force a win exactly when the nim-sum is not zero.

export const MIN_PILES = 3;
export const MAX_PILES = 5;
export const MAX_STONES = 7;

export const nimSum = (piles) => piles.reduce((a, b) => a ^ b, 0);
export const total = (piles) => piles.reduce((a, b) => a + b, 0);
export const isEmpty = (piles) => piles.every((p) => p === 0);

export function take(piles, i, k) {
  if (!(k >= 1 && k <= piles[i])) throw new Error('illegal move');
  const n = piles.slice();
  n[i] -= k;
  return n;
}

// Moves that leave a nim-sum of zero (the winning replies), as [pile, count] pairs.
export function winningMoves(piles) {
  const x = nimSum(piles);
  if (x === 0) return [];
  const out = [];
  piles.forEach((p, i) => {
    const target = p ^ x;
    if (target < p) out.push([i, p - target]);
  });
  return out;
}

export function validSetup(piles) {
  return piles.length >= MIN_PILES && piles.length <= MAX_PILES &&
    piles.every((p) => Number.isInteger(p) && p >= 1 && p <= MAX_STONES);
}

export const toBinary = (n) => n.toString(2).padStart(3, '0');
