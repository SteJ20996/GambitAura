import * as E from './engine.js';
import {
  $, makeStore, initialLang, bindLang, applyStatic, setSeg, onSeg,
  renderScore, renderStatus, renderLog, renderOverlay, confirmDialog, AIClient,
} from '../assets/shell.js';

const { JADE, AGATE } = E;

// ---------- copy ----------
const T = {
  zh: {
    setup: '設定', mode: '模式', modeAi: '對電腦', modePvp: '雙人同機',
    level: '電腦', easy: '簡單', normal: '普通', hard: '困難', size: '棋盤',
    restart: '重新開始', next: '下一局（交換先手）',
    moves: '棋譜', noMoves: '還沒有人落子。', rulesTitle: '怎麼玩',
    footer1: '沒有骰子，沒有計時，沒有隱藏資訊。', footer2: '回到罡曜系列',
    side: ['青玉', '瑪瑙'], edges: ['上下兩邊', '左右兩邊'],
    you: '你', cpu: '電腦', p1: '玩家一', p2: '玩家二',
    round: (n) => `第 ${n} 局`, firstMove: (name) => `${name}先手`,
    plyN: (n) => `第 ${n} 手`,
    sizeTag: (n) => `${n} × ${n} 棋盤`,
    swapNote: '<b>交換規則。</b>青玉下第一子後，瑪瑙可以不落子，改按「交換」把這一子接過來。所以第一子不能太強，也不能太弱。',
    turnYou: '輪到你', turnAi: '電腦思考中', turnSide: (s) => `輪到${T.zh.side[s]}`,
    hintAi: (s) => `點一個空格落子。你執${T.zh.side[s]}，要連起${T.zh.edges[s]}。`,
    hintPvp: (s) => `點一個空格落子。${T.zh.side[s]}要連起${T.zh.edges[s]}。`,
    hintSwap: '也可以按「交換」，把對方的第一子接過來。',
    swapBtn: '交換',
    cpuSwapped: (a, b) => (a === b ? `電腦用了交換：你在 ${a} 的子留在原處，成了它的子。` : `電腦用了交換：你在 ${a} 的子翻到 ${b}，成了它的子。`),
    swappedPvp: (a, b) => (a === b ? `瑪瑙用了交換：${a} 的子留在原處，成了瑪瑙的子。` : `瑪瑙用了交換：${a} 的子翻到 ${b}，成了瑪瑙的子。`),
    winYou: '你贏了', winAi: '電腦獲勝', winSide: (s) => `${T.zh.side[s]}勝`,
    endSmall: (n, k) => `共 ${n} 手，${k} 子連成一線`,
    look: '看一下棋盤',
    logSwap: (a, b) => (a === b ? `交換 ${a}` : `交換 ${a}→${b}`),
    empty: '空格',
    sizeAsk: (n) => `換成 ${n} × ${n} 會重新開始，比分也會歸零。`,
    sizeCancel: '保留目前棋盤', sizeOk: (n) => `換成 ${n} × ${n}`,
    rules: `
      <ol>
        <li><b>目標：</b>青玉連起上、下兩邊，瑪瑙連起左、右兩邊。棋盤邊上的顏色標出各自的兩邊。四個角上的格子同時屬於它碰到的兩邊。</li>
        <li><b>每回合放一子：</b>放在任何一個空格。子放下後不再移動，也不會被吃掉。青玉先下。</li>
        <li><b>怎樣算連起來：</b>每格有六個鄰格。同色的子一格接一格，從一邊通到對邊就贏，路線怎麼彎都可以。</li>
        <li><b>交換規則：</b>青玉下完第一子後，瑪瑙可以不落子，改按「交換」。這一子會沿著長對角線翻到對稱的格子（例如 c2 翻到 b3），變成瑪瑙的子，接著輪到青玉。只有這一回合可以交換。</li>
        <li><b>沒有和棋：</b>棋盤填滿時，一定剛好有一方連起來。</li>
      </ol>
      <p><b>為什麼要交換？</b>沒有交換規則時，先手一定有必勝的下法。這是 John Nash 用「策略竊取」的論證證明的，可是在大棋盤上，沒有人知道這個下法是什麼。有了交換，先手只能挑一個不太強也不太弱的第一子，因為太好的子會被對手接走。</p>
      <p>老實說：雙方都下得完美時，總有一方會贏，交換規則改變不了這一點。它讓真實的對局變得公平。</p>`,
  },
  en: {
    setup: 'Setup', mode: 'Mode', modeAi: 'vs computer', modePvp: 'Two players',
    level: 'Computer', easy: 'Easy', normal: 'Normal', hard: 'Hard', size: 'Board',
    restart: 'Restart', next: 'Next game (swap first move)',
    moves: 'Moves', noMoves: 'No moves yet.', rulesTitle: 'How to play',
    footer1: 'No dice, no timer, nothing hidden.', footer2: 'All GambitAura games',
    side: ['Jade', 'Agate'], edges: ['top and bottom', 'left and right'],
    you: 'You', cpu: 'Computer', p1: 'Player 1', p2: 'Player 2',
    round: (n) => `Game ${n}`, firstMove: (name, you) => (you ? 'You move first' : `${name} moves first`),
    plyN: (n) => `Move ${n}`,
    sizeTag: (n) => `${n} × ${n} board`,
    swapNote: '<b>Swap rule.</b> After Jade places the first stone, Agate may press Swap instead of placing one, and take that stone over. So the first stone should be neither too strong nor too weak.',
    turnYou: 'Your move', turnAi: 'Computer is thinking', turnSide: (s) => `${T.en.side[s]} to move`,
    hintAi: (s) => `Tap an empty cell. You play ${T.en.side[s]}. Join the ${T.en.edges[s]} edges.`,
    hintPvp: (s) => `Tap an empty cell. ${T.en.side[s]} joins the ${T.en.edges[s]} edges.`,
    hintSwap: 'Or press Swap to take over the first stone.',
    swapBtn: 'Swap',
    cpuSwapped: (a, b) => (a === b ? `The computer swapped. Your stone on ${a} stays put and is now its stone.` : `The computer swapped. Your stone on ${a} moved to ${b} and is now its stone.`),
    swappedPvp: (a, b) => (a === b ? `Agate swapped. The stone on ${a} stays put and is now Agate's.` : `Agate swapped. The stone on ${a} moved to ${b} and is now Agate's.`),
    winYou: 'You win', winAi: 'Computer wins', winSide: (s) => `${T.en.side[s]} wins`,
    endSmall: (n, k) => `${n} moves, a chain of ${k} stones`,
    look: 'Look at the board',
    logSwap: (a, b) => (a === b ? `swap ${a}` : `swap ${a}→${b}`),
    empty: 'empty',
    sizeAsk: (n) => `Switching to ${n} × ${n} starts a new match. The score goes back to zero.`,
    sizeCancel: 'Keep this board', sizeOk: (n) => `Switch to ${n} × ${n}`,
    rules: `
      <ol>
        <li><b>Goal:</b> Jade joins the top and bottom edges. Agate joins the left and right edges. The coloured rims show whose edge is whose. A corner cell belongs to both edges it touches.</li>
        <li><b>Each turn, place one stone</b> on any empty cell. Stones never move and are never captured. Jade goes first.</li>
        <li><b>What counts as joined:</b> every cell has six neighbours. A line of touching stones of one colour from one edge to the other wins, however it bends.</li>
        <li><b>Swap rule:</b> after Jade's first stone, Agate may press Swap instead of placing a stone. The stone flips across the long diagonal to its mirror cell (c2 goes to b3, for example) and becomes Agate's. Then Jade moves again. You can only swap on that one turn.</li>
        <li><b>No draws:</b> when the board is full, exactly one side is always joined.</li>
      </ol>
      <p><b>Why swap?</b> Without the swap rule, the first player has a winning strategy. John Nash proved this with a strategy-stealing argument, but nobody knows the strategy for big boards. With the swap rule, the first player has to pick an opening that is neither too strong nor too weak, because the opponent can take it over.</p>
      <p>To be honest about it: with perfect play, someone always wins, and the swap rule does not change that. It makes real games between people fair.</p>`,
  },
};

