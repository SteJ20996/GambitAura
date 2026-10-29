import * as E from './engine.js';
import {
  $, makeStore, initialLang, bindLang, applyStatic, setSeg, onSeg,
  renderScore, renderStatus, renderLog, renderOverlay, confirmDialog, AIClient,
} from '../assets/shell.js';

const { N, SIZE, BLACK, WHITE } = E;

// ---------- copy ----------
const T = {
  zh: {
    setup: '設定', mode: '模式', modeAi: '對電腦', modePvp: '雙人同機',
    level: '電腦', easy: '簡單', normal: '普通', hard: '困難',
    restart: '重新開始', next: '下一局（交換開局）',
    moves: '棋譜', noMoves: '還沒有落子。', rulesTitle: '怎麼玩',
    footer1: '沒有骰子，沒有計時，沒有隱藏資訊。', footer2: '全部遊戲',
    color: ['黑', '白'], you: '你', cpu: '電腦', p: ['玩家一', '玩家二'],
    round: (n) => `第 ${n} 局`, opens: (n) => `${n}開局`,
    stoneN: (n) => `第 ${n} 子`, endPly: (n) => `共 ${n} 手`,
    fair: '<b>Swap2 開局。</b>五子棋如果不加限制，先下的一方只要每步都下對，一定會贏（Allis，1994）。所以先由一方擺出開局，再由另一方挑顏色。Swap2 沒有被證明完全公平，它的作用是讓擺開局的人必須擺得均勢，因為顏色由對手來挑。',
    youOpen: '由你擺開局', pOpen: (n) => `${n}擺開局`, aiOpen: '電腦正在擺開局',
    open3Hint: (k, c) => `放三子：兩黑一白。之後對手會挑顏色，所以擺得越均勢越好。下一子：${c}（${k}/3）。`,
    youChoose: '輪到你選', pChoose: (n) => `輪到${n}選`, aiChoose: '電腦正在選擇',
    swapHint: '開局三子已經擺好。選一種做法：',
    opt: { white: '執白，我下第四子', black: '執黑，對手下第四子', two: '再下兩子，讓對手挑顏色' },
    youTwo: '再下兩子', pTwo: (n) => `${n}再下兩子`, aiTwo: '電腦正在加兩子',
    open2Hint: (k, c) => `先下一黑，再下一白。之後由對手挑顏色。下一子：${c}（${k}/2）。`,
    youPick: '由你挑顏色', pPick: (n) => `由${n}挑顏色`, aiPick: '電腦正在挑顏色',
    pickHint: '對手加了兩子。挑一個顏色，白棋先走。',
    pickOpt: { black: '執黑', white: '執白' },
    yourMove: (c) => `輪到你（${c}）`, pMove: (n, c) => `輪到${n}（${c}）`, aiMove: '電腦思考中',
    playHint: '白棋先走，連成五子就贏。',
    chose: (n, v) => ({ white: `${n}選了執白`, black: `${n}選了執黑`, two: `${n}選了再下兩子` })[v],
    stop: '。',
    tapAim: '點一下瞄準，再點一下落子。', tapAgain: (c) => `再點一次 ${c} 就落子。`,
    winYou: '你贏了', winAi: '電腦獲勝', winP: (n) => `${n}勝`,
    drawBig: '和局', drawEnd: '棋盤下滿了，沒有人連成五子。',
    endSmall: (c, n) => `${c}棋連成五子，共 ${n} 手`,
    look: '看一下棋盤',
    restartAsk: '重新開始會清掉這一局。', restartNo: '繼續這一局', restartYes: '重新開始',
    cell: { empty: '空', 0: '黑子', 1: '白子' }, boardLabel: '棋盤',
    rules: `
      <ol>
        <li><b>目標：</b>讓自己的五顆棋子連成一直線，橫、直、斜都可以。六顆以上也算贏。</li>
        <li>棋子下在線的交叉點上，下了就不再移動。</li>
        <li><b>開局（Swap2）：</b>開局的一方先放三子：兩黑一白。</li>
        <li>另一方從三種做法選一種：執白，自己下第四子；執黑，由對方執白下第四子；或再下一黑一白，讓對方挑顏色。</li>
        <li>顏色定了以後，白棋先走，雙方輪流下。</li>
        <li>棋盤下滿還沒有人連成五子，就是和局。</li>
        <li>「下一局」會交換由誰開局。</li>
      </ol>`,
  },
  en: {
    setup: 'Setup', mode: 'Mode', modeAi: 'vs computer', modePvp: 'Two players',
    level: 'Computer', easy: 'Easy', normal: 'Normal', hard: 'Hard',
    restart: 'Restart', next: 'Next game (swap opener)',
    moves: 'Moves', noMoves: 'No stones yet.', rulesTitle: 'How to play',
    footer1: 'No dice, no timer, nothing hidden.', footer2: 'All games',
    color: ['Black', 'White'], you: 'You', cpu: 'Computer', p: ['Player 1', 'Player 2'],
    round: (n) => `Game ${n}`, opens: (n) => (n === 'You' ? 'You open' : `${n} opens`),
    stoneN: (n) => `Stone ${n}`, endPly: (n) => `${n} moves`,
    fair: '<b>Swap2 opening.</b> Without a rule like this, the player who moves first can always win with perfect play (Allis, 1994). So one player sets up the opening and the other picks a colour. Nobody has proven Swap2 perfectly fair. What it does is make the opener build a balanced position, because the opponent picks the side.',
    youOpen: 'You set the opening', pOpen: (n) => `${n} sets the opening`, aiOpen: 'The computer is setting the opening',
    open3Hint: (k, c) => `Place three stones: two black, one white. Your opponent then picks a colour, so keep it even. Next: ${c.toLowerCase()} (${k} of 3).`,
    youChoose: 'Your choice', pChoose: (n) => `${n} to choose`, aiChoose: 'The computer is choosing',
    swapHint: 'The three opening stones are down. Pick one:',
    opt: { white: 'Play White, I place stone 4', black: 'Play Black, they place stone 4', two: 'Place two more, they pick' },
    youTwo: 'Place two more stones', pTwo: (n) => `${n} places two more`, aiTwo: 'The computer is adding two stones',
    open2Hint: (k, c) => `One black, then one white. Then your opponent picks a colour. Next: ${c.toLowerCase()} (${k} of 2).`,
    youPick: 'Pick your colour', pPick: (n) => `${n} picks a colour`, aiPick: 'The computer is picking a colour',
    pickHint: 'Your opponent added two stones. Pick a colour. White moves first.',
    pickOpt: { black: 'Play Black', white: 'Play White' },
    yourMove: (c) => `Your move (${c})`, pMove: (n, c) => `${n} to move (${c})`, aiMove: 'Computer is thinking',
    playHint: 'White moves first. Five in a row wins.',
    chose: (n, v) => ({ white: `${n} took White`, black: `${n} took Black`, two: `${n} chose to place two more` })[v],
    stop: '. ',
    tapAim: 'Tap once to aim, then tap again to place.', tapAgain: (c) => `Tap ${c} again to place.`,
    winYou: 'You win', winAi: 'Computer wins', winP: (n) => `${n} wins`,
    drawBig: 'Draw', drawEnd: 'The board is full and nobody made five.',
    endSmall: (c, n) => `${c} made five in ${n} moves`,
    look: 'Look at the board',
    restartAsk: 'Restarting clears this game.', restartNo: 'Keep playing', restartYes: 'Restart',
    cell: { empty: 'empty', 0: 'black stone', 1: 'white stone' }, boardLabel: 'Board',
    rules: `
      <ol>
        <li><b>Goal:</b> get five of your stones in a straight line: across, down or diagonal. Six or more also wins.</li>
        <li>Stones go where the lines cross. Once placed, a stone never moves.</li>
        <li><b>Opening (Swap2):</b> the opener places three stones: two black, one white.</li>
        <li>The other player picks one of three: play White and place stone 4; play Black, so the opener plays White and places stone 4; or place two more stones (one black, one white) and let the opener pick the colour.</li>
        <li>Once colours are set, White moves first and the players take turns.</li>
        <li>If the board fills up and nobody has five, the game is a draw.</li>
        <li>"Next game" swaps who opens.</li>
      </ol>`,
  },
};

