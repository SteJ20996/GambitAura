import * as E from './engine.js';
import {
  $, makeStore, initialLang, bindLang, applyStatic, setSeg, onSeg,
  renderScore, renderStatus, renderLog, renderOverlay, confirmDialog, AIClient,
} from '../assets/shell.js';

const { MINT, CORAL, R, C, CELLS, HEIGHTS, OWNER, TARGET } = E;

// ---------- copy ----------
const T = {
  zh: {
    setup: '設定', mode: '模式', modeAi: '對電腦', modePvp: '雙人同機',
    level: '電腦', easy: '簡單', normal: '普通', hard: '困難',
    restart: '重新開始', next: '下一局（交換先手）',
    moves: '棋譜', noMoves: '還沒有人走棋。', rulesTitle: '怎麼玩',
    footer1: '沒有骰子，沒有計時，沒有隱藏資訊。', footer2: '公平性檢查', footer3: '全部遊戲',
    sunAt: (k) => `太陽在${['北', '東北', '東', '東南', '南', '西南', '西', '西北'][k]}方`,
    side: ['薄荷', '珊瑚'], you: '你', cpu: '電腦',
    tower: ['矮塔', '高塔'],
    round: (n) => `第 ${n} 局`, firstMove: (s) => `${T.zh.side[s]}先手`,
    plyN: (n) => `第 ${n} 手`,
    turnYou: '輪到你', turnAi: '電腦思考中', turnSide: (s) => `輪到${T.zh.side[s]}`,
    hint: '點一座沒被影子罩住的塔，再點它旁邊的圓點。',
    hintSel: '點一個圓點把塔移過去。滑鼠停在圓點上，可以先看對手下一手的影子。',
    frozen: (names) => `${names.join('和')}在影子裡，這一手不能動。`,
    rep: '這個局面已經出現兩次。再出現一次就和棋。',
    drawTag: '和',
    drawAsk: '這一步會讓同一局面第三次出現，結果是和棋。',
    drawCancel: '換一步', drawOk: '確定走出，接受和棋',
    winYou: '你贏了', winAi: '電腦獲勝', winSide: (s) => `${T.zh.side[s]}勝`,
    drawBig: '和局', drawEnd: '同一局面第三次出現。',
    reached: (n) => `抵達目標 · 共 ${n} 手`,
    stuck: (who) => `${who}無路可走：塔都被影子罩住或被擋住`,
    look: '看一下棋盤',
    logMove: (tw, a, b) => `${tw} ${a}→${b}`,
    cellLabel: (n, what) => `${n}${what ? '，' + what : ''}`,
    lblTower: (side, tw, fz) => `${T.zh.side[side]}${tw}${fz ? '，在影子裡' : ''}`,
    lblDest: '可以走到這裡',
    note: '<b>已完整求解。</b>從這個開局，電腦把 4,857,600 個局面都算過了：不論誰先走，雙方都無法強迫取勝。先走的一方有 5 種第一手，2 種保持均勢；另外 3 種會讓對手強迫取勝，但還要再走 35 到 63 手才分出勝負。',
    rules: `
      <ol>
        <li><b>目標：</b>把自己的一座塔走到對面邊的正中格。薄荷要到 c5，珊瑚要到 c1。</li>
        <li>每方有一座矮塔和一座高塔。太陽在棋盤外，每走一手就順時針移一格。虛線圈是它下一手的位置。</li>
        <li>塔的影子往背對太陽的方向延伸：矮塔一格，高塔兩格。太陽在角落時，影子是斜的。</li>
        <li><b>站在影子裡的塔不能動，</b>不論是誰的影子，自己的也算。</li>
        <li><b>每回合走一座塔一格：</b>上下左右，走到空格。</li>
        <li>輪到你時，如果兩座塔都動不了，你就輸了。</li>
        <li>同一個局面第三次出現時，判和棋。會造成和棋的走法標著「和」。</li>
      </ol>`,
  },
  en: {
    setup: 'Setup', mode: 'Mode', modeAi: 'vs computer', modePvp: 'Two players',
    level: 'Computer', easy: 'Easy', normal: 'Normal', hard: 'Hard',
    restart: 'Restart', next: 'Next game (swap first move)',
    moves: 'Moves', noMoves: 'No moves yet.', rulesTitle: 'How to play',
    footer1: 'No dice, no timer, nothing hidden.', footer2: 'How we checked fairness', footer3: 'All games',
    sunAt: (k) => `Sun in the ${['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][k]}`,
    side: ['Mint', 'Coral'], you: 'You', cpu: 'Computer',
    tower: ['short tower', 'tall tower'],
    round: (n) => `Game ${n}`, firstMove: (s) => `${T.en.side[s]} first`,
    plyN: (n) => `Move ${n}`,
    turnYou: 'Your move', turnAi: 'Computer is thinking', turnSide: (s) => `${T.en.side[s]} to move`,
    hint: 'Tap a tower that is out of the shade, then one of the dots next to it.',
    hintSel: 'Tap a dot to move the tower there. Hover over a dot to see the shade your opponent will face next.',
    frozen: (names) => `The ${names.join(' and the ')} ${names.length > 1 ? 'are' : 'is'} in shade and cannot move this turn.`,
    rep: 'This position has come up twice. Once more and the game is a draw.',
    drawTag: '=',
    drawAsk: 'This move brings the same position up for the third time, so the game ends in a draw.',
    drawCancel: 'Choose another move', drawOk: 'Play it and draw',
    winYou: 'You win', winAi: 'Computer wins', winSide: (s) => `${T.en.side[s]} wins`,
    drawBig: 'Draw', drawEnd: 'The same position came up a third time.',
    reached: (n) => `reached the target · ${n} moves`,
    stuck: (who) => `${who} cannot move: both towers are in shade or blocked`,
    look: 'Look at the board',
    logMove: (tw, a, b) => `${tw} ${a}→${b}`,
    cellLabel: (n, what) => `${n}${what ? ', ' + what : ''}`,
    lblTower: (side, tw, fz) => `${T.en.side[side]} ${tw}${fz ? ', in shade' : ''}`,
    lblDest: 'can move here',
    note: '<b>Solved.</b> From this start a computer has worked through all 4,857,600 positions: whichever side moves first, neither can force a win. The first player has 5 first moves; 2 keep the balance, and the other 3 let the opponent force a win, though it takes another 35 to 63 moves.',
    rules: `
      <ol>
        <li><b>Goal:</b> bring one of your towers to the middle of the far edge. Mint aims for c5, Coral for c1.</li>
        <li>Each side has a short tower and a tall tower. The sun stands outside the board and moves one place clockwise after every move. The dashed ring shows where it goes next.</li>
        <li>A tower's shade points away from the sun: one square for the short tower, two for the tall one. When the sun is at a corner, the shade runs diagonally.</li>
        <li><b>A tower standing in shade cannot move,</b> whoever's shade it is, your own included.</li>
        <li><b>Each turn, move one tower one square:</b> up, down, left or right, onto an empty square.</li>
        <li>If neither of your towers can move on your turn, you lose.</li>
        <li>When the same position comes up for the third time, the game is a draw. Moves that would cause this are marked "=".</li>
      </ol>`,
  },
};