// ---------- settings ----------
const store = makeStore('hex');
let lang = initialLang();
let mode = store.get('mode', 'ai');
let level = store.get('level', 'normal');
let size = Number(store.get('size', '9'));
if (!['ai', 'pvp'].includes(mode)) mode = 'ai';
if (!['easy', 'normal', 'hard'].includes(level)) level = 'normal';
if (!E.SIZES.includes(size)) size = 9;

// Players keep their identity across games; the colour they hold alternates.
// Player 1 (left on the scoreboard) is the human vs computer and holds Jade in game 1.
let p1Side = JADE;
let state = null;
let busy = false;
let logRows = [];
let note = '';
// Session score only, by player: a reload starts over.
let score = [0, 0], gameNo = 1, counted = false, overlayHidden = false, revealAt = 0;

const over = () => state.winner !== null;
const playerOf = (side) => (side === p1Side ? 0 : 1);
const humanSide = () => p1Side;
const isAiTurn = () => mode === 'ai' && state.turn !== humanSide();
const humanCanPlay = () => !over() && !busy && !isAiTurn();
const humanCanSwap = () => humanCanPlay() && E.canSwap(state);
const name = (i) => E.cellName(state.n, i);

// ---------- board geometry ----------
// One unit system for the art, the stones and the hit areas. Pointy-top hexagons of
// radius R; row r sits r half-cells to the right, so the rhombus leans right.
const R = 40, HW = Math.sqrt(3) * R / 2, CW = 2 * HW;
let G = null;
function geometry(n) {
  const ML = 1.25 * CW, MT = 2.15 * R, MR = 0.5 * R, MB = 0.5 * R;
  const X = (r, c) => ML + (c + r / 2) * CW;
  const Y = (r) => MT + 1.5 * R * r;
  const W = ML + 1.5 * (n - 1) * CW + HW + MR;
  const H = MT + 1.5 * R * (n - 1) + R + MB;
  return { n, X, Y, W, H, D: 0.86 * CW, at: (i) => [X(Math.floor(i / n), i % n), Y(Math.floor(i / n))] };
}
const f = (v) => Math.round(v * 10) / 10;
// corners clockwise from the top; edge k runs from corner k to corner k+1
const CORNER = [[0, -R], [HW, -R / 2], [HW, R / 2], [0, R], [-HW, R / 2], [-HW, -R / 2]];
// the neighbour across edge k
const ACROSS = [[-1, 1], [0, 1], [1, 0], [1, -1], [0, -1], [-1, 0]];

