import { 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

// Mapeo de roles a rutas
export const ROL_RUTA = {
  recepcionista: '/recepcion',
  doctor: '/doctor',
  admin: '/admin',
  pantalla: '/pantalla'
};

// Iniciar sesión
export const login = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, 'usuarios', cred.user.uid));
  if (!snap.exists()) {
    await signOut(auth);
    throw new Error('Usuario no registrado en el sistema.');
  }
  return { uid: cred.user.uid, ...snap.data() };
};

// Cerrar sesión
export const logout = () => signOut(auth);

// Observar cambios de autenticación
export const onAuthChange = (callback) =>
  onAuthStateChanged(auth, callback);