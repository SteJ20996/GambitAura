import * as E from './engine.js';
import {
  $, makeStore, initialLang, bindLang, applyStatic, setSeg, onSeg,
  renderScore, renderStatus, renderLog, renderOverlay, AIClient,
} from '../assets/shell.js';

const { BLACK, WHITE } = E;

const T = {
  zh: {
    setup: '設定', mode: '模式', modeAi: '對電腦', modePvp: '雙人同機',
    level: '電腦', easy: '簡單', normal: '普通', hard: '困難',
    hints: '提示', on: '顯示', off: '隱藏',
    restart: '重新開始', next: '下一局（交換執黑）',
    moves: '棋譜', noMoves: '還沒有人下棋。', rulesTitle: '怎麼玩',
    footer1: '沒有骰子，沒有計時，沒有隱藏資訊。', footer2: '全部遊戲',
    color: ['黑', '白'], you: '你', cpu: '電腦', p: ['玩家一', '玩家二'],
    round: (n) => `第 ${n} 局`,
    holds: (who, c) => `${who}執${c}`,
    count: (k, w) => `黑 ${k} · 白 ${w}`,
    turnYou: (c) => `輪到你（${c}）`, turnAi: '電腦思考中', turnSide: (c) => `輪到${c}`,
    hint: '點亮起的小點下子。', hintOff: '找一個能夾住對手棋子的空格。',
    passed: (c) => `${c}沒有可下的位置，跳過一手。`,
    winYou: '你贏了', winAi: '電腦獲勝', winSide: (c) => `${c}勝`, drawBig: '和局',
    endSmall: (k, w) => `黑 ${k} 比 白 ${w}`,
    look: '看一下棋盤', pass: '跳過',
    note: '<b>公平性：</b>8×8 黑白棋在 2023 年已被電腦證明，雙方都下最好時是和棋。所以黑先白後，都沒有必勝。下一局雙方交換執黑。',
    rules: `
      <ol>
        <li><b>目標：</b>棋局結束時，棋盤上自己的棋子比對手多。</li>
        <li><b>黑先。</b>每一手下在一個空格，而且一定要「夾住」對手：新下的棋子和你原有的一顆棋子，在橫、直或斜線上把對手連成一排的棋子夾在中間。</li>
        <li>被夾住的對手棋子全部翻成你的顏色。一手可以同時往好幾個方向夾。</li>
        <li>找不到任何能夾住對手的位置，就跳過這一手，換對手下。</li>
        <li>雙方都沒有位置可下時，棋局結束，數子決定勝負。子數一樣就是和局。</li>
      </ol>`,
  },
  en: {
    setup: 'Setup', mode: 'Mode', modeAi: 'vs computer', modePvp: 'Two players',
    level: 'Computer', easy: 'Easy', normal: 'Normal', hard: 'Hard',
    hints: 'Hints', on: 'On', off: 'Off',
    restart: 'Restart', next: 'Next game (swap Black)',
    moves: 'Moves', noMoves: 'No moves yet.', rulesTitle: 'How to play',
    footer1: 'No dice, no timer, nothing hidden.', footer2: 'All games',
    color: ['Black', 'White'], you: 'You', cpu: 'Computer', p: ['Player 1', 'Player 2'],
    round: (n) => `Game ${n}`,
    holds: (who, c) => `${who}: ${c}`,
    count: (k, w) => `Black ${k} · White ${w}`,
    turnYou: (c) => `Your move (${c})`, turnAi: 'Computer is thinking', turnSide: (c) => `${c} to move`,
    hint: 'Tap one of the glowing dots.', hintOff: 'Find an empty square that traps the other colour.',
    passed: (c) => `${c} has no legal move and passes.`,
    winYou: 'You win', winAi: 'Computer wins', winSide: (c) => `${c} wins`, drawBig: 'Draw',
    endSmall: (k, w) => `Black ${k}, White ${w}`,
    look: 'Look at the board', pass: 'pass',
    note: '<b>Fairness:</b> 8×8 Reversi was solved by computer in 2023: with perfect play on both sides it is a draw. So neither moving first nor second gives a forced win. Players swap Black each game.',
    rules: `
      <ol>
        <li><b>Goal:</b> have more discs of your colour on the board when the game ends.</li>
        <li><b>Black moves first.</b> Each move goes on an empty square and must trap the other colour: the new disc and one of yours sit at both ends of a straight line (across, down or diagonal) of the other colour's discs.</li>
        <li>Every trapped disc flips to your colour. One move can trap in several directions at once.</li>
        <li>If you cannot trap anything, you pass and the other side moves.</li>
        <li>When neither side can move, the game ends and the discs are counted. Equal counts make a draw.</li>
      </ol>`,
  },
};

