// 罡曜 GambitAura: small helpers shared by the game pages (Hex, Reversi, Gomoku, Nim).
// Every page uses the same element ids: score (sbMint/sbCoral, whoMint/whoCoral,
// ptsMint/ptsCoral, round), status (status, msg, ply, sub, passBtn), log (log,
// logEmpty), overlay (overlay, ovBig, ovSmall, ovNext, ovLook) and drawDlg.
// 借路 keeps its own copy of this logic in jielu/app.js.

export const $ = (id) => document.getElementById(id);

// The language key predates the other games; every page shares it.
const LANG_KEY = 'ga-jielu-lang';

export function makeStore(game) {
  const pre = 'ga-' + game + '-';
  return {
    get(k, d) { try { const v = localStorage.getItem(pre + k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(pre + k, v); } catch { /* private mode */ } },
  };
}

export function initialLang() {
  try { const v = localStorage.getItem(LANG_KEY); if (v === 'zh' || v === 'en') return v; } catch { /* ignore */ }
  return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function bindLang(onChange) {
  for (const b of document.querySelectorAll('[data-lang]')) {
    b.addEventListener('click', () => {
      try { localStorage.setItem(LANG_KEY, b.dataset.lang); } catch { /* ignore */ }
      onChange(b.dataset.lang);
    });
  }
}

// Static strings: [data-i18n] text, html lang, language chips.
export function applyStatic(L, lang) {
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const v = L[el.dataset.i18n];
    if (typeof v === 'string') el.textContent = v;
  }
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
}

export function setSeg(id, v) {
  for (const b of $(id).querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === v));
}

export function onSeg(id, fn) {
  for (const b of $(id).querySelectorAll('button')) b.addEventListener('click', () => fn(b.dataset.v));
}

// Scoreboard. left/right: { name, pts, on, orb } where orb is an extra class for the dot.
export function renderScore({ left, right, roundBold, roundSmall }) {
  $('whoMint').textContent = left.name;
  $('whoCoral').textContent = right.name;
  $('ptsMint').textContent = left.pts;
  $('ptsCoral').textContent = right.pts;
  $('round').innerHTML = `<b>${roundBold}</b>${roundSmall}`;
  $('sbMint').classList.toggle('on', !!left.on);
  $('sbCoral').classList.toggle('on', !!right.on);
  const o1 = $('sbMint').querySelector('.orb'), o2 = $('sbCoral').querySelector('.orb');
  o1.className = 'orb' + (left.orb ? ' ' + left.orb : '');
  o2.className = 'orb' + (right.orb ? ' ' + right.orb : '');
}

// Status line. side: 0, 1 or null; end: game over.
export function renderStatus({ side, end, msg, thinking, ply, sub, pass }) {
  const st = $('status');
  st.classList.toggle('end', !!end);
  st.classList.toggle('s0', !end && side === 0);
  st.classList.toggle('s1', !end && side === 1);
  const m = $('msg');
  m.textContent = msg;
  m.classList.toggle('thinking', !!thinking);
  $('ply').textContent = ply || '';
  const s = $('sub');
  s.textContent = sub || '';
  s.hidden = !sub;
  const p = $('passBtn');
  if (p) { p.hidden = !pass; if (pass) p.textContent = pass; }
}

// Move list. rows: [{ side: 0|1, text }].
export function renderLog(rows, sideName) {
  const ol = $('log');
  ol.innerHTML = '';
  rows.forEach((row, i) => {
    const li = document.createElement('li');
    const cls = row.side === 0 ? 'mint' : 'coral';
    li.innerHTML = `<span class="n">${i + 1}</span><span class="d ${cls}"></span><span class="m">${sideName(row.side)} ${row.text}</span>`;
    ol.appendChild(li);
  });
  $('logEmpty').hidden = rows.length > 0;
  ol.scrollTop = ol.scrollHeight;
}

// Result overlay. kind: 'mint' | 'coral' | 'draw'. Fades in after the last move has landed.
let ovTimer = 0;
export function renderOverlay({ show, kind, big, small, next, look }) {
  const ov = $('overlay');
  ov.classList.remove('mint', 'coral', 'draw');
  if (kind) ov.classList.add(kind);
  if (big !== undefined) { $('ovBig').textContent = big; $('ovSmall').textContent = small || ''; }
  if (next) $('ovNext').textContent = next;
  if (look) $('ovLook').textContent = look;
  clearTimeout(ovTimer);
  if (show) { if (!ov.classList.contains('show')) ovTimer = setTimeout(() => ov.classList.add('show'), 650); }
  else ov.classList.remove('show');
}

// Yes/no dialog on #drawDlg. Resolves true when the second button is chosen.
export function confirmDialog(text, cancelText, okText) {
  const dlg = $('drawDlg');
  $('drawText').textContent = text;
  $('drawCancel').textContent = cancelText;
  $('drawOk').textContent = okText;
  return new Promise((resolve) => {
    $('drawCancel').onclick = () => dlg.close('cancel');
    $('drawOk').onclick = () => dlg.close('ok');
    dlg.onclose = () => resolve(dlg.returnValue === 'ok');
    dlg.returnValue = '';
    dlg.showModal();
  });
}

// Computer player in a module Web Worker. Replies arrive no sooner than minMs after
// the request, so a fast reply does not feel abrupt; stale replies are dropped.
export class AIClient {
  constructor(workerUrl, onReply, minMs = 520) {
    this.onReply = onReply;
    this.minMs = minMs;
    this.id = 0;
    this.worker = new Worker(workerUrl, { type: 'module' });
    this.worker.onmessage = (e) => this.receive(e.data);
  }
  ask(payload) {
    const id = ++this.id;
    this.started = performance.now();
    this.worker.postMessage({ id, ...payload });
    return id;
  }
  cancel() { this.id++; }
  receive(data) {
    if (data.id !== this.id) return;
    const wait = Math.max(0, this.minMs - (performance.now() - this.started));
    const id = data.id;
    setTimeout(() => { if (id === this.id) this.onReply(data); }, wait);
  }
}
