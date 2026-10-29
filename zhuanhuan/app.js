import * as E from './engine.js';
import {
  $, makeStore, initialLang, bindLang, applyStatic, setSeg, onSeg,
  renderScore, renderStatus, renderLog, renderOverlay, confirmDialog, AIClient,
} from '../assets/shell.js';

const { MINT, CORAL } = E;

// ---------- copy ----------
const T = {
  zh: {
    setup: '設定', mode: '模式', modeAi: '對電腦', modePvp: '雙人同機',
    level: '電腦', easy: '簡單', normal: '普通', hard: '困難',
    restart: '重新開始', next: '下一局（交換先手）',
    moves: '棋譜', noMoves: '還沒有人走棋。', rulesTitle: '怎麼玩',
    footer1: '沒有骰子，沒有計時，沒有隱藏資訊。', footer2: '公平性檢查', footer3: '全部遊戲',
    tag: '螺旋開局',
    side: ['薄荷', '珊瑚'], you: '你', cpu: '電腦',
    ringName: ['內環', '中環', '外環'],
    ccw: '逆時針轉', cw: '順時針轉',
    round: (n) => `第 ${n} 局`, firstMove: (s) => `${T.zh.side[s]}先手`,
    plyN: (n) => `第 ${n} 手`,
    turnYou: '輪到你', turnAi: '電腦思考中', turnSide: (s) => `輪到${T.zh.side[s]}`,
    hintPick: '點自己的棋子，再點圓點走一格。或用棋盤下方的按鈕轉一個環。',
    hintSel: '點圓點走一格。再點一次棋子就取消。',
    ban: (r) => `對手剛轉過${T.zh.ringName[r]}，這一手不能直接轉回去。`,
    rep: '這個局面已經出現兩次。再出現一次就和棋。',
    drawTag: '和',
    drawAsk: '這一步會讓同一局面第三次出現，結果是和棋。',
    drawCancel: '換一步', drawOk: '確定走出，接受和棋',
    winYou: '你贏了', winAi: '電腦獲勝', winSide: (s) => `${T.zh.side[s]}勝`,
    drawBig: '和局', drawEnd: '同一局面第三次出現。',
    howSpoke: '三枚連在同一條輻線上', howArc: '三枚在同一環上相鄰',
    gift: (a, b) => `${a}的一手讓${b}連成一線`,
    both: (a) => `雙方同時連成一線，走這一手的${a}獲勝`,
    endSmall: (how, n) => `${how} · 共 ${n} 手`,
    look: '看一下棋盤',
    logTurn: (r, d) => `${T.zh.ringName[r]} ${d > 0 ? '↻' : '↺'}`,
    note: '<b>已完整求解。</b>從這個螺旋開局，電腦把每一個局面都算過了：雙方都無法強迫取勝。先走的一方第一手有 16 種走法，12 種保持均勢，4 種會輸。',
    spotLabel: (n, what) => `${n}${what ? '，' + what : ''}`,
    what: { mint: '薄荷棋', coral: '珊瑚棋', target: '可以走到這裡' },
    rules: `
      <ol>
        <li><b>目標：</b>讓自己的三枚棋子連成一線。兩種都算：同一條輻線（從中心向外的直線）上的內、中、外三格，或同一個環上相鄰的三格。</li>
        <li><b>每回合做一件事：</b>轉環，或走棋。</li>
        <li><b>轉環：</b>選一個上面有你棋子的環，順時針或逆時針轉一格。環上所有棋子都跟著轉，對方的也一樣。</li>
        <li><b>走棋：</b>把一枚自己的棋子移到相鄰的空格：沿著環走一格，或沿著輻線走到內一環、外一環。</li>
        <li><b>不能馬上轉回：</b>對手剛轉過的環，你下一手不能直接轉回去。往同一個方向繼續轉可以。</li>
        <li>如果你的一手讓對方連成一線，而你沒有，對方獲勝。雙方同時連成，走這一手的人獲勝。</li>
        <li>同一個局面第三次出現時，判和棋。會造成和棋的按鈕和落點標著「和」。</li>
      </ol>`,
  },
  en: {
    setup: 'Setup', mode: 'Mode', modeAi: 'vs computer', modePvp: 'Two players',
    level: 'Computer', easy: 'Easy', normal: 'Normal', hard: 'Hard',
    restart: 'Restart', next: 'Next game (swap first move)',
    moves: 'Moves', noMoves: 'No moves yet.', rulesTitle: 'How to play',
    footer1: 'No dice, no timer, nothing hidden.', footer2: 'How we checked fairness', footer3: 'All games',
    tag: 'Spiral opening',
    side: ['Mint', 'Coral'], you: 'You', cpu: 'Computer',
    ringName: ['Inner', 'Middle', 'Outer'],
    ccw: 'Turn anticlockwise', cw: 'Turn clockwise',
    round: (n) => `Game ${n}`, firstMove: (s) => `${T.en.side[s]} first`,
    plyN: (n) => `Move ${n}`,
    turnYou: 'Your move', turnAi: 'Computer is thinking', turnSide: (s) => `${T.en.side[s]} to move`,
    hintPick: 'Tap one of your pieces, then a dot, to step. Or turn a ring with the buttons under the board.',
    hintSel: 'Tap a dot to step there. Tap the piece again to cancel.',
    ban: (r) => `The other side just turned the ${T.en.ringName[r].toLowerCase()} ring, so you cannot turn it straight back this move.`,
    rep: 'This position has come up twice. Once more and the game is a draw.',
    drawTag: '=',
    drawAsk: 'This move brings the same position up for the third time, so the game ends in a draw.',
    drawCancel: 'Choose another move', drawOk: 'Play it and draw',
    winYou: 'You win', winAi: 'Computer wins', winSide: (s) => `${T.en.side[s]} wins`,
    drawBig: 'Draw', drawEnd: 'The same position came up a third time.',
    howSpoke: 'three on one spoke', howArc: 'three side by side on one ring',
    gift: (a, b) => `${a}'s move lined up ${b}`,
    both: (a) => `both sides lined up at once; ${a} moved, so ${a} wins`,
    endSmall: (how, n) => `${how} · ${n} moves`,
    look: 'Look at the board',
    logTurn: (r, d) => `${T.en.ringName[r].toLowerCase()} ring ${d > 0 ? '↻' : '↺'}`,
    note: '<b>Solved.</b> From this spiral start a computer has worked through every position: neither side can force a win. The first player has 16 first moves; 12 keep the balance and 4 lose.',
    spotLabel: (n, what) => `${n}${what ? ', ' + what : ''}`,
    what: { mint: 'Mint piece', coral: 'Coral piece', target: 'you can step here' },
    rules: `
      <ol>
        <li><b>Goal:</b> line up your three pieces. Two kinds of line count: the inner, middle and outer spot of one spoke (a straight line out from the centre), or three spots side by side on one ring.</li>
        <li><b>Each turn, do one thing:</b> turn a ring, or step a piece.</li>
        <li><b>Turn a ring:</b> pick a ring with at least one of your pieces on it and turn it one spot, either way. Every piece on that ring rides along, the other side's too.</li>
        <li><b>Step:</b> move one of your pieces to an empty spot next to it: one spot along its ring, or along its spoke to the next ring in or out.</li>
        <li><b>No turning straight back:</b> the ring the other side just turned cannot be turned back on your next move. Turning it further the same way is fine.</li>
        <li>If your move lines up the other side's pieces and not yours, they win. If it lines up both, you win.</li>
        <li>When the same position comes up for the third time, the game is a draw. Buttons and spots that would cause this are marked "=".</li>
      </ol>`,
  },
};

