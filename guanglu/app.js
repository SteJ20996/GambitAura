import * as E from './engine.js';
import {
  $, makeStore, initialLang, bindLang, applyStatic, setSeg, onSeg,
  renderScore, renderStatus, renderLog, renderOverlay, confirmDialog, AIClient,
} from '../assets/shell.js';

const { MINT, CORAL, R, C, CELLS } = E;

// ---------- copy ----------
const T = {
  zh: {
    setup: '設定', mode: '模式', modeAi: '對電腦', modePvp: '雙人同機',
    level: '電腦', easy: '簡單', normal: '普通', hard: '困難',
    restart: '重新開始', next: '下一局（交換先手）',
    moves: '棋譜', noMoves: '還沒有人翻鏡子。', rulesTitle: '怎麼玩',
    footer1: '沒有骰子，沒有計時，沒有隱藏資訊。', footer2: '公平性檢查', footer3: '全部遊戲',
    tag: `${R} × ${C} 鏡陣`,
    side: ['薄荷', '珊瑚'], you: '你', cpu: '電腦',
    round: (n) => `第 ${n} 局`, firstMove: (s) => `${T.zh.side[s]}先手`,
    plyN: (n) => `第 ${n} 手`,
    turnYou: '輪到你', turnAi: '電腦思考中', turnSide: (s) => `輪到${T.zh.side[s]}`,
    hint: '點一面發亮的鏡子把它翻過來。只有光正經過的鏡子才能翻。滑鼠停在鏡子上，可以先看翻了以後光會怎麼走。',
    ban: (c) => `對手剛翻了 ${c}，這一手不能翻回。`,
    rep: '這個局面已經出現兩次。再出現一次就和棋。',
    drawTag: '和',
    drawAsk: '這一步會讓同一局面第三次出現，結果是和棋。',
    drawCancel: '換一步', drawOk: '確定走出，接受和棋',
    winYou: '你贏了', winAi: '電腦獲勝', winSide: (s) => `${T.zh.side[s]}勝`,
    drawBig: '和局', drawEnd: '同一局面第三次出現。',
    reached: (n) => `光抵達目標 · 共 ${n} 手`,
    gift: (a, b) => `${a}的一手把${b}的光送到了目標`,
    both: (a) => `兩道光同時抵達，走這一手的${a}獲勝`,
    look: '看一下棋盤',
    logFlip: (c) => `翻 ${c}`, logPass: '跳過',
    cellLabel: (n, lit, ban) => `${n}${ban ? '，剛被翻過，這一手不能翻' : lit ? '，光經過，可以翻' : ''}`,
    note: '<b>已完整求解。</b>從這個開局，電腦把 44,040,192 個局面都算過了：雙方都無法強迫取勝。先走的一方有 16 種第一手，8 種保持均勢，另外 8 種會讓對手在 7 手內強迫取勝。',
    rules: `
      <ol>
        <li><b>目標：</b>把自己的光送進自己的目標光環。薄荷的光從下方射入，珊瑚的光從上方射入，兩邊的位置互為轉半圈。</li>
        <li>每一格都是一面雙面鏡，斜放成 / 或 \\。光碰到鏡子就轉 90 度，最後從棋盤邊上的某個出口出去。</li>
        <li><b>每回合翻一面鏡子：</b>只能翻任一道光正經過的鏡子（發亮的那些）。翻過來以後，兩道光可能都會改道。</li>
        <li><b>不能馬上翻回：</b>對手剛翻的那面鏡子，你下一手不能翻。</li>
        <li>如果你的一手讓對方的光到達目標，而你的沒有，對方獲勝。兩道光同時到達，走這一手的人獲勝。</li>
        <li>同一個局面第三次出現時，判和棋。會造成和棋的鏡子標著「和」。</li>
      </ol>`,
  },
  en: {
    setup: 'Setup', mode: 'Mode', modeAi: 'vs computer', modePvp: 'Two players',
    level: 'Computer', easy: 'Easy', normal: 'Normal', hard: 'Hard',
    restart: 'Restart', next: 'Next game (swap first move)',
    moves: 'Moves', noMoves: 'No mirror flipped yet.', rulesTitle: 'How to play',
    footer1: 'No dice, no timer, nothing hidden.', footer2: 'How we checked fairness', footer3: 'All games',
    tag: `${R} × ${C} mirrors`,
    side: ['Mint', 'Coral'], you: 'You', cpu: 'Computer',
    round: (n) => `Game ${n}`, firstMove: (s) => `${T.en.side[s]} first`,
    plyN: (n) => `Move ${n}`,
    turnYou: 'Your move', turnAi: 'Computer is thinking', turnSide: (s) => `${T.en.side[s]} to move`,
    hint: 'Tap a lit mirror to flip it. Only mirrors a beam passes through can be flipped. Hover over a mirror to see where the light would go.',
    ban: (c) => `The other side just flipped ${c}, so you cannot flip it back this move.`,
    rep: 'This position has come up twice. Once more and the game is a draw.',
    drawTag: '=',
    drawAsk: 'This move brings the same position up for the third time, so the game ends in a draw.',
    drawCancel: 'Choose another move', drawOk: 'Play it and draw',
    winYou: 'You win', winAi: 'Computer wins', winSide: (s) => `${T.en.side[s]} wins`,
    drawBig: 'Draw', drawEnd: 'The same position came up a third time.',
    reached: (n) => `the light reached its target · ${n} moves`,
    gift: (a, b) => `${a}'s move sent ${b}'s light home`,
    both: (a) => `both beams arrived at once; ${a} moved, so ${a} wins`,
    look: 'Look at the board',
    logFlip: (c) => `flips ${c}`, logPass: 'passes',
    cellLabel: (n, lit, ban) => `${n}${ban ? ', just flipped, cannot flip back now' : lit ? ', lit, can flip' : ''}`,
    note: '<b>Solved.</b> From this start a computer has worked through all 44,040,192 positions: neither side can force a win. The first player has 16 first moves; 8 keep the balance, and the other 8 let the opponent force a win within 7 moves.',
    rules: `
      <ol>
        <li><b>Goal:</b> send your own beam into your own target ring. Mint's light comes in from the bottom and Coral's from the top; their places are a half turn of each other.</li>
        <li>Every cell holds a two-sided mirror set as / or \\. Light turns 90 degrees at every mirror and leaves at some opening on the rim.</li>
        <li><b>Each turn, flip one mirror:</b> only a mirror that a beam (either one) passes through, the lit ones. A flip can reroute both beams.</li>
        <li><b>No flipping straight back:</b> the mirror the other side just flipped cannot be flipped on your next move.</li>
        <li>If your move sends the other beam home and not yours, the other side wins. If both arrive at once, the side that moved wins.</li>
        <li>When the same position comes up for the third time, the game is a draw. Mirrors that would cause this are marked "=".</li>
      </ol>`,
  },
};

