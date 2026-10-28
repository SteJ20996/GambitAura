import * as E from './engine.js';
import { search, sameMove } from './ai.js';

const { MINT, CORAL } = E;

// ---------- copy ----------
const T = {
  zh: {
    setup: '設定', mode: '模式', modeAi: '對電腦', modePvp: '雙人同機',
    level: '電腦', easy: '簡單', normal: '普通', hard: '困難',
    opening: '開局', restart: '重新開始', next: '下一局（交換先手）',
    moves: '棋譜', noMoves: '還沒有人走棋。', rulesTitle: '怎麼玩',
    footer1: '沒有骰子，沒有計時，沒有隱藏資訊。', footer2: '公平性檢查',
    side: ['薄荷', '珊瑚'],
    you: '你', cpu: '電腦',
    round: (n) => `第 ${n} 局`, firstMove: (s) => `${T.zh.side[s]}先手`,
    plyN: (n) => `第 ${n} 手`,
    verV05: '開局 v0.5 提案', verV04: '開局 v0.4 原版',
    noteV05: '<b>建議開局。</b>水洞在 A2、E2、A4、E4。電腦完整求解的結果：雙方都無法強迫取勝，誰先犯錯誰吃虧。',
    noteV04: '<b>原版開局。</b>水洞在 B2、D2、B4、D4。電腦完整求解的結果：先走的一方怎麼走都會輸，後手最多 22 手內獲勝。',
    turnYou: '輪到你', turnAi: '電腦思考中', turnSide: (s) => `輪到${T.zh.side[s]}`,
    hintPick: '走棋：點自己的棋子，再點圓點。搬地板：直接點虛線框的地板，再點水洞。',
    hintPiece: '點圓點走一格。想搬地板，改點虛線框的地板。',
    hintSrc: '再點一個金色虛線的水洞，把地板放進去。亮金環的棋子是支點，留在原地。',
    pass: '跳過這一回合', mustPass: '沒有任何合法行動，只能跳過。',
    rep: '這個局面已經出現兩次。再出現一次就和棋。',
    ban: '對手剛搬過來的那塊地板，這一手不能直接搬回原處。',
    drawTag: '和',
    drawAsk: '這一步會讓同一局面第三次出現，結果是和棋。',
    drawCancel: '換一步', drawOk: '確定走出，接受和棋',
    winYou: '你贏了', winAi: '電腦獲勝', winSide: (s) => `${T.zh.side[s]}勝`,
    drawBig: '和局', drawEnd: '同一局面第三次出現。',
    endSmall: (n) => `共 ${n} 手`,
    look: '看一下棋盤',
    walk: (a, b) => `${a}→${b}`, floor: (a, b) => `地板 ${a}→${b}`, passed: '跳過',
    cell: { floor: '地板', hole: '水洞', mint: '薄荷棋', coral: '珊瑚棋', mflag: '薄荷旗', cflag: '珊瑚旗' },
    rules: `
      <ol>
        <li><b>目標：</b>讓任一枚己方棋子走上自己的旗格。薄荷的旗在 C1，珊瑚的旗在 C5。</li>
        <li><b>每回合做一件事：</b>走棋，或搬地板。</li>
        <li><b>走棋：</b>上下左右走一格，走到沒有棋子的地板上。不能走進水裡，也不能站上對方的旗格。</li>
        <li><b>搬地板：</b>選自己一枚棋子當支點，把它旁邊一塊沒人站的地板，搬到它旁邊的一個水洞。棋子留在原地。旗格的地板不能搬。</li>
        <li><b>不能封死：</b>搬完以後，雙方都至少要有一枚棋子能沿著地板通到自己的旗格（這時不看棋子擋路）。</li>
        <li><b>不能馬上搬回：</b>對手剛搬過來的地板，你下一手不能直接搬回原處。</li>
        <li>真的沒有任何合法行動，才會跳過一回合。</li>
        <li>同一個局面第三次出現時，判和棋。會造成和棋的落點標著「和」。</li>
      </ol>`,
  },
  en: {
    setup: 'Setup', mode: 'Mode', modeAi: 'vs computer', modePvp: 'Two players',
    level: 'Computer', easy: 'Easy', normal: 'Normal', hard: 'Hard',
    opening: 'Opening', restart: 'Restart', next: 'Next game (swap first move)',
    moves: 'Moves', noMoves: 'No moves yet.', rulesTitle: 'How to play',
    footer1: 'No dice, no timer, nothing hidden.', footer2: 'Fairness check',
    side: ['Mint', 'Coral'],
    you: 'You', cpu: 'Computer',
    round: (n) => `Game ${n}`, firstMove: (s) => `${T.en.side[s]} first`,
    plyN: (n) => `Move ${n}`,
    verV05: 'Opening v0.5 proposal', verV04: 'Opening v0.4 original',
    noteV05: '<b>Suggested opening.</b> Water at A2, E2, A4, E4. A full computer solve shows neither side can force a win. The first real mistake decides it.',
    noteV04: '<b>Original opening.</b> Water at B2, D2, B4, D4. A full computer solve shows the side that moves first loses whatever it does; the second player wins within 22 moves.',
    turnYou: 'Your move', turnAi: 'Computer is thinking', turnSide: (s) => `${T.en.side[s]} to move`,
    hintPick: 'To step: tap your piece, then a dot. To move a tile: tap a dashed tile, then a water square.',
    hintPiece: 'Tap a dot to step there. To move a tile instead, tap a dashed tile.',
    hintSrc: 'Now tap a gold dashed water square to drop the tile there. The piece with the gold ring is the anchor and stays put.',
    pass: 'Pass this turn', mustPass: 'No legal move. You have to pass.',
    rep: 'This position has come up twice. Once more and the game is a draw.',
    ban: 'The tile your opponent just moved cannot go straight back this turn.',
    drawTag: 'Draw',
    drawAsk: 'This move repeats the same position a third time, so the game ends in a draw.',
    drawCancel: 'Choose another move', drawOk: 'Play it and accept the draw',
    winYou: 'You win', winAi: 'Computer wins', winSide: (s) => `${T.en.side[s]} wins`,
    drawBig: 'Draw', drawEnd: 'The same position came up a third time.',
    endSmall: (n) => `${n} moves`,
    look: 'Look at the board',
    walk: (a, b) => `${a}→${b}`, floor: (a, b) => `tile ${a}→${b}`, passed: 'pass',
    cell: { floor: 'floor', hole: 'water', mint: 'Mint piece', coral: 'Coral piece', mflag: 'Mint flag', cflag: 'Coral flag' },
    rules: `
      <ol>
        <li><b>Goal:</b> get either of your pieces onto your own flag. Mint's flag is C1, Coral's is C5.</li>
        <li><b>Each turn, do one thing:</b> step, or move a tile.</li>
        <li><b>Step:</b> move one square up, down, left or right onto empty floor. No stepping into water, and never onto the other side's flag.</li>
        <li><b>Move a tile:</b> pick one of your pieces. Lift an empty floor tile next to it and drop it into a water square next to the same piece. The piece stays where it is. Flag tiles never move.</li>
        <li><b>No sealing off:</b> after the move, each side must still have a piece joined to its own flag by floor (pieces in the way do not count here).</li>
        <li><b>No instant undo:</b> the tile your opponent just moved cannot go straight back on your next move.</li>
        <li>You pass only when you have no legal move at all.</li>
        <li>When the same position comes up a third time, the game is a draw. Squares that would cause it are marked "Draw".</li>
      </ol>`,
  },
};

