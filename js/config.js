// ===== ตั้งค่าแอปเปิดหมวก =====
// ไฟล์เดียวที่ต้องแก้ตอนติดตั้ง

// 1) ค่าจาก Firebase Console > Project settings > Your apps > Web app (ใส่แทนค่าตัวอย่างทั้งก้อน)
export const firebaseConfig = {
  apiKey: "AIzaSyBfnfP8lBGZPNsLGlU7tJ4vGib77zxk7X0",
  authDomain: "peadmuak.firebaseapp.com",
  projectId: "peadmuak",
  storageBucket: "peadmuak.firebasestorage.app",
  messagingSenderId: "423160423594",
  appId: "1:423160423594:web:a3f59553bea7e8d7f89cd3"
};

// 2) อีเมล Google ของคนเล่น (คนเดียวที่เข้าหน้าควบคุมได้) ต้องตรงกับใน firestore.rules
export const PERFORMER_EMAIL = "momoshi5669@gmail.com";

// 3) ข้อมูลรับทิป
export const STAGE_NAME = "Moshi";
export const STYLE_LINE = "อะคูสติก";
export const PROMPTPAY_ID = "0954156484";
export const PROMPTPAY_NAME = "นายจิตติพัฒน์ ทักษะวิเรขะพันธ์";

// 4) สถานที่เล่นประจำ (เลือกตอนเริ่มรอบ มีช่อง "ที่อื่น" ให้พิมพ์เองด้วย)
export const VENUES = [
  "ถนนคนเดินริมหนองปัง",
  "ถนนคนเดินชุมแพ",
  "ถนนคนเดินเลาะเลย",
  "ถนนคนเดินเชียงคาน"
];

export const TIP_PRESETS = [20, 50, 100];

// เศษสตางค์ที่บวกเพิ่มเป็นรหัสแยกทิป สุ่มตั้งแต่ 0.01 ถึงค่านี้ (หน่วยสตางค์)
// ยิ่งน้อยยิ่งไม่รบกวนคนให้ แต่ถ้าหลายคนโอนพร้อมกัน โอกาสเลขซ้ำจะสูงขึ้น
export const SATANG_MAX = 50;
