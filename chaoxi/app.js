import * as E from './engine.js';
import {
  $, makeStore, initialLang, bindLang, applyStatic, setSeg, onSeg,
  renderScore, renderStatus, renderLog, renderOverlay, confirmDialog, AIClient,
} from '../assets/shell.js';

const { MINT, CORAL, R, C, CELLS, HEIGHTS, TIDE, TARGET } = E;

// ---------- copy ----------
const T = {
  zh: {
    setup: '設定', mode: '模式', modeAi: '對電腦', modePvp: '雙人同機',
    level: '電腦', easy: '簡單', normal: '普通', hard: '困難',
    restart: '重新開始', next: '下一局（交換先手）',
    moves: '棋譜', noMoves: '還沒有人走棋。', rulesTitle: '怎麼玩',
    footer1: '沒有骰子，沒有計時，沒有隱藏資訊。', footer2: '公平性檢查', footer3: '全部遊戲',
    tag: '5 × 5 · 潮位 0 1 2 3 2 1',
    side: ['薄荷', '珊瑚'], you: '你', cpu: '電腦',
    round: (n) => `第 ${n} 局`, firstMove: (s) => `${T.zh.side[s]}先手`,
    plyN: (n) => `第 ${n} 手`,
    turnYou: '輪到你', turnAi: '電腦思考中', turnSide: (s) => `輪到${T.zh.side[s]}`,
    hint: '點自己的棋子，再點圓點走一格。只能走到乾的格子。虛線框是這一手之後會被淹的格子。',
    hintSel: '點一個圓點走過去，或點另一枚棋子改選。',
    gauge: (lv, up, nx) => `潮位 ${lv}，${up ? '上漲中' : '退潮中'}；下一手 ${nx}`,
    stuck: (cells) => `${cells.join('、')} 的棋子站在水裡，退潮前不能動。`,
    passNow: '兩枚棋子都困在水裡，這一回合跳過。',
    rep: '這個局面已經出現兩次。再出現一次就和棋。',
    drawTag: '和',
    drawAsk: '這一步會讓同一局面第三次出現，結果是和棋。',
    drawCancel: '換一步', drawOk: '確定走出，接受和棋',
    winYou: '你贏了', winAi: '電腦獲勝', winSide: (s) => `${T.zh.side[s]}勝`,
    drawBig: '和局', drawEnd: '同一局面第三次出現。',
    reached: (n) => `抵達對岸 · 共 ${n} 手`,
    look: '看一下棋盤',
    logPass: '困在水裡，跳過',
    cellLabel: (n, what) => `${n}${what ? '，' + what : ''}`,
    lblHeight: (h, wet) => `地勢 ${h}${wet ? '，現在是水' : ''}`,
    lblPiece: (side) => `${T.zh.side[side]}的棋子`, lblDest: '可以走到這裡',
    note: '<b>已完整求解。</b>從這個開局，電腦把 910,800 個局面都算過了：雙方都無法強迫取勝，誰先走都一樣。先走的一方有 3 種第一手，2 種保持均勢；另一種（d1→d2）會讓對手強迫取勝，不過還要再走 39 手。',
    rules: `
      <ol>
        <li><b>目標：</b>把自己的一枚棋子走到對岸的正中格。薄荷要到 c5，珊瑚要到 c1。</li>
        <li>每一格有地勢高低，從 0 到 3，寫在格子的左上角。兩邊的岸都是 3。</li>
        <li><b>潮水照固定的順序漲落：</b>0、1、2、3、2、1，然後再來一次。每走一手，潮位就換到下一個。地勢比潮位低的格子是水。棋盤下方的潮位表會標出現在和下一手的潮位。</li>
        <li><b>每回合走一枚棋子一格：</b>上下左右，走到空著、而且現在是乾的格子。</li>
        <li><b>站在水裡的棋子不能動，</b>要等潮水退到它的格子變乾。虛線框是這一手之後會被淹的格子。</li>
        <li>兩枚棋子都動不了時，這一回合跳過。</li>
        <li>同一個局面第三次出現時，判和棋。會造成和棋的走法標著「和」。</li>
      </ol>`,
  },
  en: {
    setup: 'Setup', mode: 'Mode', modeAi: 'vs computer', modePvp: 'Two players',
    level: 'Computer', easy: 'Easy', normal: 'Normal', hard: 'Hard',
    restart: 'Restart', next: 'Next game (swap first move)',
    moves: 'Moves', noMoves: 'No moves yet.', rulesTitle: 'How to play',
    footer1: 'No dice, no timer, nothing hidden.', footer2: 'How we checked fairness', footer3: 'All games',
    tag: '5 × 5 · tide 0 1 2 3 2 1',
    side: ['Mint', 'Coral'], you: 'You', cpu: 'Computer',
    round: (n) => `Game ${n}`, firstMove: (s) => `${T.en.side[s]} first`,
    plyN: (n) => `Move ${n}`,
    turnYou: 'Your move', turnAi: 'Computer is thinking', turnSide: (s) => `${T.en.side[s]} to move`,
    hint: 'Tap one of your pieces, then a dot, to move one square. You can only move onto dry ground. Dashed squares flood after this move.',
    hintSel: 'Tap a dot to move there, or tap your other piece instead.',
    gauge: (lv, up, nx) => `Tide ${lv}, ${up ? 'rising' : 'falling'}; next move ${nx}`,
    stuck: (cells) => `The piece on ${cells.join(' and ')} is standing in water and cannot move until the tide falls.`,
    passNow: 'Both pieces are stuck in water, so this turn passes.',
    rep: 'This position has come up twice. Once more and the game is a draw.',
    drawTag: '=',
    drawAsk: 'This move brings the same position up for the third time, so the game ends in a draw.',
    drawCancel: 'Choose another move', drawOk: 'Play it and draw',
    winYou: 'You win', winAi: 'Computer wins', winSide: (s) => `${T.en.side[s]} wins`,
    drawBig: 'Draw', drawEnd: 'The same position came up a third time.',
    reached: (n) => `reached the far shore · ${n} moves`,
    look: 'Look at the board',
    logPass: 'stuck in water, passes',
    cellLabel: (n, what) => `${n}${what ? ', ' + what : ''}`,
    lblHeight: (h, wet) => `height ${h}${wet ? ', under water now' : ''}`,
    lblPiece: (side) => `${T.en.side[side]} piece`, lblDest: 'can move here',
    note: '<b>Solved.</b> From this start a computer has worked through all 910,800 positions: neither side can force a win, whoever moves first. The first player has 3 first moves; 2 keep the balance, and the other (d1 to d2) lets the opponent force a win, though it takes another 39 moves.',
    rules: `
      <ol>
        <li><b>Goal:</b> bring one of your pieces to the middle of the far shore. Mint aims for c5, Coral for c1.</li>
        <li>Every square has a height from 0 to 3, written in its top left corner. Both shores are 3.</li>
        <li><b>The tide rises and falls on a fixed schedule:</b> 0, 1, 2, 3, 2, 1, and round again, one step after every move. A square lower than the tide is under water. The gauge under the board shows the tide now and after this move.</li>
        <li><b>Each turn, move one piece one square:</b> up, down, left or right, onto an empty square that is dry now.</li>
        <li><b>A piece standing in water cannot move</b> until the tide falls and its square is dry again. Dashed squares flood after this move.</li>
        <li>If neither of your pieces can move, your turn passes.</li>
        <li>When the same position comes up for the third time, the game is a draw. Moves that would cause this are marked "=".</li>
      </ol>`,
  },
};

