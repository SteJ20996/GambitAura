import * as E from './engine.js';
import { chooseMove, chooseOrder, chooseSetup } from './ai.js';
import {
  $, makeStore, initialLang, bindLang, applyStatic, setSeg, onSeg,
  renderScore, renderStatus, renderLog, renderOverlay,
} from '../assets/shell.js';

const T = {
  zh: {
    setup: '設定', mode: '模式', modeAi: '對電腦', modePvp: '雙人同機',
    level: '電腦', easy: '簡單', normal: '普通', hard: '困難',
    teachRow: '教學', on: '顯示', off: '隱藏',
    restart: '重新開始', next: '下一局（交換角色）',
    moves: '棋譜', noMoves: '還沒有人動手。', rulesTitle: '怎麼玩',
    footer1: '沒有骰子，沒有計時，沒有隱藏資訊。', footer2: '全部遊戲',
    piles: '堆數', setupDone: '擺好了，交給對方', goFirst: '我先拿', goSecond: '我後拿',
    you: '你', cpu: '電腦', p: ['玩家一', '玩家二'],
    tag: (n) => `${n} 堆`,
    round: (n) => `第 ${n} 局`,
    roles: (s, c) => `${s}擺石子 · ${c}選先後`,
    left: (n) => `剩 ${n} 顆`,
    setMsg: (w) => `${w}擺石子`, setMine: '擺石子',
    setSub: '用 ＋ 和 － 決定每堆幾顆（1 到 7 顆），下方調整堆數（3 到 5 堆），然後按「擺好了」。對方會看著你擺的石子，決定先拿還是後拿。',
    setWait: '對方正在擺石子。',
    chooseMsg: '選先後', chooseWait: (w) => `${w}正在選先後`,
    chooseSub: '看清楚這幾堆石子，決定你要先拿還是後拿。',
    turnYou: '輪到你', turnAi: '電腦思考中', turnSide: (w) => `輪到${w}`,
    playSub: '點一顆石子：拿走它和它右邊的石子。每次只能從一堆拿。',
    winYou: '你贏了', winAi: '電腦獲勝', winSide: (w) => `${w}勝`,
    endSmall: '拿走了最後一顆石子',
    look: '看一下棋盤',
    logSet: (p) => `擺好 ${p.join(' · ')}`, logFirst: '選擇先拿', logSecond: '選擇後拿',
    logTake: (i, k) => `第 ${i + 1} 堆拿 ${k}`,
    sumLabel: '尼姆和', sumWin: '不是 0：輪到的一方有必勝拿法，金框是其中一種。', sumLose: '是 0：輪到的一方怎麼拿，對方都能再把它變回 0。',
    note: '<b>公平性：</b>取石子沒有和局，而且每個局面誰會贏早在 1901 年就算出來了。所以這裡的公平靠賽制：一方擺石子、另一方看了再選先後，下一局交換。擺的人想讓對方看錯，選的人要看穿它。',
    rules: `
      <ol>
        <li>桌上有幾堆石子。雙方輪流，每次從<b>其中一堆</b>拿走一顆或好幾顆。</li>
        <li><b>拿走最後一顆石子的人獲勝。</b></li>
        <li>每局開始前，一方擺石子：決定有幾堆、每堆幾顆。另一方看過後，選自己先拿還是後拿。</li>
        <li>下一局兩人交換角色。</li>
        <li>這個遊戲有完美的算法，打開「教學」就看得到：把每堆的數量寫成二進位，同一位上的 1 如果是奇數個就記 1，偶數個就記 0，得到的數叫「尼姆和」。輪到你時尼姆和不是 0，就一定有一種拿法讓它變成 0；一直這樣拿，最後一顆就是你的。</li>
      </ol>`,
  },
  en: {
    setup: 'Setup', mode: 'Mode', modeAi: 'vs computer', modePvp: 'Two players',
    level: 'Computer', easy: 'Easy', normal: 'Normal', hard: 'Hard',
    teachRow: 'Teaching view', on: 'On', off: 'Off',
    restart: 'Restart', next: 'Next game (swap roles)',
    moves: 'Moves', noMoves: 'Nothing taken yet.', rulesTitle: 'How to play',
    footer1: 'No dice, no timer, nothing hidden.', footer2: 'All games',
    piles: 'Piles', setupDone: 'Done, hand it over', goFirst: 'I go first', goSecond: 'I go second',
    you: 'You', cpu: 'Computer', p: ['Player 1', 'Player 2'],
    tag: (n) => `${n} piles`,
    round: (n) => `Game ${n}`,
    roles: (s, c) => `${s} ${s === 'You' ? 'set' : 'sets'} up · ${c} ${c === 'You' ? 'pick' : 'picks'} the order`,
    left: (n) => `${n} left`,
    setMsg: (w) => `${w} sets up the piles`, setMine: 'Set up the piles',
    setSub: 'Use + and − to choose how many stones each pile has (1 to 7), and the controls below for the number of piles (3 to 5). Then press Done. The other player will look at your piles and choose to go first or second.',
    setWait: 'The other player is setting up.',
    chooseMsg: 'Choose the order', chooseWait: (w) => `${w} is choosing the order`,
    chooseSub: 'Look at the piles and decide whether you want to take first or second.',
    turnYou: 'Your move', turnAi: 'Computer is thinking', turnSide: (w) => `${w} to move`,
    playSub: 'Tap a stone to take it and every stone to its right. Take from one pile only.',
    winYou: 'You win', winAi: 'Computer wins', winSide: (w) => `${w} wins`,
    endSmall: 'took the last stone',
    look: 'Look at the board',
    logSet: (p) => `set up ${p.join(' · ')}`, logFirst: 'chose to go first', logSecond: 'chose to go second',
    logTake: (i, k) => `pile ${i + 1}, take ${k}`,
    sumLabel: 'Nim-sum', sumWin: 'is not 0: the side to move has a winning move; the gold rings show one.', sumLose: 'is 0: whatever the side to move takes, the other side can bring it back to 0.',
    note: '<b>Fairness:</b> Nim has no draws, and who wins from any position was worked out in 1901. So the fairness here comes from the format: one player sets up the piles, the other looks and chooses to go first or second, and the roles swap every game. The setter hopes the chooser misreads the piles; the chooser tries to see through them.',
    rules: `
      <ol>
        <li>There are a few piles of stones. Take turns; each turn take one or more stones from <b>one pile</b>.</li>
        <li><b>Whoever takes the last stone wins.</b></li>
        <li>Before each game one player sets up the piles: how many, and how many stones in each. The other player looks and chooses to go first or second.</li>
        <li>The roles swap every game.</li>
        <li>Nim has a perfect method, shown by the teaching view: write each pile size in binary; in each column, an odd number of 1s gives 1 and an even number gives 0. The result is the nim-sum. If it is not 0 on your turn, some move makes it 0; keep doing that and the last stone is yours.</li>
      </ol>`,
  },
};

