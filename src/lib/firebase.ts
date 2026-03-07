import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyA4UzTtEKB61mn7IF6pOhpar-7WHSp9OYY",
  authDomain: "trademarkia-sheet-ys.firebaseapp.com",
  databaseURL: "https://trademarkia-sheet-ys-default-rtdb.firebaseio.com",
  projectId: "trademarkia-sheet-ys",
  storageBucket: "trademarkia-sheet-ys.firebasestorage.app",
  messagingSenderId: "435208523401",
  appId: "1:435208523401:web:04df4179fc9b01607d4058"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const database = getDatabase(app);

export { app, auth, database };