// ---------- settings and match state ----------
const store = makeStore('chaoxi');
let lang = initialLang();
let mode = store.get('mode', 'ai');
let level = store.get('level', 'normal');
if (!['ai', 'pvp'].includes(mode)) mode = 'ai';
if (!['easy', 'normal', 'hard'].includes(level)) level = 'normal';

const HUMAN = MINT;
let first = MINT;
let state = null;
let busy = false;
let rows = [];
let score = [0, 0], gameNo = 1, counted = false, overlayHidden = false;
let sel = -1;          // selected piece (cell)

// ---------- geometry (board units; a cell is 100, the tide gauge sits under the board) ----------
const S = 100, GY = 600;
const centre = (i) => [(i % C) * S + S / 2, Math.floor(i / C) * S + S / 2];
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs, parent) => {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
};

const boardEl = $('board');
const hitEls = [], waterEls = [], soonEls = [], barEls = [];
let pieceEls = new Map(), gnowEl, gtextEl;

function buildBoard() {
  const cells = $('cells');
  for (let i = 0; i < CELLS; i++) {
    const [x, y] = centre(i);
    svg('rect', { class: 'ground h' + HEIGHTS[i], x: x - S / 2, y: y - S / 2, width: S, height: S }, cells);
    if (HEIGHTS[i] === 3 && Math.floor(i / C) > 0 && Math.floor(i / C) < R - 1) svg('rect', { class: 'rock', x: x - 40, y: y - 40, width: 80, height: 80, rx: 14 }, cells);
  }
  svg('rect', { class: 'frame', x: 0, y: 0, width: C * S, height: R * S }, cells);
  for (let c = 0; c < C; c++) svg('text', { class: 'lbl', x: c * S + S / 2, y: -24, 'font-size': 16 }, cells).textContent = 'abcde'[c];
  for (let r = 0; r < R; r++) svg('text', { class: 'lbl', x: -24, y: r * S + S / 2, 'font-size': 16 }, cells).textContent = R - r;
  const water = $('water');
  for (let i = 0; i < CELLS; i++) {
    const [x, y] = centre(i);
    waterEls.push(svg('rect', { class: 'water', x: x - S / 2, y: y - S / 2, width: S, height: S }, water));
    svg('text', { class: 'hnum', x: x - S / 2 + 9, y: y - S / 2 + 20 }, $('nums')).textContent = HEIGHTS[i];
    soonEls.push(svg('rect', { class: 'soon', x: x - 42, y: y - 42, width: 84, height: 84, rx: 8 }, water));
  }
  const tg = $('targets');
  for (const side of [MINT, CORAL]) {
    const [x, y] = centre(TARGET[side]);
    const g = svg('g', { class: 'tgt ' + (side === MINT ? 'm' : 'c'), id: 'tgt' + side }, tg);
    svg('circle', { class: 'core', cx: x, cy: y, r: 10 }, g);
    const sp = svg('g', { class: 'spin' }, g);
    svg('circle', { cx: x, cy: y, r: 38, 'stroke-dasharray': '3 6' }, sp);
  }
  const hits = $('hits');
  for (let i = 0; i < CELLS; i++) {
    const [x, y] = centre(i);
    const h = svg('rect', { class: 'hitbox', x: x - S / 2, y: y - S / 2, width: S, height: S, role: 'button', tabindex: -1 }, hits);
    h.addEventListener('click', () => onCell(i));
    h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCell(i); } });
    hitEls.push(h);
  }
  // tide gauge: one bar per step of the cycle
  const gauge = $('gauge');
  svg('line', { class: 'gbase', x1: 0, y1: GY + 40, x2: TIDE.length * 38 - 12, y2: GY + 40 }, gauge);
  TIDE.forEach((lv, k) => {
    const h = 8 + lv * 18;
    barEls.push(svg('rect', { class: 'gbar', x: k * 38, y: GY + 40 - h, width: 26, height: h, rx: 3 }, gauge));
  });
  gnowEl = svg('rect', { class: 'gnow', x: -5, y: GY - 28, width: 36, height: 74, rx: 6 }, gauge);
  gtextEl = svg('text', { class: 'gtext', x: TIDE.length * 38 + 14, y: GY + 18 }, gauge);
}

