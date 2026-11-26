import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const app = initializeApp({
  apiKey: "AIzaSyDtwDwsfNFpBft7pA15BgHvi05X9q2FeaU",
  authDomain: "coach-calendar-72249.firebaseapp.com",
  projectId: "coach-calendar-72249",
  storageBucket: "coach-calendar-72249.firebasestorage.app",
  messagingSenderId: "554633019348",
  appId: "1:554633019348:web:2a9953a1cc9ebab3f96041",
});
export const db = getFirestore(app);
