import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import {
  doc, getDoc, updateDoc, setDoc, serverTimestamp, increment,
  collection, addDoc, query, where, onSnapshot,
  orderBy, limit, getDocs, deleteDoc
} from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import BuscadorCIE10 from '../components/BuscadorCIE10';
import ModalCamas from '../components/ModalCamas';
import DocumentoImprimible from '../components/DocumentoImprimible';
import { generarNotaMedica } from '../services/iaNotaMedica';
import { useReactToPrint } from 'react-to-print';
import {
  ArrowLeft, Activity, ClipboardList, FileText,
  Pill, FlaskConical, X, CheckCircle2, RotateCcw,
  Trash2, Pencil, Plus, Eye, Upload, Printer
} from 'lucide-react';

const TABS = [
  { key: 'resumen', label: 'Resumen', icon: Activity },
  { key: 'historia', label: 'Historia Clínica', icon: ClipboardList },
  { key: 'diagnostico', label: 'Diagnóstico', icon: FileText },
  { key: 'nota', label: 'Nota Médica', icon: FileText },
  { key: 'indicaciones', label: 'Indicaciones', icon: Pill },
  { key: 'estudios', label: 'Estudios', icon: FlaskConical },
];

const DESTINOS_HOSPITAL = [
  { key: 'ALTA', label: 'Alta médica', icon: '✅', requiereCama: false },
  { key: 'OBSERVACION', label: 'Observación', icon: '👁', requiereCama: true },
  { key: 'CIRUGIA', label: 'Cirugía', icon: '🔪', requiereCama: true },
  { key: 'HOSPITALIZACION', label: 'Hospitalización', icon: '🏨', requiereCama: true },
  { key: 'TERAPIA_INTENSIVA', label: 'UCI', icon: '💊', requiereCama: true },
  { key: 'TRASLADO', label: 'Traslado', icon: '🚑', requiereCama: false },
];

const DESTINOS_CLINICA = [
  { key: 'ALTA', label: 'Alta médica', icon: '✅', requiereCama: false },
  { key: 'INTERNAMIENTO', label: 'Internamiento', icon: '🏨', requiereCama: true },
];

