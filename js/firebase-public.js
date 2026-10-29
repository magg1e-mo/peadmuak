// เชื่อมต่อ Firebase สำหรับหน้าคนดู: โหลดเฉพาะฐานข้อมูล ไม่โหลดส่วนล็อกอิน (คนดูไม่ต้องล็อกอิน หน้าเลยเบากว่า)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

export const configured = !String(firebaseConfig.projectId).includes("REPLACE_ME");
export const app = configured ? initializeApp(firebaseConfig) : null;
export const db = configured ? getFirestore(app) : null;
export * from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
