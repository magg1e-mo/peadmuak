import { PERFORMER_EMAIL, VENUES } from './config.js';
import {
  configured, db, auth, doc, collection, onSnapshot, addDoc, setDoc, updateDoc, getDoc, getDocs,
  query, orderBy, limit, serverTimestamp, increment, writeBatch,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut
} from './firebase.js';

const $ = (id) => document.getElementById(id);
const stateRef = () => doc(db, 'public', 'state');
const songsRef = () => doc(db, 'stats', 'songs');

const S = {
  user: null, live: false, sessionId: null, session: null, requests: [],
  mode: 'cash', undo: [], venue: '', publishedQ: -1, unsubs: [], range: 30, timer: null,
  closeId: null, closeSess: null, unclosed: []
};

const fmt = (n) => {
  const v = Math.round((n || 0) * 100) / 100;
  return '฿' + v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
};
const ms = (t) => (t && t.toMillis ? t.toMillis() : null);
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 1800); }
function showError(msg) { $('errorBox').textContent = msg || ''; $('errorBox').hidden = !msg; }
function ago(t) {
  const m = ms(t); if (!m) return 'เมื่อสักครู่';
  const min = Math.floor((Date.now() - m) / 60000);
  return min < 1 ? 'เมื่อสักครู่' : min < 60 ? `${min} นาทีที่แล้ว` : `${Math.floor(min / 60)} ชม.ที่แล้ว`;
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- ล็อกอิน ----------
if (!configured) {
  $('vLogin').hidden = false; $('btnLogin').disabled = true;
  showError('ยังไม่ได้ตั้งค่า Firebase ในไฟล์ js/config.js');
} else {
  onAuthStateChanged(auth, (u) => {
    S.user = u;
    if (u && u.email && u.email.toLowerCase() === PERFORMER_EMAIL.toLowerCase()) {
      $('vLogin').hidden = true; $('vApp').hidden = false; showError(''); watchState();
    } else {
      stopAll();
      $('vApp').hidden = true; $('vLogin').hidden = false;
      if (u) {
        $('loginMsg').textContent = `บัญชี ${u.email} ไม่ใช่บัญชีคนเล่น ออกจากระบบแล้วเข้าด้วยบัญชีที่ถูกต้อง`;
        $('btnLogin').textContent = 'ออกจากระบบ';
      } else {
        $('loginMsg').textContent = 'เข้าสู่ระบบด้วยบัญชี Google ของคุณ เพื่อดูคิวเพลงและรายรับ';
        $('btnLogin').textContent = 'เข้าสู่ระบบด้วย Google';
      }
    }
  });
}
$('btnLogin').onclick = async () => {
  if (S.user) { await signOut(auth); return; }
  const p = new GoogleAuthProvider();
  try { await signInWithPopup(auth, p); }
  catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(auth, p);
    else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') showError('เข้าสู่ระบบไม่สำเร็จ: ' + e.code);
  }
};
$('btnLogout').onclick = () => signOut(auth);

function stopAll() { S.unsubs.forEach((u) => u()); S.unsubs = []; clearInterval(S.timer); }
function stopSession() { S.sessUnsubs?.forEach((u) => u()); S.sessUnsubs = []; clearInterval(S.timer); }

// ---------- สถานะรอบเล่น ----------
function watchState() {
  if (S.unsubs.length) return;
  S.unsubs.push(onSnapshot(stateRef(), (snap) => {
    const d = snap.exists() ? snap.data() : {};
    const live = !!d.live && !!d.sessionId;
    if (live && d.sessionId !== S.sessionId) openSession(d.sessionId);
    if (!live && S.live) stopSession();
    S.live = live; S.sessionId = live ? d.sessionId : null;
    S.publishedQ = d.queueCount ?? -1;
    if (!S.unclosedLoaded) { S.unclosedLoaded = true; loadUnclosed(); }
    renderTab();
  }, (e) => showError('อ่านข้อมูลไม่ได้ (' + e.code + ') ตรวจว่าอีเมลใน firestore.rules ตรงกับบัญชีนี้')));
}

