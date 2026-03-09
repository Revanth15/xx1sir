import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const storage = getStorage(app);
const auth = getAuth(app);

/**
 * Automatically signs in using the credentials in your .env
 * Call this in your uploader component or a high-level layout.
 */
export const initAdminAuth = async () => {
  const email = process.env.NEXT_PUBLIC_FIREBASE_ADMIN_EMAIL;
  const password = process.env.NEXT_PUBLIC_FIREBASE_ADMIN_PASSWORD;

  if (!auth.currentUser && email && password) {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("Authenticated as admin for storage uploads.");
    } catch (error) {
      console.error("Firebase Admin Auth failed:", error);
    }
  }
};

export { app, storage, auth };