// ---------- settings and match state ----------
const store = makeStore('guanglu');
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
let hover = -1;

// ---------- geometry (board units; a cell is 100) ----------
const S = 100, OUT = 42;
const centre = (i) => [(i % C) * S + S / 2, Math.floor(i / C) * S + S / 2];
function portPoints(p) {
  const k = E.portIndex(p), side = E.portSide(p);
  if (side === 'top') return [[k * S + S / 2, -OUT], [k * S + S / 2, 0]];
  if (side === 'bottom') return [[k * S + S / 2, R * S + OUT], [k * S + S / 2, R * S]];
  if (side === 'left') return [[-OUT, k * S + S / 2], [0, k * S + S / 2]];
  return [[C * S + OUT, k * S + S / 2], [C * S, k * S + S / 2]];
}
function beamPoints(src, tr) {
  const [o1, e1] = portPoints(src), [o2, e2] = portPoints(tr.exit);
  return [o1, e1, ...tr.steps.map((st) => centre(st.i)), e2, o2];
}
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs, parent) => {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
};
const polyLen = (pts) => pts.slice(1).reduce((a, p, k) => a + Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]), 0);
const ptsAttr = (pts) => pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');

const boardEl = $('board');
const mirEls = [], hitEls = [];
let angle = new Array(CELLS).fill(0);
let tgtEls = [];

