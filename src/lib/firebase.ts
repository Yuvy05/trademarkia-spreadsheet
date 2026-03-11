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

// if firebase already exists use it only(using get apps) , do not create it twice , if not there initialsie it 

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app); // login system
const database = getDatabase(app); // realtime data

export { app, auth, database }; // whole project can use Firebase

// output -> fb realtime database , fb authentication