function hexPoints(x, y, s = 1) {
  return CORNER.map(([dx, dy]) => `${f(x + dx * s)},${f(y + dy * s)}`).join(' ');
}

function buildArt() {
  const n = size;
  G = geometry(n);
  const { X, Y, W, H } = G;
  // outer edges: every hexagon edge with no neighbour across it
  const edges = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const x = X(r, c), y = Y(r);
    for (let k = 0; k < 6; k++) {
      const rr = r + ACROSS[k][0], cc = c + ACROSS[k][1];
      const rowOut = rr < 0 || rr >= n, colOut = cc < 0 || cc >= n;
      if (!rowOut && !colOut) continue;
      const a = [x + CORNER[k][0], y + CORNER[k][1]], b = [x + CORNER[(k + 1) % 6][0], y + CORNER[(k + 1) % 6][1]];
      edges.push({ a, b, side: rowOut && colOut ? -1 : rowOut ? JADE : AGATE });
    }
  }
  // chain them into the outline (each hexagon runs clockwise, so the outline does too)
  const key = (p) => `${Math.round(p[0])},${Math.round(p[1])}`;
  const from = new Map(edges.map((e) => [key(e.a), e]));
  const outline = [];
  let e = edges[0];
  for (let k = 0; k < edges.length; k++) { outline.push(e.a); e = from.get(key(e.b)); if (!e || e === edges[0]) break; }
  const poly = outline.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');
  const rim = (side) => edges.filter((x) => x.side === side).map((x) => `M${f(x.a[0])} ${f(x.a[1])}L${f(x.b[0])} ${f(x.b[1])}`).join('');

  let cells = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const x = X(r, c), y = Y(r), s = 0.94;
    const bev = [4, 5, 0, 1].map((k) => `${f(x + CORNER[k][0] * s)},${f(y + CORNER[k][1] * s)}`).join(' ');
    cells += `<polygon class="cell" points="${hexPoints(x, y, s)}"/><polyline class="bevel" points="${bev}"/>`;
  }
  let coords = '';
  for (let c = 0; c < n; c++) coords += `<text class="coord" x="${f(X(0, c))}" y="${f(Y(0) - 1.62 * R)}">${E.FILES[c]}</text>`;
  for (let r = 0; r < n; r++) coords += `<text class="coord" x="${f(X(r, 0) - 0.98 * CW)}" y="${f(Y(r))}">${r + 1}</text>`;

  const art = $('art');
  art.setAttribute('viewBox', `0 0 ${f(W)} ${f(H)}`);
  art.innerHTML = `
    <defs>
      <radialGradient id="hxPool" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#12151b"/><stop offset="1" stop-color="#0a0b0f"/></radialGradient>
      <linearGradient id="hxStone" x1=".25" y1="0" x2=".75" y2="1"><stop offset="0" stop-color="#262a32"/><stop offset=".5" stop-color="#1c1f25"/><stop offset="1" stop-color="#14161b"/></linearGradient>
      <radialGradient id="hxLight"><stop offset="0" stop-color="rgb(120,150,190)" stop-opacity=".09"/><stop offset="1" stop-color="rgb(120,150,190)" stop-opacity="0"/></radialGradient>
      <filter id="hxAura" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f(R * 0.9)}"/></filter>
      <filter id="hxBlur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f(R * 0.22)}"/></filter>
      <filter id="hxBlur2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f(R * 0.14)}"/></filter>
      <clipPath id="hxClip"><polygon points="${poly}"/></clipPath>
    </defs>
    <polygon class="aura" points="${poly}" filter="url(#hxAura)"/>
    <polygon class="pool" points="${poly}"/>
    <g clip-path="url(#hxClip)">
      <ellipse class="drift" cx="${f(W * 0.3)}" cy="${f(H * 0.4)}" rx="${f(W * 0.3)}" ry="${f(H * 0.32)}" fill="url(#hxLight)"/>
      <ellipse class="drift b" cx="${f(W * 0.7)}" cy="${f(H * 0.62)}" rx="${f(W * 0.26)}" ry="${f(H * 0.3)}" fill="url(#hxLight)"/>
    </g>
    <path class="rim glow s0" d="${rim(JADE)}"/><path class="rim glow s1" d="${rim(AGATE)}"/>
    <path class="rim line s0" d="${rim(JADE)}"/><path class="rim line s1" d="${rim(AGATE)}"/><path class="rim line neutral" d="${rim(-1)}"/>
    ${cells}
    ${coords}`;
  $('thread').setAttribute('viewBox', `0 0 ${f(W)} ${f(H)}`);
  $('thread').innerHTML = '';
  const board = $('board');
  board.style.setProperty('--W', f(W));
  board.style.setProperty('--H', f(H));
  board.style.setProperty('--D', f(G.D));

  // hit areas: real buttons clipped to a hexagon
  const cellsL = $('cells');
  cellsL.innerHTML = '';
  cellsL.style.setProperty('--cw', f(CW));
  cellsL.style.setProperty('--ch', f(2 * R));
  cellBtns.length = 0;
  for (let i = 0; i < n * n; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hexcell';
    const [x, y] = G.at(i);
    b.style.setProperty('--x', f(x));
    b.style.setProperty('--y', f(y));
    b.addEventListener('click', () => onCell(i));
    cellsL.appendChild(b);
    cellBtns.push(b);
  }
  $('stones').innerHTML = '';
  stoneEls.clear();
  builtSize = n;
}
const cellBtns = [];
const stoneEls = new Map();   // cell -> { el, side }
let builtSize = 0;

