import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';

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

// Persistencia por pestaña (cada pestaña tiene su propia sesión)
setPersistence(auth, browserSessionPersistence)
  .then(() => console.log('🔒 Sesión independiente por pestaña'))
  .catch((err) => console.error('Error configurando persistencia:', err));

export const db = getFirestore(app);

// Persistencia offline multi-pestaña
enableMultiTabIndexedDbPersistence(db)
  .then(() => console.log('✅ Modo offline multi-pestaña activado'))
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('⚠️ Usando memoria (otra pestaña ya tiene persistencia)');
    } else if (err.code === 'unimplemented') {
      console.warn('⚠️ Navegador no soporta persistencia');
    }
  });