export default function Consulta() {
  const { pacienteId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const printRef = useRef();

  const [paciente, setPaciente] = useState(null);
  const [activeTab, setActiveTab] = useState('resumen');
  const [licencia, setLicencia] = useState('hospital');
  const [mostrarModalDestino, setMostrarModalDestino] = useState(false);
  const [destinoSeleccionado, setDestinoSeleccionado] = useState(null);
  const [mostrarModalCamas, setMostrarModalCamas] = useState(false);
  const [camaAsignada, setCamaAsignada] = useState('');

  // Historia clínica
  const [historia, setHistoria] = useState({ padecimiento: '', antecedentes: '', exploracion: '' });
  const [historiaCargada, setHistoriaCargada] = useState(false);

  // Diagnóstico
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [diagnosticoPrincipal, setDiagnosticoPrincipal] = useState('');
  const [diagnosticoManual, setDiagnosticoManual] = useState('');

  // Nota médica
  const [notaGenerada, setNotaGenerada] = useState('');
  const [generandoNota, setGenerandoNota] = useState(false);
  const [editandoNota, setEditandoNota] = useState(false);
  const [notasGuardadas, setNotasGuardadas] = useState([]);
  const [notaActiva, setNotaActiva] = useState(null);

  // Indicaciones
  const [indicaciones, setIndicaciones] = useState([]);
  const [nuevaIndicacion, setNuevaIndicacion] = useState({ medicamento: '', dosis: '', via: '', frecuencia: '' });
  const [ultimaIndicacion, setUltimaIndicacion] = useState(null);
  const [guardandoIndicacion, setGuardandoIndicacion] = useState(false);

  // Estudios
  const [estudios, setEstudios] = useState([]);
  const [nuevoEstudio, setNuevoEstudio] = useState({ tipo: 'laboratorio', descripcion: '', prioridad: 'normal' });
  const [guardandoEstudio, setGuardandoEstudio] = useState(false);
  const [estudiosSugeridos, setEstudiosSugeridos] = useState([]);
  const [editandoEstudioId, setEditandoEstudioId] = useState(null);

  // Modal ver anterior
  const [verAnterior, setVerAnterior] = useState(false);
  const [episodioAnterior, setEpisodioAnterior] = useState(null);

  // Imprimir
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Nota_Medica_${paciente?.nombre || 'paciente'}`,
  });

  // Cargar paciente
  useEffect(() => {
    if (!pacienteId) return;
    const unsub = onSnapshot(doc(db, 'pacientes', pacienteId), (snap) => {
      if (snap.exists()) setPaciente({ id: snap.id, ...snap.data() });
      else { addToast('Paciente no encontrado', 'error', 3000); navigate('/doctor'); }
    });
    return () => unsub();
  }, [pacienteId]);

  // Cargar licencia
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracion', 'global'), (snap) => {
      if (snap.exists() && snap.data().licencia) setLicencia(snap.data().licencia);
    });
    return () => unsub();
  }, []);

  // Cargar historia clínica actual
  useEffect(() => {
    if (!pacienteId) return;
    getDoc(doc(db, 'pacientes', pacienteId, 'historia_clinica', 'actual')).then((snap) => {
      if (snap.exists()) setHistoria(snap.data());
    });
  }, [pacienteId]);

  // Cargar notas médicas previas
  useEffect(() => {
    if (!pacienteId) return;
    const q = query(collection(db, 'pacientes', pacienteId, 'notas_medicas'), orderBy('timestamp', 'desc'), limit(10));
    const unsub = onSnapshot(q, (snap) => {
      const notas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotasGuardadas(notas);
      if (notas.length > 0 && !notaActiva) setNotaActiva(notas[0]);
    });
    return () => unsub();
  }, [pacienteId]);

  // Cargar indicaciones
  useEffect(() => {
    if (!pacienteId) return;
    const q = query(collection(db, 'pacientes', pacienteId, 'indicaciones'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setIndicaciones(lista);
      if (lista.length > 0) {
        const ultima = lista[lista.length - 1];
        setUltimaIndicacion({ medicamento: ultima.medicamento, dosis: ultima.dosis, via: ultima.via, frecuencia: ultima.frecuencia });
      }
    });
    return () => unsub();
  }, [pacienteId]);

  // Cargar estudios
  useEffect(() => {
    if (!pacienteId) return;
    const q = query(collection(db, 'pacientes', pacienteId, 'estudios'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => setEstudios(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [pacienteId]);

  // 🔹 Obtener ID correcto del historial
  const obtenerHistorialId = async (paciente) => {
    const qPorPacienteId = query(collection(db, 'historial'), where('pacienteId', '==', paciente.id));
    const snapId = await getDocs(qPorPacienteId);
    if (!snapId.empty) return snapId.docs[0].id;

    const qPorNombre = query(collection(db, 'historial'), where('nombre', '==', paciente.nombre), where('edad', '==', paciente.edad));
    const snapNombre = await getDocs(qPorNombre);
    if (!snapNombre.empty) return snapNombre.docs[0].id;

    return paciente.id;
  };

  // 🔹 Obtener episodio anterior
  const obtenerEpisodioAnterior = async () => {
    try {
      if (!paciente) return null;
      const historialId = await obtenerHistorialId(paciente);

      const q = query(collection(db, 'historial', historialId, 'episodios'), orderBy('fechaAtencion', 'desc'), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };

      const docHistorial = await getDoc(doc(db, 'historial', historialId));
      if (docHistorial.exists()) {
        const data = docHistorial.data();
        if (Array.isArray(data.episodios) && data.episodios.length > 0) {
          const ordenados = [...data.episodios].sort((a, b) => (b.fechaAlta?.seconds || 0) - (a.fechaAlta?.seconds || 0));
          return ordenados[0];
        }
      }
      return null;
    } catch (err) {
      console.error('Error obteniendo episodio anterior:', err);
      return null;
    }
  };

  // 📂 Cargar episodio anterior completo
  const cargarEpisodioAnteriorCompleto = async () => {
    const anterior = await obtenerEpisodioAnterior();
    if (!anterior) {
      addToast('No hay episodio anterior', 'info', 2000);
      return;
    }

    if (anterior.historia_clinica) {
      setHistoria({
        padecimiento: anterior.historia_clinica.padecimiento || '',
        antecedentes: anterior.historia_clinica.antecedentes || '',
        exploracion: anterior.historia_clinica.exploracion || '',
      });
      setHistoriaCargada(true);
    }

    if (anterior.diagnostico_cie10 || anterior.diagnostico_descripcion) {
      const codigos = anterior.diagnostico_cie10 ? anterior.diagnostico_cie10.split(',').map(c => c.trim()) : [];
      const descripciones = anterior.diagnostico_descripcion ? anterior.diagnostico_descripcion.split(',').map(d => d.trim()) : [];
      const diags = [];
      const max = Math.max(codigos.length, descripciones.length);
      for (let i = 0; i < max; i++) diags.push({ codigo: codigos[i] || '', descripcion: descripciones[i] || '' });
      if (diags.length) {
        setDiagnosticos(diags);
        setDiagnosticoPrincipal(diags[0].codigo);
      }
    }

    if (anterior.nota_medica) {
      setNotaGenerada(anterior.nota_medica);
      setEditandoNota(true);
    }

    if (Array.isArray(anterior.indicaciones)) {
      setIndicaciones(anterior.indicaciones.map((ind, i) => ({ id: `anterior-${i}`, ...ind })));
      const ultima = anterior.indicaciones[anterior.indicaciones.length - 1];
      if (ultima) setUltimaIndicacion({ medicamento: ultima.medicamento, dosis: ultima.dosis, via: ultima.via, frecuencia: ultima.frecuencia });
    }

    if (Array.isArray(anterior.estudios)) {
      setEstudios(anterior.estudios.map((est, i) => ({ id: `anterior-est-${i}`, ...est })));
    }

    addToast('Episodio anterior cargado', 'success', 2500);
  };

  // 👁️ Ver episodio anterior en modal
  const verEpisodioAnterior = async () => {
    const anterior = await obtenerEpisodioAnterior();
    if (!anterior) {
      addToast('No hay episodio anterior', 'info', 2000);
      return;
    }
    setEpisodioAnterior(anterior);
    setVerAnterior(true);
  };

  // Guardar historia clínica (versiona)
  const guardarHistoria = async () => {
    try {
      await setDoc(doc(db, 'pacientes', pacienteId, 'historia_clinica', 'actual'), {
        ...historia,
        actualizado_en: serverTimestamp(),
        autor: user?.nombre || 'Médico',
      }, { merge: true });

      await addDoc(collection(db, 'pacientes', pacienteId, 'historia_clinica_versiones'), {
        ...historia,
        timestamp: serverTimestamp(),
        autor: user?.nombre || 'Médico',
      });

      addToast('Historia clínica guardada y versionada', 'success', 3000, '✅');
    } catch (err) {
      console.error('Error guardando historia:', err);
      addToast('Error al guardar historia', 'error', 3000);
    }
  };

  const agregarDiagnostico = (diag) => {
    if (!diag) return;
    setDiagnosticos(prev => [...prev, diag]);
    if (!diagnosticoPrincipal) setDiagnosticoPrincipal(diag.codigo);
  };

  const handleGenerarNota = async () => {
    if (!paciente) return;
    setGenerandoNota(true);
    try {
      const resultado = await generarNotaMedica({
        nombre: paciente.nombre,
        edad: paciente.edad,
        especialidad: paciente.especialidad,
        motivo: paciente.motivo,
        antecedentes: paciente.antecedentes,
        vitales: paciente.vitales,
        signosAlarma: paciente.signosAlarma,
        escalaDolor: paciente.escalaDolor,
        historiaClinica: historia,
        diagnosticos,
        indicaciones: indicaciones.filter(i => i.estado === 'abierta'),
      });
      setNotaGenerada(resultado.nota);
      setEstudiosSugeridos(resultado.estudios_sugeridos || []);
      setEditandoNota(true);
      addToast('Nota generada por IA', 'success', 3000, '🤖 Nota médica');
    } catch (err) {
      console.error(err);
      addToast('No se pudo generar la nota', 'error', 4000, 'Error');
    } finally {
      setGenerandoNota(false);
    }
  };

  const guardarNota = async () => {
    if (!notaGenerada.trim()) {
      addToast('La nota está vacía', 'warning', 3000);
      return;
    }
    try {
      const notaRef = await addDoc(collection(db, 'pacientes', pacienteId, 'notas_medicas'), {
        texto: notaGenerada,
        timestamp: serverTimestamp(),
        autor: user?.nombre || 'Médico',
        activa: true,
      });
      const q = query(collection(db, 'pacientes', pacienteId, 'notas_medicas'), where('activa', '==', true));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        if (d.id !== notaRef.id) await updateDoc(doc(db, 'pacientes', pacienteId, 'notas_medicas', d.id), { activa: false });
      }
      setEditandoNota(false);
      setNotaActiva({ id: notaRef.id, texto: notaGenerada, autor: user?.nombre, timestamp: { toDate: () => new Date() } });
      addToast('Nota médica guardada', 'success', 3000, '📋 Nota guardada');
    } catch (err) {
      console.error('Error guardando nota:', err);
      addToast('Error al guardar la nota', 'error', 4000);
    }
  };

  const agregarIndicacion = async () => {
    if (!nuevaIndicacion.medicamento.trim()) {
      addToast('Ingresa el medicamento o instrucción', 'warning', 3000, 'Campo requerido');
      return;
    }
    setGuardandoIndicacion(true);
    try {
      await addDoc(collection(db, 'pacientes', pacienteId, 'indicaciones'), {
        ...nuevaIndicacion,
        estado: 'abierta',
        timestamp: serverTimestamp(),
        autor: user?.nombre || 'Médico',
      });
      setNuevaIndicacion({ medicamento: '', dosis: '', via: '', frecuencia: '' });
      addToast('Indicación agregada', 'success', 3000, '💊 Indicación');
    } catch (err) {
      console.error('Error agregando indicación:', err);
      addToast('Error al agregar indicación', 'error', 4000);
    } finally {
      setGuardandoIndicacion(false);
    }
  };

  const toggleEstadoIndicacion = async (indicacion) => {
    try {
      const nuevoEstado = indicacion.estado === 'abierta' ? 'cerrada' : 'abierta';
      await updateDoc(doc(db, 'pacientes', pacienteId, 'indicaciones', indicacion.id), {
        estado: nuevoEstado,
        fecha_cierre: nuevoEstado === 'cerrada' ? serverTimestamp() : null,
      });
      addToast(`Indicación ${nuevoEstado}`, 'success', 3000, nuevoEstado === 'cerrada' ? '🔒 Cerrada' : '🔓 Abierta');
    } catch (err) {
      console.error('Error cambiando estado:', err);
      addToast('Error al cambiar estado', 'error', 4000);
    }
  };

  const usarUltimaIndicacion = () => {
    if (ultimaIndicacion) setNuevaIndicacion(ultimaIndicacion);
  };

  const agregarEstudio = async () => {
    if (!nuevoEstudio.descripcion.trim()) {
      addToast('Describe el estudio o referencia', 'warning', 3000, 'Campo requerido');
      return;
    }
    setGuardandoEstudio(true);
    try {
      if (editandoEstudioId) {
        await updateDoc(doc(db, 'pacientes', pacienteId, 'estudios', editandoEstudioId), {
          ...nuevoEstudio,
          fecha_actualizacion: serverTimestamp(),
        });
        setEditandoEstudioId(null);
        addToast('Estudio actualizado', 'success', 3000, '✅');
      } else {
        await addDoc(collection(db, 'pacientes', pacienteId, 'estudios'), {
          ...nuevoEstudio,
          estado: 'solicitado',
          timestamp: serverTimestamp(),
          autor: user?.nombre || 'Médico',
        });
        addToast('Estudio solicitado', 'success', 3000, '🧪 Estudio');
      }
      setNuevoEstudio({ tipo: 'laboratorio', descripcion: '', prioridad: 'normal' });
    } catch (err) {
      console.error('Error guardando estudio:', err);
      addToast('Error al guardar estudio', 'error', 4000);
    } finally {
      setGuardandoEstudio(false);
    }
  };

  const editarEstudio = (estudio) => {
    setEditandoEstudioId(estudio.id);
    setNuevoEstudio({ tipo: estudio.tipo, descripcion: estudio.descripcion, prioridad: estudio.prioridad });
    addToast('Editando estudio', 'info', 2000);
  };

  const eliminarEstudio = async (estudioId) => {
    if (!window.confirm('¿Eliminar este estudio?')) return;
    try {
      await deleteDoc(doc(db, 'pacientes', pacienteId, 'estudios', estudioId));
      addToast('Estudio eliminado', 'success', 3000, '🗑️ Eliminado');
    } catch (err) {
      console.error('Error eliminando estudio:', err);
      addToast('Error al eliminar estudio', 'error', 4000);
    }
  };

  const agregarEstudioSugerido = async (estudioSugerido) => {
    try {
      await addDoc(collection(db, 'pacientes', pacienteId, 'estudios'), {
        ...estudioSugerido,
        estado: 'solicitado',
        timestamp: serverTimestamp(),
        autor: user?.nombre || 'Médico',
      });
      setEstudiosSugeridos(prev => prev.filter((_, idx) => idx !== prev.indexOf(estudioSugerido)));
      addToast('Estudio sugerido agregado', 'success', 3000, '🧪');
    } catch (err) {
      console.error('Error agregando estudio sugerido:', err);
      addToast('Error al agregar', 'error', 4000);
    }
  };

  const descartarEstudioSugerido = (index) => setEstudiosSugeridos(prev => prev.filter((_, i) => i !== index));
  const descartarTodosSugeridos = () => setEstudiosSugeridos([]);

  const cambiarEstadoEstudio = async (estudio, nuevoEstado) => {
    try {
      await updateDoc(doc(db, 'pacientes', pacienteId, 'estudios', estudio.id), { estado: nuevoEstado, fecha_actualizacion: serverTimestamp() });
      addToast(`Estudio ${nuevoEstado}`, 'success', 3000, '✅');
    } catch (err) {
      console.error('Error cambiando estado:', err);
      addToast('Error al cambiar estado', 'error', 4000);
    }
  };

  const validarParaFinalizar = () => {
    const diagValido = diagnosticos.length > 0 || diagnosticoManual.trim().length > 0;
    if (!diagValido) {
      addToast('Agrega un diagnóstico (CIE-10 o manual)', 'warning', 3000, 'Falta diagnóstico');
      return false;
    }
    if (!notaGenerada.trim()) {
      addToast('Genera la nota médica', 'warning', 3000, 'Falta nota');
      return false;
    }
    if (indicaciones.filter(i => i.estado === 'abierta').length === 0) {
      addToast('Agrega al menos una indicación abierta', 'warning', 3000, 'Falta indicación');
      return false;
    }
    return true;
  };

  const abrirModalFinalizar = () => {
    if (!validarParaFinalizar()) return;
    setMostrarModalDestino(true);
  };

  const seleccionarDestino = (destino) => {
    setDestinoSeleccionado(destino);
    setMostrarModalDestino(false);
    if (destino.requiereCama) {
      setMostrarModalCamas(true);
    } else {
      confirmarFinalizacion(destino.key);
    }
  };

  const confirmarFinalizacion = async (destinoFinal) => {
    try {
      if (paciente.cama_asignada && (destinoFinal === 'ALTA' || destinoFinal === 'TRASLADO')) {
        await updateDoc(doc(db, 'camas', paciente.cama_asignada), { ocupada: false, paciente_id: null });
      }

      await guardarEpisodioEnHistorial(destinoFinal);

      await updateDoc(doc(db, 'pacientes', pacienteId), {
        estado: destinoFinal === 'ALTA' ? 'alta' : destinoFinal.toLowerCase(),
        ubicacion_actual: destinoFinal,
        fecha_atencion: serverTimestamp(),
        atendido_por: user?.nombre || user?.email,
      });

      addToast('Atención finalizada. Generando PDF...', 'success', 3000, '✅');
      setTimeout(() => handlePrint(), 500);
      navigate('/doctor');
    } catch (err) {
      console.error('Error finalizando:', err);
      addToast('Error al finalizar atención', 'error', 4000);
    }
  };

  const guardarEpisodioEnHistorial = async (destinoFinal) => {
    if (!paciente) return;
    try {
      const historialId = await obtenerHistorialId(paciente);

      const episodioData = {
        fechaIngreso: paciente.fecha_ingreso || serverTimestamp(),
        fechaAtencion: serverTimestamp(),
        destino: destinoFinal,
        nivel: paciente.nivel_prioridad,
        especialidad: paciente.especialidad,
        motivo: paciente.motivo,
        signosVitales: paciente.vitales || {},
        signosAlarma: paciente.signosAlarma || [],
        diagnostico_cie10: diagnosticoPrincipal,
        diagnostico_descripcion: diagnosticos.map(d => d.descripcion).join(', ') || diagnosticoManual,
        historia_clinica: {
          padecimiento: historia.padecimiento,
          antecedentes: historia.antecedentes,
          exploracion: historia.exploracion,
        },
        nota_medica: notaGenerada || '',
        indicaciones: indicaciones.filter(i => i.estado === 'abierta').map(i => ({
          medicamento: i.medicamento,
          dosis: i.dosis,
          via: i.via,
          frecuencia: i.frecuencia,
          estado: i.estado,
        })),
        estudios: estudios.map(e => ({
          tipo: e.tipo,
          descripcion: e.descripcion,
          prioridad: e.prioridad,
          estado: e.estado,
        })),
        medico: user?.nombre || user?.email,
      };

      await setDoc(doc(db, 'historial', historialId), {
        pacienteId: pacienteId,
        nombre: paciente.nombre,
        edad: paciente.edad,
        especialidad: paciente.especialidad,
        fechaUltimaVisita: serverTimestamp(),
        totalEpisodios: increment(1),
      }, { merge: true });

      await addDoc(collection(db, 'historial', historialId, 'episodios'), episodioData);
      addToast('Episodio guardado en historial clínico', 'success', 3000, '📋');
    } catch (err) {
      console.error('Error guardando episodio en historial:', err);
      addToast('Error al guardar en historial', 'error', 4000);
    }
  };

  if (!paciente) {
    return <div className="page-container"><div className="card">Cargando paciente...</div></div>;
  }

  const DESTINOS = licencia === 'clinica' ? DESTINOS_CLINICA : DESTINOS_HOSPITAL;

  return (
    <div className="page-container">
      {/* Encabezado */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm"><ArrowLeft size={18} /></button>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>{paciente.nombre}</h2>
            <p style={{ fontSize: '13px', color: '#6B7280' }}>{paciente.edad} años · {paciente.especialidad} · Nivel {paciente.nivel_prioridad}</p>
          </div>
        </div>
      </div>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', borderBottom: '1px solid #E5E7EB', paddingBottom: '8px' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, backgroundColor: active ? '#EFF6FF' : 'transparent', color: active ? '#3B82F6' : '#6B7280', transition: 'all 0.15s ease' }}>
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      {activeTab === 'resumen' && (
        <div className="cards-grid-2">
          <div className="card">
            <h3 className="section-title">Datos del paciente</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p><strong>Nombre:</strong> {paciente.nombre}</p>
              <p><strong>Edad:</strong> {paciente.edad} años</p>
              <p><strong>Especialidad:</strong> {paciente.especialidad || 'General'}</p>
              <p><strong>Motivo:</strong> {paciente.motivo}</p>
              <p><strong>Antecedentes:</strong> {paciente.antecedentes || 'Ninguno'}</p>
              {paciente.signosAlarma?.length > 0 && <p><strong>Signos de alarma:</strong> {paciente.signosAlarma.join(', ')}</p>}
            </div>
          </div>
          <div className="card">
            <h3 className="section-title">Signos vitales</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {paciente.vitales?.ta && <span className="badge" style={{ backgroundColor: '#F3F4F6' }}>T/A: {paciente.vitales.ta}</span>}
              {paciente.vitales?.temp && <span className="badge" style={{ backgroundColor: '#F3F4F6' }}>Temp: {paciente.vitales.temp}°C</span>}
              {paciente.vitales?.fc && <span className="badge" style={{ backgroundColor: '#F3F4F6' }}>FC: {paciente.vitales.fc}</span>}
              {paciente.vitales?.spo2 && <span className="badge" style={{ backgroundColor: '#F3F4F6' }}>SpO₂: {paciente.vitales.spo2}%</span>}
              {paciente.vitales?.glu && <span className="badge" style={{ backgroundColor: '#F3F4F6' }}>Glucosa: {paciente.vitales.glu}</span>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'historia' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 className="section-title" style={{ marginBottom: 0 }}>Historia Clínica</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={verEpisodioAnterior} className="btn btn-secondary btn-sm"><Eye size={14} /> Ver anterior</button>
              <button onClick={cargarEpisodioAnteriorCompleto} className="btn btn-primary btn-sm"><Upload size={14} /> Cargar anterior</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div><label className="label">Padecimiento actual</label><textarea value={historia.padecimiento} onChange={(e) => setHistoria(prev => ({ ...prev, padecimiento: e.target.value }))} rows={3} placeholder="Describe el padecimiento actual..." className="input-modern" /></div>
            <div><label className="label">Antecedentes de importancia</label><textarea value={historia.antecedentes} onChange={(e) => setHistoria(prev => ({ ...prev, antecedentes: e.target.value }))} rows={2} placeholder="Antecedentes heredofamiliares, personales, etc." className="input-modern" /></div>
            <div><label className="label">Exploración física</label><textarea value={historia.exploracion} onChange={(e) => setHistoria(prev => ({ ...prev, exploracion: e.target.value }))} rows={4} placeholder="Describe los hallazgos de la exploración física..." className="input-modern" /></div>
            <button onClick={guardarHistoria} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>💾 Guardar historia</button>
          </div>
        </div>
      )}

      {activeTab === 'diagnostico' && (
        <div className="card">
          <h3 className="section-title">Diagnóstico</h3>
          <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>Busca en CIE-10 o escribe un diagnóstico manual.</p>
          <BuscadorCIE10 onSelect={agregarDiagnostico} />
          <div style={{ marginTop: '16px' }}>
            <label className="label">Diagnóstico manual (opcional)</label>
            <input type="text" value={diagnosticoManual} onChange={(e) => setDiagnosticoManual(e.target.value)} placeholder="Escribe un diagnóstico libre..." className="input-modern" />
          </div>
          {(diagnosticos.length > 0 || diagnosticoManual.trim()) && (
            <div style={{ marginTop: '16px' }}>
              <h4 className="label">Diagnósticos registrados</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {diagnosticos.map((diag, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#F9FAFB', borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px' }}>{diag.descripcion}</span>
                    <span style={{ fontWeight: 600, color: '#3B82F6' }}>{diag.codigo}</span>
                  </div>
                ))}
                {diagnosticoManual.trim() && (
                  <div style={{ padding: '8px 12px', backgroundColor: '#F0FDF4', borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px' }}>{diagnosticoManual}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'nota' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="section-title" style={{ marginBottom: 0 }}>📋 Nota Médica</h3>
            <button onClick={handleGenerarNota} disabled={generandoNota} className="btn btn-primary">{generandoNota ? '🤖 Generando...' : '🤖 Generar nota con IA'}</button>
          </div>
          {notaGenerada ? (
            <>
              <textarea value={notaGenerada} onChange={(e) => setNotaGenerada(e.target.value)} rows={12} className="input-modern" style={{ fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.6, resize: 'vertical' }} disabled={!editandoNota} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                {!editandoNota ? <button onClick={() => setEditandoNota(true)} className="btn btn-secondary">✏️ Editar</button> : <button onClick={guardarNota} className="btn btn-primary">💾 Guardar nota</button>}
              </div>
            </>
          ) : (
            <div className="empty-state"><div className="empty-state-icon">📄</div><p className="empty-state-text">No hay nota generada.</p></div>
          )}
          {notasGuardadas.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h4 className="label">Notas anteriores</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notasGuardadas.map(nota => (
                  <div key={nota.id} style={{ padding: '12px', backgroundColor: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB', cursor: 'pointer' }} onClick={() => { setNotaGenerada(nota.texto); setEditandoNota(false); setNotaActiva(nota); }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ fontSize: '12px', fontWeight: 600, color: '#3B82F6' }}>{nota.autor || 'Médico'}</span><span style={{ fontSize: '11px', color: '#9CA3AF' }}>{nota.timestamp?.toDate ? nota.timestamp.toDate().toLocaleString('es-MX') : ''}</span></div>
                    <p style={{ fontSize: '12px', color: '#1F2937', maxHeight: '60px', overflow: 'hidden' }}>{nota.texto.substring(0, 120)}...</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'indicaciones' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="section-title" style={{ marginBottom: 0 }}>💊 Indicaciones Médicas</h3>
            {ultimaIndicacion && <button onClick={usarUltimaIndicacion} className="btn btn-ghost btn-sm"><RotateCcw size={14} /> Reutilizar última</button>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div><label className="label">Medicamento *</label><input type="text" value={nuevaIndicacion.medicamento} onChange={(e) => setNuevaIndicacion(prev => ({ ...prev, medicamento: e.target.value }))} placeholder="Ej: Paracetamol" className="input-modern" /></div>
            <div><label className="label">Dosis</label><input type="text" value={nuevaIndicacion.dosis} onChange={(e) => setNuevaIndicacion(prev => ({ ...prev, dosis: e.target.value }))} placeholder="Ej: 500 mg" className="input-modern" /></div>
            <div><label className="label">Vía</label><input type="text" value={nuevaIndicacion.via} onChange={(e) => setNuevaIndicacion(prev => ({ ...prev, via: e.target.value }))} placeholder="Ej: Oral" className="input-modern" /></div>
            <div><label className="label">Frecuencia</label><input type="text" value={nuevaIndicacion.frecuencia} onChange={(e) => setNuevaIndicacion(prev => ({ ...prev, frecuencia: e.target.value }))} placeholder="Ej: Cada 8 horas" className="input-modern" /></div>
          </div>
          <button onClick={agregarIndicacion} disabled={guardandoIndicacion} className="btn btn-primary" style={{ marginBottom: '16px' }}>{guardandoIndicacion ? 'Guardando...' : '➕ Agregar indicación'}</button>
          {indicaciones.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">💊</div><p className="empty-state-text">No hay indicaciones registradas</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}><span className="badge" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>Abiertas: {indicaciones.filter(i => i.estado === 'abierta').length}</span><span className="badge" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>Cerradas: {indicaciones.filter(i => i.estado === 'cerrada').length}</span></div>
              {indicaciones.map(ind => (
                <div key={ind.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', backgroundColor: ind.estado === 'abierta' ? '#F0FDF4' : '#F9FAFB', border: `1px solid ${ind.estado === 'abierta' ? '#BBF7D0' : '#E5E7EB'}`, opacity: ind.estado === 'cerrada' ? 0.7 : 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}><span style={{ fontWeight: 600, fontSize: '14px' }}>{ind.medicamento}</span>{ind.estado === 'abierta' ? <span className="badge" style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}>Abierta</span> : <span className="badge" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>Cerrada</span>}</div>
                    <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>{[ind.dosis, ind.via, ind.frecuencia].filter(Boolean).join(' · ') || 'Sin detalles'}</p>
                  </div>
                  <button onClick={() => toggleEstadoIndicacion(ind)} className={`btn btn-sm ${ind.estado === 'abierta' ? 'btn-secondary' : 'btn-primary'}`} title={ind.estado === 'abierta' ? 'Cerrar' : 'Reabrir'}>{ind.estado === 'abierta' ? <CheckCircle2 size={14} /> : <RotateCcw size={14} />}{ind.estado === 'abierta' ? 'Cerrar' : 'Reabrir'}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'estudios' && (
        <div className="card">
          <h3 className="section-title">🧪 Estudios y Referencias</h3>
          {estudiosSugeridos.length > 0 && (
            <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#F0F9FF', borderRadius: '12px', border: '1px solid #BAE6FD' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#0369A1' }}>🤖 Estudios sugeridos por IA</span>
                <button onClick={descartarTodosSugeridos} className="btn btn-ghost btn-sm" style={{ color: '#0369A1' }}>Descartar todos</button>
              </div>
              {estudiosSugeridos.map((est, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid #E0F2FE' }}>
                  <span style={{ flex: 1, fontSize: '13px' }}>{est.descripcion} <span style={{ color: '#6B7280' }}>({est.tipo}) {est.prioridad === 'urgente' && '⚡'}</span></span>
                  <button onClick={() => agregarEstudioSugerido(est)} className="btn btn-sm btn-primary"><Plus size={14} /></button>
                  <button onClick={() => descartarEstudioSugerido(idx)} className="btn btn-sm btn-ghost"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div><label className="label">Tipo</label><select value={nuevoEstudio.tipo} onChange={(e) => setNuevoEstudio(prev => ({ ...prev, tipo: e.target.value }))} className="input-modern"><option value="laboratorio">🧫 Laboratorio</option><option value="gabinete">🩻 Gabinete</option><option value="interconsulta">👨‍⚕️ Interconsulta</option><option value="referencia">🚑 Referencia</option></select></div>
            <div><label className="label">Prioridad</label><select value={nuevoEstudio.prioridad} onChange={(e) => setNuevoEstudio(prev => ({ ...prev, prioridad: e.target.value }))} className="input-modern"><option value="normal">Normal</option><option value="urgente">Urgente</option></select></div>
            <div style={{ gridColumn: '1 / -1' }}><label className="label">Descripción</label><input type="text" value={nuevoEstudio.descripcion} onChange={(e) => setNuevoEstudio(prev => ({ ...prev, descripcion: e.target.value }))} placeholder="Ej: Hemograma completo, Rx de tórax..." className="input-modern" /></div>
          </div>
          <button onClick={agregarEstudio} disabled={guardandoEstudio} className="btn btn-primary" style={{ marginBottom: '16px' }}>
            {editandoEstudioId ? '💾 Guardar cambios' : '➕ Solicitar estudio'}
          </button>

          {estudios.length === 0 ? <div className="empty-state"><div className="empty-state-icon">🧪</div><p className="empty-state-text">No hay estudios solicitados</p></div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {estudios.map(est => (
                <div key={est.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <div style={{ fontSize: '20px', flexShrink: 0 }}>{est.tipo === 'laboratorio' ? '🧫' : est.tipo === 'gabinete' ? '🩻' : est.tipo === 'interconsulta' ? '👨‍⚕️' : '🚑'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}><span style={{ fontWeight: 600, fontSize: '14px' }}>{est.descripcion}</span>{est.prioridad === 'urgente' && <span className="badge" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>⚡ Urgente</span>}</div>
                    <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{est.tipo} · {est.estado}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {est.estado === 'solicitado' && <button onClick={() => cambiarEstadoEstudio(est, 'realizado')} className="btn btn-sm btn-secondary">✓ Realizado</button>}
                    {est.estado === 'realizado' && <button onClick={() => cambiarEstadoEstudio(est, 'entregado')} className="btn btn-sm btn-primary">📤 Entregado</button>}
                    {est.estado !== 'cancelado' && <button onClick={() => cambiarEstadoEstudio(est, 'cancelado')} className="btn btn-sm btn-danger">Cancelar</button>}
                    <button onClick={() => editarEstudio(est)} className="btn btn-sm btn-ghost"><Pencil size={14} /></button>
                    <button onClick={() => eliminarEstudio(est.id)} className="btn btn-sm btn-danger"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Botones flotantes */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 50, display: 'flex', gap: '8px' }}>
        <button
          onClick={() => handlePrint()}
          className="btn btn-secondary btn-lg"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
          title="Imprimir nota"
        >
          <Printer size={18} /> Imprimir
        </button>
        <button
          onClick={abrirModalFinalizar}
          className="btn btn-primary btn-lg"
          style={{ boxShadow: '0 4px 20px rgba(59,130,246,0.3)' }}
        >
          ✅ Finalizar atención
        </button>
      </div>

      {/* Modal destino */}
      {mostrarModalDestino && (
        <div className="modal-overlay" onClick={() => setMostrarModalDestino(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Seleccionar destino</h3>
              <button onClick={() => setMostrarModalDestino(false)} className="btn btn-ghost btn-sm"><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {DESTINOS.map(dest => (
                <button key={dest.key} onClick={() => seleccionarDestino(dest)} className="btn btn-secondary" style={{ padding: '16px', justifyContent: 'flex-start', gap: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{dest.icon}</span> {dest.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal camas */}
      <ModalCamas
        open={mostrarModalCamas}
        onClose={() => setMostrarModalCamas(false)}
        pacienteId={pacienteId}
        area={destinoSeleccionado?.key || ''}
        onAsignar={(cama) => {
          setCamaAsignada(cama);
          setMostrarModalCamas(false);
          confirmarFinalizacion(destinoSeleccionado.key);
        }}
      />

      {/* Modal ver anterior */}
      {verAnterior && episodioAnterior && (
        <div className="modal-overlay" onClick={() => setVerAnterior(false)}>
          <div className="modal-box" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Episodio anterior</h3>
              <button onClick={() => setVerAnterior(false)} className="btn btn-ghost btn-sm"><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 28px', maxHeight: '70vh', overflowY: 'auto' }}>
              <p><strong>Fecha:</strong> {episodioAnterior.fechaAtencion?.toDate ? episodioAnterior.fechaAtencion.toDate().toLocaleString('es-MX') : '—'}</p>
              <p><strong>Motivo:</strong> {episodioAnterior.motivo || '—'}</p>
              <h4 className="section-title">Historia Clínica</h4>
              <p><strong>Padecimiento:</strong> {episodioAnterior.historia_clinica?.padecimiento || '—'}</p>
              <p><strong>Antecedentes:</strong> {episodioAnterior.historia_clinica?.antecedentes || '—'}</p>
              <p><strong>Exploración:</strong> {episodioAnterior.historia_clinica?.exploracion || '—'}</p>
              <h4 className="section-title">Diagnóstico</h4>
              <p>{episodioAnterior.diagnostico_cie10 || '—'} - {episodioAnterior.diagnostico_descripcion || ''}</p>
              <h4 className="section-title">Nota Médica</h4>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{episodioAnterior.nota_medica || '—'}</pre>
              <h4 className="section-title">Indicaciones</h4>
              {episodioAnterior.indicaciones?.length ? episodioAnterior.indicaciones.map((ind, i) => <p key={i}>{ind.medicamento} {ind.dosis} {ind.via} {ind.frecuencia}</p>) : '—'}
              <h4 className="section-title">Estudios</h4>
              {episodioAnterior.estudios?.length ? episodioAnterior.estudios.map((est, i) => <p key={i}>{est.descripcion} ({est.tipo})</p>) : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Documento imprimible oculto */}
      <div style={{ display: 'none' }}>
        <DocumentoImprimible
          ref={printRef}
          tipo="atencion"
          datos={{
            paciente,
            medico: user?.nombre || user?.email,
            fecha: new Date().toLocaleString('es-MX'),
            destino: destinoSeleccionado?.key || '',
            diagnostico: diagnosticoPrincipal || diagnosticoManual,
            diagnosticoDesc: diagnosticos.map(d => d.descripcion).join(', ') || diagnosticoManual,
            motivo: paciente?.motivo,
            nota: notaGenerada,
            indicaciones: indicaciones.filter(i => i.estado === 'abierta'),
            estudios,
          }}
        />
      </div>
    </div>
  );
}