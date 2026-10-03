// เชื่อมต่อ Firebase (โหลดจาก CDN ทางการของ Google ไม่ต้องติดตั้งอะไร)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./config.js";

export const configured = !String(firebaseConfig.projectId).includes("REPLACE_ME");
export const app = configured ? initializeApp(firebaseConfig) : null;
export const db = configured ? getFirestore(app) : null;
export const auth = configured ? getAuth(app) : null;
export * from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
export {
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