// ---------- settings and match state ----------
const store = makeStore('zhuanhuan');
let lang = initialLang();
let mode = store.get('mode', 'ai');
let level = store.get('level', 'normal');
if (!['ai', 'pvp'].includes(mode)) mode = 'ai';
if (!['easy', 'normal', 'hard'].includes(level)) level = 'normal';

const HUMAN = MINT;   // vs computer, the player is Mint
let first = MINT;     // a fresh load starts with Mint; "Next game" swaps
let state = null;
let sel = null;
let busy = false;
let rows = [];
let score = [0, 0], gameNo = 1, counted = false, overlayHidden = false;

// ---------- geometry ----------
const RAD = [92, 160, 228];
const ringOf = (s) => s >> 3, rayOf = (s) => s & 7;
const pt = (s, a = rayOf(s) * 45) => {
  const t = (a * Math.PI) / 180, r = RAD[ringOf(s)];
  return [r * Math.sin(t), -r * Math.cos(t)];
};
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs, parent) => {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
};

const boardEl = $('board');
const piecesL = $('pieces'), marksL = $('marks'), cellsL = $('cells');
const ringEls = [];
let ringA = [0, 0, 0];   // cumulative ring angles, so a turn always animates the short way
let pieces = [];         // { side, spot, a, el }: identity kept so moves animate