function openSession(sid) {
  stopSession(); S.undo = []; S.requests = []; S.session = null;
  const sRef = doc(db, 'sessions', sid);
  S.sessUnsubs.push(onSnapshot(sRef, (snap) => { S.session = snap.data() || null; renderLive(); }));
  S.sessUnsubs.push(onSnapshot(query(collection(sRef, 'requests'), orderBy('createdAt', 'asc')), (qs) => {
    const before = new Set(S.requests.map((r) => r.id));
    S.requests = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
    const fresh = S.requests.filter((r) => !before.has(r.id) && r.status === 'queued');
    if (before.size && fresh.length) { toast(fresh[0].kind === 'song' ? 'คำขอใหม่: ' + fresh[0].song : 'มีทิปเข้ามาใหม่'); if (navigator.vibrate) navigator.vibrate(120); }
    renderQueue();
  }));
  S.timer = setInterval(renderTimer, 1000);
}

// ---------- แท็บ ----------
let tab = 'live';
$('tabLive').onclick = () => { tab = 'live'; renderTab(); };
$('tabStats').onclick = () => { tab = 'stats'; renderTab(); loadStats(); };
function renderTab() {
  $('tabLive').setAttribute('aria-selected', String(tab === 'live'));
  $('tabStats').setAttribute('aria-selected', String(tab === 'stats'));
  $('pStats').hidden = tab !== 'stats';
  const showClose = tab === 'live' && !S.live && !!S.closeId;
  $('pClose').hidden = !showClose;
  $('pStart').hidden = !(tab === 'live' && !S.live && !S.closeId);
  $('pLive').hidden = !(tab === 'live' && S.live);
  if (showClose) renderClose();
  if (tab === 'live' && !S.live && !S.closeId) { renderVenues(); renderUnclosed(); }
}

// ---------- เริ่มรอบ ----------
function renderVenues() {
  const box = $('venues'); box.innerHTML = '';
  [...VENUES, 'ที่อื่น'].forEach((v) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'venue'; b.textContent = v;
    const other = v === 'ที่อื่น';
    b.setAttribute('aria-pressed', String(other ? S.venue === '__other' : S.venue === v));
    b.onclick = () => { S.venue = other ? '__other' : v; renderVenues(); if (other) $('venueOther').focus(); };
    box.appendChild(b);
  });
  $('venueOther').hidden = S.venue !== '__other';
  $('btnStart').disabled = !venueName();
}
const venueName = () => (S.venue === '__other' ? $('venueOther').value.trim() : S.venue);
$('venueOther').addEventListener('input', () => ($('btnStart').disabled = !venueName()));
$('btnStart').onclick = async () => {
  const venue = venueName(); if (!venue) return;
  $('btnStart').disabled = true;
  try {
    const ref = await addDoc(collection(db, 'sessions'), {
      venue, startedAt: serverTimestamp(), endedAt: null, live: true, cash: 0, transfer: 0, hours: {}
    });
    await setDoc(stateRef(), { live: true, sessionId: ref.id, venue, queueCount: 0, startedAt: serverTimestamp() });
    S.venue = '';
  } catch (e) { showError('เริ่มรอบไม่สำเร็จ: ' + e.code); $('btnStart').disabled = false; }
};

// ---------- ระหว่างเล่น ----------
function renderTimer() {
  const st = ms(S.session?.startedAt); if (!st) { $('timer').textContent = '00:00:00'; return; }
  const e = Math.max(0, Math.floor((Date.now() - st) / 1000)), p = (n) => String(n).padStart(2, '0');
  $('timer').textContent = `${p(Math.floor(e / 3600))}:${p(Math.floor((e % 3600) / 60))}:${p(e % 60)}`;
}
function renderLive() {
  const s = S.session || {};
  $('liveVenue').textContent = s.venue || '';
  $('cash').textContent = fmt(s.cash); $('transfer').textContent = fmt(s.transfer);
  $('total').textContent = fmt((s.cash || 0) + (s.transfer || 0));
  renderTimer();
}

function setMode(m) { S.mode = m; $('mCash').setAttribute('aria-pressed', String(m === 'cash')); $('mTransfer').setAttribute('aria-pressed', String(m === 'transfer')); }
$('mCash').onclick = () => setMode('cash');
$('mTransfer').onclick = () => setMode('transfer');
[10, 20, 50, 100].forEach((v) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = '+' + v;
  b.onclick = () => addMoney(v, S.mode); $('quick').appendChild(b);
});
$('btnAddCustom').onclick = () => {
  const v = parseFloat($('addCustom').value);
  if (!(v > 0)) { toast('ใส่ยอดเงินก่อน'); return; }
  addMoney(v, S.mode); $('addCustom').value = '';
};

