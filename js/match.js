// จับคู่ชื่อเพลงที่คนดูพิมพ์กับลิสต์ (Dice coefficient แบบ bigram)
// คืนค่า { strong, partial } : strong = ตรงชัด (ขึ้นสีเขียว), partial = ใกล้เคียง (ถามว่าหมายถึงเพลงนี้ไหม)
const norm = (t) => (t || '').toLowerCase().replace(/[\s\-_.,'"()!?]/g, '');
const grams = (t) => { const g = []; for (let i = 0; i < t.length - 1; i++) g.push(t.slice(i, i + 2)); return g; };
function dice(a, b) {
  if (a === b) return 1;
  const A = grams(a), B = grams(b);
  if (!A.length || !B.length) return 0;
  const pool = B.slice(); let hit = 0;
  A.forEach((g) => { const k = pool.indexOf(g); if (k !== -1) { hit++; pool.splice(k, 1); } });
  return (2 * hit) / (A.length + B.length);
}
export const songLabel = (c) => (c.artist ? c.title + ' - ' + c.artist : c.title);

export function matchSong(input, catalog) {
  const q = norm(input);
  let strong = null, strongSc = 0, partial = null, partialSc = 0;
  const exact = catalog.some((c) => norm(c.title) === q || (c.alias || []).some((al) => norm(al) === q));
  if (q.length < 3 && !exact) return { strong: null, partial: null };
  catalog.forEach((c) => {
    if (c.artist && norm(c.artist).includes(q) && !norm(c.title).includes(q)) return; // พิมพ์แต่ชื่อศิลปิน ไม่เดา
    const forms = [norm(c.title), ...(c.alias || []).map(norm)];
    if (c.artist) forms.push(norm(c.title + c.artist));
    forms.forEach((f) => {
      const sc = dice(q, f);
      const r = q.length / f.length;
      const inside = f.includes(q);
      if (sc >= 0.8 && r >= 0.85 && r <= 1.2) {
        if (sc > strongSc) { strongSc = sc; strong = c; }
      } else if (sc >= 0.55 || (inside && r >= 0.5)) {
        const ps = Math.max(sc, inside ? r : 0);
        if (ps > partialSc) { partialSc = ps; partial = c; }
      }
    });
  });
  return { strong, partial: strong ? null : partial };
}
