// พรีวิวหน้าคนเล่น: ข้อมูลตัวอย่างทั้งหมด ไม่ต่อ Firebase ไม่บันทึกอะไร
import { VENUES } from '../js/config.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => { const v = Math.round((n || 0) * 100) / 100; return '฿' + v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 1800); }

const D = {
  view: 'start', venue: '', mode: 'cash', cash: 180, transfer: 120, undo: [], t0: Date.now() - (47 * 60 + 12) * 1000,
  songs: [
    { id: 1, song: 'ใจสั่งมา', nick: 'แป้ง', ago: '2 นาทีที่แล้ว', matched: true, tip: 50.12 },
    { id: 2, song: 'เธอ - แบบรัตน์', nick: '', ago: '5 นาทีที่แล้ว', matched: true, tip: 0 },
    { id: 3, song: 'เพลงที่ไม่มีในลิสต์', nick: 'บอส', ago: '8 นาทีที่แล้ว', matched: false, tip: 20.07 }
  ],
  tips: [{ id: 9, amt: 100.31, label: 'ทิปอย่างเดียว', nick: 'เจ', ago: 'เมื่อสักครู่' }]
};

function setTab(t) { $('tabLive').setAttribute('aria-selected', String(t === 'live')); $('tabStats').setAttribute('aria-selected', String(t === 'stats')); }
function show(v) {
  D.view = v;
  document.querySelectorAll('.demobar button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  $('vLogin').hidden = v !== 'login'; $('vApp').hidden = v === 'login';
  document.querySelector('.pbar').hidden = v === 'login';
  setTab(v === 'stats' ? 'stats' : 'live');
  $('pStart').hidden = v !== 'start'; $('pLive').hidden = v !== 'live';
  $('pClose').hidden = v !== 'close'; $('pStats').hidden = v !== 'stats';
  const st = $('pbarState'); st.className = 'pbar-state' + (v === 'live' ? ' on' : ''); st.textContent = v === 'live' ? 'กำลังเล่น' : 'ยังไม่ได้เล่น';
  if (v === 'start') renderStart();
  if (v === 'live') { renderLive(); renderQueue(); }
  if (v === 'close') renderClose();
  if (v === 'stats') renderStats();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.demobar button').forEach((b) => (b.onclick = () => show(b.dataset.v)));
$('tabLive').onclick = () => show(D.view === 'live' ? 'live' : 'start');
$('tabStats').onclick = () => show('stats');
$('btnLogin').onclick = () => show('start');
$('btnLogout').onclick = () => show('login');

// ---------- เริ่มรอบ ----------
function renderStart() {
  $('unclosedBox').hidden = false;
  $('unclosedList').innerHTML = `<div class="req"><div class="row between"><div><div class="req-song">ถนนคนเดินชุมแพ</div>
    <div class="tiny muted">2 ต.ค. · จดไว้ ${fmt(640)}</div></div><button class="btn sm" type="button" data-go="close">นับยอด</button></div></div>`;
  const box = $('venues'); box.innerHTML = '';
  [...VENUES, 'ที่อื่น'].forEach((v) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'venue'; b.textContent = v;
    const other = v === 'ที่อื่น';
    b.setAttribute('aria-pressed', String(other ? D.venue === '__other' : D.venue === v));
    b.onclick = () => { D.venue = other ? '__other' : v; renderStart(); };
    box.appendChild(b);
  });
  $('venueOther').hidden = D.venue !== '__other';
  $('btnStart').disabled = !(D.venue && D.venue !== '__other');
}
$('btnStart').onclick = () => { D.t0 = Date.now(); D.cash = 0; D.transfer = 0; show('live'); };
document.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) show(b.dataset.go); });

// ---------- ระหว่างเล่น ----------
function p2(n) { return String(n).padStart(2, '0'); }
function renderTimer() { const e = Math.max(0, Math.floor((Date.now() - D.t0) / 1000)); $('timer').textContent = `${p2(Math.floor(e / 3600))}:${p2(Math.floor((e % 3600) / 60))}:${p2(e % 60)}`; }
setInterval(() => { if (D.view === 'live') renderTimer(); }, 1000);
function renderLive() {
  $('liveVenue').textContent = D.venue && D.venue !== '__other' ? D.venue : 'ถนนคนเดินเลาะเลย';
  $('cash').textContent = fmt(D.cash); $('transfer').textContent = fmt(D.transfer); $('total').textContent = fmt(D.cash + D.transfer);
  renderTimer();
}
function setMode(m) { D.mode = m; $('mCash').setAttribute('aria-pressed', String(m === 'cash')); $('mTransfer').setAttribute('aria-pressed', String(m === 'transfer')); }
$('mCash').onclick = () => setMode('cash'); $('mTransfer').onclick = () => setMode('transfer');
function add(v, method) { D[method] += v; D.undo.push({ v, method }); renderLive(); toast(`+${fmt(v)} ${method === 'cash' ? 'เงินสด' : 'โอน'}`); }
[10, 20, 50, 100].forEach((v) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = '+' + v; b.onclick = () => add(v, D.mode); $('quick').appendChild(b); });
$('btnAddCustom').onclick = () => { const v = parseFloat($('addCustom').value); if (!(v > 0)) { toast('ใส่ยอดเงินก่อน'); return; } add(v, D.mode); $('addCustom').value = ''; };
$('btnUndo').onclick = () => { const l = D.undo.pop(); if (!l) { toast('ไม่มีรายการให้ย้อน'); return; } D[l.method] -= l.v; renderLive(); toast(`ย้อน ${fmt(l.v)} แล้ว`); };