async function addMoney(v, method, requestId = null) {
  if (!S.sessionId) return;
  const sRef = doc(db, 'sessions', S.sessionId);
  const eRef = doc(collection(sRef, 'entries'));
  const h = new Date().getHours();
  const b = writeBatch(db);
  b.set(eRef, { amount: v, method, requestId, createdAt: serverTimestamp() });
  b.update(sRef, { [method]: increment(v), [`hours.${h}`]: increment(v) });
  if (requestId) b.update(doc(sRef, 'requests', requestId), { tipConfirmed: true });
  try {
    await b.commit();
    S.undo.push({ id: eRef.id, v, method, h, requestId });
    toast(`+${fmt(v)} ${method === 'cash' ? 'เงินสด' : 'โอน'}`);
  } catch (e) { toast('บันทึกไม่สำเร็จ ลองอีกครั้ง'); }
}
$('btnUndo').onclick = async () => {
  const last = S.undo.pop(); if (!last) { toast('ไม่มีรายการให้ย้อน'); return; }
  const sRef = doc(db, 'sessions', S.sessionId);
  const b = writeBatch(db);
  b.delete(doc(sRef, 'entries', last.id));
  b.update(sRef, { [last.method]: increment(-last.v), [`hours.${last.h}`]: increment(-last.v) });
  if (last.requestId) b.update(doc(sRef, 'requests', last.requestId), { tipConfirmed: false });
  try { await b.commit(); toast(`ย้อน ${fmt(last.v)} แล้ว`); } catch (e) { S.undo.push(last); toast('ย้อนไม่สำเร็จ'); }
};

function renderQueue() {
  const songs = S.requests.filter((r) => r.kind === 'song' && r.status === 'queued');
  const tips = S.requests.filter((r) => r.tipAmount && !r.tipConfirmed && !r.tipDismissed);

  $('qCount').textContent = songs.length ? `(${songs.length})` : '';
  $('qEmpty').hidden = songs.length > 0;
  $('queue').innerHTML = songs.map((r, i) => `
    <div class="req${i === 0 ? ' next' : ''}">
      <div class="row between" style="align-items:flex-start">
        <div class="req-song">${esc(r.song)}</div>
        ${i === 0 ? '<span class="tag hot">ถัดไป</span>' : ''}
      </div>
      <div class="row" style="flex-wrap:wrap;gap:6px">
        <span class="tiny muted">${esc(r.nick || 'ไม่ระบุชื่อ')} ${ago(r.createdAt)}</span>
        ${r.matched ? '' : '<span class="tag warn">ไม่อยู่ในลิสต์</span>'}
        ${r.tipAmount ? `<span class="tag ${r.tipConfirmed ? 'ok' : ''}">${r.tipConfirmed ? 'ได้ทิปแล้ว' : 'แจ้งทิป'} ${fmt(r.tipAmount)}</span>` : ''}
      </div>
      <div class="row">
        <button class="btn sm" data-act="played" data-id="${r.id}" type="button" style="flex:1">เล่นแล้ว</button>
        <button class="btn ghost sm" data-act="skip" data-id="${r.id}" type="button">ข้าม</button>
      </div>
    </div>`).join('');

  $('tipBox').hidden = tips.length === 0;
  $('tipList').innerHTML = tips.map((r) => `
    <div class="req">
      <div class="row between">
        <div><div class="money" style="font-size:26px">${fmt(r.tipAmount)}</div>
        <div class="tiny muted">${r.kind === 'song' ? esc(r.song) : 'ทิปอย่างเดียว'} ${esc(r.nick || '')} ${ago(r.createdAt)}</div></div>
      </div>
      <div class="row">
        <button class="btn sm" data-act="tipok" data-id="${r.id}" type="button" style="flex:1">ยอดเข้าแล้ว</button>
        <button class="btn ghost sm" data-act="tipno" data-id="${r.id}" type="button">ไม่พบยอด</button>
      </div>
    </div>`).join('');

  // บอกคนดูว่ามีคิวกี่เพลง
  if (S.sessionId && songs.length !== S.publishedQ) {
    S.publishedQ = songs.length;
    updateDoc(stateRef(), { queueCount: songs.length }).catch(() => {});
  }
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  if (b.dataset.act === 'closeround') { openClose(b.dataset.id); return; }
  const r = S.requests.find((x) => x.id === b.dataset.id); if (!r) return;
  const rRef = doc(db, 'sessions', S.sessionId, 'requests', r.id);
  b.disabled = true;
  try {
    if (b.dataset.act === 'played' || b.dataset.act === 'skip') {
      await updateDoc(rRef, { status: b.dataset.act === 'played' ? 'played' : 'skipped' });
      countSongs([r]);
    } else if (b.dataset.act === 'tipok') {
      await addMoney(r.tipAmount, 'transfer', r.id);
    } else if (b.dataset.act === 'tipno') {
      await updateDoc(rRef, { tipDismissed: true });
    }
  } catch (er) { toast('บันทึกไม่สำเร็จ'); b.disabled = false; }
});

