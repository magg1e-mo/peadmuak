/* ป๊อปอัปสภาพอากาศหน้าคนเล่น (ไฟล์เดี่ยว ไม่แตะโค้ดเดิม)
   - โผล่ครั้งเดียวตอนเปิดแอป เมื่อเข้าหน้า "เริ่มรอบ" ของสถานที่ที่เล่นล่าสุด
   - มีชิปเล็กๆ เหนือปุ่มสถานที่ เปลี่ยนตามสถานที่ที่เลือก แตะเพื่อเปิดป๊อปอัปอีกครั้ง
   - ข้อมูลจาก Open-Meteo (ฟรี ไม่ต้องใช้คีย์) ถ้าโหลดไม่ได้ จะเงียบ ไม่รบกวนการใช้งาน
   ปรับพิกัดสถานที่ได้ที่ COORDS ด้านล่าง */

const COORDS = {
  'เลาะเลย':   { lat: 17.486, lon: 101.722 },
  'ชุมแพ':     { lat: 16.540, lon: 102.100 },
  'เชียงคาน':  { lat: 17.899, lon: 101.670 },
  'หนองปัง':   { lat: 17.486, lon: 101.722 }, // ประมาณ: ใช้ตัวเมืองเลยไปก่อน แก้พิกัดจริงได้
};

const $ = (id) => document.getElementById(id);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const coordOf = (name) => { const k = Object.keys(COORDS).find((n) => String(name || '').includes(n)); return k ? COORDS[k] : null; };

/* ---------- ไอคอน 3 แบบ ---------- */
const ICONS = {
  good: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke-linecap="round"><g stroke="#FFE27A" stroke-width="4"><path class="sn-r" pathLength="1" style="--i:0" d="M32 14V8"/><path class="sn-r" pathLength="1" style="--i:1" d="M32 50v6"/><path class="sn-r" pathLength="1" style="--i:2" d="M14 32H8"/><path class="sn-r" pathLength="1" style="--i:3" d="M50 32h6"/><path class="sn-r" pathLength="1" style="--i:4" d="M19.2 19.2L15 15"/><path class="sn-r" pathLength="1" style="--i:5" d="M44.8 44.8L49 49"/><path class="sn-r" pathLength="1" style="--i:6" d="M19.2 44.8L15 49"/><path class="sn-r" pathLength="1" style="--i:7" d="M44.8 19.2L49 15"/></g><circle class="sn-core" cx="32" cy="32" r="12" fill="#FFD24A"/></svg>',
  cloud: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke-linecap="round"><g class="cl-sun"><path stroke="#FFE27A" stroke-width="3" d="M40 15v-4M40 41v4M27 28h-4M53 28h4M49.2 18.8L52 16M30.8 18.8L28 16M49.2 37.2L52 40M30.8 37.2L28 40"/><circle cx="40" cy="28" r="9" fill="#FFD24A"/></g><g class="cl-body"><path d="M16 46h28a10 10 0 0 0 1.6-19.9A14 14 0 0 0 18.4 29 9 9 0 0 0 16 46z" fill="#FFFFFF"/><path d="M42 20a8 8 0 0 1 8 5" stroke="#FFFFFF" stroke-opacity=".6" stroke-width="3.5"/></g></svg>',
  rain: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke-linecap="round"><g stroke="#8FD0FF" stroke-width="4"><path class="rn-s" style="--i:0" d="M23 47l-3 8"/><path class="rn-s" style="--i:1" d="M33 47l-3 8"/><path class="rn-s" style="--i:2" d="M43 47l-3 8"/></g><path class="rn-c" d="M18 40h26a10 10 0 0 0 1.6-19.9A14 14 0 0 0 18.4 23 9 9 0 0 0 18 40z" fill="#E3E9F2"/></svg>',
};
/* สีพื้นไอคอนเหมือนสีท้องฟ้า: ฟ้าใส / ฟ้าหม่นครึ้ม / เทาเข้มฝน */
const SKY = {
  good:  'linear-gradient(160deg,#2E8FE8 0%,#8CCBFF 100%)',
  cloud: 'linear-gradient(160deg,#7C8CA3 0%,#BCC6D4 100%)',
  rain:  'linear-gradient(160deg,#2F3A52 0%,#5C6B88 100%)',
};
const TXT = {
  good:  { title: 'อากาศดี',  tip: 'เล่นได้สบายเลยครับ<br>ขอให้วันนี้เสียงเพราะ ทิปเยอะ' },
  cloud: { title: 'ฟ้าครึ้ม',  tip: 'ฝนยังไม่ตก แต่เตรียมผ้าคลุมเครื่องดนตรี<br>ไว้ใกล้มือหน่อยนะครับ' },
  rain:  { title: 'ฝนตก / มีโอกาสฝน', tip: 'ระวังกีต้าร์และเครื่องดนตรีโดนน้ำ<br>ลองเช็คฟ้าอีกทีก่อนไปตั้งเครื่องนะครับ' },
};

