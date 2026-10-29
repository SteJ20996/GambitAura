// Renju rules for Black (RIF): what counts as five, and which points are forbidden.
// Works on a board of 225 cells holding 0 (empty), 1 (black) or 2 (white); cell = row * 15 + col.
// Functions may place a stone for a moment but always put the board back as it was.
//
//  - Five: exactly five black stones in a row. Six or more (an overline) is not a five for Black.
//  - A four: a line through the new stone that one more black stone turns into exactly five.
//    Two fours on one line (X.XXX.X with the new stone in the middle) count as two.
//  - A straight four: a four with two different ways to make five (.XXXX.).
//  - A three: a line through the new stone that one more black stone turns into a straight four,
//    where that extra stone is not itself forbidden. Otherwise it is a false three and does not count.
//  - Forbidden for Black: an overline, two or more fours (four-four), or two or more threes
//    (three-three). Making five wins even if the same stone also makes one of these.
// White has no restrictions, and five or more wins for White.

export const N = 15;
const DR = [0, 1, 1, 1], DC = [1, 0, 1, -1];

export const NOT_FORBIDDEN = 0, DOUBLE_THREE = 1, DOUBLE_FOUR = 2, OVERLINE = 3;

// The cell k steps from p along direction d, or -1 off the board.
function at(p, d, k) {
  const r = ((p / N) | 0) + k * DR[d], c = (p % N) + k * DC[d];
  return r >= 0 && r < N && c >= 0 && c < N ? r * N + c : -1;
}

// Length of the run of `color` through p along d (counting p itself).
export function runLength(board, p, d, color) {
  let n = 1;
  for (const s of [-1, 1]) {
    for (let k = 1; ; k++) {
      const q = at(p, d, s * k);
      if (q < 0 || board[q] !== color) break;
      n++;
    }
  }
  return n;
}

// Offsets k (|k| <= 4) of empty cells on the line through p where one more black stone makes
// exactly five with p in it. p must hold a black stone.
function fiveSpots(board, p, d) {
  const out = [];
  for (let k = -4; k <= 4; k++) {
    if (k === 0) continue;
    const q = at(p, d, k);
    if (q < 0 || board[q] !== 0) continue;
    board[q] = 1;
    if (runLength(board, p, d, 1) === 5) out.push(k);
    board[q] = 0;
  }
  return out;
}

// Number of fours through p along d (0, 1 or 2), and whether it is a straight four.
function foursOn(board, p, d) {
  const s = fiveSpots(board, p, d);
  if (s.length === 2 && Math.abs(s[0] - s[1]) === 5) return { n: 1, straight: true };
  return { n: s.length, straight: false };
}

// Is there a real three through p along d? (p holds a black stone.)
function threeOn(board, p, d, depth) {
  for (let k = -4; k <= 4; k++) {
    if (k === 0) continue;
    const q = at(p, d, k);
    if (q < 0 || board[q] !== 0) continue;
    board[q] = 1;
    const st = foursOn(board, p, d).straight;
    board[q] = 0;
    if (st && forbiddenReason(board, q, depth + 1) === NOT_FORBIDDEN) return true;
  }
  return false;
}

// Would a black stone on p make exactly five?
export function blackFiveAt(board, p) {
  const was = board[p];
  board[p] = 1;
  let five = false;
  for (let d = 0; d < 4 && !five; d++) if (runLength(board, p, d, 1) === 5) five = true;
  board[p] = was;
  return five;
}

// Why a black stone on the empty point p would be forbidden (NOT_FORBIDDEN if it is allowed).
// Deep chains of false threes are cut off after a few levels; past that a three is taken as real.
export function forbiddenReason(board, p, depth = 0) {
  if (board[p] !== 0) return NOT_FORBIDDEN;
  board[p] = 1;
  let five = false, over = false;
  for (let d = 0; d < 4; d++) {
    const n = runLength(board, p, d, 1);
    if (n === 5) five = true; else if (n > 5) over = true;
  }
  let res = NOT_FORBIDDEN;
  if (!five) {
    if (over) res = OVERLINE;
    else {
      let fours = 0, threes = 0;
      for (let d = 0; d < 4; d++) {
        const f = foursOn(board, p, d).n;
        fours += f;
        if (f === 0 && (depth >= 4 ? quickThree(board, p, d) : threeOn(board, p, d, depth))) threes++;
      }
      if (fours >= 2) res = DOUBLE_FOUR;
      else if (threes >= 2) res = DOUBLE_THREE;
    }
  }
  board[p] = 0;
  return res;
}

// A three without checking whether the extension point is forbidden (used only very deep).
function quickThree(board, p, d) {
  for (let k = -4; k <= 4; k++) {
    if (k === 0) continue;
    const q = at(p, d, k);
    if (q < 0 || board[q] !== 0) continue;
    board[q] = 1;
    const st = foursOn(board, p, d).straight;
    board[q] = 0;
    if (st) return true;
  }
  return false;
}

export const isForbidden = (board, p) => forbiddenReason(board, p) !== NOT_FORBIDDEN;

// Engine boards use -1 empty, 0 black, 1 white; this makes the 0 / 1 / 2 copy used here.
export function fromEngine(board) {
  const out = new Uint8Array(board.length);
  for (let i = 0; i < board.length; i++) out[i] = board[i] + 1;
  return out;
}
