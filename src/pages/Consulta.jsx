import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import {
  doc, getDoc, updateDoc, serverTimestamp,
  collection, addDoc, query, where, onSnapshot,
  orderBy, limit, getDocs
} from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import BuscadorCIE10 from '../components/BuscadorCIE10';
import ModalCamas from '../components/ModalCamas';
import { generarNotaMedica } from '../services/iaService';
import {
  ArrowLeft, Activity, ClipboardList, FileText,
  Pill, FlaskConical, History, X, CheckCircle2, RotateCcw
} from 'lucide-react';

const TABS = [
  { key: 'resumen', label: 'Resumen', icon: Activity },
  { key: 'historia', label: 'Historia Clínica', icon: ClipboardList },
  { key: 'diagnostico', label: 'Diagnóstico', icon: FileText },
  { key: 'nota', label: 'Nota Médica', icon: FileText },
  { key: 'indicaciones', label: 'Indicaciones', icon: Pill },
  { key: 'estudios', label: 'Estudios', icon: FlaskConical },
  { key: 'seguimiento', label: 'Seguimiento', icon: History },
];

const DESTINOS_HOSPITAL = [
  { key: 'ALTA', label: 'Alta médica', icon: '✅', desc: 'Paciente se va a casa', color: '#16A34A' },
  { key: 'OBSERVACION', label: 'Observación', icon: '👁', desc: 'Pase a camilla', color: '#EAB308' },
  { key: 'CIRUGIA', label: 'Cirugía', icon: '🔪', desc: 'Pase a quirófano', color: '#3B82F6' },
  { key: 'HOSPITALIZACION', label: 'Hospitalización', icon: '🏨', desc: 'Ingreso a piso', color: '#8B5CF6' },
  { key: 'TERAPIA_INTENSIVA', label: 'UCI', icon: '💊', desc: 'Cuidados intensivos', color: '#DC2626' },
  { key: 'TRASLADO', label: 'Traslado', icon: '🚑', desc: 'A otro centro', color: '#F97316' },
];

const DESTINOS_CLINICA = [
  { key: 'ALTA', label: 'Alta médica', icon: '✅', desc: 'Paciente se va a casa', color: '#16A34A' },
  { key: 'INTERNAMIENTO', label: 'Internamiento', icon: '🏨', desc: 'Ingreso a cuarto', color: '#8B5CF6' },
];

const DESTINOS_CON_CAMA_HOSPITAL = ['OBSERVACION', 'HOSPITALIZACION', 'CIRUGIA', 'TERAPIA_INTENSIVA'];
const DESTINOS_CON_CAMA_CLINICA = ['INTERNAMIENTO'];

