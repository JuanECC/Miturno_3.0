import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { doc, onSnapshot } from 'firebase/firestore';

const DEFAULT_CAPACIDAD = 20;

export const useCapacidad = () => {
  const [capacidad, setCapacidad] = useState(() => {
    const saved = localStorage.getItem('mt-capacidad');
    return saved ? parseInt(saved) : DEFAULT_CAPACIDAD;
  });

  // Sincronizar con Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracion', 'global'), (snap) => {
      if (snap.exists() && snap.data().capacidad) {
        const cap = snap.data().capacidad;
        setCapacidad(cap);
        localStorage.setItem('mt-capacidad', cap);
      }
    });
    return () => unsub();
  }, []);

  const guardarCapacidad = (val) => {
    const num = parseInt(val);
    if (num > 0 && num <= 500) {
      setCapacidad(num);
      localStorage.setItem('mt-capacidad', num);
    }
  };

  return { capacidad, guardarCapacidad };
};