function renderQueue() {
  $('qCount').textContent = D.songs.length ? `(${D.songs.length})` : '';
  $('qEmpty').hidden = D.songs.length > 0;
  $('queue').innerHTML = D.songs.map((r, i) => `
    <div class="req${i === 0 ? ' next' : ''}">
      <div class="row between" style="align-items:flex-start">
        <div class="req-song">${esc(r.song)}</div>
        ${i === 0 ? '<span class="tag hot">ถัดไป</span>' : ''}
      </div>
      <div class="row" style="flex-wrap:wrap;gap:6px">
        <span class="tiny muted">${esc(r.nick || 'ไม่ระบุชื่อ')} ${r.ago}</span>
        ${r.matched ? '' : '<span class="tag warn">ไม่อยู่ในลิสต์</span>'}
        ${r.tip ? `<span class="tag">แจ้งทิป ${fmt(r.tip)}</span>` : ''}
      </div>
      <div class="row">
        <button class="btn sm" data-act="played" data-id="${r.id}" type="button" style="flex:1">เล่นแล้ว</button>
        <button class="btn ghost sm" data-act="skip" data-id="${r.id}" type="button">ข้าม</button>
      </div>
    </div>`).join('');
  $('tipBox').hidden = D.tips.length === 0;
  $('tipList').innerHTML = D.tips.map((r) => `
    <div class="req">
      <div class="row between"><div><div class="money" style="font-size:26px">${fmt(r.amt)}</div>
      <div class="tiny muted">${esc(r.label)} ${esc(r.nick)} ${r.ago}</div></div></div>
      <div class="row">
        <button class="btn sm" data-act="tipok" data-id="${r.id}" type="button" style="flex:1">ยอดเข้าแล้ว</button>
        <button class="btn ghost sm" data-act="tipno" data-id="${r.id}" type="button">ไม่พบยอด</button>
      </div>
    </div>`).join('');
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const id = Number(b.dataset.id), a = b.dataset.act;
  if (a === 'played' || a === 'skip') D.songs = D.songs.filter((x) => x.id !== id);
  if (a === 'tipok') { const t = D.tips.find((x) => x.id === id); if (t) add(t.amt, 'transfer'); D.tips = D.tips.filter((x) => x.id !== id); }
  if (a === 'tipno') D.tips = D.tips.filter((x) => x.id !== id);
  renderQueue();
});

