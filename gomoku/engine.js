// 五子棋 Gomoku rules. Pure functions; a state is never mutated.
// Board: 225-cell Int8Array (-1 empty, 0 black, 1 white). Cell index = row * 15 + col;
// col 0..14 is a..o, row 0 is the top line (15) and row 14 the bottom line (1), so h8 is the centre.
//
// Three rule sets (state.rule):
//  'free'   Casual. Black moves first, players alternate from the first stone, five or more wins.
//  'std'    Pro gomoku, as at the Gomoku World Championship: exactly five wins (six or more does
//           not, play goes on), and the Swap2 opening:
//             'open3'  the opener places three stones: black, white, black
//             'swap'   the other player picks: 'white' (play White, place stone 4), 'black' (play
//                      Black; the opener places stone 4 as White) or 'two' (place one black and one
//                      white, then the opener picks the colour)
//             'open2'  the other player places the two extra stones: black, then white
//             'pick'   the opener picks 'black' or 'white'; White moves next
//  'renju'  Pro renju, as at the Renju World Championship (RIF): Black wins only with exactly five
//           and may not make a three-three, four-four or overline (see renju.js); White has no
//           restrictions and five or more wins. Opening: Taraguchi-10:
//             'tplace' stone n (1..5) goes inside the central (2n-1) x (2n-1) square; stone 1 on h8
//             'tswap'  after stones 1, 2, 3 and a square-placed stone 5, the player who would move
//                      next may 'keep' or 'swap' colours
//             'tfifth' after stone 4 the player holding Black picks: 'place' stone 5 inside 9 x 9,
//                      'swap' colours first (the new Black then places stone 5 inside 9 x 9), or
//                      'ten': offer ten fifth stones anywhere
//             'toffer' Black offers ten empty points, no two of them alike by the board's symmetry
//             'tpick'  White picks one offer; it becomes Black's fifth stone and White moves next
// Players are 0 and 1 (identity, kept for the whole game). 'play' is normal play; 'over' ends it.
import { forbiddenReason, fromEngine, NOT_FORBIDDEN } from './renju.js';

export const N = 15;
export const SIZE = N * N;
export const BLACK = 0;
export const WHITE = 1;
export const FILES = 'abcdefghijklmno';
export const RULES = ['free', 'std', 'renju'];
export const OPEN3 = [BLACK, WHITE, BLACK];
export const OPEN2 = [BLACK, WHITE];
export const OFFERS = 10;
export const CENTRE = 7 * N + 7;
const DR = [0, 1, 1, 1];
const DC = [1, 0, 1, -1];

export const cellName = (i) => FILES[i % N] + (N - Math.floor(i / N));
export function parseCell(name) {
  const c = FILES.indexOf(name[0]);
  const rank = Number(name.slice(1));
  if (c < 0 || !(rank >= 1 && rank <= N)) return -1;
  return (N - rank) * N + c;
}
// d4, l4, h8, d12, l12
export const STARS = ['d4', 'l4', 'h8', 'd12', 'l12'].map(parseCell);

export function initialState(opener = 0, rule = 'free') {
  if (!RULES.includes(rule)) rule = 'free';
  const colorOf = [WHITE, WHITE];
  colorOf[opener] = BLACK;
  const base = {
    board: new Int8Array(SIZE).fill(-1),
    rule,
    opener,
    placed: 0,          // stones placed so far in a Swap2 opening phase
    moves: [],          // { player, t: 'stone' | 'offer' | 'pick', i, color } | { player, t: 'choice', v }
    offers: [],         // Taraguchi-10 choice 2: the offered fifth stones
    stones: 0,
    last: -1,
    winner: null,       // player who made five
    lines: [],          // the winning runs (arrays of cells)
    draw: false,
  };
  if (rule === 'free') return { ...base, phase: 'play', colorOf, turn: BLACK };
  if (rule === 'std') return { ...base, phase: 'open3', colorOf: null, turn: null };
  return { ...base, phase: 'tplace', colorOf, turn: BLACK };
}

const second = (s) => 1 - s.opener;
const holder = (s, color) => s.colorOf.indexOf(color);