// ---------- settings ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('ga-jielu-' + k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ga-jielu-' + k, v); } catch { /* private mode */ } },
};
const navZh = (navigator.language || '').toLowerCase().startsWith('zh');
let lang = store.get('lang', navZh ? 'zh' : 'en');
let mode = store.get('mode', 'ai');
let level = store.get('level', 'normal');
let layoutId = store.get('layout', 'v05');
if (!T[lang]) lang = 'zh';
if (!['ai', 'pvp'].includes(mode)) mode = 'ai';
if (!['easy', 'normal', 'hard'].includes(level)) level = 'normal';
if (!E.LAYOUTS[layoutId]) layoutId = 'v05';

const HUMAN = MINT;   // vs computer, the player is Mint (as in v0.4)
let first = MINT;     // a fresh load starts with Mint; "Next game" swaps
let state = null;
let sel = null, selSrc = null;
let busy = false;
let logRows = [];
let reqId = 0;
// Session score only: a reload starts over, as in v0.4.
let score = [0, 0], gameNo = 1, counted = false, overlayHidden = false;

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const boardEl = $('board');
const socketsL = $('sockets'), tilesL = $('tiles'), marksL = $('marks'), piecesL = $('pieces'), cellsL = $('cells');
const tileAt = new Map(), pieceAt = new Map();
const rc = (c) => [Math.floor(c / 5), c % 5];
function place(el, c) { const [r, k] = rc(c); el.style.setProperty('--r', r); el.style.setProperty('--c', k); }

