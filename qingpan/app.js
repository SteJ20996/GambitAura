import * as E from './engine.js';
import {
  $, makeStore, initialLang, bindLang, applyStatic, setSeg, onSeg,
  renderScore, renderStatus, renderLog, renderOverlay, confirmDialog, AIClient,
} from '../assets/shell.js';

const { MINT, CORAL, R, C, CELLS, PILLARS, HOLES } = E;

// ---------- copy ----------
const T = {
  zh: {
    setup: '設定', mode: '模式', modeAi: '對電腦', modePvp: '雙人同機',
    level: '電腦', easy: '簡單', normal: '普通', hard: '困難',
    restart: '重新開始', next: '下一局（交換先手）',
    moves: '棋譜', noMoves: '還沒有人走棋。', rulesTitle: '怎麼玩',
    footer1: '沒有骰子，沒有計時，沒有隱藏資訊。', footer2: '公平性檢查', footer3: '全部遊戲',
    tag: '5 × 5 · 兩根石柱',
    dir: ['上', '右', '下', '左'],
    side: ['薄荷', '珊瑚'], you: '你', cpu: '電腦',
    round: (n) => `第 ${n} 局`, firstMove: (s) => `${T.zh.side[s]}先手`,
    plyN: (n) => `第 ${n} 手`,
    turnYou: '輪到你', turnAi: '電腦思考中', turnSide: (s) => `輪到${T.zh.side[s]}`,
    hint: '點棋盤邊的箭頭把棋盤傾斜，雙方所有棋子會一起滑動；或點自己的棋子，再點圓點走一格。滑鼠停在箭頭上，可以先看棋子會滑到哪裡。',
    hintSel: '點一個圓點走過去，或點箭頭改成傾斜棋盤。',
    ban: (d) => `對手剛往${T.zh.dir[d]}傾斜，這一手不能往${T.zh.dir[(d + 2) % 4]}傾斜。`,
    passNow: '沒有任何可走的棋，這一回合跳過。',
    rep: '這個局面已經出現兩次。再出現一次就和棋。',
    drawTag: '和',
    drawAsk: '這一步會讓同一局面第三次出現，結果是和棋。',
    drawCancel: '換一步', drawOk: '確定走出，接受和棋',
    winYou: '你贏了', winAi: '電腦獲勝', winSide: (s) => `${T.zh.side[s]}勝`,
    drawBig: '和局', drawEnd: '同一局面第三次出現。',
    reached: (n) => `棋子落進自己的洞 · 共 ${n} 手`,
    gift: (a, b) => `${a}的一手把${b}的棋子送進了洞裡`,
    look: '看一下棋盤',
    logTilt: (d) => `往${T.zh.dir[d]}傾斜`, logPass: '跳過',
    cellLabel: (n, what) => `${n}${what ? '，' + what : ''}`,
    lblPiece: (side) => `${T.zh.side[side]}的棋子`, lblDest: '可以走到這裡', lblPillar: '石柱', lblHole: (side) => `${T.zh.side[side]}的洞`,
    arrowLabel: (d, ok) => `往${T.zh.dir[d]}傾斜${ok ? '' : '（現在不行）'}`,
    note: '<b>已完整求解。</b>從這個開局，電腦把 10,852,800 個局面都算過了：雙方都無法強迫取勝，誰先走都一樣。先走的一方有 8 種第一手，3 種保持均勢；另外 5 種會輸，最快的一種讓對手下一手就贏。',
    rules: `
      <ol>
        <li><b>目標：</b>讓自己的一枚棋子落進自己的洞。薄荷的洞在 a4，珊瑚的洞在 e2。</li>
        <li><b>每回合二選一：</b>把棋盤往上、下、左、右傾斜，或把自己的一枚棋子走一格（上下左右，走到空格或自己的洞）。</li>
        <li>傾斜時，<b>雙方所有棋子</b>一起往那個方向滑，直到碰到邊、石柱、別的棋子或對方的洞。滑到自己的洞的棋子會掉進去。</li>
        <li>對方的洞對你來說就像石柱：走不進去，也滑不進去。</li>
        <li><b>不能馬上傾斜回去：</b>對手剛往哪個方向傾斜，你這一手就不能往相反方向傾斜。傾斜也一定要讓至少一枚棋子移動。</li>
        <li>如果你的一手讓對方的棋子落進洞裡，而你的沒有，對方獲勝。雙方同時落洞，走這一手的人獲勝。</li>
        <li>同一個局面第三次出現時，判和棋。會造成和棋的走法標著「和」。</li>
      </ol>`,
  },
  en: {
    setup: 'Setup', mode: 'Mode', modeAi: 'vs computer', modePvp: 'Two players',
    level: 'Computer', easy: 'Easy', normal: 'Normal', hard: 'Hard',
    restart: 'Restart', next: 'Next game (swap first move)',
    moves: 'Moves', noMoves: 'No moves yet.', rulesTitle: 'How to play',
    footer1: 'No dice, no timer, nothing hidden.', footer2: 'How we checked fairness', footer3: 'All games',
    tag: '5 × 5 · two pillars',
    dir: ['up', 'right', 'down', 'left'],
    side: ['Mint', 'Coral'], you: 'You', cpu: 'Computer',
    round: (n) => `Game ${n}`, firstMove: (s) => `${T.en.side[s]} first`,
    plyN: (n) => `Move ${n}`,
    turnYou: 'Your move', turnAi: 'Computer is thinking', turnSide: (s) => `${T.en.side[s]} to move`,
    hint: 'Tap an arrow at the edge to tilt the board: every piece, on both sides, slides. Or tap one of your pieces, then a dot, to step one square. Hover over an arrow to see where the pieces would go.',
    hintSel: 'Tap a dot to step there, or tap an arrow to tilt instead.',
    ban: (d) => `The other side just tilted ${T.en.dir[d]}, so you cannot tilt ${T.en.dir[(d + 2) % 4]} this move.`,
    passNow: 'There is no move at all, so this turn passes.',
    rep: 'This position has come up twice. Once more and the game is a draw.',
    drawTag: '=',
    drawAsk: 'This move brings the same position up for the third time, so the game ends in a draw.',
    drawCancel: 'Choose another move', drawOk: 'Play it and draw',
    winYou: 'You win', winAi: 'Computer wins', winSide: (s) => `${T.en.side[s]} wins`,
    drawBig: 'Draw', drawEnd: 'The same position came up a third time.',
    reached: (n) => `a piece fell into its own hole · ${n} moves`,
    gift: (a, b) => `${a}'s move sent ${b}'s piece into its hole`,
    look: 'Look at the board',
    logTilt: (d) => `tilts ${T.en.dir[d]}`, logPass: 'passes',
    cellLabel: (n, what) => `${n}${what ? ', ' + what : ''}`,
    lblPiece: (side) => `${T.en.side[side]} piece`, lblDest: 'can step here', lblPillar: 'pillar', lblHole: (side) => `${T.en.side[side]}'s hole`,
    arrowLabel: (d, ok) => `Tilt ${T.en.dir[d]}${ok ? '' : ' (not now)'}`,
    note: '<b>Solved.</b> From this start a computer has worked through all 10,852,800 positions: neither side can force a win, whoever moves first. The first player has 8 first moves; 3 keep the balance, and the other 5 lose, the worst one at once.',
    rules: `
      <ol>
        <li><b>Goal:</b> drop one of your pieces into your own hole. Mint's hole is on a4, Coral's on e2.</li>
        <li><b>Each turn, do one of two things:</b> tilt the board up, down, left or right, or step one of your pieces one square (up, down, left or right, onto an empty square or into your own hole).</li>
        <li>When the board tilts, <b>every piece on both sides</b> slides that way until it meets the edge, a pillar, another piece or the other side's hole. A piece that slides onto its own hole falls in.</li>
        <li>The other side's hole is like a pillar to you: you can neither step nor slide into it.</li>
        <li><b>No tilting straight back:</b> you may not tilt the opposite way to the tilt the other side just made. A tilt must also move at least one piece.</li>
        <li>If your move drops the other side's piece into its hole and not yours, the other side wins. If both fall in at once, the side that moved wins.</li>
        <li>When the same position comes up for the third time, the game is a draw. Moves that would cause this are marked "=".</li>
      </ol>`,
  },
};

