// 五子棋 Gomoku rules with the Swap2 opening. Pure functions; a state is never mutated.
// Board: 225-cell Int8Array (-1 empty, 0 black, 1 white). Cell index = row * 15 + col;
// col 0..14 is a..o, row 0 is the top line (15) and row 14 the bottom line (1), so h8 is the centre.
// Freestyle: five or more in a row (row, column or diagonal) wins, six included.
//
// Players are 0 and 1 (identity, kept for the whole game); colours are decided by Swap2:
//   'open3'  the opener places three stones: black, white, black
//   'swap'   the other player picks: 'white' (play White, place stone 4),
//            'black' (play Black, the opener places stone 4 as White) or
//            'two' (place one black and one white, then the opener picks the colour)
//   'open2'  the other player places the two extra stones: black, then white
//   'pick'   the opener picks 'black' or 'white'
//   'play'   normal play; White moves first after the opening stones
//   'over'   five in a row, or a full board (draw)

export const N = 15;
export const SIZE = N * N;
export const BLACK = 0;
export const WHITE = 1;
export const FILES = 'abcdefghijklmno';
export const OPEN3 = [BLACK, WHITE, BLACK];
export const OPEN2 = [BLACK, WHITE];
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

export function initialState(opener = 0) {
  return {
    board: new Int8Array(SIZE).fill(-1),
    opener,
    phase: 'open3',
    placed: 0,          // stones placed so far in the current opening phase
    colorOf: null,      // [colour of player 0, colour of player 1] once Swap2 is settled
    turn: null,         // colour to move in the 'play' phase
    moves: [],          // [{ player, t: 'stone', i, color } | { player, t: 'choice', v }]
    stones: 0,
    last: -1,
    winner: null,       // player who made five
    lines: [],          // the winning runs (arrays of cells)
    draw: false,
  };
}

const second = (s) => 1 - s.opener;

// The player who has to act now (null once the game is over).
export function actor(s) {
  switch (s.phase) {
    case 'open3': case 'pick': return s.opener;
    case 'swap': case 'open2': return second(s);
    case 'play': return s.colorOf.indexOf(s.turn);
    default: return null;
  }
}

// The colour of the stone the actor places next, or null in a choice phase.
export function stoneColor(s) {
  if (s.phase === 'open3') return OPEN3[s.placed];
  if (s.phase === 'open2') return OPEN2[s.placed];
  if (s.phase === 'play') return s.turn;
  return null;
}

export function legalChoices(s) {
  if (s.phase === 'swap') return ['white', 'black', 'two'];
  if (s.phase === 'pick') return ['black', 'white'];
  return [];
}

export const canPlace = (s, i) => stoneColor(s) !== null && i >= 0 && i < SIZE && s.board[i] === -1;

// Every run of five or more through cell i in the colour of the stone on i.
export function fiveLines(board, i) {
  const col = board[i];
  if (col < 0) return [];
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
    if (run.length >= 5) out.push(run);
  }
  return out;
}

function settle(s, colourOfSecond) {
  const colorOf = [0, 0];
  colorOf[second(s)] = colourOfSecond;
  colorOf[s.opener] = 1 - colourOfSecond;
  return { ...s, phase: 'play', placed: 0, colorOf, turn: WHITE };
}

export function applyMove(s, m) {
  const player = actor(s);
  if (player === null) throw new Error('game over');
  if (m.t === 'stone') {
    if (!canPlace(s, m.i)) throw new Error('illegal stone');
    const color = stoneColor(s);
    const board = s.board.slice();
    board[m.i] = color;
    let n = { ...s, board, moves: [...s.moves, { player, t: 'stone', i: m.i, color }], stones: s.stones + 1, last: m.i };
    if (s.phase === 'open3') n = n.placed + 1 === 3 ? { ...n, phase: 'swap', placed: 0 } : { ...n, placed: n.placed + 1 };
    else if (s.phase === 'open2') n = n.placed + 1 === 2 ? { ...n, phase: 'pick', placed: 0 } : { ...n, placed: n.placed + 1 };
    else {
      const lines = fiveLines(board, m.i);
      if (lines.length) n = { ...n, phase: 'over', winner: player, lines };
      else if (n.stones === SIZE) n = { ...n, phase: 'over', draw: true };
      else n = { ...n, turn: 1 - s.turn };
    }
    return n;
  }
  if (m.t === 'choice') {
    if (!legalChoices(s).includes(m.v)) throw new Error('illegal choice');
    const moves = [...s.moves, { player, t: 'choice', v: m.v }];
    if (s.phase === 'swap') {
      if (m.v === 'two') return { ...s, moves, phase: 'open2', placed: 0 };
      return { ...settle(s, m.v === 'white' ? WHITE : BLACK), moves };
    }
    // 'pick': the opener names their own colour
    return { ...settle(s, m.v === 'black' ? WHITE : BLACK), moves };
  }
  throw new Error('unknown move');
}

export const isOver = (s) => s.phase === 'over';
// Number of the next stone (1-based), shown in the status line.
export const stoneNo = (s) => s.stones + 1;