// ---------- AI ----------
let client = null;
function onAiReply({ move }) {
  busy = false;
  if (!move || over() || !isAiTurn()) { render(); return; }
  if (move.t === 'swap' && E.canSwap(state)) return play({ t: 'swap' }, true);
  if (move.t === 'place' && state.board[move.i] === -1) return play({ t: 'place', i: move.i }, true);
  render();
}
try {
  client = new AIClient(new URL('./ai-worker.js', import.meta.url), onAiReply);
  client.worker.onerror = () => { client = mainThreadClient(); if (busy) { busy = false; maybeAi(); } };
} catch {
  client = mainThreadClient();
}
// Fallback when module workers are unavailable: same search, on the page's thread.
function mainThreadClient() {
  let id = 0;
  return {
    ask(p) {
      const my = ++id;
      setTimeout(async () => {
        const { chooseMove } = await import('./ai.js');
        const r = chooseMove(p, p.level);
        if (my === id) onAiReply({ move: r.move });
      }, 520);
    },
    cancel() { id++; },
  };
}

function maybeAi() {
  if (over() || !isAiTurn()) return;
  busy = true;
  render();
  client.ask({ n: state.n, board: Array.from(state.board), turn: state.turn, swap: E.canSwap(state), level });
}

// ---------- game flow ----------
function newGame() {
  client.cancel();
  busy = false;
  state = E.initialState(size);
  logRows = [];
  note = '';
  counted = false; overlayHidden = false;
  if (builtSize !== size) buildArt();
  render();
  maybeAi();
}