function buildArt() {
  const spokes = $('spokes');
  for (let q = 0; q < 8; q++) {
    const t = (q * 45 * Math.PI) / 180;
    svg('line', { class: 'spoke', x1: 58 * Math.sin(t), y1: -58 * Math.cos(t), x2: 252 * Math.sin(t), y2: -252 * Math.cos(t) }, spokes);
    const l = svg('text', { class: 'lbl', x: 274 * Math.sin(t), y: -274 * Math.cos(t) }, spokes);
    l.textContent = 'abcdefgh'[q];
  }
  // ring numbers in the gap between spokes h and a
  for (let r = 0; r < 3; r++) {
    const t = (-22.5 * Math.PI) / 180;
    const l = svg('text', { class: 'lbl', x: RAD[r] * Math.sin(t), y: -RAD[r] * Math.cos(t), style: 'font-size:15px;opacity:.7' }, spokes);
    l.textContent = r + 1;
  }
  const rings = $('rings');
  for (let r = 0; r < 3; r++) {
    const g = svg('g', { class: 'ring' }, rings);
    svg('circle', { class: 'band', r: RAD[r] }, g);
    svg('circle', { class: 'track', r: RAD[r] }, g);
    for (let q = 0; q < 8; q++) {
      const [x, y] = pt(r * 8 + q);
      svg('circle', { class: 'sock', cx: x, cy: y, r: 15 }, g);
    }
    ringEls.push(g);
  }
  for (let s = 0; s < 24; s++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'spot cellbtn';
    b.style.setProperty('--a', rayOf(s) * 45);
    b.style.setProperty('--rad', RAD[ringOf(s)]);
    b.dataset.s = s;
    b.addEventListener('click', () => onSpot(s));
    cellsL.appendChild(b);
  }
}

// Place piece elements to match the state, keeping identities where the last move allows.
function placePiece(p) {
  p.el.style.setProperty('--a', p.a);
  p.el.style.setProperty('--rad', RAD[ringOf(p.spot)]);
}
function rebuildPieces() {
  piecesL.innerHTML = '';
  pieces = [];
  for (const side of [MINT, CORAL]) {
    for (let x = state.masks[side]; x; x &= x - 1) {
      const spot = 31 - Math.clz32(x & -x);
      const el = document.createElement('div');
      el.className = 'spot pc ' + (side === MINT ? 'mint' : 'coral');
      el.innerHTML = '<b></b>';
      const p = { side, spot, a: rayOf(spot) * 45, el };
      placePiece(p);
      piecesL.appendChild(el);
      pieces.push(p);
    }
  }
}
function snapAll() {
  boardEl.classList.add('snap');
  for (const el of [...piecesL.children, ...ringEls]) el.style.transition = 'none';
  ringA = [0, 0, 0];
  ringEls.forEach((g) => { g.style.transform = 'rotate(0deg)'; });
  void boardEl.offsetWidth;
  for (const el of [...piecesL.children, ...ringEls]) el.style.transition = '';
  boardEl.classList.remove('snap');
}
function animateMove(m) {
  for (const p of pieces) p.el.classList.remove('last');
  ringEls.forEach((g) => g.classList.remove('last'));
  if (m.t === 'turn') {
    ringA[m.ring] += m.dir * 45;
    ringEls[m.ring].style.transform = `rotate(${ringA[m.ring]}deg)`;
    ringEls[m.ring].classList.add('last');
    for (const p of pieces) {
      if (ringOf(p.spot) !== m.ring) continue;
      p.spot = m.ring * 8 + ((rayOf(p.spot) + m.dir + 8) & 7);
      p.a += m.dir * 45;
      placePiece(p);
    }
  } else {
    const p = pieces.find((x) => x.spot === m.from);
    if (ringOf(m.from) === ringOf(m.to)) p.a += ((rayOf(m.to) - rayOf(m.from) + 8) & 7) === 1 ? 45 : -45;
    p.spot = m.to;
    placePiece(p);
    p.el.classList.add('last');
  }
  // safety: if anything drifted from the state, rebuild
  const masks = [0, 0];
  for (const p of pieces) masks[p.side] |= 1 << p.spot;
  if (masks[0] !== state.masks[0] || masks[1] !== state.masks[1]) rebuildPieces();
}