function makePiece(side, cell) {
  const g = svg('g', { class: 'piece ' + (side === MINT ? 'm' : 'c') }, $('pieces'));
  svg('circle', { class: 'sel', r: 37 }, g);
  svg('circle', { class: 'body', r: 30 }, g);
  svg('circle', { class: 'ring', r: 15 }, g);
  svg('circle', { class: 'veil', r: 31 }, g);
  place(g, cell, false);
  return g;
}
function place(el, cell, animate) {
  const [x, y] = centre(cell);
  if (!animate) el.style.transition = 'none';
  el.style.transform = `translate(${x}px, ${y}px)`;
  if (!animate) { void el.getBoundingClientRect(); el.style.transition = ''; }
}
function syncPieces() {
  $('pieces').innerHTML = '';
  pieceEls = new Map();
  state.pieces.forEach((cell, t) => pieceEls.set(cell, makePiece(t < 2 ? MINT : CORAL, cell)));
}

function drawTide() {
  const ph = state.phase, nx = (ph + 1) % TIDE.length;
  for (let i = 0; i < CELLS; i++) {
    const w = E.wet(i, ph);
    waterEls[i].classList.toggle('on', w);
    soonEls[i].classList.toggle('on', !over() && !w && E.wet(i, nx));
  }
  barEls.forEach((b, k) => { b.classList.toggle('now', k === ph); b.classList.toggle('next', k === nx && !over()); });
  gnowEl.style.transform = `translate(${ph * 38}px, 0)`;
  gtextEl.textContent = T[lang].gauge(TIDE[ph], E.rising(ph), TIDE[nx]);
}