// ---------- settings ----------
const store = makeStore('gomoku');
let lang = initialLang();
let mode = store.get('mode', 'ai');
let level = store.get('level', 'normal');
if (!['ai', 'pvp'].includes(mode)) mode = 'ai';
if (!['easy', 'normal', 'hard'].includes(level)) level = 'normal';

const HUMAN = 0;      // vs computer, the person is player 1 (left on the scoreboard)
let opener = 0;       // player 1 opens game 1; "Next game" swaps
let state = null;
let busy = false;
// Session score only, by player identity: a reload starts over.
let score = [0, 0], gameNo = 1, counted = false, overlayHidden = false;
let hover = -1, aim = -1, cursor = 112, pointer = 'mouse';
const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

// ---------- board DOM ----------
const boardEl = $('board'), stonesL = $('stones'), marksL = $('marks'), cellsL = $('cells'), winSvg = $('winline');
const SVGNS = 'http://www.w3.org/2000/svg';
const place = (el, i) => { el.style.setProperty('--r', Math.floor(i / N)); el.style.setProperty('--c', i % N); };

(function drawGrid() {
  const g = $('grid');
  let s = `<rect class="field" x=".5" y=".5" width="14" height="14"/>`;
  for (let k = 0; k < N; k++) {
    const v = k + 0.5, cls = k === 0 || k === N - 1 ? ' class="edge"' : '';
    s += `<line${cls} x1="${v}" y1=".5" x2="${v}" y2="14.5"/><line${cls} x1=".5" y1="${v}" x2="14.5" y2="${v}"/>`;
  }
  for (const i of E.STARS) s += `<circle class="star" cx="${(i % N) + 0.5}" cy="${Math.floor(i / N) + 0.5}" r=".085"/>`;
  g.innerHTML = s;
})();