// ---------- game flow ----------
const isAiTurn = () => mode === 'ai' && state.turn !== HUMAN;
const over = () => state.winner !== null || state.draw;
const name = (side) => (mode === 'ai' ? (side === HUMAN ? T[lang].you : T[lang].cpu) : T[lang].side[side]);

const ai = new AIClient(new URL('./ai-worker.js', import.meta.url), (r) => onAiReply(r));

function newGame() {
  ai.cancel();
  busy = false;
  state = E.initialState(first);
  sel = null;
  rows = [];
  counted = false; overlayHidden = false;
  rebuildPieces();
  snapAll();
  $('thread').classList.remove('on');
  $('thread').setAttribute('d', '');
  render();
  maybeAi();
}

function play(m) {
  const side = state.turn;
  state = E.applyMove(state, m);
  rows.push({ side, text: m.t === 'turn' ? T[lang].logTurn(m.ring, m.dir) : E.moveText(m) });
  rows[rows.length - 1].m = m;
  sel = null;
  animateMove(m);
  if (state.winner !== null) showLine();
  if (over() && !counted) {
    counted = true;
    if (state.winner !== null) score[state.winner]++;
  }
  render();
  maybeAi();
}

function showLine() {
  const line = state.line;
  setTimeout(() => {
    for (const p of pieces) if (line.includes(p.spot)) p.el.classList.add('won');
    const th = $('thread');
    const [a, b, c] = line;
    if (ringOf(a) !== ringOf(b)) {
      const [x1, y1] = pt(a), [x2, y2] = pt(c);
      th.setAttribute('d', `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`);
    } else {
      const r = RAD[ringOf(a)], [x1, y1] = pt(a), [x2, y2] = pt(c);
      th.setAttribute('d', `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`);
    }
    th.classList.add('on');
  }, 820);
}

function maybeAi() {
  if (over() || !isAiTurn()) return;
  busy = true;
  render();
  ai.ask({ state: { masks: state.masks, turn: state.turn, ban: state.ban }, history: [...state.history], level });
}

function onAiReply({ move }) {
  if (over() || !isAiTurn()) return;
  const legal = E.legalMoves(state).find((x) =>
    x.t === move.t && (x.t === 'turn' ? x.ring === move.ring && x.dir === move.dir : x.from === move.from && x.to === move.to));
  busy = false;
  if (legal) play(legal);
  else render();
}

const humanCanMove = () => !over() && !busy && !isAiTurn();

async function tryPlay(m) {
  if (E.makesDraw(state, m)) {
    const L = T[lang];
    if (!(await confirmDialog(L.drawAsk, L.drawCancel, L.drawOk))) return;
  }
  play(m);
}

function onSpot(s) {
  if (!humanCanMove()) return;
  const moves = E.legalMoves(state);
  if (sel !== null) {
    const m = moves.find((x) => x.t === 'step' && x.from === sel && x.to === s);
    if (m) return tryPlay(m);
  }
  if ((state.masks[state.turn] >> s) & 1) sel = sel === s ? null : s;
  else sel = null;
  render();
}

function onTurn(r, dir) {
  if (!humanCanMove()) return;
  const m = E.legalMoves(state).find((x) => x.t === 'turn' && x.ring === r && x.dir === dir);
  if (m) tryPlay(m);
}