// ---------- settings and match state ----------
const store = makeStore('qingpan');
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
let hoverDir = -1;     // tilt arrow under the pointer

// ---------- geometry (board units; a cell is 100, the arrows sit 66 outside the board) ----------
const S = 100;
const centre = (i) => [(i % C) * S + S / 2, Math.floor(i / C) * S + S / 2];
const ARROW = [[250, -66], [566, 250], [250, 566], [-66, 250]];
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs, parent) => {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
};

const boardEl = $('board'), artEl = $('art');
const hitEls = [], arrowEls = [];
let pieceEls = new Map();      // cell -> element, for the pieces on the board now

function buildBoard() {
  const cells = $('cells');
  for (let i = 0; i < CELLS; i++) {
    const [x, y] = centre(i);
    svg('rect', { class: 'cellbg', x: x - S / 2, y: y - S / 2, width: S, height: S }, cells);
  }
  svg('rect', { class: 'frame', x: 0, y: 0, width: C * S, height: R * S, rx: 4 }, cells);
  for (let c = 0; c < C; c++) svg('text', { class: 'lbl', x: c * S + S / 2, y: R * S + 24, 'font-size': 16 }, cells).textContent = 'abcde'[c];
  for (let r = 0; r < R; r++) svg('text', { class: 'lbl', x: C * S + 24, y: r * S + S / 2, 'font-size': 16 }, cells).textContent = R - r;
  for (const p of PILLARS) {
    const [x, y] = centre(p);
    svg('rect', { class: 'pillar', x: x - 38, y: y - 38, width: 76, height: 76, rx: 12 }, cells);
    svg('rect', { class: 'pillar-top', x: x - 30, y: y - 30, width: 60, height: 60, rx: 8 }, cells);
  }
  const holes = $('holes');
  for (const side of [MINT, CORAL]) {
    const [x, y] = centre(HOLES[side]);
    const g = svg('g', { class: 'hole ' + (side === MINT ? 'm' : 'c'), id: 'hole' + side }, holes);
    svg('circle', { class: 'well', cx: x, cy: y, r: 34 }, g);
    svg('circle', { class: 'glow', cx: x, cy: y, r: 14 }, g);
    const sp = svg('g', { class: 'spin' }, g);
    svg('circle', { cx: x, cy: y, r: 40, 'stroke-dasharray': '3 6' }, sp);
  }
  // click and hover targets
  const hits = $('hits');
  for (let i = 0; i < CELLS; i++) {
    const [x, y] = centre(i);
    const h = svg('rect', { class: 'hitbox', x: x - S / 2, y: y - S / 2, width: S, height: S, role: 'button', tabindex: -1 }, hits);
    h.addEventListener('click', () => onCell(i));
    h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCell(i); } });
    hitEls.push(h);
  }
  // tilt arrows
  const arrows = $('arrows');
  for (let d = 0; d < 4; d++) {
    const [x, y] = ARROW[d];
    const g = svg('g', { class: 'arrow', role: 'button', tabindex: 0, transform: `translate(${x} ${y}) rotate(${d * 90})` }, arrows);
    svg('rect', { class: 'pad', x: -52, y: -24, width: 104, height: 48, rx: 24 }, g);
    svg('path', { class: 'chev', d: 'M-14 6 L0 -8 L14 6' }, g);
    const tag = svg('text', { class: 'tag', x: 40, y: 0, transform: `rotate(${-d * 90} 40 0)` }, g);
    g.addEventListener('click', () => onTilt(d));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTilt(d); } });
    g.addEventListener('mouseenter', () => { hoverDir = d; renderGhosts(); });
    g.addEventListener('mouseleave', () => { if (hoverDir === d) { hoverDir = -1; renderGhosts(); } });
    g.addEventListener('focus', () => { hoverDir = d; renderGhosts(); });
    g.addEventListener('blur', () => { if (hoverDir === d) { hoverDir = -1; renderGhosts(); } });
    arrowEls.push({ g, tag });
  }
  document.addEventListener('keydown', (e) => {
    const k = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[e.key];
    if (k === undefined || e.target.closest('input, textarea, select, dialog')) return;
    e.preventDefault();
    onTilt(k);
  });
}