const cellBtns = [];
for (let i = 0; i < SIZE; i++) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'cellbtn at';
  b.dataset.i = i;
  b.setAttribute('role', 'gridcell');
  place(b, i);
  b.addEventListener('click', () => onCell(i));
  cellsL.appendChild(b);
  cellBtns.push(b);
}
cellsL.addEventListener('pointerdown', (e) => { pointer = e.pointerType || 'mouse'; });
cellsL.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const i = Number(e.target.dataset?.i);
  if (Number.isInteger(i) && i !== hover) { hover = i; renderMarks(); }
});
cellsL.addEventListener('pointerleave', () => { if (hover !== -1) { hover = -1; renderMarks(); } });
// Keyboard: one cell is focusable; arrows move it, Enter or Space places.
cellsL.addEventListener('keydown', (e) => {
  const d = { ArrowUp: -N, ArrowDown: N, ArrowLeft: -1, ArrowRight: 1 }[e.key];
  pointer = 'key';
  if (d === undefined) return;
  e.preventDefault();
  const r = Math.floor(cursor / N), c = cursor % N;
  const nr = r + (d === -N ? -1 : d === N ? 1 : 0), nc = c + (d === -1 ? -1 : d === 1 ? 1 : 0);
  if (nr < 0 || nr >= N || nc < 0 || nc >= N) return;
  setCursor(nr * N + nc, true);
});
function setCursor(i, focus) {
  cellBtns[cursor].tabIndex = -1;
  cursor = i;
  cellBtns[cursor].tabIndex = 0;
  if (focus) cellBtns[cursor].focus();
}