const store = makeStore('nim');
let lang = initialLang();
let mode = store.get('mode', 'ai');
let level = store.get('level', 'normal');
let teach = store.get('teach', 'off');
if (!['ai', 'pvp'].includes(mode)) mode = 'ai';
if (!['easy', 'normal', 'hard'].includes(level)) level = 'normal';
if (!['on', 'off'].includes(teach)) teach = 'off';

let setterPlayer = 0;                 // who sets up this game; swaps every game
let score = [0, 0], gameNo = 1, counted = false, overlayHidden = false;
let st = null;                        // { phase, piles, turn, winner, ply }
let rows = [];
let timer = 0, hover = null;

const chooser = () => 1 - setterPlayer;
const isCpu = (p) => mode === 'ai' && p === 1;
const name = (p) => (mode === 'ai' ? (p === 0 ? T[lang].you : T[lang].cpu) : T[lang].p[p]);
const actor = () => (st.phase === 'setup' ? setterPlayer : st.phase === 'choose' ? chooser() : st.turn);

function newGame() {
  clearTimeout(timer);
  st = { phase: 'setup', piles: [3, 4, 5], turn: null, winner: null, ply: 0 };
  rows = [];
  counted = false; overlayHidden = false; hover = null;
  render();
  maybeCpu();
}

function finishSetup() {
  rows.push({ side: setterPlayer, text: T[lang].logSet(st.piles) });
  st.phase = 'choose';
  render();
  maybeCpu();
}

function choose(order) {
  const c = chooser();
  rows.push({ side: c, text: order === 'first' ? T[lang].logFirst : T[lang].logSecond });
  st.phase = 'play';
  st.turn = order === 'first' ? c : setterPlayer;
  render();
  maybeCpu();
}

