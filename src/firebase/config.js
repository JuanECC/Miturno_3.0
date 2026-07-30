import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Persistencia local (mantiene sesión al recargar, independiente por pestaña)
setPersistence(auth, browserLocalPersistence)
  .then(() => console.log('🔒 Sesión local'))
  .catch(() => {});

export const db = getFirestore(app);

// Persistencia offline (una sola pestaña)
enableIndexedDbPersistence(db)
  .then(() => console.log('✅ Modo offline activado'))
  .catch(() => {});