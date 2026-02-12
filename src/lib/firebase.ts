import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyC1qZ9fK-6LFBxVWZsAD4dZq-KVg36A7f8",
  authDomain: "scheduler-65e51.firebaseapp.com",
  projectId: "scheduler-65e51",
  storageBucket: "scheduler-65e51.firebasestorage.app",
  messagingSenderId: "465867904027",
  appId: "1:465867904027:web:workflowz",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