function resetMatch() { score = [0, 0]; gameNo = 1; p1Side = JADE; }

function play(m, byAi = false) {
  const side = state.turn;
  state = E.applyMove(state, m);
  const mv = state.moves[state.moves.length - 1];
  logRows.push({ side, m: mv });
  note = '';
  if (mv.t === 'swap') note = byAi && mode === 'ai' ? 'cpuSwapped' : 'swappedPvp';
  if (over() && !counted) {
    counted = true;
    score[playerOf(state.winner)]++;
    revealAt = performance.now() + 600;   // let the chain light up before the result fades in
    setTimeout(render, 620);
  }
  render();
  maybeAi();
}

function onCell(i) {
  if (!humanCanPlay() || state.board[i] !== -1) return;
  play({ t: 'place', i });
}

$('passBtn').onclick = () => { if (humanCanSwap()) play({ t: 'swap' }); };
// While the swap button is hovered or focused, show where the stone would go.
const peek = (on) => {
  for (const b of cellBtns) b.classList.remove('peek');
  if (on && humanCanSwap()) cellBtns[E.reflect(state.n, state.moves[0].i)]?.classList.add('peek');
};
for (const ev of ['mouseenter', 'focus']) $('passBtn').addEventListener(ev, () => peek(true));
for (const ev of ['mouseleave', 'blur']) $('passBtn').addEventListener(ev, () => peek(false));

// ---------- rendering ----------
function who(player) {
  const L = T[lang];
  if (mode === 'ai') return player === 0 ? L.you : L.cpu;
  return player === 0 ? L.p1 : L.p2;
}
// The move list names the player vs computer and the colour between two players.
const logName = (side) => (mode === 'ai' ? who(playerOf(side)) : T[lang].side[side]);

function render() {
  const L = T[lang];
  applyStatic(L, lang);
  setSeg('modeSeg', mode); setSeg('levelSeg', level); setSeg('sizeSeg', String(size));
  $('levelRow').hidden = mode !== 'ai';
  $('swapNote').innerHTML = L.swapNote;
  $('ver').textContent = L.sizeTag(size);
  $('rulesBody').innerHTML = L.rules;
  const board = $('board');
  board.classList.toggle('turn-0', state.turn === JADE);
  board.classList.toggle('turn-1', state.turn === AGATE);
  board.classList.toggle('over', over());

  // scoreboard: by player; the dot shows the colour held this game
  const firstPlayer = playerOf(JADE);
  renderScore({
    left: { name: who(0), pts: score[0], on: !over() && playerOf(state.turn) === 0, orb: p1Side === JADE ? 'mint' : 'coral' },
    right: { name: who(1), pts: score[1], on: !over() && playerOf(state.turn) === 1, orb: p1Side === JADE ? 'coral' : 'mint' },
    roundBold: L.round(gameNo),
    roundSmall: L.firstMove(who(firstPlayer), mode === 'ai' && firstPlayer === 0),
  });
  $('sbMint').classList.toggle('hold-mint', p1Side === JADE);
  $('sbMint').classList.toggle('hold-coral', p1Side === AGATE);
  $('sbCoral').classList.toggle('hold-mint', p1Side === AGATE);
  $('sbCoral').classList.toggle('hold-coral', p1Side === JADE);
  $('sbMint').title = L.side[p1Side];
  $('sbCoral').title = L.side[1 - p1Side];

  // status line
  let msg, sub = '';
  if (over()) {
    msg = mode === 'ai' ? (state.winner === humanSide() ? L.winYou : L.winAi) : L.winSide(state.winner);
  } else if (isAiTurn()) {
    msg = L.turnAi;
  } else {
    msg = mode === 'ai' ? L.turnYou : L.turnSide(state.turn);
    const parts = [];
    if (note && state.moves.length) {
      const sw = state.moves[state.moves.length - 1];
      if (sw.t === 'swap') parts.push(L[note](name(sw.from), name(sw.to)));
    }
    parts.push(mode === 'ai' ? L.hintAi(state.turn) : L.hintPvp(state.turn));
    if (humanCanSwap()) parts.push(L.hintSwap);
    sub = parts.join(lang === 'zh' ? '' : ' ');
  }
  renderStatus({
    side: over() ? null : state.turn, end: over(), msg, thinking: !over() && isAiTurn(),
    ply: L.plyN(state.ply + (over() ? 0 : 1)), sub, pass: humanCanSwap() ? L.swapBtn : null,
  });

  renderLog(logRows.map((row) => ({
    side: row.side,
    text: row.m.t === 'swap' ? L.logSwap(name(row.m.from), name(row.m.to)) : name(row.m.i),
  })), logName);

  renderStones();
  renderCells();

  if (over()) {
    const ready = performance.now() >= revealAt - 5;
    renderOverlay({
      show: ready && !overlayHidden,
      kind: state.winner === JADE ? 'mint' : 'coral',
      big: msg,
      small: L.endSmall(state.ply, state.chain ? state.chain.length : 0),
      next: L.next, look: L.look,
    });
  } else {
    renderOverlay({ show: false });
  }
  $('nextBtn').hidden = !over();
}