// ---------- game flow ----------
const isAiTurn = () => mode === 'ai' && state.turn !== HUMAN;
const over = () => state.winner !== null || state.draw;
const name = (side) => (mode === 'ai' ? (side === HUMAN ? T[lang].you : T[lang].cpu) : T[lang].side[side]);
const humanCanMove = () => !over() && !busy && !isAiTurn();
// the piece whose moves are shown: the selected one, or the only one that can move
function activePiece() {
  const ms = E.legalMoves(state).filter((m) => m.t === 'step');
  if (sel >= 0 && ms.some((m) => m.from === sel)) return sel;
  const fs = [...new Set(ms.map((m) => m.from))];
  return fs.length === 1 ? fs[0] : -1;
}

const ai = new AIClient(new URL('./ai-worker.js', import.meta.url), (r) => onAiReply(r));

function newGame() {
  ai.cancel();
  busy = false;
  state = E.initialState(first);
  rows = [];
  counted = false; overlayHidden = false; sel = -1;
  syncPieces();
  render();
  maybeAi();
}

function play(mv) {
  const side = state.turn;
  state = E.applyMove(state, mv);
  rows.push({ side, mv });
  sel = -1;
  if (mv.t === 'step') {
    const el = pieceEls.get(mv.from);
    pieceEls.delete(mv.from);
    if (el) { place(el, mv.to, true); pieceEls.set(mv.to, el); }
  }
  if (over() && !counted) {
    counted = true;
    if (state.winner !== null) score[state.winner]++;
  }
  render();
  maybeAi();
}

function maybeAi() {
  if (over() || !isAiTurn()) return;
  busy = true;
  render();
  ai.ask({ state: { pieces: state.pieces, phase: state.phase, turn: state.turn }, history: [...state.history], level });
}

function onAiReply({ move }) {
  if (over() || !isAiTurn()) return;
  const legal = E.legalMoves(state).find((x) => E.sameMove(x, move));
  busy = false;
  if (legal) play(legal); else render();
}

async function tryPlay(mv) {
  if (E.makesDraw(state, mv)) {
    const L = T[lang];
    if (!(await confirmDialog(L.drawAsk, L.drawCancel, L.drawOk))) return;
  }
  play(mv);
}

function onCell(i) {
  if (!humanCanMove()) return;
  const ms = E.legalMoves(state);
  const own = state.pieces.slice(state.turn * 2, state.turn * 2 + 2);
  if (own.includes(i)) {
    sel = sel === i ? -1 : ms.some((m) => m.t === 'step' && m.from === i) ? i : -1;
    render();
    return;
  }
  const a = activePiece();
  const mv = ms.find((m) => m.t === 'step' && m.from === a && m.to === i);
  if (mv) tryPlay(mv);
}