const stoneEls = new Map();
function syncStones() {
  for (const m of state.moves) {
    if (m.t !== 'stone' || stoneEls.has(m.i)) continue;
    const el = document.createElement('div');
    el.className = 'stone at new ' + (m.color === BLACK ? 'b' : 'w');
    el.innerHTML = '<i></i>';
    place(el, m.i);
    stonesL.appendChild(el);
    stoneEls.set(m.i, el);
    setTimeout(() => el.classList.remove('new'), 400);
  }
}

function drawWinLines() {
  winSvg.innerHTML = '';
  for (const run of state.lines) {
    const a = run[0], z = run[run.length - 1];
    const x1 = (a % N) + 0.5, y1 = Math.floor(a / N) + 0.5, x2 = (z % N) + 0.5, y2 = Math.floor(z / N) + 0.5;
    for (const cls of ['glow', 'shade', 'core']) {
      const ln = document.createElementNS(SVGNS, 'line');
      ln.setAttribute('class', cls);
      ln.setAttribute('pathLength', '1');
      ln.setAttribute('x1', x1); ln.setAttribute('y1', y1); ln.setAttribute('x2', x2); ln.setAttribute('y2', y2);
      winSvg.appendChild(ln);
    }
    for (const i of run) stoneEls.get(i)?.classList.add('won');
  }
}

// ---------- game flow ----------
const over = () => E.isOver(state);
const isAiTurn = () => mode === 'ai' && !over() && E.actor(state) !== HUMAN;
const humanPlaces = () => !over() && !busy && !isAiTurn() && E.stoneColor(state) !== null;
const name = (p) => (mode === 'ai' ? (p === HUMAN ? T[lang].you : T[lang].cpu) : T[lang].p[p]);

const ai = new AIClient(new URL('./ai-worker.js', import.meta.url), onAiReply);

function newGame() {
  ai.cancel();
  busy = false;
  state = E.initialState(opener);
  counted = false; overlayHidden = false; hover = -1; aim = -1;
  stonesL.innerHTML = ''; winSvg.innerHTML = '';
  stoneEls.clear();
  render();
  maybeAi();
}

function resetMatch() { score = [0, 0]; gameNo = 1; opener = 0; }

function play(m) {
  state = E.applyMove(state, m);
  aim = -1;
  syncStones();
  if (over()) {
    if (!counted) { counted = true; if (state.winner !== null) score[state.winner]++; }
    drawWinLines();
  }
  render();
  maybeAi();
}

function maybeAi() {
  if (!isAiTurn()) return;
  busy = true;
  render();
  ai.ask({ state, level, gameNo });
}

const aiStats = [];
function onAiReply({ move, ms, depth, nodes }) {
  busy = false;
  aiStats.push({ phase: state.phase, level, ms, depth, nodes });
  const ok = move && (move.t === 'stone' ? E.canPlace(state, move.i) : E.legalChoices(state).includes(move.v));
  if (ok && isAiTurn()) play(move); else render();
}

function onCell(i) {
  if (!humanPlaces() || !E.canPlace(state, i)) return;
  setCursor(i, false);
  // On a touch screen the points are small, so the first tap aims and the second places.
  if (pointer === 'touch' && aim !== i) { aim = i; render(); return; }
  play({ t: 'stone', i });
}

function onChoice(v) {
  if (over() || busy || isAiTurn() || !E.legalChoices(state).includes(v)) return;
  play({ t: 'choice', v });
}

