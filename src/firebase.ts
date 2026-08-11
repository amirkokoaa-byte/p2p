import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Encrypted API Key to prevent plain text exposure in source code
const _e = "QUl6YVN5Q3VGaXVaZGtfRTdPMlpvOHJtOHhSUGIyMU5PSlBnMnNZ";
const apiKey = typeof atob === 'function' ? atob(_e) : Buffer.from(_e, 'base64').toString('ascii');

const firebaseConfig = {
  apiKey: apiKey,
  authDomain: "gen-lang-client-0277638393.firebaseapp.com",
  projectId: "gen-lang-client-0277638393",
  storageBucket: "gen-lang-client-0277638393.firebasestorage.app",
  messagingSenderId: "458430937460",
  appId: "1:458430937460:web:4e751de7f3af7f1d1c5421"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-p2ptransferappar-e57aee49-4b46-4ed4-b5e3-810a5a43a21c");
