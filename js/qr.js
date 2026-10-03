// วาด QR เป็นรูป PNG (กดค้างบันทึกรูปได้บนมือถือ) ใช้ไลบรารี qrcode-generator ที่อยู่ในโฟลเดอร์ vendor
export function qrDataUrl(text, size = 480) {
  const q = window.qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount(), quiet = 4, cell = Math.floor(size / (n + quiet * 2));
  const px = cell * (n + quiet * 2);
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, px, px);
  g.fillStyle = '#000000';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect((k + quiet) * cell, (r + quiet) * cell, cell, cell);
  return c.toDataURL('image/png');
}