function buildBoard() {
  const cells = $('cells');
  for (let i = 0; i < CELLS; i++) {
    const [x, y] = centre(i);
    svg('rect', { class: 'cellbg', x: x - S / 2, y: y - S / 2, width: S, height: S }, cells);
  }
  svg('rect', { class: 'frame', x: 0, y: 0, width: C * S, height: R * S }, cells);
  // column letters inside the rim, row numbers on the left (cells are named like c2)
  // beyond the sources and targets, so no beam ever crosses a label
  for (let c = 0; c < C; c++) svg('text', { class: 'lbl', x: c * S + S / 2, y: -68, 'font-size': 15 }, cells).textContent = 'abcdefghij'[c];
  for (let r = 0; r < R; r++) svg('text', { class: 'lbl', x: -71, y: r * S + S / 2, 'font-size': 15 }, cells).textContent = R - r;
  const mirrors = $('mirrors');
  for (let i = 0; i < CELLS; i++) {
    const [x, y] = centre(i);
    const g = svg('g', { transform: `translate(${x} ${y})` }, mirrors);
    const m = svg('g', { class: 'mir' }, g);
    svg('line', { class: 'bar', x1: -33, y1: 33, x2: 33, y2: -33 }, m);
    svg('line', { class: 'edge', x1: -31, y1: 29, x2: 29, y2: -31 }, m);
    mirEls.push(m);
  }
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
  // sources and targets
  const ports = $('ports');
  const D = state.design;
  for (const side of [MINT, CORAL]) {
    const cls = side === MINT ? 'm' : 'c';
    const [o] = portPoints(D.src[side]);
    svg('circle', { class: 'src ' + cls, cx: o[0], cy: o[1], r: 9 }, ports);
    const [t] = portPoints(D.tgt[side]);
    const g = svg('g', { class: 'tgt ' + cls }, ports);
    svg('circle', { class: 'core', cx: t[0], cy: t[1], r: 8 }, g);
    const sp = svg('g', { class: 'spin' }, g);
    svg('circle', { cx: t[0], cy: t[1], r: 15, 'stroke-dasharray': '3 5' }, sp);
    svg('circle', { cx: t[0], cy: t[1], r: 19, opacity: .45 }, g);
    tgtEls[side] = g;
  }
}

function placeMirrors(animate) {
  for (let i = 0; i < CELLS; i++) {
    const want = (state.cfg >> i) & 1;
    // turning keeps going the same way, so a flip always animates a quarter turn
    if (((angle[i] / 90) & 1) !== want) angle[i] += 90;
    const m = mirEls[i];
    if (!animate) m.style.transition = 'none';
    m.style.transform = `rotate(${angle[i]}deg)`;
    if (!animate) { void m.getBoundingClientRect(); m.style.transition = ''; }
  }
}

function drawBeams(animate) {
  const g = $('beams');
  g.innerHTML = '';
  const bm = E.beams(state.cfg, state.design);
  for (const side of [CORAL, MINT]) {
    const pts = beamPoints(state.design.src[side], bm[side]);
    const cls = side === MINT ? 'm' : 'c';
    const len = Math.ceil(polyLen(pts));
    for (const kind of ['glow', 'core']) {
      const pl = svg('polyline', { class: `beam ${kind} ${cls}${animate ? ' draw' : ''}`, points: ptsAttr(pts) }, g);
      pl.style.setProperty('--len', len);
    }
    tgtEls[side].classList.toggle('hit', bm[side].hit);
  }
  return bm;
}

function renderPreview() {
  const g = $('preview');
  g.innerHTML = '';
  if (hover < 0 || !humanCanMove()) return;
  const legal = E.legalMoves(state).some((m) => m.t === 'flip' && m.i === hover);
  if (!legal) return;
  const cfg = state.cfg ^ (1 << hover);
  const bm = E.beams(cfg, state.design);
  for (const side of [CORAL, MINT]) {
    const pts = beamPoints(state.design.src[side], bm[side]);
    svg('polyline', { class: `beam preview ${side === MINT ? 'm' : 'c'}`, points: ptsAttr(pts) }, g);
  }
}

