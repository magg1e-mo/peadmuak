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
  good: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke-linecap="round"><circle cx="32" cy="32" r="12" fill="#F2B84B"/><g stroke="#F2B84B" stroke-width="4"><path d="M32 8v6M32 50v6M8 32h6M50 32h6M15 15l4.2 4.2M44.8 44.8L49 49M15 49l4.2-4.2M44.8 19.2L49 15"/></g></svg>',
  cloud: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke-linecap="round"><path d="M18 46h26a10 10 0 0 0 1.6-19.9A14 14 0 0 0 18.4 29 9 9 0 0 0 18 46z" fill="#DCE3F5"/><path d="M40 20a8 8 0 0 1 9 5" stroke="#F2B84B" stroke-width="3.5"/></svg>',
  rain: '<svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke-linecap="round"><path d="M18 40h26a10 10 0 0 0 1.6-19.9A14 14 0 0 0 18.4 23 9 9 0 0 0 18 40z" fill="#B9C4E0"/><g stroke="#F2B84B" stroke-width="4"><path d="M23 47l-3 8M33 47l-3 8M43 47l-3 8"/></g></svg>',
};
const TXT = {
  good:  { title: 'อากาศดี',  tip: 'เล่นได้สบายเลยครับ ขอให้วันนี้เสียงเพราะ ทิปเยอะ' },
  cloud: { title: 'ฟ้าครึ้ม',  tip: 'ฝนยังไม่ตก แต่เตรียมผ้าคลุมเครื่องดนตรีไว้ใกล้มือหน่อยนะครับ' },
  rain:  { title: 'ฝนตก / มีโอกาสฝน', tip: 'ระวังกีตาร์และเครื่องเสียงโดนน้ำ ลองเช็กฟ้าอีกทีก่อนไปตั้งวงนะครับ' },
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
.wx-bg{position:fixed;inset:0;z-index:60;background:rgba(8,14,32,.86);display:flex;align-items:center;justify-content:center;padding:24px}
.wx-sheet{width:100%;max-width:340px;padding:0;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;color:#fff}
.wx-ico{width:112px;height:112px;border-radius:32px;background:#24407F;display:grid;place-items:center}
.wx-ico svg{width:72px;height:72px}
.wx-venue{font-size:14px;color:#B9C4E0}
.wx-title{font-family:var(--display,inherit);font-size:30px;font-weight:700;letter-spacing:-.02em;color:#fff;line-height:1.15}
.wx-row{display:flex;gap:10px;width:100%;margin-top:6px}
.wx-row>div{flex:1;background:rgba(255,255,255,.1);border-radius:18px;padding:12px}
.wx-row b{display:block;font-size:26px;color:#fff;letter-spacing:-.02em}
.wx-row span{font-size:13px;color:#B9C4E0}
.wx-tip{font-size:15px;color:#E8ECF7;margin:6px 0 10px}
.wx-hint{font-size:13px;color:#8D98B8}
`;
document.head.appendChild(css);

let chip = null, shown = false, curName = '';

function openSheet(name, w) {
  closeSheet();
  const t = TXT[w.kind];
  const el = document.createElement('div'); el.className = 'wx-bg'; el.id = 'wxBg';
  el.innerHTML = `<div class="wx-sheet" role="dialog" aria-label="สภาพอากาศ">
    <div class="wx-ico">${ICONS[w.kind]}</div>
    <div class="wx-title">${t.title}</div>
    <div class="wx-venue">${name ? 'ที่ ' + name.replace(/</g, '&lt;') : ''}</div>
    <div class="wx-row"><div><b>${w.temp}°</b><span>อุณหภูมิตอนนี้</span></div><div><b>${w.prob}%</b><span>โอกาสฝนใน 6 ชม.</span></div></div>
    <div class="wx-tip">${t.tip}</div>
    <div class="wx-hint">แตะที่ว่างเพื่อปิด</div></div>`;
  el.addEventListener('click', (e) => { closeSheet(); });
  document.body.appendChild(el);
}
function closeSheet() { const e = $('wxBg'); if (e) e.remove(); }

function paintChip(name, w) {
  if (!chip) return;
  if (!w) { chip.hidden = true; return; }
  chip.hidden = false;
  chip.innerHTML = `<span class="wi">${ICONS[w.kind]}</span><span class="wm">${TXT[w.kind].title} · ${w.temp}°<small>${name ? name.replace(/</g, '&lt;') : ''} · โอกาสฝน ${w.prob}%</small></span>`;
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
