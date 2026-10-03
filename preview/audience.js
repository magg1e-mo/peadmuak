import { STAGE_NAME, STYLE_LINE, PROMPTPAY_ID, PROMPTPAY_NAME, TIP_PRESETS, SATANG_MAX } from '../js/config.js';
import { SONGS } from '../js/songs.js';
import { matchSong, songLabel } from '../js/match.js';
import { promptpayPayload } from '../js/promptpay.js';
import { qrDataUrl } from '../js/qr.js';

const $ = (id) => document.getElementById(id);
const COOLDOWN_MS = 45 * 1000;
const params = new URLSearchParams(location.search);
// โหมดพรีวิว: ไม่ต่อ Firebase ไม่บันทึกอะไรทั้งสิ้น (?off = ดูหน้าตอนยังไม่ได้เล่น)
const DEMO = params.has('demo') || /\/preview\/?(index\.html)?$/.test(location.pathname);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let fb = { configured: false };
if (!DEMO) fb = await import('../js/firebase.js');
const { configured, db, doc, onSnapshot, collection, addDoc, serverTimestamp } = fb;

const state = {
  live: false, sessionId: null, venue: '', queueCount: 0,
  step: 'form', song: '', matched: null, nick: '',
  amt: TIP_PRESETS[1], custom: false, customVal: '', satang: 0, tipOnly: false, sending: false
};

$('stageName').textContent = STAGE_NAME;
$('ppNumber').textContent = PROMPTPAY_ID.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
$('ppName').textContent = PROMPTPAY_NAME;
try { state.nick = localStorage.getItem('nick') || ''; $('nick').value = state.nick; } catch (e) {}

// ---------- โน้ตลอยพื้นหลัง ----------
(function notesBg() {
  const bg = $('notesBg'), glyphs = ['♪', '♫', '♩', '♬'];
  for (let i = 0; i < 9; i++) {
    const s = document.createElement('span');
    s.textContent = glyphs[i % glyphs.length];
    s.style.left = (5 + Math.random() * 90) + '%';
    s.style.fontSize = (16 + Math.random() * 20) + 'px';
    s.style.animationDuration = (16 + Math.random() * 16) + 's';
    s.style.animationDelay = (-Math.random() * 26) + 's';
    bg.appendChild(s);
  }
})();

function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2200);
}
function showError(msg) { const e = $('errorBox'); e.textContent = msg; e.hidden = !msg; }

// ---------- สถานะรอบเล่น ----------
function renderHeader() {
  $('livePill').className = 'live-pill' + (state.live ? '' : ' off');
  $('liveText').textContent = state.live ? 'กำลังเล่นอยู่ตอนนี้' : 'ยังไม่ได้เล่น';
  $('venueLine').textContent = STYLE_LINE + (state.venue ? ' ที่ ' + state.venue : '');
  const q = state.queueCount;
  $('queueLine').hidden = !state.live;
  $('queueText').textContent = q > 0 ? `ตอนนี้มีคิวรออยู่ ${q} เพลง` : 'ตอนนี้ยังไม่มีคิว ขอได้เลยครับ';
}

function go(step) {
  state.step = step;
  if (step === 'form' && !state.live) step = 'off';
  ['form', 'off', 'tip', 'done'].forEach((s) => ($('step' + s[0].toUpperCase() + s.slice(1)).hidden = s !== step));
  if (step === 'tip') renderTip();
  window.scrollTo(0, 0);
}

if (DEMO) {
  state.live = !params.has('off'); state.venue = state.live ? 'ถนนคนเดินเลาะเลย' : ''; state.queueCount = state.live ? 2 : 0;
  renderHeader(); go('form');
  if (params.get('step') === 'done') { state.song = 'ใจสั่งมา'; go('done'); celebrate(true); }
} else if (configured) {
  onSnapshot(doc(db, 'public', 'state'), (snap) => {
    const d = snap.exists() ? snap.data() : {};
    const wasLive = state.live;
    state.live = !!d.live; state.sessionId = d.sessionId || null;
    state.venue = d.live ? (d.venue || '') : ''; state.queueCount = d.queueCount || 0;
    renderHeader(); showError('');
    if (state.step === 'form' || (wasLive !== state.live && state.step !== 'tip' && state.step !== 'done')) go('form');
  }, () => {
    renderHeader();
    showError('เชื่อมต่อไม่ได้ ลองรีเฟรชหน้านี้อีกครั้ง');
    go('form');
  });
} else {
  showError('ยังไม่ได้ตั้งค่า Firebase ในไฟล์ js/config.js (หน้านี้แสดงแบบทดลองเท่านั้น)');
  state.live = true; renderHeader(); go('form');
}