// ---------- settings and match state ----------
const store = makeStore('riying');
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
let sel = -1;        // selected tower index
let hover = -1;      // hovered cell

// ---------- geometry (board units; a cell is 100, the sun's path is 62 outside the board) ----------
const S = 100, SKY = 312;
const centre = (i) => [(i % C) * S + S / 2, Math.floor(i / C) * S + S / 2];
const sunPos = (k) => [250 + E.SUN_DC[k] * SKY, 250 + E.SUN_DR[k] * SKY];
const RAD = (t) => (HEIGHTS[t] === 2 ? 32 : 25);
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs, parent) => {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
};

const boardEl = $('board');
const hitEls = [], towerEls = [];
let sunEl, nextEl;

function buildBoard() {
  const cells = $('cells');
  for (let i = 0; i < CELLS; i++) {
    const [x, y] = centre(i);
    svg('rect', { class: 'cellbg', x: x - S / 2, y: y - S / 2, width: S, height: S }, cells);
  }
  svg('rect', { class: 'frame', x: 0, y: 0, width: C * S, height: R * S }, cells);
  for (let c = 0; c < C; c++) svg('text', { class: 'lbl', x: c * S + S / 2, y: -24, 'font-size': 16 }, cells).textContent = 'abcde'[c];
  for (let r = 0; r < R; r++) svg('text', { class: 'lbl', x: -24, y: r * S + S / 2, 'font-size': 16 }, cells).textContent = R - r;
  // the sun's path and its eight places
  const sky = $('sky');
  svg('rect', { class: 'orbit', x: 250 - SKY, y: 250 - SKY, width: 2 * SKY, height: 2 * SKY }, sky);
  for (let k = 0; k < 8; k++) { const [x, y] = sunPos(k); svg('circle', { class: 'station', cx: x, cy: y, r: 3 }, sky); }
  nextEl = svg('circle', { class: 'next', cx: 0, cy: 0, r: 19 }, sky);
  sunEl = svg('g', { class: 'sun' }, sky);
  svg('circle', { class: 'halo', r: 31 }, sunEl);
  const rays = svg('g', { class: 'ray' }, sunEl);
  for (let a = 0; a < 8; a++) {
    const t = (a * Math.PI) / 4, c = Math.cos(t), s = Math.sin(t);
    svg('line', { x1: c * 19, y1: s * 19, x2: c * 25, y2: s * 25 }, rays);
  }
  svg('circle', { class: 'core', r: 13 }, sunEl);
  // targets
  const tg = $('targets');
  for (const side of [MINT, CORAL]) {
    const [x, y] = centre(TARGET[side]);
    const g = svg('g', { class: 'tgt ' + (side === MINT ? 'm' : 'c'), id: 'tgt' + side }, tg);
    svg('circle', { class: 'core', cx: x, cy: y, r: 10 }, g);
    const sp = svg('g', { class: 'spin' }, g);
    svg('circle', { cx: x, cy: y, r: 30, 'stroke-dasharray': '3 6' }, sp);
  }
  // towers
  const tw = $('towers');
  for (let t = 0; t < 4; t++) {
    const g = svg('g', { class: 'tower ' + (OWNER[t] === MINT ? 'm' : 'c') }, tw);
    const r = RAD(t);
    svg('circle', { class: 'sel', r: r + 8 }, g);
    svg('circle', { class: 'body', r }, g);
    svg('circle', { class: 'ring', r: HEIGHTS[t] === 2 ? 21 : 12 }, g);
    if (HEIGHTS[t] === 2) svg('circle', { class: 'ring', r: 10 }, g);
    svg('circle', { class: 'veil', r: r + 1 }, g);
    towerEls.push(g);
  }
  // click and hover targets
  const hits = $('hits');
  for (let i = 0; i < CELLS; i++) {
    const [x, y] = centre(i);
    const h = svg('rect', { class: 'hitbox', x: x - S / 2, y: y - S / 2, width: S, height: S, role: 'button', tabindex: -1 }, hits);
    h.addEventListener('click', () => onCell(i));
    h.addEventListener('mouseenter', () => { hover = i; renderPreview(); });
    h.addEventListener('mouseleave', () => { if (hover === i) { hover = -1; renderPreview(); } });
    h.addEventListener('focus', () => { hover = i; renderPreview(); });
    h.addEventListener('blur', () => { if (hover === i) { hover = -1; renderPreview(); } });
    h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCell(i); } });
    hitEls.push(h);
  }
}