function takeMove(i, k) {
  const p = st.turn;
  st.piles = E.take(st.piles, i, k);
  st.ply++;
  rows.push({ side: p, text: T[lang].logTake(i, k) });
  hover = null;
  if (E.isEmpty(st.piles)) {
    st.phase = 'over';
    st.winner = p;
    if (!counted) { counted = true; score[p]++; }
  } else {
    st.turn = 1 - p;
  }
  render();
  maybeCpu();
}

// The computer acts after a short pause, so each step can be seen.
function maybeCpu() {
  clearTimeout(timer);
  if (st.phase === 'over' || !isCpu(actor())) return;
  const g = gameNo;
  timer = setTimeout(() => {
    if (g !== gameNo) return;
    if (st.phase === 'setup') { st.piles = chooseSetup(level, gameNo); finishSetup(); }
    else if (st.phase === 'choose') choose(chooseOrder(st.piles, level));
    else if (st.phase === 'play') { const [i, k] = chooseMove(st.piles, level, gameNo * 131 + st.ply); takeMove(i, k); }
  }, st.phase === 'play' ? 700 : 900);
}

// ---------- rendering ----------
const pilesEl = $('piles');

function stoneClick(i, j) {
  if (st.phase !== 'play' || isCpu(st.turn)) return;
  const k = st.piles[i] - j;
  if (k >= 1) takeMove(i, k);
}

function adjust(i, d) {
  const v = st.piles[i] + d;
  if (v < 1 || v > E.MAX_STONES) return;
  st.piles[i] = v;
  render();
}

function renderPiles(L) {
  pilesEl.innerHTML = '';
  const setupMine = st.phase === 'setup' && !isCpu(setterPlayer);
  const playMine = st.phase === 'play' && !isCpu(st.turn);
  const showTeach = teach === 'on' && st.phase !== 'setup';
  const hint = showTeach && st.phase === 'play' ? E.winningMoves(st.piles)[0] : null;
  st.piles.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'pile';
    const label = document.createElement('span');
    label.className = 'pl';
    label.textContent = i + 1;
    const stones = document.createElement('div');
    stones.className = 'stones';
    for (let j = 0; j < E.MAX_STONES; j++) {
      const b = document.createElement('button');
      b.type = 'button';
      const isStone = j < p;
      b.className = 'slot' + (isStone ? ' stone' : '');
      if (isStone && playMine) {
        b.classList.add('act');
        b.setAttribute('aria-label', L.logTake(i, p - j));
        b.addEventListener('mouseenter', () => { hover = [i, j]; paintHover(); });
        b.addEventListener('mouseleave', () => { hover = null; paintHover(); });
        b.addEventListener('click', () => stoneClick(i, j));
      } else {
        b.tabIndex = -1;
        b.setAttribute('aria-hidden', 'true');
      }
      if (hint && hint[0] === i && j >= p - hint[1] && isStone) b.classList.add('hintk');
      b.dataset.i = i; b.dataset.j = j;
      stones.appendChild(b);
    }
    const cnt = document.createElement('span');
    cnt.className = 'cnt';
    cnt.textContent = p;
    row.append(label, stones, cnt);
    if (setupMine) {
      const pm = document.createElement('span');
      pm.className = 'pm';
      pm.innerHTML = `<button type="button" aria-label="−">−</button><button type="button" aria-label="+">+</button>`;
      const [minus, plus] = pm.querySelectorAll('button');
      minus.disabled = p <= 1; plus.disabled = p >= E.MAX_STONES;
      minus.onclick = () => adjust(i, -1);
      plus.onclick = () => adjust(i, 1);
      row.append(pm);
    } else if (showTeach) {
      const bin = document.createElement('span');
      bin.className = 'bin';
      bin.textContent = E.toBinary(p);
      row.append(bin);
    } else {
      row.append(document.createElement('span'));
    }
    pilesEl.appendChild(row);
  });
  // teaching row: the nim-sum and what it means for the side to move
  const t = $('teach');
  t.hidden = !(showTeach && st.phase !== 'over');
  if (!t.hidden) {
    const x = E.nimSum(st.piles);
    t.innerHTML = `<span></span><span class="lbl"><b>${L.sumLabel}</b> ${x === 0 ? L.sumLose : L.sumWin}</span><span class="cnt">${x}</span><span class="bin">${E.toBinary(x)}</span>`;
  }
  paintHover();
}

function paintHover() {
  for (const b of pilesEl.querySelectorAll('.slot.stone')) {
    const i = +b.dataset.i, j = +b.dataset.j;
    b.classList.toggle('take', !!hover && hover[0] === i && j >= hover[1]);
  }
}