// ---------- turn controls ----------
const turnBtns = [];
function buildTurnbar() {
  const bar = $('turnbar');
  for (let r = 0; r < 3; r++) {
    const g = document.createElement('div');
    g.className = 'tg';
    g.innerHTML = `<svg class="ic" viewBox="-12 -12 24 24" aria-hidden="true">${[4, 7.5, 11].map((rad, i) => `<circle r="${rad}"${i === r ? ' class="on"' : ''}/>`).join('')}</svg><span class="nm"></span>`;
    const mk = (dir) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tb';
      b.textContent = dir > 0 ? '↻' : '↺';
      b.addEventListener('click', () => onTurn(r, dir));
      const hot = (on) => { ringEls[r].classList.toggle('hot', on); g.classList.toggle('hot', on); };
      b.addEventListener('mouseenter', () => hot(!b.disabled));
      b.addEventListener('mouseleave', () => hot(false));
      b.addEventListener('focus', () => hot(!b.disabled));
      b.addEventListener('blur', () => hot(false));
      turnBtns.push({ r, dir, b });
      return b;
    };
    g.prepend(mk(-1));
    g.append(mk(1));
    bar.appendChild(g);
  }
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
  const ban = E.effectiveBan(state);

  // status
  let msg, sub = '', thinking = false;
  if (state.winner !== null) msg = mode === 'ai' ? (state.winner === HUMAN ? L.winYou : L.winAi) : L.winSide(state.winner);
  else if (state.draw) msg = L.drawBig;
  else if (isAiTurn()) { msg = L.turnAi; thinking = true; }
  else {
    msg = mode === 'ai' ? L.turnYou : L.turnSide(state.turn);
    sub = sel !== null ? L.hintSel : L.hintPick;
    if (ban) sub += ' ' + L.ban(ban.ring);
    if (E.repeatCount(state) >= 2) sub += ' ' + L.rep;
  }
  renderStatus({ side: over() ? null : state.turn, end: over(), msg, thinking, ply: L.plyN(state.ply), sub });

  // pieces and marks
  for (const p of pieces) p.el.classList.toggle('sel', p.spot === sel);
  marksL.innerHTML = '';
  const targets = new Set();
  if (sel !== null) {
    for (const m of moves) {
      if (m.t !== 'step' || m.from !== sel) continue;
      targets.add(m.to);
      const mk = document.createElement('div');
      mk.className = 'spot mark step';
      mk.style.setProperty('--a', rayOf(m.to) * 45);
      mk.style.setProperty('--rad', RAD[ringOf(m.to)]);
      if (E.makesDraw(state, m)) mk.innerHTML = `<span class="tag">${L.drawTag}</span>`;
      marksL.appendChild(mk);
    }
  }
  for (const b of cellsL.children) {
    const s = +b.dataset.s;
    const own = canMove && ((state.masks[state.turn] >> s) & 1);
    const act = own || targets.has(s);
    b.classList.toggle('act', !!act);
    b.tabIndex = act ? 0 : -1;
    const who = (state.masks[MINT] >> s) & 1 ? L.what.mint : (state.masks[CORAL] >> s) & 1 ? L.what.coral : targets.has(s) ? L.what.target : '';
    b.setAttribute('aria-label', L.spotLabel(E.spotName(s), who));
  }

  // turn controls
  const groups = $('turnbar').children;
  for (let r = 0; r < 3; r++) groups[r].querySelector('.nm').textContent = L.ringName[r];
  for (const { r, dir, b } of turnBtns) {
    const m = moves.find((x) => x.t === 'turn' && x.ring === r && x.dir === dir);
    b.disabled = !m;
    b.title = L.ringName[r] + ' · ' + (dir > 0 ? L.cw : L.ccw);
    b.setAttribute('aria-label', b.title);
    const old = b.querySelector('.tag');
    if (old) old.remove();
    if (m && E.makesDraw(state, m)) b.insertAdjacentHTML('beforeend', `<span class="tag">${L.drawTag}</span>`);
    if (b.disabled && document.activeElement === b) b.blur();
  }

  // move list: re-word turns in the current language
  renderLog(rows.map((row) => ({ side: row.side, text: row.m.t === 'turn' ? L.logTurn(row.m.ring, row.m.dir) : row.text })), name);

  // result
  let small = '';
  if (state.winner !== null) {
    const how = ringOf(state.line[0]) !== ringOf(state.line[1]) ? L.howSpoke : L.howArc;
    const mover = state.last.side;
    if (mover !== state.winner) small = L.gift(name(mover), name(state.winner)) + ' · ' + L.plyN(state.ply);
    else if (E.hasLine(state.masks[1 - mover])) small = L.both(name(mover));
    else small = L.endSmall(how, state.ply);
  } else if (state.draw) small = L.drawEnd;
  renderOverlay({
    show: over() && !overlayHidden,
    kind: state.winner === MINT ? 'mint' : state.winner === CORAL ? 'coral' : 'draw',
    big: msg, small, next: L.next, look: L.look,
  });
}

// ---------- wiring ----------
buildArt();
buildTurnbar();
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
  get pieces() { return pieces.map((p) => ({ side: p.side, spot: p.spot, a: p.a })); },
};