// ---------- ขอเพลง ----------
function renderMatch() {
  const has = state.song.trim().length > 0;
  const m = has ? matchSong(state.song, SONGS) : { strong: null, partial: null };
  state.matched = m.strong;
  $('song').classList.toggle('ok', !!m.strong);
  $('matchOk').hidden = !m.strong;
  if (m.strong) $('matchLabel').textContent = songLabel(m.strong);
  $('suggest').hidden = !m.partial;
  if (m.partial) { $('suggestLabel').textContent = songLabel(m.partial); $('suggest').onclick = () => { state.song = m.partial.title; $('song').value = m.partial.title; renderMatch(); buzz(10); }; }
  $('notInList').hidden = !(has && !m.strong && !m.partial && state.song.trim().length >= 3);
  $('submitSong').disabled = !has;
}
$('song').addEventListener('input', (e) => { state.song = e.target.value; renderMatch(); });
$('nick').addEventListener('input', (e) => { state.nick = e.target.value; try { localStorage.setItem('nick', state.nick.trim()); } catch (er) {} });

function cooldownLeft() {
  if (DEMO) return 0;
  try { const t = Number(localStorage.getItem('lastReq') || 0); return Math.max(0, COOLDOWN_MS - (Date.now() - t)); } catch (e) { return 0; }
}
$('submitSong').onclick = () => {
  if (!state.song.trim()) return;
  const left = cooldownLeft();
  if (left > 0) { toast(`ขอเพลงถัดไปได้ในอีก ${Math.ceil(left / 1000)} วินาทีครับ`); return; }
  buzz(12); state.tipOnly = false; newSatang(); go('tip');
};
$('tipOnly').onclick = () => { buzz(12); state.tipOnly = true; newSatang(); go('tip'); };
$('tipOff').onclick = () => { buzz(12); state.tipOnly = true; newSatang(); go('tip'); };

// ---------- ทิป ----------
function newSatang() { state.satang = 1 + Math.floor(Math.random() * SATANG_MAX); }
function baseAmount() { return state.custom ? (parseInt(state.customVal, 10) || 0) : state.amt; }
function tipAmount() { const b = baseAmount(); return b > 0 ? Math.round((b + state.satang / 100) * 100) / 100 : 0; }

function renderTip() {
  const pill = !state.tipOnly && state.song.trim();
  $('songPill').hidden = !pill;
  $('songPillText').textContent = state.matched ? songLabel(state.matched) : state.song.trim();
  const chips = $('chips'); chips.innerHTML = '';
  TIP_PRESETS.forEach((a) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = '฿' + a;
    b.setAttribute('aria-pressed', String(!state.custom && state.amt === a));
    b.onclick = () => { buzz(8); state.amt = a; state.custom = false; renderTip(); };
    chips.appendChild(b);
  });
  const c = document.createElement('button');
  c.type = 'button'; c.className = 'chip'; c.textContent = 'ใส่เอง';
  c.setAttribute('aria-pressed', String(state.custom));
  c.onclick = () => { buzz(8); state.custom = true; renderTip(); $('customAmt').focus(); };
  chips.appendChild(c);
  $('customBox').hidden = !state.custom;
  renderQR();
}

let shownAmt = 0;
function countTo(el, to) {
  const from = shownAmt; shownAmt = to;
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  if (reduceMotion || !to) { el.textContent = to ? '฿' + to.toFixed(2) : 'ใส่จำนวนเงิน'; return; }
  const t0 = performance.now(), dur = 380;
  (function tick(now) {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = '฿' + (from + (to - from) * e).toFixed(2);
    if (k < 1 && shownAmt === to) requestAnimationFrame(tick); else if (shownAmt === to) el.textContent = '฿' + to.toFixed(2);
  })(t0);
}
function renderQR() {
  const amt = tipAmount();
  const url = qrDataUrl(promptpayPayload(PROMPTPAY_ID, amt || null));
  const img = $('qrImg');
  if (img.getAttribute('src') !== url) {
    img.classList.add('swap');
    setTimeout(() => { img.src = url; img.classList.remove('swap'); }, 110);
  }
  $('saveQR').href = url;
  countTo($('amountText'), amt);
  const tail = '.' + String(state.satang).padStart(2, '0');
  $('satangHint').textContent = amt
    ? `เศษสตางค์ ${tail} เป็นแค่รหัสเล็กน้อย ช่วยให้รู้ว่าทิปนี้มาจากใคร จะโอนเท่านี้พอดีหรือปัดลงก็ได้ครับ`
    : 'เลือกจำนวนด้านบน หรือสแกนแล้วใส่ยอดเองในแอปธนาคาร';
}
$('customAmt').addEventListener('input', (e) => { state.customVal = e.target.value; renderQR(); });
$('copyPP').onclick = async () => {
  try { await navigator.clipboard.writeText(PROMPTPAY_ID); buzz(10); toast('คัดลอกเบอร์ PromptPay แล้ว'); }
  catch (e) { toast('คัดลอกไม่ได้ จดเบอร์ ' + PROMPTPAY_ID + ' แทนได้ครับ'); }
};