// ---------- กล่องยืนยันจบรอบ (โค้ดเดียวกับของจริง) ----------
(function injectSheetStyle() {
  const st = document.createElement('style');
  st.textContent = `
  .sheet-bg{position:fixed;inset:0;background:rgba(21,23,28,.45);z-index:50;display:flex;align-items:flex-end;justify-content:center;animation:sheetBg .2s both}
  .sheet{width:100%;max-width:520px;background:#fff;border-radius:28px 28px 0 0;padding:10px 20px calc(20px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:14px;box-shadow:0 -12px 40px rgba(0,0,0,.18);animation:sheetUp .28s cubic-bezier(.2,.8,.2,1) both}
  .sheet-grab{width:40px;height:5px;border-radius:99px;background:#D5D8DE;align-self:center}
  .sheet-title{font-size:22px;font-weight:700;margin:4px 0 0}
  .sheet-sub{font-size:15px;color:#5B616E;margin-top:-8px}
  .sheet-card{background:#F5F6F8;border-radius:18px;padding:14px 16px}
  .sheet-card .l{font-size:13px;color:#5B616E}
  .sheet-card .v{font-size:30px;font-weight:700;letter-spacing:-.5px}
  .sheet-note{font-size:14px;color:#5B616E;line-height:1.5;margin:0}
  .sheet .btn{margin:0}
  `;
  document.head.appendChild(st);
})();
function askConfirm({ title, sub, big, bigLabel, note, okText = 'ตกลง', cancelText = 'ยกเลิก' }) {
  return new Promise((resolve) => {
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grab"></div>
      <h2 class="sheet-title">${esc(title)}</h2>
      ${sub ? `<div class="sheet-sub">${esc(sub)}</div>` : ''}
      ${big ? `<div class="sheet-card"><div class="l">${esc(bigLabel || '')}</div><div class="v">${esc(big)}</div></div>` : ''}
      ${note ? `<p class="sheet-note">${esc(note)}</p>` : ''}
      <button class="btn hot" type="button" data-ok>${esc(okText)}</button>
      <button class="btn text" type="button" data-cancel>${esc(cancelText)}</button>
    </div>`;
    const done = (v) => { document.removeEventListener('keydown', onKey); bg.remove(); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    bg.addEventListener('click', (e) => { if (e.target === bg) done(false); });
    bg.querySelector('[data-ok]').onclick = () => done(true);
    bg.querySelector('[data-cancel]').onclick = () => done(false);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(bg);
    bg.querySelector('[data-cancel]').focus();
  });
}
$('btnEnd').onclick = async () => {
  const ok = await askConfirm({ title: 'จบรอบเล่นเลยไหม?', sub: $('liveVenue').textContent, big: fmt(D.cash + D.transfer), bigLabel: 'รายรับรอบนี้ (ที่จดไว้)',
    note: 'คนดูจะขอเพลงไม่ได้จนกว่าจะเริ่มรอบใหม่ จบแล้วจะไปหน้านับยอดปิดรอบต่อทันที', okText: 'จบรอบ', cancelText: 'เล่นต่อ' });
  if (ok) { toast('จบรอบแล้ว'); show('close'); }
};

// ---------- นับยอดปิดรอบ ----------
const num = (id) => { const v = $(id).value.trim(); if (v === '') return null; const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : null; };
function renderClose() {
  const cc = num('cCash'), ct = num('cTrans');
  $('cMeta').textContent = `${$('liveVenue').textContent || 'ถนนคนเดินเลาะเลย'} · 3 ต.ค. · 19:10 ถึง 21:35`;
  const ca = cc ?? D.cash, ta = ct ?? D.transfer, diff = (a, b) => { const d = Math.round((a - b) * 100) / 100; return d === 0 ? 'ตรงกับที่จดไว้' : (d > 0 ? `เพิ่ม ${fmt(d)}` : `ลด ${fmt(-d)}`) + ' จากที่จดไว้'; };
  $('cCashHint').textContent = `แอปจดไว้ ${fmt(D.cash)}` + (cc != null ? ' · ' + diff(cc, D.cash) : '');
  $('cTransHint').textContent = `แอปจดไว้ ${fmt(D.transfer)} (เฉพาะทิปที่คุณกดยืนยัน)` + (ct != null ? ' · ' + diff(ct, D.transfer) : '') + ' · ดูยอดเข้าบัญชีช่วง 19:10 ถึง 21:35';
  $('cCashAfter').textContent = fmt(ca); $('cTransAfter').textContent = fmt(ta); $('cTotal').textContent = fmt(ca + ta);
}
$('cCash').addEventListener('input', renderClose); $('cTrans').addEventListener('input', renderClose);
$('btnSaveClose').onclick = () => { toast('ปิดรอบแล้ว'); D.venue = ''; show('start'); };
$('btnLaterClose').onclick = () => show('start');

// ---------- สถิติ ----------
document.querySelectorAll('[data-range]').forEach((b) => (b.onclick = () => document.querySelectorAll('[data-range]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))));
function renderStats() {
  $('sTotal').textContent = fmt(6840); $('sCount').textContent = 9; $('sHour').textContent = fmt(310); $('sAvg').textContent = fmt(760);
  const vs = [['ถนนคนเดินเลาะเลย', 3200, 4], ['ถนนคนเดินชุมแพ', 2240, 3], ['ถนนคนเดินเชียงคาน', 1400, 2]];
  $('sVenues').innerHTML = vs.map(([v, t, n]) => `<div class="col" style="gap:6px"><div class="row between small"><span>${v}</span><span class="muted">${fmt(t)} จาก ${n} รอบ</span></div><div class="bar-track"><div class="bar" style="width:${(t / 3200) * 100}%"></div></div></div>`).join('');
  const hv = [5, 12, 40, 70, 100, 85, 60, 35, 20, 8, 3, 1];
  $('sHours').innerHTML = hv.map((h, i) => `<div title="${(14 + i) % 24}:00" style="height:${h}%"></div>`).join('');
  $('sHoursLbl').innerHTML = '<span>14:00</span><span>18:00</span><span>22:00</span><span>01:00</span>';
  const list = (a) => a.map(([k, n]) => `<div class="list-row"><span>${k}</span><span class="muted">${n} ครั้ง</span></div>`).join('');
  $('sSongs').innerHTML = list([['ใจสั่งมา', 14], ['เธอ - แบบรัตน์', 11], ['ผู้ชายหลายใจ', 9]]);
  $('sMissing').innerHTML = list([['เพลงที่ไม่มีในลิสต์', 3], ['ตัวอย่างเพลงอื่น', 2]]);
  $('sHistory').innerHTML = [['3 ต.ค. ถนนคนเดินเลาะเลย', 820], ['2 ต.ค. ถนนคนเดินชุมแพ (ยังไม่นับยอด)', 640], ['30 ก.ย. ถนนคนเดินเชียงคาน', 710]].map(([a, m]) => `<div class="list-row"><span>${a}</span><span style="font-weight:600">${fmt(m)}</span></div>`).join('');
}

show(new URLSearchParams(location.search).get('view') || 'start');