// นับสถิติเพลงที่ถูกขอ (นับตอนจัดการคำขอแล้ว เพื่อไม่ให้นับซ้ำ)
function countSongs(list) {
  const requested = {}, missing = {};
  list.filter((r) => r.kind === 'song' && r.song).forEach((r) => {
    const key = r.matched ? r.song : r.song.trim().toLowerCase().slice(0, 60);
    const bucket = r.matched ? requested : missing;
    bucket[key] = (bucket[key] || 0) + 1;
  });
  const data = {};
  if (Object.keys(requested).length) data.requested = Object.fromEntries(Object.entries(requested).map(([k, v]) => [k, increment(v)]));
  if (Object.keys(missing).length) data.missing = Object.fromEntries(Object.entries(missing).map(([k, v]) => [k, increment(v)]));
  if (Object.keys(data).length) setDoc(songsRef(), data, { merge: true }).catch(() => {});
}

// ---------- กล่องยืนยันแบบแอป (แทน confirm ของเบราว์เซอร์) ----------
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
  @keyframes sheetBg{from{opacity:0}to{opacity:1}}
  @keyframes sheetUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
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
  const s = S.session || {};
  const ok = await askConfirm({
    title: 'จบรอบเล่นเลยไหม?',
    sub: s.venue || '',
    big: fmt((s.cash || 0) + (s.transfer || 0)),
    bigLabel: 'รายรับรอบนี้ (ที่จดไว้)',
    note: 'คนดูจะขอเพลงไม่ได้จนกว่าจะเริ่มรอบใหม่ จบแล้วจะไปหน้านับยอดปิดรอบต่อทันที',
    okText: 'จบรอบ',
    cancelText: 'เล่นต่อ'
  });
  if (!ok) return;
  const sid = S.sessionId, sRef = doc(db, 'sessions', sid);
  const left = S.requests.filter((r) => r.kind === 'song' && r.status === 'queued');
  const b = writeBatch(db);
  b.update(sRef, { live: false, endedAt: serverTimestamp(), closed: false });
  b.set(stateRef(), { live: false, sessionId: null, venue: '', queueCount: 0 });
  left.forEach((r) => b.update(doc(sRef, 'requests', r.id), { status: 'expired' }));
  try {
    await b.commit(); countSongs(left); toast('จบรอบแล้ว');
    await openClose(sid);
  } catch (e) { toast('จบรอบไม่สำเร็จ ลองอีกครั้ง'); }
};


// ---------- นับยอดปิดรอบ ----------
const round2 = (n) => Math.round(n * 100) / 100;
const num = (id) => { const v = $(id).value.trim(); if (v === '') return null; const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : null; };
const hhmm = (m) => new Date(m).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

// กระจายยอดส่วนต่างไปตามชั่วโมงที่เล่นจริง (ตามจำนวนนาที) เพื่อให้กราฟช่วงเวลาไม่เพี้ยน
function spreadHours(startMs, endMs, amount) {
  if (!startMs || !endMs || endMs <= startMs) return { [new Date(startMs || Date.now()).getHours()]: round2(amount) };
  const w = {}; let cur = startMs;
  while (cur < endMs) {
    const d = new Date(cur), next = Math.min(endMs, new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime());
    w[d.getHours()] = (w[d.getHours()] || 0) + (next - cur); cur = next;
  }
  const total = Object.values(w).reduce((a, b) => a + b, 0), keys = Object.keys(w), out = {}; let used = 0;
  keys.forEach((h, i) => {
    const v = i === keys.length - 1 ? round2(amount - used) : round2((amount * w[h]) / total);
    out[h] = v; used = round2(used + v);
  });
  return out;
}

async function openClose(sid) {
  const snap = await getDoc(doc(db, 'sessions', sid));
  if (!snap.exists()) { toast('ไม่พบรอบนี้'); return; }
  S.closeId = sid; S.closeSess = snap.data();
  $('cCash').value = ''; $('cTrans').value = '';
  renderTab();
}