const store = makeStore('reversi');
let lang = initialLang();
let mode = store.get('mode', 'ai');
let level = store.get('level', 'normal');
let hints = store.get('hints', 'on');
if (!['ai', 'pvp'].includes(mode)) mode = 'ai';
if (!['easy', 'normal', 'hard'].includes(level)) level = 'normal';
if (!['on', 'off'].includes(hints)) hints = 'on';

let state = null;
let blackPlayer = 0;          // which player holds Black this game (player 0 is you vs computer)
let score = [0, 0], gameNo = 1, counted = false, overlayHidden = false, busy = false;
let rows = [];
let passNote = null;

const boardEl = $('board'), discsL = $('discs'), marksL = $('marks'), cellsL = $('cells');
const discAt = new Map();
const place = (el, i) => { el.style.setProperty('--r', i >> 3); el.style.setProperty('--c', i & 7); };

const cellBtns = [];
for (let i = 0; i < 64; i++) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'cellbtn at';
  place(b, i);
  b.addEventListener('click', () => onCell(i));
  cellsL.appendChild(b);
  cellBtns.push(b);
}

const playerOf = (color) => (color === BLACK ? blackPlayer : 1 - blackPlayer);
const isAiTurn = () => mode === 'ai' && !state.over && playerOf(state.turn) === 1;

const ai = new AIClient(new URL('./ai-worker.js', import.meta.url), ({ move }) => {
  busy = false;
  if (move !== null && E.flipsFor(state.board, state.turn, move).length) play(move);
  else render();
});

function makeDisc(i, color, isNew) {
  const d = document.createElement('div');
  d.className = 'disc at' + (color === WHITE ? ' white' : '') + (isNew ? ' new' : '');
  d.innerHTML = '<div class="flip"><span class="f k"></span><span class="f w"></span></div>';
  place(d, i);
  discsL.appendChild(d);
  discAt.set(i, d);
}

function buildBoard() {
  discsL.innerHTML = '';
  discAt.clear();
  for (let i = 0; i < 64; i++) if (state.board[i] !== -1) makeDisc(i, state.board[i], false);
}

function newGame() {
  ai.cancel();
  busy = false;
  state = E.initialState();
  rows = [];
  passNote = null;
  counted = false; overlayHidden = false;
  buildBoard();
  render();
  maybeAi();
}

function play(i) {
  const side = state.turn;
  const next = E.play(state, i);
  rows.push({ side, text: E.cellName(i) });
  makeDisc(i, side, true);
  // flips ripple outward from the new disc
  const r0 = i >> 3, c0 = i & 7;
  for (const f of next.flipped) {
    const d = discAt.get(f);
    const dist = Math.max(Math.abs((f >> 3) - r0), Math.abs((f & 7) - c0));
    d.querySelector('.flip').style.transitionDelay = (dist - 1) * 70 + 'ms';
    d.classList.toggle('white', side === WHITE);
  }
  passNote = null;
  if (next.passed) {
    rows.push({ side: 1 - side, text: T[lang].pass });
    passNote = 1 - side;
  }
  state = next;
  if (state.over && !counted) {
    counted = true;
    if (state.winner !== -1) score[playerOf(state.winner)]++;
  }
  render();
  maybeAi();
}

function maybeAi() {
  if (!isAiTurn()) return;
  busy = true;
  render();
  ai.ask({ board: Array.from(state.board), side: state.turn, level });
}

function onCell(i) {
  if (state.over || busy || isAiTurn()) return;
  if (!E.flipsFor(state.board, state.turn, i).length) return;
  play(i);
}