const SIGIL = `<svg class="sigil" viewBox="0 0 40 40" aria-hidden="true">
  <g fill="none" stroke="currentColor">
    <g class="spin"><circle cx="20" cy="20" r="16.5" stroke-width=".8" stroke-dasharray="1 4.2" opacity=".75"/></g>
    <circle cx="20" cy="20" r="11.5" stroke-width="1" opacity=".85"/>
  </g>
  <circle class="core" cx="20" cy="20" r="3.4" fill="currentColor"/>
</svg>`;
// The direction mark is carved into the stone in a deeper shade of its own colour.
const glyph = (side) => side === MINT
  ? `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 5 L15 13.5 H5 Z" fill="#1f4f43" fill-opacity=".62"/></svg>`
  : `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15 L5 6.5 H15 Z" fill="#5f2518" fill-opacity=".62"/></svg>`;

const cellBtns = [];
for (let c = 0; c < 25; c++) {
  const s = document.createElement('div');
  s.className = 'socket';
  place(s, c);
  socketsL.appendChild(s);
  const b = document.createElement('button');
  b.className = 'cellbtn';
  b.type = 'button';
  place(b, c);
  b.addEventListener('click', () => onCell(c));
  cellsL.appendChild(b);
  cellBtns.push(b);
}

function buildBoard() {
  tilesL.innerHTML = ''; piecesL.innerHTML = '';
  tileAt.clear(); pieceAt.clear();
  for (let c = 0; c < 25; c++) {
    if ((state.holes >> c) & 1) continue;
    const t = document.createElement('div');
    t.className = 'tile';
    if (c === E.GOAL[MINT]) { t.classList.add('flag', 'mint'); t.innerHTML = '<i></i>' + SIGIL; }
    else if (c === E.GOAL[CORAL]) { t.classList.add('flag', 'coral'); t.innerHTML = '<i></i>' + SIGIL; }
    else t.innerHTML = '<i></i>';
    place(t, c);
    tilesL.appendChild(t);
    tileAt.set(c, t);
  }
  for (const side of [MINT, CORAL]) {
    for (const c of state.pieces[side]) {
      const p = document.createElement('div');
      p.className = 'piece ' + (side === MINT ? 'mint' : 'coral');
      p.innerHTML = '<b>' + glyph(side) + '</b>';
      place(p, c);
      piecesL.appendChild(p);
      pieceAt.set(c, p);
    }
  }
}

function animateMove(m) {
  for (const el of tilesL.querySelectorAll('.tile.last')) el.classList.remove('last');
  for (const el of tilesL.querySelectorAll('.hole-last')) el.remove();
  if (m.t === 'walk') {
    const p = pieceAt.get(m.from);
    pieceAt.delete(m.from);
    pieceAt.set(m.to, p);
    place(p, m.to);
  } else if (m.t === 'floor') {
    const t = tileAt.get(m.src);
    tileAt.delete(m.src);
    tileAt.set(m.dst, t);
    t.classList.add('flying');
    place(t, m.dst);
    setTimeout(() => { t.classList.remove('flying'); t.classList.add('last'); }, 460);
    const ring = document.createElement('div');
    ring.className = 'hole-last';
    ring.innerHTML = '<span></span>';
    place(ring, m.src);
    tilesL.appendChild(ring);
  }
}

// ---------- game flow ----------
function newGame() {
  reqId++;
  busy = false;
  state = E.initialState(first, E.LAYOUTS[layoutId]);
  sel = null; selSrc = null;
  logRows = [];
  counted = false; overlayHidden = false;
  buildBoard();
  render();
  maybeAi();
}