function drawSky(animate) {
  const [x, y] = sunPos(state.sun), [nx, ny] = sunPos((state.sun + 1) % 8);
  for (const el of [sunEl, nextEl]) if (!animate) el.style.transition = 'none';
  sunEl.style.transform = `translate(${x}px, ${y}px)`;
  nextEl.style.transform = `translate(${nx}px, ${ny}px)`;
  nextEl.style.opacity = over() ? 0 : '';
  if (!animate) for (const el of [sunEl, nextEl]) { void el.getBoundingClientRect(); el.style.transition = ''; }
}

function drawShade() {
  const sh = E.shades(state.towers, state.sun);
  const gs = $('shadows'), gc = $('shade');
  gs.innerHTML = ''; gc.innerHTML = '';
  const seen = new Set();
  sh.forEach((list, t) => {
    if (!list.length) return;
    const [x1, y1] = centre(state.towers[t]), [x2, y2] = centre(list[list.length - 1]);
    svg('line', { class: 'shadow', x1, y1, x2, y2, 'stroke-width': HEIGHTS[t] === 2 ? 52 : 40 }, gs);
    for (const i of list) {
      if (seen.has(i)) continue;
      seen.add(i);
      const [x, y] = centre(i);
      svg('rect', { class: 'shade', x: x - S / 2 + 5, y: y - S / 2 + 5, width: S - 10, height: S - 10, rx: 10 }, gc);
    }
  });
}

