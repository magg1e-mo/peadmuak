// สร้างข้อความ PromptPay QR ตามมาตรฐาน EMVCo (เทียบผลกับไลบรารี promptpay-qr แล้ว)
const f = (id, v) => id + String(v.length).padStart(2, '0') + v;

function crc16(s) {
  let crc = 0xFFFF;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function promptpayPayload(id, amount) {
  const n = id.replace(/[^0-9]/g, '');
  // 13 หลัก = เลขบัตรประชาชน, มากกว่า = e-wallet, ที่เหลือ = เบอร์โทร (0xx -> 0066xx)
  const [sub, val] = n.length === 13 ? ['02', n]
    : n.length > 13 ? ['03', n]
    : ['01', ('0000000000000' + n.replace(/^0/, '66')).slice(-13)];
  const merchant = f('00', 'A000000677010111') + f(sub, val);
  let p = f('00', '01') + f('01', amount ? '12' : '11') + f('29', merchant) + f('58', 'TH') + f('53', '764');
  if (amount) p += f('54', Number(amount).toFixed(2));
  p += '6304';
  return p + crc16(p);
}
