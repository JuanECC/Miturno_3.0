import { db } from '../firebase/config';
import { 
  collection, onSnapshot, getDocs, doc, setDoc, getDoc, updateDoc, 
  arrayUnion, increment, query, where, limit 
} from 'firebase/firestore';

// Escucha en tiempo real de todos los pacientes
export const suscribirPacientes = (callback) => {
  const q = collection(db, 'pacientes');
  return onSnapshot(q, (snap) => {
    const pacientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(pacientes);
  });
};

// ─────────────────────────────────────────────
// Archivar paciente al dar de alta (con nombre único)
// ─────────────────────────────────────────────
export const archivarPaciente = async (paciente) => {
  try {
    const nombreLimpio = (paciente.nombre || 'Sin nombre').trim();
    const nombreLower = nombreLimpio.toLowerCase();

    // Buscar si ya existe un historial con este nombre (case insensitive)
    const q = query(
      collection(db, 'historial'),
      where('nombreLower', '==', nombreLower)
    );
    const snap = await getDocs(q);

    const nuevoEpisodio = {
      id: 'ep_' + Date.now(),
      fechaIngreso: paciente.fecha_ingreso || new Date().toISOString(),
      fechaAlta: new Date().toISOString(),
      nivel: paciente.nivel_prioridad || 5,
      especialidad: paciente.especialidad || 'General',
      motivo: paciente.motivo || '',
      signosVitales: paciente.vitales || {},
      signosAlarma: paciente.signosAlarma || [],
      diagnostico: paciente.diagnostico_cie10 || '',
      diagnosticoDesc: paciente.diagnostico_descripcion || '',
      tratamiento: paciente.diagnostico_observaciones || '',
      medico: paciente.atendido_por || 'No especificado',
      destino: paciente.ubicacion_actual || 'ALTA',
      escalaDolor: paciente.escalaDolor || 0,
    };

    if (snap.empty) {
      // Primera visita: crear nuevo historial
      await setDoc(doc(db, 'historial', paciente.id), {
        pacienteId: paciente.id,
        nombre: nombreLimpio,
        nombreLower: nombreLower,
        edad: paciente.edad || 0,
        especialidad: paciente.especialidad || 'General',
        fechaUltimaVisita: new Date().toISOString(),
        totalEpisodios: 1,
        episodios: [nuevoEpisodio],
        createdAt: new Date().toISOString(),
      });
    } else {
      // Ya tiene historial: agregar nuevo episodio al existente
      const docRef = snap.docs[0];
      await updateDoc(doc(db, 'historial', docRef.id), {
        episodios: arrayUnion(nuevoEpisodio),
        totalEpisodios: increment(1),
        fechaUltimaVisita: new Date().toISOString(),
        edad: paciente.edad || docRef.data().edad,
        especialidad: paciente.especialidad || docRef.data().especialidad,
      });
    }

    // ─────────────────────────────────────────────
    // NUEVO: Si el paciente vino de una cita, marcarla como completada
    // ─────────────────────────────────────────────
    if (paciente.origen === 'cita' && paciente.cita_id) {
      try {
        await updateDoc(doc(db, 'citas', paciente.cita_id), { estado: 'completada' });
      } catch (err) {
        console.error('Error al completar cita:', err);
      }
    }

    return true;
  } catch (err) {
    console.error('Error archivando paciente:', err);
    return false;
  }
};

// ─────────────────────────────────────────────
// Obtener todo el historial clínico
// ─────────────────────────────────────────────
export const obtenerHistorial = async () => {
  try {
    const snap = await getDocs(collection(db, 'historial'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error obteniendo historial:', err);
    return [];
  }
};

// ─────────────────────────────────────────────
// Buscar en historial por nombre (para sugerencias)
// ─────────────────────────────────────────────
export const buscarEnHistorial = async (texto) => {
  if (!texto || texto.length < 2) return [];
  try {
    const textoLower = texto.toLowerCase().trim();
    const q = query(
      collection(db, 'historial'),
      where('nombreLower', '>=', textoLower),
      where('nombreLower', '<=', textoLower + '\uf8ff'),
      limit(5)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error('Error buscando en historial:', err);
    return [];
  }
};