function placeTowers(animate) {
  state.towers.forEach((cell, t) => {
    const [x, y] = centre(cell), el = towerEls[t];
    if (!animate) el.style.transition = 'none';
    el.style.transform = `translate(${x}px, ${y}px)`;
    if (!animate) { void el.getBoundingClientRect(); el.style.transition = ''; }
  });
}

// the shade the other side will face after the hovered move
function renderPreview() {
  const g = $('preview');
  g.innerHTML = '';
  if (hover < 0 || !humanCanMove()) return;
  const m = E.legalMoves(state).find((x) => x.t === activeTower() && x.to === hover);
  if (!m) return;
  const n = E.step(state, m);
  const seen = new Set();
  for (const list of E.shades(n.towers, n.sun)) for (const i of list) {
    if (seen.has(i)) continue;
    seen.add(i);
    const [x, y] = centre(i);
    svg('rect', { class: 'pshade', x: x - S / 2 + 9, y: y - S / 2 + 9, width: S - 18, height: S - 18, rx: 8 }, g);
  }
}

// ---------- game flow ----------
const isAiTurn = () => mode === 'ai' && state.turn !== HUMAN;
const over = () => state.winner !== null || state.draw;
const name = (side) => (mode === 'ai' ? (side === HUMAN ? T[lang].you : T[lang].cpu) : T[lang].side[side]);
const humanCanMove = () => !over() && !busy && !isAiTurn();
// the tower whose moves are shown: the selected one, or the only one that can move
function activeTower() {
  const ms = E.legalMoves(state);
  if (sel >= 0 && ms.some((m) => m.t === sel)) return sel;
  const ts = [...new Set(ms.map((m) => m.t))];
  return ts.length === 1 ? ts[0] : -1;
}

const ai = new AIClient(new URL('./ai-worker.js', import.meta.url), (r) => onAiReply(r));

function newGame() {
  ai.cancel();
  busy = false;
  state = E.initialState(first);
  rows = [];
  counted = false; overlayHidden = false; hover = -1; sel = -1;
  placeTowers(false);
  drawSky(false);
  render();
  maybeAi();
}

function play(m) {
  const side = state.turn;
  state = E.applyMove(state, m);
  rows.push({ side, m });
  hover = -1; sel = -1;
  placeTowers(true);
  drawSky(true);
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
  ai.ask({ state: { towers: state.towers, sun: state.sun, turn: state.turn }, history: [...state.history], level });
}

function onAiReply({ move }) {
  if (over() || !isAiTurn()) return;
  const legal = E.legalMoves(state).find((x) => x.t === move.t && x.to === move.to);
  busy = false;
  if (legal) play(legal); else render();
}

async function tryPlay(m) {
  if (E.makesDraw(state, m)) {
    const L = T[lang];
    if (!(await confirmDialog(L.drawAsk, L.drawCancel, L.drawOk))) return;
  }
  play(m);
}

function onCell(i) {
  if (!humanCanMove()) return;
  const ms = E.legalMoves(state);
  const t = state.towers.indexOf(i);
  if (t >= 0 && OWNER[t] === state.turn) {
    sel = ms.some((m) => m.t === t) ? (sel === t ? -1 : t) : -1;
    render();
    return;
  }
  const a = activeTower();
  const m = ms.find((x) => x.t === a && x.to === i);
  if (m) tryPlay(m);
}