function resetMatch() { score = [0, 0]; gameNo = 1; first = MINT; }

const isAiTurn = () => mode === 'ai' && state.turn !== HUMAN;
const over = () => state.winner !== null || state.draw;

function play(m) {
  const side = state.turn;
  state = E.applyMove(state, m);
  logRows.push({ side, m });
  sel = null; selSrc = null;
  animateMove(m);
  if (state.winner !== null) {
    const p = pieceAt.get(m.to);
    if (p) setTimeout(() => p.classList.add('won'), 380);
  }
  if (over() && !counted) {
    counted = true;
    if (state.winner !== null) score[state.winner]++;
  }
  render();
  maybeAi();
}

let worker = null;
try {
  worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => onAiReply(e.data);
  worker.onerror = () => { worker = null; };
} catch { worker = null; }

let aiStarted = 0;
function maybeAi() {
  if (over() || !isAiTurn()) return;
  busy = true;
  render();
  const id = ++reqId;
  aiStarted = performance.now();
  const snap = { holes: state.holes, pieces: state.pieces, turn: state.turn, ban: state.ban, history: state.history };
  if (worker) worker.postMessage({ id, state: snap, level });
  else setTimeout(() => { const r = search(snap, level, snap.history); onAiReply({ id, move: r.move }); }, 30);
}

function onAiReply({ id, move }) {
  if (id !== reqId) return;
  const wait = Math.max(0, 520 - (performance.now() - aiStarted));
  setTimeout(() => {
    if (id !== reqId) return;
    const legal = E.legalMoves(state).find((x) => sameMove(x, move));
    busy = false;
    if (legal) play(legal); else render();
  }, wait);
}

// ---------- input ----------
function humanMoves() {
  if (over() || busy || isAiTurn()) return [];
  return E.legalMoves(state);
}

function onCell(c) {
  const moves = humanMoves();
  if (!moves.length) return;
  const own = state.pieces[state.turn];
  if (own.includes(c)) {
    sel = sel === c ? null : c;
    selSrc = null;
    render();
    return;
  }
  // A piece first means a step; a tile first means a tile move. The two never clash.
  if (sel !== null) {
    const walk = moves.find((m) => m.t === 'walk' && m.from === sel && m.to === c);
    if (walk) return tryPlay(walk);
  }
  if (selSrc !== null) {
    const drop = moves.find((m) => m.t === 'floor' && m.src === selSrc && m.dst === c);
    if (drop) return tryPlay(drop);
  }
  if (moves.some((m) => m.t === 'floor' && m.src === c)) {
    selSrc = selSrc === c ? null : c;
    sel = null;
    render();
    return;
  }
  sel = null; selSrc = null;
  render();
}

const dlg = $('drawDlg');
function tryPlay(m) {
  if (E.makesDraw(state, m)) {
    $('drawText').textContent = T[lang].drawAsk;
    $('drawCancel').textContent = T[lang].drawCancel;
    $('drawOk').textContent = T[lang].drawOk;
    dlg.returnValue = '';
    dlg.showModal();
    dlg.onclose = () => { if (dlg.returnValue === 'ok') play(m); };
    return;
  }
  play(m);
}
$('drawCancel').onclick = () => dlg.close('cancel');
$('drawOk').onclick = () => dlg.close('ok');

$('passBtn').onclick = () => {
  const moves = humanMoves();
  if (moves.length === 1 && moves[0].t === 'pass') tryPlay(moves[0]);
};

// ---------- rendering ----------
function render() {
  const L = T[lang];
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const v = L[el.dataset.i18n];
    if (typeof v === 'string') el.textContent = v;
  }
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  setSeg('modeSeg', mode); setSeg('levelSeg', level); setSeg('layoutSeg', layoutId);
  $('levelRow').hidden = mode !== 'ai';
  const note = $('layoutNote');
  note.innerHTML = layoutId === 'v05' ? L.noteV05 : L.noteV04;
  note.classList.toggle('v04', layoutId === 'v04');
  const ver = $('ver');
  ver.textContent = layoutId === 'v05' ? L.verV05 : L.verV04;
  ver.classList.toggle('v04', layoutId === 'v04');
  $('rulesBody').innerHTML = L.rules;
  boardEl.classList.toggle('turn-0', state.turn === MINT);
  boardEl.classList.toggle('turn-1', state.turn === CORAL);
  boardEl.classList.toggle('over', over());
  renderScore();
  renderStatus();
  renderMarks();
  renderLog();
  renderOverlay();
  $('nextBtn').hidden = !over();
}