// ---------- rendering ----------
function render() {
  const L = T[lang];
  applyStatic(L, lang);
  setSeg('modeSeg', mode); setSeg('levelSeg', level);
  $('levelRow').hidden = mode !== 'ai';
  $('fairNote').innerHTML = L.fair;
  $('rulesBody').innerHTML = L.rules;
  cellsL.setAttribute('aria-label', L.boardLabel);
  const a = E.actor(state);
  boardEl.classList.toggle('turn-0', a === 0);
  boardEl.classList.toggle('turn-1', a === 1);
  boardEl.classList.toggle('over', over());
  const orb = (p) => (state.colorOf ? (state.colorOf[p] === BLACK ? 'black' : 'white') : 'tbd');
  renderScore({
    left: { name: name(0), pts: score[0], on: !over() && a === 0, orb: orb(0) },
    right: { name: name(1), pts: score[1], on: !over() && a === 1, orb: orb(1) },
    roundBold: L.round(gameNo),
    roundSmall: L.opens(name(opener)),
  });
  for (const [id, p] of [['sbMint', 0], ['sbCoral', 1]]) $(id).title = state.colorOf ? L.color[state.colorOf[p]] : '';
  renderStatusLine();
  renderChoices();
  renderMoves();
  renderMarks();
  renderCells();
  renderResult();
  $('nextBtn').hidden = !over();
}

function renderStatusLine() {
  const L = T[lang];
  const a = E.actor(state), col = E.stoneColor(state), ai = isAiTurn();
  const you = mode === 'ai';
  let msg = '', sub = '';
  if (over()) {
    msg = state.winner === null ? L.drawBig : you ? (state.winner === HUMAN ? L.winYou : L.winAi) : L.winP(name(state.winner));
    renderStatus({ side: null, end: true, msg, ply: L.endPly(state.stones), sub: state.winner === null ? L.drawEnd : '' });
    return;
  }
  const ph = state.phase;
  if (ai) {
    msg = { open3: L.aiOpen, swap: L.aiChoose, open2: L.aiTwo, pick: L.aiPick, play: L.aiMove }[ph];
  } else if (ph === 'open3') {
    msg = you ? L.youOpen : L.pOpen(name(a));
    sub = L.open3Hint(state.placed + 1, L.color[col]);
  } else if (ph === 'swap') {
    msg = you ? L.youChoose : L.pChoose(name(a));
    sub = L.swapHint;
  } else if (ph === 'open2') {
    msg = you ? L.youTwo : L.pTwo(name(a));
    sub = L.open2Hint(state.placed + 1, L.color[col]);
  } else if (ph === 'pick') {
    msg = you ? L.youPick : L.pPick(name(a));
    sub = L.pickHint;
  } else {
    msg = you ? L.yourMove(L.color[col]) : L.pMove(name(a), L.color[col]);
    const lastM = state.moves[state.moves.length - 1];
    if (lastM && lastM.t === 'choice') sub = L.chose(name(lastM.player), lastM.v) + L.stop + L.playHint;
  }
  if (!ai && col !== null) {
    if (aim >= 0) sub = L.tapAgain(E.cellName(aim));
    else if (coarse && state.stones === 0) sub += (lang === 'zh' ? '' : ' ') + L.tapAim;
  }
  renderStatus({ side: col, end: false, msg, thinking: ai, ply: col !== null ? L.stoneN(state.stones + 1) : '', sub });
}

function renderChoices() {
  const L = T[lang];
  const box = $('choices');
  const show = !over() && !busy && !isAiTurn() && (state.phase === 'swap' || state.phase === 'pick');
  const appearing = show && box.hidden;
  box.hidden = !show;
  box.innerHTML = '';
  if (!show) return;
  // the buttons sit under the board; bring them into view when a choice is due
  if (appearing) {
    requestAnimationFrame(() => {
      const r = box.getBoundingClientRect();
      if (r.bottom > window.innerHeight || r.top < 0) {
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        box.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
      }
    });
  }
  const icon = { white: 'mini w', black: 'mini b', two: 'mini pair' };
  const opts = state.phase === 'swap' ? L.opt : L.pickOpt;
  for (const v of E.legalChoices(state)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ga-btn';
    b.dataset.v = v;
    b.innerHTML = `<i class="${icon[v]}" aria-hidden="true"></i><span>${opts[v]}</span>`;
    b.addEventListener('click', () => onChoice(v));
    box.appendChild(b);
  }
}