// ---------- rendering ----------
function render() {
  const L = T[lang];
  applyStatic(L, lang);
  setSeg('modeSeg', mode); setSeg('levelSeg', level);
  $('levelRow').hidden = mode !== 'ai';
  $('note').innerHTML = L.note;
  $('rulesBody').innerHTML = L.rules;
  $('tag').textContent = L.sunAt(state.sun);
  $('nextBtn').hidden = !over();

  boardEl.classList.toggle('turn-0', !over() && state.turn === MINT);
  boardEl.classList.toggle('turn-1', !over() && state.turn === CORAL);
  boardEl.classList.toggle('over', over());

  renderScore({
    left: { name: name(MINT), pts: score[MINT], on: !over() && state.turn === MINT },
    right: { name: name(CORAL), pts: score[CORAL], on: !over() && state.turn === CORAL },
    roundBold: L.round(gameNo), roundSmall: L.firstMove(first),
  });

  drawShade();
  const fz = E.frozen(state);
  const canMove = humanCanMove();
  const moves = canMove ? E.legalMoves(state) : [];
  const act = canMove ? activeTower() : -1;

  let msg, sub = '', thinking = false;
  if (state.winner !== null) msg = mode === 'ai' ? (state.winner === HUMAN ? L.winYou : L.winAi) : L.winSide(state.winner);
  else if (state.draw) msg = L.drawBig;
  else if (isAiTurn()) { msg = L.turnAi; thinking = true; }
  else {
    msg = mode === 'ai' ? L.turnYou : L.turnSide(state.turn);
    sub = act >= 0 ? L.hintSel : L.hint;
    const stuckNames = [0, 1].filter((k) => fz[state.turn * 2 + k]).map((k) => L.tower[k]);
    if (stuckNames.length) sub += ' ' + L.frozen(stuckNames);
    if (E.repeatCount(state) >= 2) sub += ' ' + L.rep;
  }
  renderStatus({ side: over() ? null : state.turn, end: over(), msg, thinking, ply: L.plyN(state.ply), sub });

  const lastTower = state.last ? state.last.t : -1;
  towerEls.forEach((el, t) => {
    el.classList.toggle('frozen', fz[t] && !over());
    el.classList.toggle('selected', t === act && canMove);
    el.classList.toggle('last', t === lastTower);
  });
  for (const side of [MINT, CORAL]) $('tgt' + side).classList.toggle('hit', state.winner === side && state.reason === 'target');

  // dots for the active tower's moves, with repetition marks
  const dots = $('dots');
  dots.innerHTML = '';
  const dest = new Set();
  for (const m of moves) {
    if (m.t !== act) continue;
    dest.add(m.to);
    const [x, y] = centre(m.to);
    svg('circle', { class: 'dot', cx: x, cy: y, r: 9 }, dots);
    if (E.makesDraw(state, m)) svg('text', { class: 'tag', x: x + 30, y: y - 30 }, dots).textContent = L.drawTag;
  }
  const movable = new Set(moves.map((m) => m.t));
  for (let i = 0; i < CELLS; i++) {
    const t = state.towers.indexOf(i);
    const clickable = dest.has(i) || (t >= 0 && movable.has(t));
    hitEls[i].classList.toggle('act', clickable);
    hitEls[i].setAttribute('tabindex', clickable ? 0 : -1);
    const what = t >= 0 ? L.lblTower(OWNER[t], L.tower[HEIGHTS[t] - 1], fz[t]) : dest.has(i) ? L.lblDest : '';
    hitEls[i].setAttribute('aria-label', L.cellLabel(E.cellName(i), what));
  }
  renderPreview();

  renderLog(rows.map((row) => ({ side: row.side, text: L.logMove(L.tower[HEIGHTS[row.m.t] - 1], E.cellName(row.m.from), E.cellName(row.m.to)) })), name);

  let small = '';
  if (state.winner !== null) small = state.reason === 'stuck' ? L.stuck(name(1 - state.winner)) : L.reached(state.ply);
  else if (state.draw) small = L.drawEnd;
  renderOverlay({
    show: over() && !overlayHidden,
    kind: state.winner === MINT ? 'mint' : state.winner === CORAL ? 'coral' : 'draw',
    big: msg, small, next: L.next, look: L.look,
  });
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