// The player who has to act now (null once the game is over).
export function actor(s) {
  switch (s.phase) {
    case 'open3': case 'pick': return s.opener;
    case 'swap': case 'open2': return second(s);
    case 'play': case 'tplace': case 'tswap': return holder(s, s.turn);
    case 'tfifth': case 'toffer': return holder(s, BLACK);
    case 'tpick': return holder(s, WHITE);
    default: return null;
  }
}

// The colour of the stone the actor places (or offers) next, or null in a choice phase.
export function stoneColor(s) {
  if (s.phase === 'open3') return OPEN3[s.placed];
  if (s.phase === 'open2') return OPEN2[s.placed];
  if (s.phase === 'play' || s.phase === 'tplace') return s.turn;
  if (s.phase === 'toffer' || s.phase === 'tpick') return BLACK;
  return null;
}

export function legalChoices(s) {
  if (s.phase === 'swap') return ['white', 'black', 'two'];
  if (s.phase === 'pick') return ['black', 'white'];
  if (s.phase === 'tswap') return ['keep', 'swap'];
  if (s.phase === 'tfifth') return ['place', 'swap', 'ten'];
  return [];
}

// Taraguchi-10: stone n goes inside the central square of side 2n - 1 (stone 5: 9 x 9).
export function zoneRadius(s) {
  return s.phase === 'tplace' ? s.stones : -1;
}
export function inZone(s, i) {
  const r = zoneRadius(s);
  if (r < 0) return true;
  return Math.abs(Math.floor(i / N) - 7) <= r && Math.abs((i % N) - 7) <= r;
}

// The eight symmetries of the square around h8, as functions of (dr, dc).
export const SYM = [
  (r, c) => [r, c], (r, c) => [c, -r], (r, c) => [-r, -c], (r, c) => [-c, r],
  (r, c) => [r, -c], (r, c) => [-c, -r], (r, c) => [-r, c], (r, c) => [c, r],
];
export const symCell = (g, i) => { const [r, c] = SYM[g](Math.floor(i / N) - 7, (i % N) - 7); return (r + 7) * N + c + 7; };
// The symmetries that leave the stones on the board where they are.
export function boardSymmetries(board) {
  const out = [];
  for (let g = 0; g < 8; g++) {
    let ok = true;
    for (let i = 0; i < SIZE && ok; i++) if (board[i] >= 0 && board[symCell(g, i)] !== board[i]) ok = false;
    if (ok) out.push(g);
  }
  return out;
}
// Is point i the same as an offer already made, once the board's symmetry is taken into account?
export function offerClash(s, i) {
  const gs = boardSymmetries(s.board);
  return s.offers.some((o) => gs.some((g) => symCell(g, o) === i));
}

// Why Black may not play on i under renju rules (0 when allowed). Only Black is ever restricted.
export function forbiddenAt(s, i) {
  if (s.rule !== 'renju' || s.board[i] !== -1) return NOT_FORBIDDEN;
  return forbiddenReason(fromEngine(s.board), i);
}

export function canPlace(s, i) {
  if (!(i >= 0 && i < SIZE) || stoneColor(s) === null) return false;
  if (s.phase === 'tpick') return s.offers.includes(i);
  if (s.board[i] !== -1) return false;
  if (s.phase === 'toffer') return !offerClash(s, i);
  if (s.phase === 'tplace') return inZone(s, i);
  if (s.phase === 'play' && s.rule === 'renju' && s.turn === BLACK) return forbiddenAt(s, i) === NOT_FORBIDDEN;
  return true;
}

// Does the stone on i win, and along which runs? Free play: five or more. Pro gomoku: exactly five.
// Renju: exactly five for Black, five or more for White.
export function winLines(board, i, rule = 'free') {
  const col = board[i];
  if (col < 0) return [];
  const exact = rule === 'std' || (rule === 'renju' && col === BLACK);
  const r0 = Math.floor(i / N), c0 = i % N, out = [];
  for (let d = 0; d < 4; d++) {
    const run = [i];
    for (const sg of [-1, 1]) {
      let r = r0 + sg * DR[d], c = c0 + sg * DC[d];
      while (r >= 0 && r < N && c >= 0 && c < N && board[r * N + c] === col) {
        if (sg < 0) run.unshift(r * N + c); else run.push(r * N + c);
        r += sg * DR[d]; c += sg * DC[d];
      }
    }
    if (exact ? run.length === 5 : run.length >= 5) out.push(run);
  }
  return out;
}
// Kept for callers that only care about five or more.
export const fiveLines = (board, i) => winLines(board, i, 'free');