function renderMoves() {
  const L = T[lang];
  // opening stones also say who placed them, since one player places both colours there
  const settled = state.moves.findIndex((x) => x.t === 'choice' && x.v !== 'two');
  const rows = state.moves.map((m, k) => {
    if (m.t === 'choice') return { side: 0, choice: true, text: L.chose(name(m.player), m.v) };
    const opening = settled < 0 || k < settled;
    return { side: m.color, text: `${L.color[m.color]} ${E.cellName(m.i)}` + (opening ? ` <span class="who">· ${name(m.player)}</span>` : '') };
  });
  renderLog(rows, () => '');
  // stone numbers instead of row numbers; the Swap2 choices get a small diamond
  const lis = $('log').querySelectorAll('li');
  let n = 0;
  rows.forEach((r, k) => {
    const li = lis[k];
    if (r.choice) { li.classList.add('choice'); li.querySelector('.n').textContent = ''; li.querySelector('.d').className = 'd choice'; }
    else li.querySelector('.n').textContent = ++n;
  });
}

function renderMarks() {
  marksL.innerHTML = '';
  if (state.last >= 0) addMark('mark last', state.last);
  if (!humanPlaces()) return;
  const col = E.stoneColor(state);
  const at = aim >= 0 ? aim : hover;
  if (at >= 0 && state.board[at] === -1) {
    const g = addMark('ghost ' + (col === BLACK ? 'b' : 'w') + (aim >= 0 ? ' aim' : ''), at);
    g.innerHTML = '<i></i>';
  }
}

function addMark(cls, i) {
  const d = document.createElement('div');
  d.className = cls + ' at';
  place(d, i);
  marksL.appendChild(d);
  return d;
}

function renderCells() {
  const L = T[lang];
  const can = humanPlaces();
  for (let i = 0; i < SIZE; i++) {
    const b = cellBtns[i], v = state.board[i];
    b.classList.toggle('act', can && v === -1);
    b.setAttribute('aria-label', `${E.cellName(i)}, ${v === -1 ? L.cell.empty : L.cell[v]}`);
    b.tabIndex = i === cursor ? 0 : -1;
  }
}

function renderResult() {
  const L = T[lang];
  if (!over()) { renderOverlay({ show: false }); return; }
  let big, small;
  if (state.winner === null) { big = L.drawBig; small = L.drawEnd; }
  else {
    big = mode === 'ai' ? (state.winner === HUMAN ? L.winYou : L.winAi) : L.winP(name(state.winner));
    small = L.endSmall(L.color[state.colorOf[state.winner]], state.stones);
  }
  renderOverlay({ show: !overlayHidden, kind: 'draw', big, small, next: L.next, look: L.look });
}

// ---------- controls ----------
bindLang((v) => { lang = v; render(); });
onSeg('modeSeg', (v) => { if (v === mode) return; mode = v; store.set('mode', v); resetMatch(); newGame(); });
onSeg('levelSeg', (v) => { level = v; store.set('level', v); render(); });
$('restartBtn').onclick = async () => {
  if (!over() && state.moves.length) {
    const L = T[lang];
    if (!(await confirmDialog(L.restartAsk, L.restartNo, L.restartYes))) return;
  }
  newGame();
};
function nextGame() { opener = 1 - opener; gameNo++; newGame(); }
$('nextBtn').onclick = nextGame;
$('ovNext').onclick = nextGame;
$('ovLook').onclick = () => { overlayHidden = true; renderOverlay({ show: false }); };

newGame();

// exposed for automated tests
window.__gomoku = {
  get state() { return state; }, get busy() { return busy; }, get score() { return score.slice(); },
  get gameNo() { return gameNo; }, get mode() { return mode; }, get aiStats() { return aiStats.slice(); },
  get actor() { return E.actor(state); },
  nextGame,
};