function render() {
  const L = T[lang];
  applyStatic(L, lang);
  setSeg('modeSeg', mode); setSeg('levelSeg', level); setSeg('hintSeg', hints);
  $('levelRow').hidden = mode !== 'ai';
  $('note').innerHTML = L.note;
  $('rulesBody').innerHTML = L.rules;
  $('nextBtn').hidden = !state.over;

  const turnPlayer = playerOf(state.turn);
  boardEl.classList.toggle('turn-0', !state.over && turnPlayer === 0);
  boardEl.classList.toggle('turn-1', !state.over && turnPlayer === 1);
  boardEl.classList.toggle('over', state.over);

  const name = (p) => (mode === 'ai' ? (p === 0 ? L.you : L.cpu) : L.p[p]);
  const colorOf = (p) => (p === blackPlayer ? BLACK : WHITE);
  renderScore({
    left: { name: name(0), pts: score[0], on: !state.over && turnPlayer === 0, orb: colorOf(0) === BLACK ? 'black' : 'white' },
    right: { name: name(1), pts: score[1], on: !state.over && turnPlayer === 1, orb: colorOf(1) === BLACK ? 'black' : 'white' },
    roundBold: L.round(gameNo),
    roundSmall: L.holds(name(blackPlayer), L.color[BLACK]),
  });

  const [k, w] = E.count(state.board);
  let msg, sub = '';
  if (state.over) {
    msg = state.winner === -1 ? L.drawBig
      : mode === 'ai' ? (playerOf(state.winner) === 0 ? L.winYou : L.winAi) : L.winSide(L.color[state.winner]);
  } else if (isAiTurn()) {
    msg = L.turnAi;
  } else {
    msg = mode === 'ai' ? L.turnYou(L.color[state.turn]) : L.turnSide(L.color[state.turn]);
    sub = hints === 'on' ? L.hint : L.hintOff;
  }
  if (passNote !== null && !state.over) sub = L.passed(L.color[passNote]) + (sub ? (lang === 'zh' ? '' : ' ') + sub : '');
  renderStatus({ side: state.over ? null : state.turn, end: state.over, msg, thinking: isAiTurn(), ply: L.count(k, w), sub });
  renderLog(rows, (c) => L.color[c]);

  // hints and the last move
  marksL.innerHTML = '';
  const legal = !state.over && !isAiTurn() && !busy ? E.legalMoves(state.board, state.turn) : [];
  if (hints === 'on') {
    for (const i of legal) {
      const m = document.createElement('div');
      m.className = 'mark at legal';
      place(m, i);
      marksL.appendChild(m);
    }
  }
  if (state.last !== null) {
    const m = document.createElement('div');
    m.className = 'mark at last';
    place(m, state.last);
    marksL.appendChild(m);
  }
  const legalSet = new Set(legal);
  for (let i = 0; i < 64; i++) {
    const b = cellBtns[i];
    b.classList.toggle('act', legalSet.has(i));
    b.tabIndex = legalSet.has(i) ? 0 : -1;
    const v = state.board[i];
    b.setAttribute('aria-label', E.cellName(i) + (v === -1 ? '' : ', ' + L.color[v]));
  }

  // Results here belong to a colour, not to jade or agate, so every result is shown in champagne.
  renderOverlay({
    show: state.over && !overlayHidden,
    kind: state.over ? 'draw' : null,
    big: msg, small: state.over ? L.endSmall(k, w) : '', next: L.next, look: L.look,
  });
}

bindLang((l) => { lang = l; render(); });
onSeg('modeSeg', (v) => { if (v === mode) return; mode = v; store.set('mode', v); score = [0, 0]; gameNo = 1; blackPlayer = 0; newGame(); });
onSeg('levelSeg', (v) => { level = v; store.set('level', v); render(); });
onSeg('hintSeg', (v) => { hints = v; store.set('hints', v); render(); });
$('restartBtn').onclick = () => newGame();
const nextGame = () => { blackPlayer = 1 - blackPlayer; gameNo++; newGame(); };
$('nextBtn').onclick = nextGame;
$('ovNext').onclick = nextGame;
$('ovLook').onclick = () => { overlayHidden = true; renderOverlay({ show: false }); };

newGame();

window.__game = { get state() { return state; }, get busy() { return busy; }, get score() { return score.slice(); } };