function closePreview() {
  const s = S.closeSess || {};
  const cc = num('cCash'), ct = num('cTrans');
  const cashAfter = cc ?? (s.cash || 0), transAfter = ct ?? (s.transfer || 0);
  const diff = (after, before) => { const d = round2(after - before); return d === 0 ? 'ตรงกับที่จดไว้' : (d > 0 ? `เพิ่ม ${fmt(d)}` : `ลด ${fmt(-d)}`) + ' จากที่จดไว้'; };
  $('cCashHint').textContent = `แอปจดไว้ ${fmt(s.cash)}` + (cc != null ? ' · ' + diff(cc, s.cash || 0) : '');
  const st = ms(s.startedAt), en = ms(s.endedAt);
  $('cTransHint').textContent = `แอปจดไว้ ${fmt(s.transfer)} (เฉพาะทิปที่คุณกดยืนยัน)` + (ct != null ? ' · ' + diff(ct, s.transfer || 0) : '')
    + (st && en ? ` · ดูยอดเข้าบัญชีช่วง ${hhmm(st)} ถึง ${hhmm(en)}` : '');
  $('cCashAfter').textContent = fmt(cashAfter); $('cTransAfter').textContent = fmt(transAfter);
  $('cTotal').textContent = fmt(cashAfter + transAfter);
}
function renderClose() {
  const s = S.closeSess || {}, st = ms(s.startedAt), en = ms(s.endedAt);
  const d = new Date(st || Date.now());
  $('cMeta').textContent = `${s.venue || ''} · ${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}` + (st && en ? ` · ${hhmm(st)} ถึง ${hhmm(en)}` : '');
  closePreview();
}
$('cCash').addEventListener('input', closePreview);
$('cTrans').addEventListener('input', closePreview);

$('btnSaveClose').onclick = async () => {
  const sid = S.closeId, s = S.closeSess; if (!sid || !s) return;
  const adj = {};
  const cc = num('cCash'), ct = num('cTrans');
  if (cc != null) adj.cash = round2(cc - (s.cash || 0));
  if (ct != null) adj.transfer = round2(ct - (s.transfer || 0));
  const sRef = doc(db, 'sessions', sid), b = writeBatch(db);
  const upd = { closed: true, closedAt: serverTimestamp() };
  const totalAdj = round2((adj.cash || 0) + (adj.transfer || 0));
  Object.entries(adj).forEach(([method, v]) => {
    if (v === 0) return;
    b.set(doc(collection(sRef, 'entries')), { amount: v, method, requestId: null, kind: 'closing', createdAt: serverTimestamp() });
    upd[method] = increment(v);
  });
  if (totalAdj !== 0) {
    Object.entries(spreadHours(ms(s.startedAt), ms(s.endedAt) || Date.now(), totalAdj)).forEach(([h, v]) => { upd[`hours.${h}`] = increment(v); });
  }
  b.update(sRef, upd);
  $('btnSaveClose').disabled = true;
  try {
    await b.commit();
    const total = round2((cc ?? (s.cash || 0)) + (ct ?? (s.transfer || 0)));
    toast(`ปิดรอบแล้ว รวม ${fmt(total)}`);
    S.closeId = null; S.closeSess = null;
    await loadUnclosed(); renderTab();
  } catch (e) { toast('บันทึกไม่สำเร็จ ลองอีกครั้ง'); }
  finally { $('btnSaveClose').disabled = false; }
};
$('btnLaterClose').onclick = async () => { S.closeId = null; S.closeSess = null; await loadUnclosed(); renderTab(); };

// รอบที่จบแล้วแต่ยังไม่ได้นับยอด (แสดงบนหน้าเริ่มรอบ)
async function loadUnclosed() {
  try {
    const qs = await getDocs(query(collection(db, 'sessions'), orderBy('startedAt', 'desc'), limit(20)));
    S.unclosed = qs.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.live === false && s.closed === false);
    if (!S.live && !S.closeId) renderUnclosed();
  } catch (e) { /* แสดงตอนเปิดหน้าสถิติอยู่แล้ว ไม่ต้องแจ้งซ้ำ */ }
}
function renderUnclosed() {
  $('unclosedBox').hidden = S.unclosed.length === 0;
  $('unclosedList').innerHTML = S.unclosed.map((s) => {
    const d = new Date(ms(s.startedAt) || Date.now());
    return `<div class="req"><div class="row between"><div><div class="req-song">${esc(s.venue)}</div>
      <div class="tiny muted">${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} · จดไว้ ${fmt((s.cash || 0) + (s.transfer || 0))}</div></div>
      <button class="btn sm" data-act="closeround" data-id="${s.id}" type="button">นับยอด</button></div></div>`;
  }).join('');
}