// ---------- game flow ----------
const isAiTurn = () => mode === 'ai' && state.turn !== HUMAN;
const over = () => state.winner !== null || state.draw;
const name = (side) => (mode === 'ai' ? (side === HUMAN ? T[lang].you : T[lang].cpu) : T[lang].side[side]);
const humanCanMove = () => !over() && !busy && !isAiTurn();

const ai = new AIClient(new URL('./ai-worker.js', import.meta.url), (r) => onAiReply(r));

function newGame() {
  ai.cancel();
  busy = false;
  state = E.initialState(first);
  rows = [];
  counted = false; overlayHidden = false; hover = -1;
  angle = new Array(CELLS).fill(0);
  placeMirrors(false);
  drawBeams(true);
  render();
  maybeAi();
}

function play(m) {
  const side = state.turn;
  state = E.applyMove(state, m);
  rows.push({ side, m });
  hover = -1;
  placeMirrors(true);
  setTimeout(() => { drawBeams(true); }, m.t === 'flip' ? 280 : 0);
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
  ai.ask({ state: { cfg: state.cfg, turn: state.turn, ban: state.ban, design: state.design }, history: [...state.history], level });
}

function onAiReply({ move }) {
  if (over() || !isAiTurn()) return;
  const legal = E.legalMoves(state).find((x) => x.t === move.t && (x.t === 'pass' || x.i === move.i));
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
  const m = E.legalMoves(state).find((x) => x.t === 'flip' && x.i === i);
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

  const canMove = humanCanMove();
  const moves = canMove ? E.legalMoves(state) : [];
  const bm = E.beams(state.cfg, state.design);
  const litMask = bm[0].mask | bm[1].mask;

  let msg, sub = '', thinking = false;
  if (state.winner !== null) msg = mode === 'ai' ? (state.winner === HUMAN ? L.winYou : L.winAi) : L.winSide(state.winner);
  else if (state.draw) msg = L.drawBig;
  else if (isAiTurn()) { msg = L.turnAi; thinking = true; }
  else {
    msg = mode === 'ai' ? L.turnYou : L.turnSide(state.turn);
    sub = L.hint;
    if (state.ban !== null) sub += ' ' + L.ban(E.cellName(state.ban));
    if (E.repeatCount(state) >= 2) sub += ' ' + L.rep;
  }
  renderStatus({ side: over() ? null : state.turn, end: over(), msg, thinking, ply: L.plyN(state.ply), sub });

  const lastFlip = state.last && state.last.t === 'flip' ? state.last.i : -1;
  for (let i = 0; i < CELLS; i++) {
    const lit = (litMask >> i) & 1;
    mirEls[i].classList.toggle('lit', !!lit);
    mirEls[i].classList.toggle('ban', state.ban === i && !over());
    mirEls[i].classList.toggle('last', lastFlip === i);
    const act = moves.some((m) => m.t === 'flip' && m.i === i);
    hitEls[i].classList.toggle('act', act);
    hitEls[i].setAttribute('tabindex', act ? 0 : -1);
    hitEls[i].setAttribute('aria-label', L.cellLabel(E.cellName(i), lit, state.ban === i));
  }
  // repetition marks
  const hitsG = $('hits');
  for (const t of hitsG.querySelectorAll('text.tag')) t.remove();
  for (const m of moves) {
    if (m.t !== 'flip' || !E.makesDraw(state, m)) continue;
    const [x, y] = centre(m.i);
    const t = svg('text', { class: 'tag', x: x + 34, y: y - 34 }, hitsG);
    t.textContent = L.drawTag;
  }
  renderPreview();

  renderLog(rows.map((row) => ({ side: row.side, text: row.m.t === 'flip' ? L.logFlip(E.cellName(row.m.i)) : L.logPass })), name);

  let small = '';
  if (state.winner !== null) {
    const mover = state.last.side;
    if (mover !== state.winner) small = L.gift(name(mover), name(state.winner));
    else if (bm[1 - mover].hit) small = L.both(name(mover));
    else small = L.reached(state.ply);
  } else if (state.draw) small = L.drawEnd;
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