export default function Consulta() {
  const { pacienteId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [paciente, setPaciente] = useState(null);
  const [activeTab, setActiveTab] = useState('resumen');
  const [licencia, setLicencia] = useState('hospital');
  const [mostrarModalCamas, setMostrarModalCamas] = useState(false);
  const [destinoSeleccionado, setDestinoSeleccionado] = useState('');
  const [camaAsignada, setCamaAsignada] = useState('');

  // Historia clínica
  const [historia, setHistoria] = useState({ padecimiento: '', antecedentes: '', exploracion: '' });

  // Diagnóstico
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [diagnosticoPrincipal, setDiagnosticoPrincipal] = useState('');

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

  // Seguimiento
  const [seguimientos, setSeguimientos] = useState([]);
  const [nuevoSeguimiento, setNuevoSeguimiento] = useState({
    nota: '',
    vitales: { ta: '', temp: '', fc: '', spo2: '', glu: '' },
  });
  const [guardandoSeguimiento, setGuardandoSeguimiento] = useState(false);

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

  // Cargar historia clínica
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
        setUltimaIndicacion({ medicamento: ultima.medicamento || '', dosis: ultima.dosis || '', via: ultima.via || '', frecuencia: ultima.frecuencia || '' });
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

  // Cargar seguimiento
  useEffect(() => {
    if (!pacienteId) return;
    const q = query(collection(db, 'pacientes', pacienteId, 'seguimiento'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => setSeguimientos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [pacienteId]);

  const guardarHistoria = async () => {
    try {
      await updateDoc(doc(db, 'pacientes', pacienteId, 'historia_clinica', 'actual'), {
        ...historia,
        actualizado_en: serverTimestamp(),
        autor: user?.nombre || 'Médico',
      });
      addToast('Historia clínica guardada', 'success', 3000, '✅');
    } catch (err) { console.error('Error guardando historia:', err); addToast('Error al guardar', 'error', 3000); }
  };

  const agregarDiagnostico = (diag) => {
    if (!diag) return;
    setDiagnosticos(prev => [...prev, diag]);
    if (!diagnosticoPrincipal) setDiagnosticoPrincipal(diag.codigo);
  };

  const agregarIndicacion = async () => {
    if (!nuevaIndicacion.medicamento.trim()) {
      addToast('Ingresa el medicamento o instrucción', 'warning', 3000, 'Campo requerido');
      return;
    }
    setGuardandoIndicacion(true);
    try {
      await addDoc(collection(db, 'pacientes', pacienteId, 'indicaciones'), {
        ...nuevaIndicacion, estado: 'abierta', timestamp: serverTimestamp(), autor: user?.nombre || 'Médico',
      });
      setNuevaIndicacion({ medicamento: '', dosis: '', via: '', frecuencia: '' });
      addToast('Indicación agregada', 'success', 3000, '💊 Indicación');
    } catch (err) { console.error('Error agregando indicación:', err); addToast('Error al agregar indicación', 'error', 4000); }
    finally { setGuardandoIndicacion(false); }
  };

  const toggleEstadoIndicacion = async (indicacion) => {
    try {
      const nuevoEstado = indicacion.estado === 'abierta' ? 'cerrada' : 'abierta';
      await updateDoc(doc(db, 'pacientes', pacienteId, 'indicaciones', indicacion.id), {
        estado: nuevoEstado,
        fecha_cierre: nuevoEstado === 'cerrada' ? serverTimestamp() : null,
      });
      addToast(`Indicación ${nuevoEstado}`, 'success', 3000, nuevoEstado === 'cerrada' ? '🔒 Cerrada' : '🔓 Abierta');
    } catch (err) { console.error('Error cambiando estado:', err); addToast('Error al cambiar estado', 'error', 4000); }
  };

  const usarUltimaIndicacion = () => {
    if (ultimaIndicacion) setNuevaIndicacion(ultimaIndicacion);
  };

  const handleGenerarNota = async () => {
    if (!paciente) return;
    setGenerandoNota(true);
    try {
      const datosParaIA = {
        nombre: paciente.nombre,
        edad: paciente.edad,
        especialidad: paciente.especialidad,
        motivo: paciente.motivo,
        antecedentes: paciente.antecedentes,
        vitales: paciente.vitales,
        signosAlarma: paciente.signosAlarma,
        escalaDolor: paciente.escalaDolor,
        historiaClinica: historia,
        diagnosticos: diagnosticos,
        indicaciones: indicaciones.filter(i => i.estado === 'abierta').map(i => ({
          medicamento: i.medicamento,
          dosis: i.dosis,
          via: i.via,
          frecuencia: i.frecuencia,
        })),
      };
      const nota = await generarNotaMedica(datosParaIA);
      setNotaGenerada(nota);
      setEditandoNota(true);
      addToast('Nota generada por IA', 'success', 3000, '🤖 Nota médica');
    } catch (err) { console.error('Error generando nota:', err); addToast('No se pudo generar la nota', 'error', 4000, 'Error'); }
    finally { setGenerandoNota(false); }
  };

  const guardarNota = async () => {
    if (!notaGenerada.trim()) { addToast('La nota está vacía', 'warning', 3000); return; }
    try {
      const notaRef = await addDoc(collection(db, 'pacientes', pacienteId, 'notas_medicas'), {
        texto: notaGenerada, timestamp: serverTimestamp(), autor: user?.nombre || 'Médico', activa: true,
      });
      const q = query(collection(db, 'pacientes', pacienteId, 'notas_medicas'), where('activa', '==', true));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        if (d.id !== notaRef.id) await updateDoc(doc(db, 'pacientes', pacienteId, 'notas_medicas', d.id), { activa: false });
      }
      setEditandoNota(false);
      setNotaActiva({ id: notaRef.id, texto: notaGenerada, autor: user?.nombre, timestamp: { toDate: () => new Date() } });
      addToast('Nota médica guardada', 'success', 3000, '📋 Nota guardada');
    } catch (err) { console.error('Error guardando nota:', err); addToast('Error al guardar la nota', 'error', 4000); }
  };

  const agregarEstudio = async () => {
    if (!nuevoEstudio.descripcion.trim()) { addToast('Describe el estudio o referencia', 'warning', 3000, 'Campo requerido'); return; }
    setGuardandoEstudio(true);
    try {
      await addDoc(collection(db, 'pacientes', pacienteId, 'estudios'), {
        ...nuevoEstudio, estado: 'solicitado', timestamp: serverTimestamp(), autor: user?.nombre || 'Médico',
      });
      setNuevoEstudio({ tipo: 'laboratorio', descripcion: '', prioridad: 'normal' });
      addToast('Estudio solicitado', 'success', 3000, '🧪 Estudio');
    } catch (err) { console.error('Error agregando estudio:', err); addToast('Error al solicitar estudio', 'error', 4000); }
    finally { setGuardandoEstudio(false); }
  };

  const cambiarEstadoEstudio = async (estudio, nuevoEstado) => {
    try {
      await updateDoc(doc(db, 'pacientes', pacienteId, 'estudios', estudio.id), { estado: nuevoEstado, fecha_actualizacion: serverTimestamp() });
      addToast(`Estudio ${nuevoEstado}`, 'success', 3000, '✅');
    } catch (err) { console.error('Error cambiando estado:', err); addToast('Error al cambiar estado', 'error', 4000); }
  };

  const agregarSeguimiento = async () => {
    if (!nuevoSeguimiento.nota.trim() && !Object.values(nuevoSeguimiento.vitales).some(v => v.trim())) {
      addToast('Escribe una nota o registra signos vitales', 'warning', 3000, 'Seguimiento requerido');
      return;
    }
    setGuardandoSeguimiento(true);
    try {
      await addDoc(collection(db, 'pacientes', pacienteId, 'seguimiento'), {
        ...nuevoSeguimiento, timestamp: serverTimestamp(), autor: user?.nombre || 'Médico',
      });
      setNuevoSeguimiento({ nota: '', vitales: { ta: '', temp: '', fc: '', spo2: '', glu: '' } });
      addToast('Seguimiento guardado', 'success', 3000, '📈 Seguimiento');
    } catch (err) { console.error('Error guardando seguimiento:', err); addToast('Error al guardar seguimiento', 'error', 4000); }
    finally { setGuardandoSeguimiento(false); }
  };

  const finalizarAtencion = (destino) => {
    if (destino === 'ALTA') {
      navigate('/doctor');
      return;
    }
    setDestinoSeleccionado(destino);
    setMostrarModalCamas(true);
  };

  const confirmarDestino = async () => {
    try {
      await updateDoc(doc(db, 'pacientes', pacienteId), {
        estado: destinoSeleccionado === 'ALTA' ? 'alta' : destinoSeleccionado.toLowerCase(),
        ubicacion_actual: destinoSeleccionado,
        fecha_atencion: serverTimestamp(),
        atendido_por: user?.nombre || user?.email,
      });
      addToast('Atención finalizada', 'success', 3000, '✅');
      navigate('/doctor');
    } catch (err) { console.error('Error finalizando:', err); addToast('Error al finalizar', 'error', 3000); }
  };

  if (!paciente) {
    return <div className="page-container"><div className="card">Cargando paciente...</div></div>;
  }

  const DESTINOS = licencia === 'clinica' ? DESTINOS_CLINICA : DESTINOS_HOSPITAL;
  const DESTINOS_CON_CAMA = licencia === 'clinica' ? DESTINOS_CON_CAMA_CLINICA : DESTINOS_CON_CAMA_HOSPITAL;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/doctor')} className="btn btn-ghost btn-sm"><ArrowLeft size={18} /></button>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>{paciente.nombre}</h2>
            <p style={{ fontSize: '13px', color: '#6B7280' }}>{paciente.edad} años · {paciente.especialidad} · Nivel {paciente.nivel_prioridad}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {DESTINOS.map(dest => (
            <button key={dest.key} onClick={() => finalizarAtencion(dest.key)} className={`btn btn-sm ${dest.key === 'ALTA' ? 'btn-secondary' : 'btn-primary'}`}>
              {dest.icon} {dest.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
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

      {/* Contenido según pestaña */}
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
          <h3 className="section-title">Historia clínica</h3>
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
          <h3 className="section-title">Diagnóstico CIE-10</h3>
          <BuscadorCIE10 onSelect={agregarDiagnostico} />
          {diagnosticos.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h4 className="label">Diagnósticos seleccionados</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {diagnosticos.map((diag, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#F9FAFB', borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px' }}>{diag.descripcion}</span>
                    <span style={{ fontWeight: 600, color: '#3B82F6' }}>{diag.codigo}</span>
                  </div>
                ))}
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
            <div className="empty-state"><div className="empty-state-icon">📄</div><p className="empty-state-text">No hay nota generada. Pulsa "Generar nota con IA" para crearla automáticamente.</p></div>
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
            {ultimaIndicacion && <button onClick={usarUltimaIndicacion} className="btn btn-ghost btn-sm" title="Usar última indicación"><RotateCcw size={14} /> Reutilizar última</button>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div><label className="label">Medicamento / Instrucción *</label><input type="text" value={nuevaIndicacion.medicamento} onChange={(e) => setNuevaIndicacion(prev => ({ ...prev, medicamento: e.target.value }))} placeholder="Ej: Paracetamol" className="input-modern" /></div>
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
                    <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{ind.autor || 'Médico'} · {ind.timestamp?.toDate ? ind.timestamp.toDate().toLocaleString('es-MX') : ''}</p>
                  </div>
                  <button onClick={() => toggleEstadoIndicacion(ind)} className={`btn btn-sm ${ind.estado === 'abierta' ? 'btn-secondary' : 'btn-primary'}`} title={ind.estado === 'abierta' ? 'Cerrar indicación' : 'Reabrir indicación'}>{ind.estado === 'abierta' ? <CheckCircle2 size={14} /> : <RotateCcw size={14} />}{ind.estado === 'abierta' ? 'Cerrar' : 'Reabrir'}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'estudios' && (
        <div className="card">
          <h3 className="section-title">🧪 Estudios y Referencias</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div><label className="label">Tipo</label><select value={nuevoEstudio.tipo} onChange={(e) => setNuevoEstudio(prev => ({ ...prev, tipo: e.target.value }))} className="input-modern"><option value="laboratorio">🧫 Laboratorio</option><option value="gabinete">🩻 Gabinete</option><option value="interconsulta">👨‍⚕️ Interconsulta</option><option value="referencia">🚑 Referencia</option></select></div>
            <div><label className="label">Prioridad</label><select value={nuevoEstudio.prioridad} onChange={(e) => setNuevoEstudio(prev => ({ ...prev, prioridad: e.target.value }))} className="input-modern"><option value="normal">Normal</option><option value="urgente">Urgente</option></select></div>
            <div style={{ gridColumn: '1 / -1' }}><label className="label">Descripción</label><input type="text" value={nuevoEstudio.descripcion} onChange={(e) => setNuevoEstudio(prev => ({ ...prev, descripcion: e.target.value }))} placeholder="Ej: Hemograma completo, Rx de tórax..." className="input-modern" /></div>
          </div>
          <button onClick={agregarEstudio} disabled={guardandoEstudio} className="btn btn-primary" style={{ marginBottom: '16px' }}>{guardandoEstudio ? 'Guardando...' : '➕ Solicitar estudio'}</button>
          {estudios.length === 0 ? <div className="empty-state"><div className="empty-state-icon">🧪</div><p className="empty-state-text">No hay estudios solicitados</p></div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {estudios.map(est => (
                <div key={est.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <div style={{ fontSize: '20px', flexShrink: 0 }}>{est.tipo === 'laboratorio' ? '🧫' : est.tipo === 'gabinete' ? '🩻' : est.tipo === 'interconsulta' ? '👨‍⚕️' : '🚑'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}><span style={{ fontWeight: 600, fontSize: '14px' }}>{est.descripcion}</span>{est.prioridad === 'urgente' && <span className="badge" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>⚡ Urgente</span>}</div>
                    <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{est.tipo} · {est.estado} · {est.autor || 'Médico'} · {est.timestamp?.toDate ? est.timestamp.toDate().toLocaleString('es-MX') : ''}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {est.estado === 'solicitado' && <button onClick={() => cambiarEstadoEstudio(est, 'realizado')} className="btn btn-sm btn-secondary">✓ Realizado</button>}
                    {est.estado === 'realizado' && <button onClick={() => cambiarEstadoEstudio(est, 'entregado')} className="btn btn-sm btn-primary">📤 Entregado</button>}
                    {est.estado !== 'cancelado' && <button onClick={() => cambiarEstadoEstudio(est, 'cancelado')} className="btn btn-sm btn-danger">Cancelar</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'seguimiento' && (
        <div className="card">
          <h3 className="section-title">📈 Seguimiento y Evolución</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div><label className="label">T/A</label><input type="text" value={nuevoSeguimiento.vitales.ta} onChange={(e) => setNuevoSeguimiento(prev => ({ ...prev, vitales: { ...prev.vitales, ta: e.target.value } }))} placeholder="120/80" className="input-modern" /></div>
            <div><label className="label">Temp (°C)</label><input type="number" value={nuevoSeguimiento.vitales.temp} onChange={(e) => setNuevoSeguimiento(prev => ({ ...prev, vitales: { ...prev.vitales, temp: e.target.value } }))} placeholder="36.5" className="input-modern" /></div>
            <div><label className="label">FC (lpm)</label><input type="number" value={nuevoSeguimiento.vitales.fc} onChange={(e) => setNuevoSeguimiento(prev => ({ ...prev, vitales: { ...prev.vitales, fc: e.target.value } }))} placeholder="80" className="input-modern" /></div>
            <div><label className="label">SpO₂ (%)</label><input type="number" value={nuevoSeguimiento.vitales.spo2} onChange={(e) => setNuevoSeguimiento(prev => ({ ...prev, vitales: { ...prev.vitales, spo2: e.target.value } }))} placeholder="98" className="input-modern" /></div>
            <div><label className="label">Glucosa</label><input type="number" value={nuevoSeguimiento.vitales.glu} onChange={(e) => setNuevoSeguimiento(prev => ({ ...prev, vitales: { ...prev.vitales, glu: e.target.value } }))} placeholder="90" className="input-modern" /></div>
            <div style={{ gridColumn: '1 / -1' }}><label className="label">Nota de evolución</label><textarea value={nuevoSeguimiento.nota} onChange={(e) => setNuevoSeguimiento(prev => ({ ...prev, nota: e.target.value }))} rows={2} placeholder="Describe la evolución del paciente..." className="input-modern" /></div>
          </div>
          <button onClick={agregarSeguimiento} disabled={guardandoSeguimiento} className="btn btn-primary" style={{ marginBottom: '16px' }}>{guardandoSeguimiento ? 'Guardando...' : '➕ Registrar seguimiento'}</button>
          {seguimientos.length === 0 ? <div className="empty-state"><div className="empty-state-icon">📈</div><p className="empty-state-text">No hay seguimiento registrado</p></div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {seguimientos.map(seg => (
                <div key={seg.id} style={{ padding: '12px 16px', backgroundColor: '#F9FAFB', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span style={{ fontSize: '12px', fontWeight: 600, color: '#3B82F6' }}>{seg.autor || 'Médico'}</span><span style={{ fontSize: '11px', color: '#9CA3AF' }}>{seg.timestamp?.toDate ? seg.timestamp.toDate().toLocaleString('es-MX') : ''}</span></div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                    {seg.vitales?.ta && <span className="badge" style={{ backgroundColor: '#FFF' }}>T/A: {seg.vitales.ta}</span>}
                    {seg.vitales?.temp && <span className="badge" style={{ backgroundColor: '#FFF' }}>Temp: {seg.vitales.temp}°C</span>}
                    {seg.vitales?.fc && <span className="badge" style={{ backgroundColor: '#FFF' }}>FC: {seg.vitales.fc}</span>}
                    {seg.vitales?.spo2 && <span className="badge" style={{ backgroundColor: '#FFF' }}>SpO₂: {seg.vitales.spo2}%</span>}
                    {seg.vitales?.glu && <span className="badge" style={{ backgroundColor: '#FFF' }}>Glucosa: {seg.vitales.glu}</span>}
                  </div>
                  {seg.nota && <p style={{ fontSize: '13px', color: '#1F2937' }}>{seg.nota}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de camas */}
      <ModalCamas
        open={mostrarModalCamas}
        onClose={() => setMostrarModalCamas(false)}
        pacienteId={pacienteId}
        area={destinoSeleccionado}
        onAsignar={(cama) => {
          setCamaAsignada(cama);
          setMostrarModalCamas(false);
          confirmarDestino();
        }}
      />
    </div>
  );
}