// ---------- สถิติ ----------
document.querySelectorAll('[data-range]').forEach((b) => (b.onclick = () => {
  S.range = Number(b.dataset.range);
  document.querySelectorAll('[data-range]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  loadStats();
}));

async function loadStats() {
  try {
    const [qs, songSnap] = await Promise.all([
      getDocs(query(collection(db, 'sessions'), orderBy('startedAt', 'desc'), limit(500))),
      getDoc(songsRef())
    ]);
    const since = S.range ? Date.now() - S.range * 86400000 : 0;
    const rows = qs.docs.map((d) => d.data()).filter((s) => (ms(s.startedAt) || 0) >= since);
    let total = 0, hours = 0; const venues = {}, hist = {};
    rows.forEach((s) => {
      const t = (s.cash || 0) + (s.transfer || 0); total += t;
      const st = ms(s.startedAt), en = ms(s.endedAt) || (s.live ? Date.now() : st);
      hours += Math.max(0, (en - st) / 3600000);
      venues[s.venue] = venues[s.venue] || { t: 0, n: 0 }; venues[s.venue].t += t; venues[s.venue].n++;
      Object.entries(s.hours || {}).forEach(([h, v]) => (hist[h] = (hist[h] || 0) + v));
    });
    $('sTotal').textContent = fmt(total);
    $('sCount').textContent = rows.length;
    $('sHour').textContent = hours > 0.1 ? fmt(Math.round(total / hours)) : '-';
    $('sAvg').textContent = rows.length ? fmt(Math.round(total / rows.length)) : '-';

    const vs = Object.entries(venues).sort((a, b) => b[1].t - a[1].t), vmax = vs[0]?.[1].t || 1;
    $('sVenues').innerHTML = vs.length ? vs.map(([v, x]) => `
      <div class="col" style="gap:6px"><div class="row between small"><span>${esc(v)}</span><span class="muted">${fmt(x.t)} จาก ${x.n} รอบ</span></div>
      <div class="bar-track"><div class="bar" style="width:${Math.max(4, (x.t / vmax) * 100)}%"></div></div></div>`).join('')
      : '<div class="small muted">ยังไม่มีข้อมูลในช่วงนี้</div>';

    // ช่วง 14:00 ถึง 01:59 (ถนนคนเดินเล่นช่วงเย็นถึงดึก)
    let hrs = Array.from({ length: 12 }, (_, i) => (14 + i) % 24);
    const outside = Object.keys(hist).some((h) => hist[h] > 0 && !hrs.includes(Number(h)));
    if (outside) hrs = Array.from({ length: 12 }, (_, i) => i * 2);   // มีทิปนอกช่วงเย็น แสดงทั้งวันทีละ 2 ชม.
    const val = (h) => Math.max(0, (hist[h] || 0) + (outside ? (hist[h + 1] || 0) : 0));
    const hmax2 = Math.max(1, ...hrs.map(val));
    $('sHours').innerHTML = hrs.map((h) => `<div title="${h}:00 ${fmt(val(h))}" style="height:${(val(h) / hmax2) * 100}%"></div>`).join('');
    $('sHoursLbl').innerHTML = outside
      ? '<span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span>'
      : '<span>14:00</span><span>18:00</span><span>22:00</span><span>01:00</span>';

    const sd = songSnap.exists() ? songSnap.data() : {};
    const top = (m) => Object.entries(m || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const list = (arr) => arr.length ? arr.map(([k, n]) => `<div class="list-row"><span>${esc(k)}</span><span class="muted">${n} ครั้ง</span></div>`).join('') : '<div class="small muted" style="padding-top:8px">ยังไม่มีข้อมูล</div>';
    $('sSongs').innerHTML = list(top(sd.requested));
    $('sMissing').innerHTML = list(top(sd.missing));

    $('sHistory').innerHTML = rows.length ? rows.slice(0, 30).map((s) => {
      const d = new Date(ms(s.startedAt) || Date.now());
      return `<div class="list-row"><span>${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} ${esc(s.venue)}${s.live ? ' (กำลังเล่น)' : s.closed === false ? ' (ยังไม่นับยอด)' : ''}</span><span style="font-weight:600">${fmt((s.cash || 0) + (s.transfer || 0))}</span></div>`;
    }).join('') : '<div class="small muted">ยังไม่มีรอบเล่น</div>';
    showError('');
  } catch (e) { showError('โหลดสถิติไม่สำเร็จ: ' + e.code); }
}