function setSeg(id, v) {
  for (const b of $(id).querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === v));
}

// The orb colour already says which side; vs computer the label says who plays it.
function sideName(s) {
  const L = T[lang];
  if (mode !== 'ai') return L.side[s];
  return s === HUMAN ? L.you : L.cpu;
}

function renderScore() {
  const L = T[lang];
  $('whoMint').textContent = sideName(MINT);
  $('whoCoral').textContent = sideName(CORAL);
  $('sbMint').title = L.side[MINT];
  $('sbCoral').title = L.side[CORAL];
  $('ptsMint').textContent = score[MINT];
  $('ptsCoral').textContent = score[CORAL];
  $('round').innerHTML = `<b>${L.round(gameNo)}</b>${L.firstMove(first)}`;
  $('sbMint').classList.toggle('on', !over() && state.turn === MINT);
  $('sbCoral').classList.toggle('on', !over() && state.turn === CORAL);
}

function renderStatus() {
  const L = T[lang];
  const st = $('status'), msg = $('msg'), sub = $('sub'), pass = $('passBtn');
  st.classList.toggle('end', over());
  st.classList.toggle('s0', !over() && state.turn === MINT);
  st.classList.toggle('s1', !over() && state.turn === CORAL);
  msg.classList.remove('thinking');
  pass.hidden = true;
  $('ply').textContent = L.plyN(state.ply + (over() ? 0 : 1));
  let subText = '';
  if (state.winner !== null) {
    msg.textContent = mode === 'ai' ? (state.winner === HUMAN ? L.winYou : L.winAi) : L.winSide(state.winner);
  } else if (state.draw) {
    msg.textContent = L.drawBig + (lang === 'zh' ? '：' : ': ') + L.drawEnd;
  } else {
    if (isAiTurn()) { msg.textContent = L.turnAi; msg.classList.add('thinking'); }
    else msg.textContent = mode === 'ai' ? L.turnYou : L.turnSide(state.turn);
    const moves = humanMoves();
    if (moves.length === 1 && moves[0].t === 'pass') {
      subText = L.mustPass;
      pass.hidden = false;
      pass.textContent = L.pass;
    } else if (moves.length) {
      const parts = [selSrc !== null ? L.hintSrc : sel !== null ? L.hintPiece : L.hintPick];
      if (E.effectiveBan(state)) parts.push(L.ban);
      if (E.repeatCount(state) >= 2) parts.push(L.rep);
      subText = parts.join(lang === 'zh' ? '' : ' ');
    }
  }
  sub.textContent = subText;
  sub.hidden = !subText;
}

function renderOverlay() {
  const L = T[lang];
  const ov = $('overlay');
  const show = over() && !overlayHidden;
  ov.classList.remove('mint', 'coral', 'draw');
  if (over()) {
    if (state.winner !== null) {
      ov.classList.add(state.winner === MINT ? 'mint' : 'coral');
      $('ovBig').textContent = mode === 'ai' ? (state.winner === HUMAN ? L.winYou : L.winAi) : L.winSide(state.winner);
      $('ovSmall').textContent = L.endSmall(state.ply);
    } else {
      ov.classList.add('draw');
      $('ovBig').textContent = L.drawBig;
      $('ovSmall').textContent = L.drawEnd;
    }
    $('ovNext').textContent = L.next;
    $('ovLook').textContent = L.look;
  }
  // let the winning step land before the overlay fades in
  if (show && !ov.classList.contains('show')) setTimeout(() => { if (over() && !overlayHidden) ov.classList.add('show'); }, 650);
  if (!show) ov.classList.remove('show');
}