/* ---------- ดึงและจัดกลุ่มอากาศ ---------- */
const cache = {};
function classify(code, maxProb) {
  if (code >= 51 || maxProb >= 60) return 'rain';
  if (code >= 2 || maxProb >= 35) return 'cloud';
  return 'good';
}
async function getWeather(name) {
  const demo = new URLSearchParams(location.search).get('weather');
  if (demo && TXT[demo]) return { kind: demo, temp: demo === 'rain' ? 26 : demo === 'cloud' ? 29 : 32, prob: demo === 'rain' ? 80 : demo === 'cloud' ? 35 : 5 };
  const c = coordOf(name); if (!c) return null;
  const key = c.lat + ',' + c.lon, hit = cache[key];
  if (hit && Date.now() - hit.t < 15 * 60e3) return hit.v;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weather_code&hourly=precipitation_probability&forecast_hours=6&timezone=Asia%2FBangkok`;
  try {
    const r = await fetch(url); if (!r.ok) throw 0;
    const j = await r.json();
    const probs = (j.hourly?.precipitation_probability || []).filter((x) => x != null);
    const maxProb = probs.length ? Math.max(...probs) : 0;
    const v = { kind: classify(j.current.weather_code, maxProb), temp: Math.round(j.current.temperature_2m), prob: maxProb };
    cache[key] = { t: Date.now(), v }; return v;
  } catch { return null; }
}

/* ---------- UI ---------- */
const css = document.createElement('style');
css.textContent = `
.wx-chip{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;padding:8px 14px;border:1.5px solid var(--line,#E6DCC6);border-radius:16px;background:#fff;color:var(--ink,#14213D);font-size:15px;font-weight:600;text-align:left}
.wx-chip .wi{width:34px;height:34px;border-radius:12px;background:var(--navy,#142652);display:grid;place-items:center;flex-shrink:0}
.wx-chip .wi svg{width:26px;height:26px}
.wx-chip .wm{flex:1;line-height:1.25}
.wx-chip .wm small{display:block;font-weight:500;color:var(--ink-2,#566079);font-size:13px}
.wx-bg{position:fixed;inset:0;z-index:60;background:rgba(8,14,32,.78);display:flex;align-items:center;justify-content:center;padding:24px}
.wx-sheet{width:100%;max-width:340px;padding:0;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;color:#fff}
.wx-ico{width:112px;height:112px;border-radius:32px;box-shadow:0 8px 30px rgba(0,0,0,.35);display:grid;place-items:center}
.wx-ico svg{width:72px;height:72px}
.wx-venue{font-size:14px;color:#B9C4E0}
.wx-title{font-family:var(--display,inherit);font-size:30px;font-weight:700;letter-spacing:-.02em;color:#fff;line-height:1.15}
.wx-row{display:flex;gap:10px;width:100%;margin-top:6px}
.wx-row>div{flex:1;position:relative;background:rgba(255,255,255,.17);-webkit-backdrop-filter:blur(30px) saturate(170%);backdrop-filter:blur(30px) saturate(170%);border:1px solid rgba(255,255,255,.28);border-radius:22px;padding:12px}
.wx-row b{position:relative;display:block;font-size:26px;color:#fff;letter-spacing:-.02em}
.wx-row span{position:relative;font-size:13px;color:#DCE3F5}
.wx-tip{font-size:15px;line-height:1.6;color:#E8ECF7;margin:8px 0 12px}
.wx-hint{font-size:13px;color:#8D98B8}
/* แอนิเมชันเข้า/ออก (ทับกฎ animation:none ของหน้าคนเล่นด้วย !important เฉพาะป๊อปอัปนี้) */
@keyframes wxFade{from{background-color:rgba(8,14,32,0)}to{background-color:rgba(8,14,32,.78)}}
@keyframes wxPop{0%{transform:translateY(28px) scale(.9)}55%{transform:translateY(-5px) scale(1.025)}100%{transform:none}}
@keyframes wxIcon{0%{opacity:0;transform:scale(.55) rotate(-8deg)}60%{opacity:1;transform:scale(1.1) rotate(2deg)}100%{opacity:1;transform:none}}
@keyframes wxUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes wxOut{from{background-color:rgba(8,14,32,.78)}to{background-color:rgba(8,14,32,0)}}
@keyframes wxOutC{from{opacity:1}to{opacity:0}}
@keyframes wxOutS{from{transform:none}to{transform:translateY(10px) scale(.96)}}
.wx-ico{overflow:hidden}.wx-ico svg{overflow:visible}
.sn-core,.cl-sun,.cl-body,.rn-c{transform-box:fill-box;transform-origin:center}
.cl-sun{opacity:0}
@keyframes snCore{0%{transform:scale(0)}60%{transform:scale(1.14)}100%{transform:scale(1)}}
@keyframes snRay{0%{stroke-dasharray:1 1;stroke-dashoffset:1;opacity:0}12%{opacity:1}100%{stroke-dasharray:1 1;stroke-dashoffset:0;opacity:1}}
@keyframes clSun{0%{opacity:0;transform:scale(.4)}22%{opacity:1;transform:scale(1.06)}32%{opacity:1;transform:scale(1)}72%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.92)}}
@keyframes clCloud{0%{opacity:0;transform:translateX(-30px)}100%{opacity:1;transform:none}}
@keyframes rnCloud{0%{opacity:0;transform:translateY(-8px) scale(.85)}100%{opacity:1;transform:none}}
@keyframes rnDrop{0%{opacity:0;transform:translateY(-10px)}20%{opacity:1}75%{opacity:1}100%{opacity:0;transform:translateY(30px)}}
@keyframes rnSettle{0%{opacity:0;transform:translateY(-5px)}100%{opacity:1;transform:none}}
.wx-ico .sn-core{animation:snCore .6s cubic-bezier(.2,.9,.3,1.2) .35s both !important}
.wx-ico .sn-r{animation:snRay .45s ease-out calc(.85s + var(--i)*.06s) both !important}
.wx-ico .cl-sun{animation:clSun 2.3s ease-in-out .3s both !important}
.wx-ico .cl-body{animation:clCloud 1s cubic-bezier(.3,.7,.2,1) 1.05s both !important}
.wx-ico .rn-c{animation:rnCloud .5s cubic-bezier(.2,.9,.3,1.1) .3s both !important}
.wx-ico .rn-s{animation:rnDrop .8s linear calc(.7s + var(--i)*.15s) 3 both !important,rnSettle .45s ease-out calc(3.1s + var(--i)*.15s) both !important}
.wx-bg{animation:wxFade .3s ease both !important}
.wx-sheet{animation:wxPop .6s cubic-bezier(.2,.85,.25,1) both !important}
.wx-ico{animation:wxIcon .65s cubic-bezier(.2,.9,.3,1.1) .1s both !important}
.wx-title{animation:wxUp .5s ease-out .22s both !important}
.wx-venue{animation:wxUp .5s ease-out .27s both !important}
.wx-row>div:nth-child(1){animation:wxUp .5s ease-out .32s both !important}
.wx-row>div:nth-child(2){animation:wxUp .5s ease-out .39s both !important}
.wx-tip{animation:wxUp .5s ease-out .46s both !important}
.wx-hint{animation:wxUp .5s ease-out .54s both !important}
.wx-bg.out{animation:wxOut .22s ease forwards !important}
.wx-bg.out .wx-sheet{animation:wxOutS .22s ease forwards !important}
.wx-bg.out .wx-sheet>*:not(.wx-row),.wx-bg.out .wx-row>div{animation:wxOutC .22s ease forwards !important}
@media (prefers-reduced-motion:reduce){.wx-bg,.wx-bg *{animation:none !important}}
`;
document.head.appendChild(css);

let chip = null, shown = false, curName = '';

function openSheet(name, w) {
  closeSheet(true);
  const t = TXT[w.kind];
  const el = document.createElement('div'); el.className = 'wx-bg'; el.id = 'wxBg';
  el.innerHTML = `<div class="wx-sheet" role="dialog" aria-label="สภาพอากาศ">
    <div class="wx-ico" style="background:${SKY[w.kind]}">${ICONS[w.kind]}</div>
    <div class="wx-title">${t.title}</div>
    <div class="wx-venue">${name ? 'ที่ ' + name.replace(/</g, '&lt;') : ''}</div>
    <div class="wx-row"><div><b>${w.temp}°</b><span>อุณหภูมิตอนนี้</span></div><div><b>${w.prob}%</b><span>โอกาสฝนใน 6 ชม.</span></div></div>
    <div class="wx-tip">${t.tip}</div>
    <div class="wx-hint">แตะเพื่อปิด</div></div>`;
  el.addEventListener('click', (e) => { closeSheet(); });
  document.body.appendChild(el);
}
function closeSheet(instant) {
  const e = $('wxBg'); if (!e) return;
  if (instant || e.classList.contains('out')) { if (instant) e.remove(); return; }
  e.classList.add('out'); setTimeout(() => e.remove(), 230);
}

function paintChip(name, w) {
  if (!chip) return;
  if (!w) { chip.hidden = true; return; }
  chip.hidden = false;
  chip.innerHTML = `<span class="wi" style="background:${SKY[w.kind]}">${ICONS[w.kind]}</span><span class="wm">${TXT[w.kind].title} · ${w.temp}°<small>${name ? name.replace(/</g, '&lt;') : ''} · โอกาสฝน ${w.prob}%</small></span>`;
  chip.onclick = () => openSheet(name, w);
}

async function refresh(name, popup) {
  curName = name;
  const w = await getWeather(name);
  if (curName !== name) return; // เลือกที่อื่นไปแล้ว
  paintChip(name, w);
  if (w && popup) openSheet(name, w);
}

function selectedName() {
  const b = document.querySelector('#venues .venue[aria-pressed="true"]');
  if (!b || b.textContent.trim() === 'ที่อื่น') return '';
  return b.textContent.trim();
}
function defaultName() {
  const last = store.get('wx_venue');
  const btns = [...document.querySelectorAll('#venues .venue')].map((b) => b.textContent.trim()).filter((t) => t && t !== 'ที่อื่น');
  return btns.includes(last) ? last : (btns[0] || '');
}

function init() {
  const start = $('pStart'), venues = $('venues');
  if (!start || !venues) return;
  chip = document.createElement('button'); chip.type = 'button'; chip.className = 'wx-chip'; chip.hidden = true;
  venues.before(chip);
  venues.addEventListener('click', () => {
    const n = selectedName(); if (!n) { paintChip('', null); return; }
    store.set('wx_venue', n); refresh(n, false);
  });
  const onShow = () => {
    if (start.hidden || shown) return;
    if (!document.querySelector('#venues .venue')) return; // รอปุ่มสถานที่ขึ้นก่อน
    shown = true;
    const n = selectedName() || defaultName();
    if (n) refresh(n, true);
  };
  new MutationObserver(onShow).observe(start, { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(onShow).observe(venues, { childList: true });
  onShow();
  window.__wx = { open: (kind) => { const demo = { good: { temp: 32, prob: 5 }, cloud: { temp: 29, prob: 35 }, rain: { temp: 26, prob: 80 } }[kind]; openSheet('ถนนคนเดินเลาะเลย', { kind, ...demo }); paintChip('ถนนคนเดินเลาะเลย', { kind, ...demo }); } };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