// ---------- rendering ----------
function render() {
  const L = T[lang];
  applyStatic(L, lang);
  setSeg('modeSeg', mode); setSeg('levelSeg', level);
  $('levelRow').hidden = mode !== 'ai';
  $('note').innerHTML = L.note;
  $('rulesBody').innerHTML = L.rules;
  $('tag').textContent = L.tag;
  $('nextBtn').hidden = !over();

  boardEl.classList.toggle('turn-0', !over() && state.turn === MINT);
  boardEl.classList.toggle('turn-1', !over() && state.turn === CORAL);
  boardEl.classList.toggle('over', over());

  renderScore({
    left: { name: name(MINT), pts: score[MINT], on: !over() && state.turn === MINT },
    right: { name: name(CORAL), pts: score[CORAL], on: !over() && state.turn === CORAL },
    roundBold: L.round(gameNo), roundSmall: L.firstMove(first),
  });

  drawTide();
  const wetNow = E.stranded(state);
  const canMove = humanCanMove();
  const moves = canMove ? E.legalMoves(state) : [];
  const act = canMove ? activePiece() : -1;

  let msg, sub = '', thinking = false;
  if (state.winner !== null) msg = mode === 'ai' ? (state.winner === HUMAN ? L.winYou : L.winAi) : L.winSide(state.winner);
  else if (state.draw) msg = L.drawBig;
  else if (isAiTurn()) { msg = L.turnAi; thinking = true; }
  else {
    msg = mode === 'ai' ? L.turnYou : L.turnSide(state.turn);
    if (moves.length === 1 && moves[0].t === 'pass') sub = L.passNow;
    else {
      sub = act >= 0 ? L.hintSel : L.hint;
      const stuck = [0, 1].map((k) => state.turn * 2 + k).filter((t) => wetNow[t]).map((t) => E.cellName(state.pieces[t]));
      if (stuck.length) sub += ' ' + L.stuck(stuck);
    }
    if (E.repeatCount(state) >= 2) sub += ' ' + L.rep;
  }
  renderStatus({ side: over() ? null : state.turn, end: over(), msg, thinking, ply: L.plyN(state.ply), sub });

  const last = state.lastMove && state.lastMove.t === 'step' ? state.lastMove.to : -1;
  for (const [cell, el] of pieceEls) {
    el.classList.toggle('wet', E.wet(cell, state.phase) && !over());
    el.classList.toggle('selected', cell === act && canMove);
    el.classList.toggle('last', cell === last);
  }
  for (const side of [MINT, CORAL]) $('tgt' + side).classList.toggle('hit', state.winner === side);

  const dots = $('dots');
  dots.innerHTML = '';
  const dest = new Set();
  for (const m of moves) {
    if (m.t !== 'step' || m.from !== act) continue;
    dest.add(m.to);
    const [x, y] = centre(m.to);
    svg('circle', { class: 'dot', cx: x, cy: y, r: 9 }, dots);
    if (E.makesDraw(state, m)) svg('text', { class: 'tag', x: x + 30, y: y - 30 }, dots).textContent = L.drawTag;
  }
  const from = new Set(moves.filter((m) => m.t === 'step').map((m) => m.from));
  for (let i = 0; i < CELLS; i++) {
    const clickable = dest.has(i) || from.has(i);
    hitEls[i].classList.toggle('act', clickable);
    hitEls[i].setAttribute('tabindex', clickable ? 0 : -1);
    const t = state.pieces.indexOf(i);
    let what = L.lblHeight(HEIGHTS[i], E.wet(i, state.phase));
    if (t >= 0) what += ', ' + L.lblPiece(t < 2 ? MINT : CORAL);
    if (dest.has(i)) what += ', ' + L.lblDest;
    hitEls[i].setAttribute('aria-label', L.cellLabel(E.cellName(i), what));
  }

  renderLog(rows.map((row) => ({ side: row.side, text: row.mv.t === 'step' ? `${E.cellName(row.mv.from)}→${E.cellName(row.mv.to)}` : L.logPass })), name);

  let small = '';
  if (state.winner !== null) small = L.reached(state.ply);
  else if (state.draw) small = L.drawEnd;
  renderOverlay({
    show: over() && !overlayHidden,
    kind: state.winner === MINT ? 'mint' : state.winner === CORAL ? 'coral' : 'draw',
    big: msg, small, next: L.next, look: L.look,
  });

  if (canMove && moves.length === 1 && moves[0].t === 'pass') setTimeout(() => { if (humanCanMove()) play(moves[0]); }, 1000);
}

// ---------- wiring ----------
state = E.initialState(first);
buildBoard();
bindLang((l) => { lang = l; render(); });
onSeg('modeSeg', (v) => { if (v === mode) return; mode = v; store.set('mode', v); score = [0, 0]; gameNo = 1; first = MINT; newGame(); });
onSeg('levelSeg', (v) => { level = v; store.set('level', v); render(); });
$('restartBtn').onclick = () => newGame();
const nextGame = () => { first = 1 - first; gameNo++; newGame(); };
$('nextBtn').onclick = nextGame;
$('ovNext').onclick = nextGame;
$('ovLook').onclick = () => { overlayHidden = true; renderOverlay({ show: false }); };

newGame();

window.__game = {
  get state() { return state; },
  get busy() { return busy; },
  get score() { return score.slice(); },
};