function renderStones() {
  const layer = $('stones');
  const n = state.n;
  for (const [i, s] of stoneEls) {
    if (state.board[i] === s.side) continue;
    stoneEls.delete(i);
    s.el.classList.remove('last', 'won');
    s.el.classList.add('gone');
    setTimeout(() => s.el.remove(), 460);
  }
  for (let i = 0; i < n * n; i++) {
    const side = state.board[i];
    if (side === -1 || stoneEls.has(i)) continue;
    const el = document.createElement('div');
    el.className = 'stone s' + side;
    const [x, y] = G.at(i);
    el.style.setProperty('--x', f(x));
    el.style.setProperty('--y', f(y));
    el.innerHTML = '<b></b>';
    layer.appendChild(el);
    stoneEls.set(i, { el, side });
  }
  const chain = new Set(state.chain || []);
  for (const [i, s] of stoneEls) {
    s.el.classList.toggle('last', i === state.last && !over());
    s.el.classList.toggle('won', chain.has(i));
  }
  // the winning chain: a fine champagne thread through the stones
  const thread = $('thread');
  if (state.chain) {
    if (!thread.firstChild) {
      const pts = state.chain.map((i) => G.at(i));
      let len = 0;
      for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      const p = pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
      thread.innerHTML = `<polyline class="t2" points="${p}"/><polyline class="t1" points="${p}" style="--len:${f(len + 1)}"/>`;
    }
  } else if (thread.firstChild) thread.innerHTML = '';
}

function renderCells() {
  const L = T[lang];
  const can = humanCanPlay();
  for (let i = 0; i < cellBtns.length; i++) {
    const b = cellBtns[i];
    const v = state.board[i];
    const act = can && v === -1;
    b.classList.toggle('act', act);
    b.tabIndex = act ? 0 : -1;
    b.setAttribute('aria-label', `${name(i)}, ${v === -1 ? L.empty : L.side[v]}`);
  }
  if (!humanCanSwap()) for (const b of cellBtns) b.classList.remove('peek');
}

// ---------- controls ----------
bindLang((l) => { lang = l; render(); });
onSeg('modeSeg', (v) => { if (v === mode) return; mode = v; store.set('mode', v); resetMatch(); newGame(); });
onSeg('levelSeg', (v) => { level = v; store.set('level', v); render(); });
onSeg('sizeSeg', async (v) => {
  const n = Number(v);
  if (n === size) return;
  const L = T[lang];
  if (state.ply > 0 || score[0] + score[1] > 0) {
    const ok = await confirmDialog(L.sizeAsk(n), L.sizeCancel, L.sizeOk(n));
    if (!ok) return;
  }
  size = n; store.set('size', v);
  resetMatch();
  newGame();
});
$('restartBtn').onclick = () => newGame();
function nextGame() { p1Side = 1 - p1Side; gameNo++; newGame(); }
$('nextBtn').onclick = nextGame;
$('ovNext').onclick = nextGame;
$('ovLook').onclick = () => { overlayHidden = true; render(); };

newGame();

// exposed for automated tests
window.__hex = {
  get state() { return state; }, get busy() { return busy; }, get score() { return score.slice(); },
  get p1Side() { return p1Side; }, get size() { return size; }, E,
};