function settle(s, colourOfSecond) {
  const colorOf = [0, 0];
  colorOf[second(s)] = colourOfSecond;
  colorOf[s.opener] = 1 - colourOfSecond;
  return { ...s, phase: 'play', placed: 0, colorOf, turn: WHITE };
}
const flip = (c) => [c[1], c[0]];

function putStone(s, i, color, player, t = 'stone') {
  const board = s.board.slice();
  board[i] = color;
  return { ...s, board, moves: [...s.moves, { player, t, i, color }], stones: s.stones + 1, last: i };
}

function afterPlay(n, i, player) {
  const lines = winLines(n.board, i, n.rule);
  if (lines.length) return { ...n, phase: 'over', winner: player, lines };
  if (n.stones === SIZE) return { ...n, phase: 'over', draw: true };
  return { ...n, turn: 1 - n.turn };
}

export function applyMove(s, m) {
  const player = actor(s);
  if (player === null) throw new Error('game over');
  if (m.t === 'stone') {
    if (!canPlace(s, m.i)) throw new Error('illegal stone');
    switch (s.phase) {
      case 'open3': {
        const n = putStone(s, m.i, OPEN3[s.placed], player);
        return n.placed + 1 === 3 ? { ...n, phase: 'swap', placed: 0 } : { ...n, placed: n.placed + 1 };
      }
      case 'open2': {
        const n = putStone(s, m.i, OPEN2[s.placed], player);
        return n.placed + 1 === 2 ? { ...n, phase: 'pick', placed: 0 } : { ...n, placed: n.placed + 1 };
      }
      case 'tplace': {
        const n = putStone(s, m.i, s.turn, player);
        if (n.stones === 4) return { ...n, phase: 'tfifth', turn: BLACK };
        return { ...n, phase: 'tswap', turn: 1 - s.turn };
      }
      case 'toffer': {
        const offers = [...s.offers, m.i];
        const n = { ...s, offers, moves: [...s.moves, { player, t: 'offer', i: m.i, color: BLACK }] };
        return offers.length === OFFERS ? { ...n, phase: 'tpick' } : n;
      }
      case 'tpick': {
        const n = putStone(s, m.i, BLACK, player, 'pick');
        return { ...n, offers: [], phase: 'play', turn: WHITE };
      }
      default:
        return afterPlay(putStone(s, m.i, s.turn, player), m.i, player);
    }
  }
  if (m.t === 'choice') {
    if (!legalChoices(s).includes(m.v)) throw new Error('illegal choice');
    const moves = [...s.moves, { player, t: 'choice', v: m.v }];
    switch (s.phase) {
      case 'swap':
        if (m.v === 'two') return { ...s, moves, phase: 'open2', placed: 0 };
        return { ...settle(s, m.v === 'white' ? WHITE : BLACK), moves };
      case 'pick':
        // the opener names their own colour
        return { ...settle(s, m.v === 'black' ? WHITE : BLACK), moves };
      case 'tswap': {
        const colorOf = m.v === 'swap' ? flip(s.colorOf) : s.colorOf;
        return { ...s, moves, colorOf, phase: s.stones === 5 ? 'play' : 'tplace' };
      }
      case 'tfifth':
        if (m.v === 'ten') return { ...s, moves, phase: 'toffer', offers: [] };
        return { ...s, moves, colorOf: m.v === 'swap' ? flip(s.colorOf) : s.colorOf, phase: 'tplace', turn: BLACK };
      default:
        throw new Error('no choice here');
    }
  }
  throw new Error('unknown move');
}

export const isOver = (s) => s.phase === 'over';
// Number of the next stone (1-based), shown in the status line.
export const stoneNo = (s) => s.stones + 1;
// Stones placed after the opening (the side to move alternates from here on).
export const inOpening = (s) => !['play', 'over'].includes(s.phase);