function renderMarks() {
  const L = T[lang];
  marksL.innerHTML = '';
  for (const p of piecesL.querySelectorAll('.piece')) p.classList.remove('sel', 'pivot');
  const moves = humanMoves();
  const active = new Set();
  if (moves.length && !(moves.length === 1 && moves[0].t === 'pass')) {
    const srcs = new Set();
    for (const m of moves) {
      if (m.t === 'walk') active.add(m.from);
      if (m.t === 'floor') { srcs.add(m.src); active.add(m.src); }
    }
    for (const s of srcs) addMark(s, 'lift' + (s === selSrc ? ' on' : ''));
    if (sel !== null) {
      pieceAt.get(sel)?.classList.add('sel');
      for (const m of moves) {
        if (m.t !== 'walk' || m.from !== sel) continue;
        addMark(m.to, 'walk' + (m.win ? ' win' : ''), E.makesDraw(state, m) ? L.drawTag : null);
        active.add(m.to);
      }
    }
    if (selSrc !== null) {
      for (const m of moves) {
        if (m.t !== 'floor' || m.src !== selSrc) continue;
        addMark(m.dst, 'drop', E.makesDraw(state, m) ? L.drawTag : null);
        active.add(m.dst);
        for (const p of m.pivots) pieceAt.get(p)?.classList.add('pivot');
      }
    }
  }
  for (let c = 0; c < 25; c++) {
    const b = cellBtns[c];
    b.classList.toggle('act', active.has(c));
    b.setAttribute('aria-label', cellLabel(c));
    b.tabIndex = active.has(c) ? 0 : -1;
  }
}

function addMark(c, cls, tag) {
  const d = document.createElement('div');
  d.className = 'mark ' + cls;
  place(d, c);
  if (tag) d.innerHTML = `<span class="tag">${tag}</span>`;
  marksL.appendChild(d);
}

function cellLabel(c) {
  const L = T[lang].cell;
  const parts = [E.cellName(c)];
  if (state.pieces[MINT].includes(c)) parts.push(L.mint);
  else if (state.pieces[CORAL].includes(c)) parts.push(L.coral);
  if (c === E.GOAL[MINT]) parts.push(L.mflag);
  else if (c === E.GOAL[CORAL]) parts.push(L.cflag);
  else parts.push((state.holes >> c) & 1 ? L.hole : L.floor);
  return parts.join(', ');
}

function renderLog() {
  const L = T[lang];
  const ol = $('log');
  ol.innerHTML = '';
  logRows.forEach((row, i) => {
    const li = document.createElement('li');
    const m = row.m;
    const txt = m.t === 'walk' ? L.walk(E.cellName(m.from), E.cellName(m.to))
      : m.t === 'floor' ? L.floor(E.cellName(m.src), E.cellName(m.dst)) : L.passed;
    const cls = row.side === MINT ? 'mint' : 'coral';
    li.innerHTML = `<span class="n">${i + 1}</span><span class="d ${cls}" title="${L.side[row.side]}"></span><span class="m">${L.side[row.side]} ${txt}</span>`;
    ol.appendChild(li);
  });
  $('logEmpty').hidden = logRows.length > 0;
  ol.scrollTop = ol.scrollHeight;
}

// ---------- controls ----------
for (const b of document.querySelectorAll('[data-lang]')) {
  b.addEventListener('click', () => { lang = b.dataset.lang; store.set('lang', lang); render(); });
}
function segHandler(id, apply) {
  for (const b of $(id).querySelectorAll('button')) b.addEventListener('click', () => apply(b.dataset.v));
}
segHandler('modeSeg', (v) => { if (v === mode) return; mode = v; store.set('mode', v); resetMatch(); newGame(); });
segHandler('levelSeg', (v) => { level = v; store.set('level', v); render(); });
segHandler('layoutSeg', (v) => { if (v === layoutId) return; layoutId = v; store.set('layout', v); resetMatch(); newGame(); });
$('restartBtn').onclick = () => newGame();
function nextGame() { first = 1 - first; gameNo++; newGame(); }
$('nextBtn').onclick = nextGame;
$('ovNext').onclick = nextGame;
$('ovLook').onclick = () => { overlayHidden = true; renderOverlay(); };

newGame();

// exposed for automated tests
window.__jielu = { get state() { return state; }, get busy() { return busy; }, get score() { return score.slice(); } };