function makePiece(side, cell) {
  const g = svg('g', { class: 'piece ' + (side === MINT ? 'm' : 'c') }, $('pieces'));
  svg('circle', { class: 'sel', r: 37 }, g);
  svg('circle', { class: 'body', r: 30 }, g);
  svg('circle', { class: 'ring', r: 15 }, g);
  place(g, cell, false);
  return g;
}
function place(el, cell, animate) {
  const [x, y] = centre(cell);
  if (!animate) el.style.transition = 'none';
  el.style.transform = `translate(${x}px, ${y}px)`;
  if (!animate) { void el.getBoundingClientRect(); el.style.transition = ''; }
}
// Lay the pieces out from scratch (new game, or after anything unexpected).
function syncPieces() {
  $('pieces').innerHTML = '';
  pieceEls = new Map();
  for (const i of E.cellsOf(state.m)) pieceEls.set(i, makePiece(MINT, i));
  for (const i of E.cellsOf(state.c)) pieceEls.set(i, makePiece(CORAL, i));
}
// Move the existing pieces along a move's paths, so each one slides where it really goes.
function animate(prev, mv) {
  let paths = [];
  if (mv.t === 'tilt') paths = E.tilt(prev.m, prev.c, mv.d).paths;
  else if (mv.t === 'step') paths = [{ from: mv.from, to: mv.to, fell: mv.to === HOLES[prev.turn] }];
  const next = new Map(pieceEls);
  for (const p of paths) next.delete(p.from);
  for (const p of paths) {
    const el = pieceEls.get(p.from);
    if (!el) continue;
    place(el, p.to, true);
    if (p.fell) { el.classList.add('gone'); setTimeout(() => el.remove(), 900); }
    else next.set(p.to, el);
  }
  pieceEls = next;
  if (mv.t === 'tilt') {
    artEl.classList.add('lean-' + mv.d);
    setTimeout(() => artEl.classList.remove('lean-' + mv.d), 380);
  }
  // keep the drawing honest: if anything disagrees with the state, lay it out again
  const want = [...E.cellsOf(state.m), ...E.cellsOf(state.c)].sort((a, b) => a - b).join();
  if ([...pieceEls.keys()].sort((a, b) => a - b).join() !== want) setTimeout(syncPieces, 500);
}

