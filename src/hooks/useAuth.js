import { useState, useEffect } from 'react';
import { onAuthChange, logout } from '../services/authService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
          if (snap.exists()) {
            setUser({ uid: firebaseUser.uid, ...snap.data() });
          } else {
            await logout();
            setUser(null);
          }
        } catch (err) {
          console.error('Error al obtener usuario:', err);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
};