function render() {
  const L = T[lang];
  applyStatic(L, lang);
  setSeg('modeSeg', mode); setSeg('levelSeg', level); setSeg('teachSeg', teach);
  $('levelRow').hidden = mode !== 'ai';
  $('note').innerHTML = L.note;
  $('rulesBody').innerHTML = L.rules;
  $('nextBtn').hidden = st.phase !== 'over';
  $('tag').textContent = L.tag(st.piles.length);

  const who = actor();
  const board = $('board');
  board.classList.toggle('turn-0', st.phase !== 'over' && who === 0);
  board.classList.toggle('turn-1', st.phase !== 'over' && who === 1);
  board.classList.toggle('over', st.phase === 'over');

  renderScore({
    left: { name: name(0), pts: score[0], on: st.phase !== 'over' && who === 0 },
    right: { name: name(1), pts: score[1], on: st.phase !== 'over' && who === 1 },
    roundBold: L.round(gameNo),
    roundSmall: L.roles(name(setterPlayer), name(chooser())),
  });

  const setupMine = st.phase === 'setup' && !isCpu(setterPlayer);
  $('setupBar').hidden = !setupMine;
  $('pileMinus').disabled = st.piles.length <= E.MIN_PILES;
  $('pilePlus').disabled = st.piles.length >= E.MAX_PILES;
  $('chooseBar').hidden = !(st.phase === 'choose' && !isCpu(chooser()));

  let msg, sub = '', thinking = false;
  if (st.phase === 'setup') {
    msg = setupMine ? (mode === 'ai' ? L.setMine : L.setMsg(name(setterPlayer))) : L.setMsg(name(setterPlayer));
    sub = setupMine ? L.setSub : L.setWait;
    thinking = !setupMine;
  } else if (st.phase === 'choose') {
    const mine = !isCpu(chooser());
    msg = mine ? (mode === 'ai' ? L.chooseMsg : name(chooser()) + (lang === 'zh' ? '：' : ': ') + L.chooseMsg) : L.chooseWait(name(chooser()));
    sub = mine ? L.chooseSub : '';
    thinking = !mine;
  } else if (st.phase === 'play') {
    if (isCpu(st.turn)) { msg = L.turnAi; thinking = true; }
    else { msg = mode === 'ai' ? L.turnYou : L.turnSide(name(st.turn)); sub = L.playSub; }
  } else {
    msg = mode === 'ai' ? (st.winner === 0 ? L.winYou : L.winAi) : L.winSide(name(st.winner));
  }
  renderStatus({ side: st.phase === 'over' ? null : who, end: st.phase === 'over', msg, thinking, ply: L.left(E.total(st.piles)), sub });
  renderLog(rows, (p) => name(p));
  renderPiles(L);

  renderOverlay({
    show: st.phase === 'over' && !overlayHidden,
    kind: st.phase === 'over' ? (st.winner === 0 ? 'mint' : 'coral') : null,
    big: msg, small: st.phase === 'over' ? name(st.winner) + (lang === 'zh' ? '' : ' ') + L.endSmall : '',
    next: L.next, look: L.look,
  });
}

$('pileMinus').onclick = () => { if (st.piles.length > E.MIN_PILES) { st.piles.pop(); render(); } };
$('pilePlus').onclick = () => { if (st.piles.length < E.MAX_PILES) { st.piles.push(3); render(); } };
$('setupDone').onclick = () => { if (E.validSetup(st.piles)) finishSetup(); };
$('goFirst').onclick = () => choose('first');
$('goSecond').onclick = () => choose('second');

bindLang((l) => { lang = l; render(); });
onSeg('modeSeg', (v) => { if (v === mode) return; mode = v; store.set('mode', v); score = [0, 0]; gameNo = 1; setterPlayer = 0; newGame(); });
onSeg('levelSeg', (v) => { level = v; store.set('level', v); render(); });
onSeg('teachSeg', (v) => { teach = v; store.set('teach', v); render(); });
$('restartBtn').onclick = () => newGame();
const nextGame = () => { setterPlayer = 1 - setterPlayer; gameNo++; newGame(); };
$('nextBtn').onclick = nextGame;
$('ovNext').onclick = nextGame;
$('ovLook').onclick = () => { overlayHidden = true; renderOverlay({ show: false }); };

newGame();

window.__game = { get state() { return st; }, get score() { return score.slice(); } };