// ghosts: where each piece would slide on the hovered tilt
function renderGhosts() {
  const g = $('ghosts');
  g.innerHTML = '';
  if (hoverDir < 0 || !humanCanMove()) return;
  if (!E.legalMoves(state).some((m) => m.t === 'tilt' && m.d === hoverDir)) return;
  for (const p of E.tilt(state.m, state.c, hoverDir).paths) {
    const [x, y] = centre(p.to);
    svg('circle', { class: 'ghost ' + (p.side === MINT ? 'm' : 'c'), cx: x, cy: y, r: p.fell ? 22 : 30 }, g);
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
  counted = false; overlayHidden = false; sel = -1; hoverDir = -1;
  syncPieces();
  render();
  maybeAi();
}

function play(mv) {
  const prev = state, side = state.turn;
  state = E.applyMove(state, mv);
  rows.push({ side, mv });
  sel = -1; hoverDir = -1;
  animate(prev, mv);
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
  ai.ask({ state: { m: state.m, c: state.c, turn: state.turn, last: state.last }, history: [...state.history], level });
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

function onTilt(d) {
  if (!humanCanMove()) return;
  const mv = E.legalMoves(state).find((m) => m.t === 'tilt' && m.d === d);
  if (mv) tryPlay(mv);
}

function onCell(i) {
  if (!humanCanMove()) return;
  const ms = E.legalMoves(state);
  const own = state.turn === MINT ? state.m : state.c;
  if ((own >> i) & 1) {
    sel = sel === i ? -1 : ms.some((m) => m.t === 'step' && m.from === i) ? i : -1;
    render();
    return;
  }
  const mv = ms.find((m) => m.t === 'step' && m.from === sel && m.to === i);
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

  const canMove = humanCanMove();
  const moves = canMove ? E.legalMoves(state) : [];

  let msg, sub = '', thinking = false;
  if (state.winner !== null) msg = mode === 'ai' ? (state.winner === HUMAN ? L.winYou : L.winAi) : L.winSide(state.winner);
  else if (state.draw) msg = L.drawBig;
  else if (isAiTurn()) { msg = L.turnAi; thinking = true; }
  else {
    msg = mode === 'ai' ? L.turnYou : L.turnSide(state.turn);
    sub = moves.length === 1 && moves[0].t === 'pass' ? L.passNow : sel >= 0 ? L.hintSel : L.hint;
    if (state.last !== null) sub += ' ' + L.ban(state.last);
    if (E.repeatCount(state) >= 2) sub += ' ' + L.rep;
  }
  renderStatus({ side: over() ? null : state.turn, end: over(), msg, thinking, ply: L.plyN(state.ply), sub });

  // arrows
  for (let d = 0; d < 4; d++) {
    const mv = moves.find((m) => m.t === 'tilt' && m.d === d);
    const { g, tag } = arrowEls[d];
    g.classList.toggle('off', !mv);
    g.setAttribute('tabindex', mv ? 0 : -1);
    g.setAttribute('aria-label', L.arrowLabel(d, !!mv));
    tag.textContent = mv && E.makesDraw(state, mv) ? L.drawTag : '';
  }
  for (const [cell, el] of pieceEls) el.classList.toggle('selected', cell === sel && canMove);
  for (const side of [MINT, CORAL]) $('hole' + side).classList.toggle('hit', state.winner !== null && state.winner === side && rows.length > 0);

  // dots for the selected piece's steps, with repetition marks
  const dots = $('dots');
  dots.innerHTML = '';
  const dest = new Set();
  for (const m of moves) {
    if (m.t !== 'step' || m.from !== sel) continue;
    dest.add(m.to);
    const [x, y] = centre(m.to);
    svg('circle', { class: 'dot', cx: x, cy: y, r: 9 }, dots);
    if (E.makesDraw(state, m)) svg('text', { class: 'tag', x: x + 30, y: y - 30 }, dots).textContent = L.drawTag;
  }
  const own = state.turn === MINT ? state.m : state.c;
  const stepFrom = new Set(moves.filter((m) => m.t === 'step').map((m) => m.from));
  for (let i = 0; i < CELLS; i++) {
    const clickable = dest.has(i) || (((own >> i) & 1) === 1 && stepFrom.has(i));
    hitEls[i].classList.toggle('act', clickable);
    hitEls[i].setAttribute('tabindex', clickable ? 0 : -1);
    let what = '';
    if ((state.m >> i) & 1) what = L.lblPiece(MINT);
    else if ((state.c >> i) & 1) what = L.lblPiece(CORAL);
    else if (PILLARS.includes(i)) what = L.lblPillar;
    else if (HOLES.includes(i)) what = L.lblHole(HOLES.indexOf(i));
    if (dest.has(i)) what += (what ? ', ' : '') + L.lblDest;
    hitEls[i].setAttribute('aria-label', L.cellLabel(E.cellName(i), what));
  }
  renderGhosts();

  renderLog(rows.map((row) => ({ side: row.side, text: row.mv.t === 'tilt' ? L.logTilt(row.mv.d) : row.mv.t === 'step' ? `${E.cellName(row.mv.from)}→${E.cellName(row.mv.to)}` : L.logPass })), name);

  let small = '';
  if (state.winner !== null) small = state.reason === 'gift' ? L.gift(name(state.lastMove.side), name(state.winner)) : L.reached(state.ply);
  else if (state.draw) small = L.drawEnd;
  renderOverlay({
    show: over() && !overlayHidden,
    kind: state.winner === MINT ? 'mint' : state.winner === CORAL ? 'coral' : 'draw',
    big: msg, small, next: L.next, look: L.look,
  });

  // a side with no move at all passes by itself
  if (canMove && moves.length === 1 && moves[0].t === 'pass') setTimeout(() => { if (humanCanMove()) play(moves[0]); }, 900);
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
