import { STAGE_NAME, STYLE_LINE, PROMPTPAY_ID, PROMPTPAY_NAME, TIP_PRESETS, SATANG_MAX } from './config.js';
import { SONGS } from './songs.js';
import { matchSong, songLabel } from './match.js';
import { promptpayPayload } from './promptpay.js';
import { qrDataUrl } from './qr.js';
import { configured, db, doc, onSnapshot, collection, addDoc, serverTimestamp } from './firebase.js';

const $ = (id) => document.getElementById(id);
const COOLDOWN_MS = 45 * 1000;

const state = {
  live: false, sessionId: null, venue: '', queueCount: 0,
  step: 'form', song: '', matched: null, nick: '',
  amt: TIP_PRESETS[1], custom: false, customVal: '', satang: 0, tipOnly: false, sending: false
};

$('stageName').textContent = STAGE_NAME;
$('ppNumber').textContent = PROMPTPAY_ID.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
$('ppName').textContent = PROMPTPAY_NAME;
try { state.nick = localStorage.getItem('nick') || ''; $('nick').value = state.nick; } catch (e) {}

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2200);
}
function showError(msg) { const e = $('errorBox'); e.textContent = msg; e.hidden = !msg; }

// ---------- สถานะรอบเล่น ----------
function renderHeader() {
  $('liveDot').className = 'live-dot' + (state.live ? '' : ' off');
  $('liveText').textContent = state.live ? 'กำลังเล่นอยู่ตอนนี้' : 'ยังไม่ได้เล่น';
  $('liveText').style.color = state.live ? '' : 'var(--ink-2)';
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

if (configured) {
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
  if (m.partial) { $('suggestLabel').textContent = songLabel(m.partial); $('suggest').onclick = () => { state.song = m.partial.title; $('song').value = m.partial.title; renderMatch(); }; }
  $('notInList').hidden = !(has && !m.strong && !m.partial && state.song.trim().length >= 3);
  $('submitSong').disabled = !has;
}
$('song').addEventListener('input', (e) => { state.song = e.target.value; renderMatch(); });
$('nick').addEventListener('input', (e) => { state.nick = e.target.value; try { localStorage.setItem('nick', state.nick.trim()); } catch (er) {} });

function cooldownLeft() {
  try { const t = Number(localStorage.getItem('lastReq') || 0); return Math.max(0, COOLDOWN_MS - (Date.now() - t)); } catch (e) { return 0; }
}
$('submitSong').onclick = () => {
  if (!state.song.trim()) return;
  const left = cooldownLeft();
  if (left > 0) { toast(`ขอเพลงถัดไปได้ในอีก ${Math.ceil(left / 1000)} วินาทีครับ`); return; }
  state.tipOnly = false; newSatang(); go('tip');
};
$('tipOnly').onclick = () => { state.tipOnly = true; newSatang(); go('tip'); };
$('tipOff').onclick = () => { state.tipOnly = true; newSatang(); go('tip'); };

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
    b.onclick = () => { state.amt = a; state.custom = false; renderTip(); };
    chips.appendChild(b);
  });
  const c = document.createElement('button');
  c.type = 'button'; c.className = 'chip'; c.textContent = 'ใส่เอง';
  c.setAttribute('aria-pressed', String(state.custom));
  c.onclick = () => { state.custom = true; renderTip(); $('customAmt').focus(); };
  chips.appendChild(c);
  $('customBox').hidden = !state.custom;
  renderQR();
}
function renderQR() {
  const amt = tipAmount();
  // ถ้ายังไม่ใส่จำนวน ใช้ QR แบบไม่ระบุยอด ให้คนดูกรอกเองในแอปธนาคาร
  const url = qrDataUrl(promptpayPayload(PROMPTPAY_ID, amt || null));
  $('qrImg').src = url; $('saveQR').href = url;
  $('amountText').textContent = amt ? '฿' + amt.toFixed(2) : 'ใส่จำนวนเงิน';
  const tail = '.' + String(state.satang).padStart(2, '0');
  $('satangHint').textContent = amt
    ? `เศษสตางค์ ${tail} เป็นแค่รหัสเล็กน้อย ช่วยให้รู้ว่าทิปนี้มาจากใคร จะโอนเท่านี้พอดีหรือปัดลงก็ได้ครับ`
    : 'เลือกจำนวนด้านบน หรือสแกนแล้วใส่ยอดเองในแอปธนาคาร';
}
$('customAmt').addEventListener('input', (e) => { state.customVal = e.target.value; renderQR(); });
$('copyPP').onclick = async () => {
  try { await navigator.clipboard.writeText(PROMPTPAY_ID); toast('คัดลอกเบอร์ PromptPay แล้ว'); }
  catch (e) { toast('คัดลอกไม่ได้ จดเบอร์ ' + PROMPTPAY_ID + ' แทนได้ครับ'); }
};

async function send(paid) {
  const hasSong = !state.tipOnly && state.song.trim();
  const tip = paid ? tipAmount() || null : null;
  if (!hasSong && !tip) { finish(paid, false); return; }      // ทิปโดยไม่ระบุยอด หรือกดข้าม ไม่ต้องส่งข้อมูล
  if (!configured || !state.live || !state.sessionId) { finish(paid, !!hasSong); return; }
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
  $('doneTitle').textContent = hadSong ? 'ได้รับคำขอแล้ว' : 'ขอบคุณมากครับ';
  $('doneSub').textContent = paid ? 'ขอบคุณสำหรับการสนับสนุนครับ' : 'ขอบคุณที่ร่วมฟังครับ';
  $('again').textContent = state.live ? 'ขอเพลงอื่นอีก' : 'กลับหน้าแรก';
  go('done');
}
$('paid').onclick = () => send(true);
$('skip').onclick = () => { if (!state.tipOnly && state.song.trim()) send(false); else go('form'); };
$('again').onclick = () => {
  state.song = ''; state.matched = null; state.custom = false; state.customVal = ''; state.amt = TIP_PRESETS[1];
  $('song').value = ''; $('customAmt').value = ''; renderMatch(); go('form');
};

renderMatch();