// ---------- ฉลอง: หมวกกระโดด + ของลอยออกมา ----------
const THANKS = ['ขอบคุณมากครับ', 'ขอบคุณที่ร่วมฟังนะครับ', 'ใจฟูเลยครับ'];
function celebrate(big) {
  if (reduceMotion) return;
  const box = $('burst'); box.innerHTML = '';
  const m = $('mascot').getBoundingClientRect();
  const ox = m.left + m.width / 2, oy = m.top + m.height * .35;
  const kinds = big
    ? ['coin', 'coin', 'coin', 'coin', 'note', 'note', 'note g', 'heart', 'heart', 'pick', 'mini', 'spark']
    : ['note', 'note g', 'heart', 'spark'];
  const n = big ? 34 : 12;
  for (let i = 0; i < n; i++) {
    const kind = kinds[i % kinds.length];
    const p = document.createElement('span');
    p.className = 'p ' + kind.split(' ').join(' ');
    const a = (-Math.PI / 2) + (Math.random() - .5) * Math.PI * 1.25; // พุ่งขึ้นเป็นพัด
    const r = 110 + Math.random() * 190;
    p.style.left = ox + 'px'; p.style.top = oy + 'px';
    p.style.setProperty('--dx', Math.cos(a) * r + 'px');
    p.style.setProperty('--dy', Math.sin(a) * r * 1.1 + 'px');
    p.style.setProperty('--fall', 90 + Math.random() * 160 + 'px');
    p.style.setProperty('--rot', (Math.random() - .5) * 720 + 'deg');
    p.style.setProperty('--dur', 1.5 + Math.random() * 1.1 + 's');
    p.style.setProperty('--delay', 0.25 + i * 0.035 + 's');
    if (kind === 'coin') p.textContent = '฿';
    else if (kind.startsWith('note')) p.textContent = ['♪', '♫', '♬'][i % 3];
    else if (kind === 'heart') p.textContent = '♥';
    else if (kind === 'spark') p.textContent = '✦';
    else if (kind === 'mini') p.innerHTML = '<svg width="36" height="30" style="--cap:#142652;--seam:#fff"><use href="#cap"/></svg>';
    box.appendChild(p);
  }
  setTimeout(() => (box.innerHTML = ''), 3600);
  buzz(big ? [25, 40, 25] : 15);
}

async function send(paid) {
  const hasSong = !state.tipOnly && state.song.trim();
  const tip = paid ? tipAmount() || null : null;
  if (!hasSong && !tip) { finish(paid, false); return; }
  if (DEMO || !configured || !state.live || !state.sessionId) { finish(paid, !!hasSong); return; }
  if (state.sending) return;
  state.sending = true; $('paid').disabled = $('skip').disabled = true;
  try {
    await addDoc(collection(db, 'sessions', state.sessionId, 'requests'), {
      kind: hasSong ? 'song' : 'tip',
      song: hasSong ? (state.matched ? state.matched.title : state.song.trim()).slice(0, 80) : '',
      matched: !!(hasSong && state.matched),
      nick: state.nick.trim().slice(0, 30),
      tipAmount: tip,
      createdAt: serverTimestamp(),
      status: 'queued'
    });
    if (hasSong) { try { localStorage.setItem('lastReq', String(Date.now())); } catch (e) {} }
    finish(paid, !!hasSong);
  } catch (e) {
    toast('ส่งไม่สำเร็จ ลองกดอีกครั้ง');
  } finally {
    state.sending = false; $('paid').disabled = $('skip').disabled = false;
  }
}
function finish(paid, hadSong) {
  $('doneTitle').textContent = hadSong ? 'ได้รับคำขอแล้ว' : THANKS[0];
  $('doneSub').textContent = paid ? 'ขอบคุณสำหรับการสนับสนุนครับ ขอให้เป็นวันที่ดีนะครับ' : 'ขอบคุณที่ร่วมฟังครับ';
  $('again').textContent = state.live ? 'ขอเพลงอื่นอีก' : 'กลับหน้าแรก';
  go('done');
  requestAnimationFrame(() => setTimeout(() => celebrate(paid), 350));
}
$('paid').onclick = () => send(true);
$('skip').onclick = () => { if (!state.tipOnly && state.song.trim()) send(false); else go('form'); };
$('again').onclick = () => {
  state.song = ''; state.matched = null; state.custom = false; state.customVal = ''; state.amt = TIP_PRESETS[1];
  $('song').value = ''; $('customAmt').value = ''; renderMatch(); go('form');
};

renderMatch();
