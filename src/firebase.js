import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC0ah02GSaZ7hszanROdZCHzYwmAzmpcGg",
  authDomain: "movie-watchlist-68b3c.firebaseapp.com",
  projectId: "movie-watchlist-68b3c",
  storageBucket: "movie-watchlist-68b3c.firebasestorage.app",
  messagingSenderId: "411985322031",
  appId: "1:411985322031:web:d7019ad6f7f547a2f866da",
  measurementId: "G-SH7ELTFHKK"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
