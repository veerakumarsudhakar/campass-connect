import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import { getAnalytics, isSupported } from 'firebase/analytics';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

export const firebaseReady = Boolean(config.apiKey && config.projectId);
const app = firebaseReady ? initializeApp(config) : null;
// Analytics is optional and unavailable in some privacy-restricted browsers.
if (app && config.measurementId) isSupported().then(ok => { if (ok) getAnalytics(app); }).catch(() => {});
export const auth = app && getAuth(app);
export const db = app && getFirestore(app);
// Callable functions are deployed in the same European region as the project backend.
// Explicitly setting it prevents the SDK falling back to us-central1.
export const functions = app && getFunctions(app, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'europe-west1');
export const storage = app && getStorage(app);
export const rtdb = app && getDatabase(app);
