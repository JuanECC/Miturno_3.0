import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { Stethoscope, Search, Clock, CheckCircle, ArrowRight, X, Activity, Filter } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';
import { archivarPaciente } from '../services/firestoreService';
import ModalCamas from '../components/ModalCamas';

const TIEMPOS_MAX = { 1: 0, 2: 10, 3: 30, 4: 60, 5: 120 };
const ESPECIALIDADES = ['', 'Medicina General', 'Traumatología', 'Cardiología', 'Pediatría', 'Ginecología'];

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

export default function Doctor() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [pacientes, setPacientes] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [espFilter, setEspFilter] = useState('');
  const [nivelFilter, setNivelFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [pasoModal, setPasoModal] = useState(1);
  const [pacienteModal, setPacienteModal] = useState(null);
  const [destino, setDestino] = useState('');
  const [cie10, setCie10] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [doctorNombre, setDoctorNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [ahora, setAhora] = useState(Date.now());
  const [consultaInicio, setConsultaInicio] = useState(null);
  const [consultaFinalizada, setConsultaFinalizada] = useState(false);
  const [nuevosVitales, setNuevosVitales] = useState({});
  const [alarmasChecklist, setAlarmasChecklist] = useState({});
  const [camaAsignada, setCamaAsignada] = useState('');
  const [licencia, setLicencia] = useState('hospital');
  const [soloCriticos, setSoloCriticos] = useState(false);
  const [soloMios, setSoloMios] = useState(false);
  const [citasDelDia, setCitasDelDia] = useState([]);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [mostrarModalCamas, setMostrarModalCamas] = useState(false);
  const [camaArea, setCamaArea] = useState('');
  const [pendienteConfirmacion, setPendienteConfirmacion] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracion', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.licencia) { setLicencia(data.licencia); if (data.licencia === 'clinica') setSoloMios(true); }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const hoy = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'citas'), where('fecha', '==', hoy), where('estado', 'in', ['pendiente', 'en_sala']));
    const unsub = onSnapshot(q, (snap) => { const citas = snap.docs.map(d => ({ id: d.id, ...d.data() })); citas.sort((a, b) => (a.hora || '').localeCompare(b.hora || '')); setCitasDelDia(citas); });
    return () => unsub();
  }, []);

  useEffect(() => { const timer = setInterval(() => setAhora(Date.now()), 30000); return () => clearInterval(timer); }, []);

  useEffect(() => {
    const q = query(collection(db, 'pacientes'), where('estado', 'in', ['espera', 'en consulta']));
    return onSnapshot(q, (snap) => setPacientes(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const DESTINOS = licencia === 'clinica' ? DESTINOS_CLINICA : DESTINOS_HOSPITAL;
  const DESTINOS_CON_CAMA = licencia === 'clinica' ? DESTINOS_CON_CAMA_CLINICA : DESTINOS_CON_CAMA_HOSPITAL;

  const pacientesFiltrados = pacientes
    .filter(p => !buscar || p.nombre?.toLowerCase().includes(buscar.toLowerCase()) || p.motivo?.toLowerCase().includes(buscar.toLowerCase()))
    .filter(p => !espFilter || p.especialidad === espFilter)
    .filter(p => !nivelFilter || p.nivel_prioridad <= parseInt(nivelFilter))
    .filter(p => !soloCriticos || p.nivel_prioridad <= 2)
    .filter(p => { if (!soloMios) return true; const nombreDoctor = user?.nombre || user?.email || ''; if (licencia === 'clinica') return p.doctor_asignado === nombreDoctor; return p.atendido_por === nombreDoctor; })
    .filter(p => { if (licencia !== 'clinica') return true; const nombreDoctor = user?.nombre || user?.email || ''; return p.doctor_asignado === nombreDoctor; })
    .sort((a, b) => a.nivel_prioridad - b.nivel_prioridad || (a.fecha_ingreso?.seconds || 0) - (b.fecha_ingreso?.seconds || 0));

  const criticos = pacientes.filter(p => p.nivel_prioridad <= 2).length;
  const esperaPromedio = pacientes.length > 0 ? Math.round(pacientes.reduce((s, p) => { const min = p.fecha_ingreso?.seconds ? Math.floor((ahora - p.fecha_ingreso.seconds * 1000) / 60000) : 0; return s + min; }, 0) / pacientes.length) : 0;
  const getMinutos = (p) => p.fecha_ingreso?.seconds ? Math.floor((ahora - p.fecha_ingreso.seconds * 1000) / 60000) : 0;

  const timerClass = (nivel, minutos) => { const max = TIEMPOS_MAX[nivel] ?? 120; if (max === 0 || minutos > max * 1.5) return { color: '#DC2626', fontWeight: 700 }; if (minutos > max * 0.8) return { color: '#EA580C', fontWeight: 500 }; return { color: '#16A34A', fontWeight: 400 }; };
  const coloresNivel = ['', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb'];
  const fondosNivel = ['', '#fef2f2', '#fff7ed', '#fefce8', '#f0fdf4', '#eff4ff'];

  const cerrarModal = async () => {
    if (!consultaFinalizada && pacienteModal) { try { await updateDoc(doc(db, 'pacientes', pacienteModal.id), { estado: 'espera', consulta_inicio: null, atendido_por: null }); } catch (err) { console.error('Error al revertir consulta:', err); } }
    setModalOpen(false); setPacienteModal(null); setConsultaFinalizada(false); setPendienteConfirmacion(false);
  };

  const atenderPaciente = async (paciente) => {
    setPacienteModal(paciente); setDestino(''); setCie10(''); setDiagnostico(''); setObservaciones('');
    setDoctorNombre(user?.nombre || user?.email || ''); setPasoModal(1); setConsultaInicio(Date.now());
    setConsultaFinalizada(false); setNuevosVitales({}); setAlarmasChecklist({}); setCamaAsignada(''); setModalOpen(true); setPendienteConfirmacion(false);
    try { await updateDoc(doc(db, 'pacientes', paciente.id), { estado: 'en consulta', consulta_inicio: serverTimestamp(), atendido_por: user?.nombre || user?.email || 'Médico' }); } catch (err) { console.error('Error al iniciar consulta:', err); }
  };

  const llamarYAtender = async () => {
    const siguiente = pacientesFiltrados.filter(p => p.estado === 'espera')[0];
    if (!siguiente) return;
    try { await addDoc(collection(db, 'llamados'), { paciente: siguiente.nombre, nivel: siguiente.nivel_prioridad, consultorio: user?.nombre || user?.email || 'Consultorio', timestamp: serverTimestamp(), activo: true }); addToast(`📢 Llamando a ${siguiente.nombre}`, 'info', 3000, 'Paciente llamado'); atenderPaciente(siguiente); } catch (err) { console.error('Error:', err); }
  };

  const confirmarAtencion = async () => {
    if (!destino) { addToast('Selecciona un destino para el paciente', 'warning', 3000, 'Destino requerido'); return; }

    // Si el destino requiere cama y no tiene asignada, mostrar modal
    if (DESTINOS_CON_CAMA.includes(destino) && !camaAsignada && !pendienteConfirmacion) {
      setCamaArea(destino); setMostrarModalCamas(true); return;
    }
    if (DESTINOS_CON_CAMA.includes(destino) && !camaAsignada.trim()) { addToast('Asigna una cama para este destino', 'warning', 3000, 'Cama requerida'); return; }

    setGuardando(true);
    try {
      // 🆕 Liberar cama anterior si el paciente cambia de área
      if (pacienteModal.cama_asignada && DESTINOS_CON_CAMA.includes(destino)) {
        const camaAnteriorId = pacienteModal.cama_asignada;
        // Verificar si la cama anterior es de otra área
        if (!camaAsignada || camaAnteriorId !== camaAsignada) {
          try {
            await updateDoc(doc(db, 'camas', camaAnteriorId), { ocupada: false, paciente_id: null });
            console.log('🛏️ Cama anterior liberada:', camaAnteriorId);
          } catch (err) { console.error('Error al liberar cama anterior:', err); }
        }
      }

      // Liberar cama si va a ALTA o TRASLADO
      if (pacienteModal.cama_asignada && (destino === 'ALTA' || destino === 'TRASLADO')) {
        try { await updateDoc(doc(db, 'camas', pacienteModal.cama_asignada), { ocupada: false, paciente_id: null }); console.log('🛏️ Cama liberada:', pacienteModal.cama_asignada); } catch (err) { console.error('Error al liberar cama:', err); }
      }

      const update = { estado: destino === 'ALTA' ? 'alta' : destino.toLowerCase(), ubicacion_actual: destino, fecha_atencion: serverTimestamp(), consulta_fin: serverTimestamp() };
      if (observaciones) update.diagnostico_observaciones = observaciones;
      if (doctorNombre) update.atendido_por = doctorNombre;
      if (cie10) update.diagnostico_cie10 = cie10;
      if (diagnostico) update.diagnostico_descripcion = diagnostico;
      if (destino === 'ALTA') update.fecha_alta = serverTimestamp();
      if (camaAsignada.trim()) update.cama_asignada = camaAsignada.trim();

      await updateDoc(doc(db, 'pacientes', pacienteModal.id), update);

      if (destino === 'ALTA') {
        const pacienteCompleto = { ...pacienteModal, diagnostico_cie10: cie10, diagnostico_descripcion: diagnostico, diagnostico_observaciones: observaciones, atendido_por: doctorNombre, ubicacion_actual: destino, origen: pacienteModal.origen || 'manual', cita_id: pacienteModal.cita_id || null };
        console.log('📋 [Doctor] Archivando paciente:', { nombre: pacienteCompleto.nombre, origen: pacienteCompleto.origen, cita_id: pacienteCompleto.cita_id });
        const archivado = await archivarPaciente(pacienteCompleto);
        if (archivado) { addToast(`${pacienteModal.nombre} archivado en historial`, 'success', 3000, '📋 Historial'); if (pacienteCompleto.origen === 'cita' && pacienteCompleto.cita_id) addToast('Cita marcada como completada ✅', 'success', 3000, '📅 Cita completada'); }
      }

      setConsultaFinalizada(true); setModalOpen(false); setPendienteConfirmacion(false);
      addToast(`Atención de ${pacienteModal.nombre} finalizada`, 'success', 4000, '✅ Completada');
    } catch (err) { console.error('Error al guardar:', err); addToast('Error al guardar', 'error', 4000, 'Error'); } finally { setGuardando(false); }
  };

  const tiempoConsulta = consultaInicio ? Math.floor((Date.now() - consultaInicio) / 60000) : 0;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div><h1 className="page-title">Consultorio médico</h1><p className="page-subtitle">Pacientes en espera y en consulta{licencia === 'clinica' ? ' · Modo Clínica' : ''}</p></div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}><div className="kpi-value" style={{ fontSize: '22px' }}>{pacientesFiltrados.length}</div><div className="kpi-label">En espera/consulta</div></div>
          <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}><div className="kpi-value" style={{ fontSize: '22px', color: '#DC2626' }}>{criticos}</div><div className="kpi-label">Críticos</div></div>
          <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}><div className="kpi-value" style={{ fontSize: '22px' }}>{esperaPromedio} min</div><div className="kpi-label">Espera prom.</div></div>
        </div>
      </div>

      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '180px' }}><label className="label">Buscar paciente</label><input type="text" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Nombre o motivo..." className="input-modern" /></div>
          <div style={{ minWidth: '160px' }}><label className="label">Especialidad</label><select value={espFilter} onChange={e => setEspFilter(e.target.value)} className="input-modern"><option value="">Todas</option>{ESPECIALIDADES.filter(e => e).map(e => <option key={e}>{e}</option>)}</select></div>
          <div style={{ minWidth: '160px' }}><label className="label">Nivel máximo</label><select value={nivelFilter} onChange={e => setNivelFilter(e.target.value)} className="input-modern"><option value="">Todos</option><option value="1">N1 — Resucitación</option><option value="2">N2 — Emergencia</option><option value="3">N3 — Urgencia</option></select></div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setSoloCriticos(!soloCriticos)} className={`btn btn-sm ${soloCriticos ? 'btn-primary' : 'btn-secondary'}`} title="Solo críticos"><Activity size={14} /> 🔴 Críticos</button>
            <button onClick={() => setSoloMios(!soloMios)} className={`btn btn-sm ${soloMios ? 'btn-primary' : 'btn-secondary'}`} title="Solo mis pacientes"><Filter size={14} /> 👤 Míos</button>
            <button onClick={() => setMostrarCalendario(!mostrarCalendario)} className={`btn btn-sm ${mostrarCalendario ? 'btn-primary' : 'btn-secondary'}`} title="Calendario de citas">📅 Citas ({citasDelDia.length})</button>
          </div>
        </div>
      </div>

      {mostrarCalendario && (
        <div className="card" style={{ padding: '20px', border: '2px solid #BFDBFE', backgroundColor: '#F8FAFC' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}><h3 className="section-title" style={{ marginBottom: 0 }}>📅 Mis citas del día · {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</h3><button onClick={() => setMostrarCalendario(false)} className="btn btn-ghost btn-sm">✕</button></div>
          {citasDelDia.length === 0 ? <div className="empty-state" style={{ padding: '20px 0', minHeight: '60px' }}><p className="empty-state-text">No hay citas programadas para hoy</p></div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{citasDelDia.map(cita => (<div key={cita.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', backgroundColor: cita.estado === 'en_sala' ? '#F0FDF4' : '#FFF7ED', border: `1.5px solid ${cita.estado === 'en_sala' ? '#BBF7D0' : '#FED7AA'}` }}><div style={{ fontSize: '20px' }}>{cita.estado === 'en_sala' ? '🟢' : '⏳'}</div><div style={{ flex: 1 }}><span style={{ fontWeight: 600, fontSize: '14px' }}>{cita.nombre}</span><span style={{ fontSize: '12px', color: '#6B7280', marginLeft: '8px' }}>{cita.especialidad} · {cita.motivo}</span></div><span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', fontSize: '13px', fontWeight: 600 }}>🕐 {cita.hora}</span></div>))}</div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
        {pacientesFiltrados.length === 0 ? <div className="empty-state"><div className="empty-state-icon">🩺</div><p className="empty-state-text">{pacientes.length === 0 ? 'No hay pacientes' : 'Sin resultados'}</p></div> : (
          pacientesFiltrados.slice(0, 50).map((p, i) => {
            const minutos = getMinutos(p); const v = p.vitales || {}; const n = Math.min((p.nivel_prioridad || 5), 5);
            const enConsulta = p.estado === 'en consulta'; const esSiguiente = i === 0 && !enConsulta; const tClass = timerClass(p.nivel_prioridad, minutos);
            return (
              <div key={p.id} className="card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderColor: enConsulta ? '#FED7AA' : (esSiguiente ? '#BFDBFE' : '#E5E7EB'), backgroundColor: enConsulta ? '#FFF7ED' : (esSiguiente ? '#F8FAFC' : '#FFFFFF') }}>
                <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: 0, alignItems: 'center' }}><div style={{ width: '4px', height: '50px', borderRadius: '2px', flexShrink: 0, backgroundColor: coloresNivel[n] }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      {enConsulta && <span className="badge" style={{ backgroundColor: '#FFF7ED', color: '#EA580C', fontWeight: 600, fontSize: '10px' }}>🩺 En consulta</span>}
                      {!enConsulta && esSiguiente && <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6', fontWeight: 600, fontSize: '10px' }}>→ Siguiente</span>}
                      <span style={{ fontWeight: 600, fontSize: '15px' }}>{p.nombre}</span>
                      <span className="badge" style={{ backgroundColor: fondosNivel[n], color: coloresNivel[n], border: `1px solid ${coloresNivel[n]}` }}>N{p.nivel_prioridad}</span>
                      {!enConsulta && <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: tClass.fontWeight, color: tClass.color }}>⏱ {minutos} min</span>}
                      {licencia === 'clinica' && p.numero_turno && <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6', fontSize: '10px' }}>🔢 T{p.numero_turno}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}><span style={{ fontSize: '13px', color: '#6B7280' }}>{p.edad} años · {p.especialidad}</span>{p.signosAlarma?.length > 0 && <span style={{ fontSize: '11px', color: '#DC2626', fontWeight: 500 }}>⚠ {p.signosAlarma.join(' · ')}</span>}<span style={{ fontSize: '13px', color: '#1F2937' }}><strong>Motivo:</strong> {p.motivo}</span></div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>{v.ta && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', fontSize: '11px' }}>T/A: {v.ta}</span>}{v.temp && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', fontSize: '11px' }}>Temp: {v.temp}°C</span>}{v.fc && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', fontSize: '11px' }}>FC: {v.fc}</span>}{v.spo2 && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', fontSize: '11px' }}>SpO₂: {v.spo2}%</span>}</div>
                  </div>
                </div>
                <button onClick={() => atenderPaciente(p)} className={`btn ${enConsulta ? 'btn-primary' : (esSiguiente ? 'btn-primary' : 'btn-secondary')}`} style={{ flexShrink: 0 }}>{enConsulta ? 'Continuar atención' : (esSiguiente ? 'Atender ahora' : 'Atender')}</button>
              </div>
            );
          })
        )}
      </div>

      {pacientesFiltrados.filter(p => p.estado === 'espera').length > 0 && (
        <button onClick={llamarYAtender} className="btn btn-primary btn-lg" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 40, boxShadow: '0 4px 20px rgba(59,130,246,0.3)' }}>📢 Llamar y atender · {pacientesFiltrados.filter(p => p.estado === 'espera')[0]?.nombre?.split(' ')[0]}</button>
      )}

      {modalOpen && pacienteModal && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal-box" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}><div><h2 style={{ fontSize: '18px', fontWeight: 600 }}>{pacienteModal.nombre}</h2><p style={{ fontSize: '13px', color: '#6B7280' }}>{pacienteModal.edad} años · {pacienteModal.especialidad}</p></div><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6B7280', fontSize: '13px' }}><Clock size={14} /><span>{tiempoConsulta} min</span></div><button onClick={cerrarModal} className="btn btn-ghost btn-sm" style={{ width: '32px', height: '32px', padding: 0 }}><X size={18} /></button></div></div>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>{['Evaluación', 'Diagnóstico', 'Destino'].map((label, idx) => (<button key={idx} onClick={() => setPasoModal(idx + 1)} style={{ flex: 1, padding: '8px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: pasoModal === idx + 1 ? '#3B82F6' : pasoModal > idx + 1 ? '#DBEAFE' : '#F3F4F6', color: pasoModal === idx + 1 ? '#FFF' : pasoModal > idx + 1 ? '#3B82F6' : '#9CA3AF' }}>{idx + 1}. {label}{pasoModal > idx + 1 ? ' ✓' : ''}</button>))}</div>
            </div>
            <div className="modal-body" style={{ padding: '20px 24px' }}>
              {pasoModal === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="card" style={{ padding: '16px', background: '#F9FAFB', boxShadow: 'none' }}><p className="label">Motivo de consulta</p><p style={{ fontSize: '15px', fontWeight: 500 }}>{pacienteModal.motivo}</p>{pacienteModal.antecedentes && <><p className="label" style={{ marginTop: '12px' }}>Antecedentes</p><p style={{ fontSize: '14px', color: '#6B7280' }}>{pacienteModal.antecedentes}</p></>}</div>
                  <div><p className="label">Actualizar signos vitales</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>{[{ id: 'ta', label: 'T/A (mmHg)', ph: pacienteModal.vitales?.ta || '120/80' },{ id: 'temp', label: 'Temp (°C)', ph: pacienteModal.vitales?.temp || '36.5' },{ id: 'fc', label: 'FC (lpm)', ph: pacienteModal.vitales?.fc || '80' },{ id: 'spo2', label: 'SpO₂ (%)', ph: pacienteModal.vitales?.spo2 || '98' },{ id: 'glu', label: 'Glucosa (mg/dL)', ph: pacienteModal.vitales?.glu || '90' }].map(v => (<div key={v.id}><label className="label" style={{ fontSize: '11px' }}>{v.label}</label><input type="text" placeholder={v.ph} value={nuevosVitales[v.id] || ''} onChange={e => setNuevosVitales(prev => ({ ...prev, [v.id]: e.target.value }))} className="input-modern" style={{ height: '40px', fontSize: '13px' }} /></div>))}</div></div>
                  {pacienteModal.signosAlarma?.length > 0 && (<div><p className="label" style={{ color: '#DC2626' }}>⚠️ Verificar signos de alarma</p><div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>{pacienteModal.signosAlarma.map(alarma => (<label key={alarma} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', background: alarmasChecklist[alarma] ? '#FEF2F2' : '#F9FAFB', border: `1px solid ${alarmasChecklist[alarma] ? '#FECACA' : '#E5E7EB'}`, fontSize: '13px' }}><input type="checkbox" checked={!!alarmasChecklist[alarma]} onChange={e => setAlarmasChecklist(prev => ({ ...prev, [alarma]: e.target.checked }))} style={{ accentColor: '#DC2626' }} />{alarma}</label>))}</div></div>)}
                  <button onClick={() => setPasoModal(2)} className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>Siguiente: Diagnóstico <ArrowRight size={16} /></button>
                </div>
              )}
              {pasoModal === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div><label className="label">Diagnóstico principal</label><textarea value={diagnostico} onChange={e => setDiagnostico(e.target.value)} rows={2} placeholder="Describa el diagnóstico clínico..." className="input-modern" /></div>
                  <div><label className="label">Código CIE-10</label><input type="text" value={cie10} onChange={e => setCie10(e.target.value.toUpperCase())} placeholder="Ej: J06.9" className="input-modern" style={{ textTransform: 'uppercase' }} maxLength={10} /></div>
                  <div><label className="label">Observaciones / Tratamiento</label><textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} placeholder="Medicación, indicaciones, seguimiento..." className="input-modern" /></div>
                  <div><label className="label">Médico que atiende</label><input type="text" value={doctorNombre} onChange={e => setDoctorNombre(e.target.value)} placeholder="Dr. / Dra." className="input-modern" style={{ backgroundColor: '#F9FAFB' }} /></div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}><button onClick={() => setPasoModal(1)} className="btn btn-secondary">← Volver</button><button onClick={() => setPasoModal(3)} className="btn btn-primary">Siguiente: Destino <ArrowRight size={16} /></button></div>
                </div>
              )}
              {pasoModal === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <p className="label">Seleccionar destino del paciente</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>{DESTINOS.map(d => (<button key={d.key} onClick={() => { setDestino(d.key); if (!DESTINOS_CON_CAMA.includes(d.key)) setCamaAsignada(''); }} style={{ padding: '16px', borderRadius: '14px', border: '2px solid', textAlign: 'left', cursor: 'pointer', background: destino === d.key ? '#F9FAFB' : '#FFF', borderColor: destino === d.key ? d.color : '#E5E7EB', display: 'flex', alignItems: 'center', gap: '12px' }}><span style={{ fontSize: '24px' }}>{d.icon}</span><div><div style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937' }}>{d.label}</div><div style={{ fontSize: '11px', color: '#9CA3AF' }}>{d.desc}</div></div>{destino === d.key && <CheckCircle size={18} style={{ color: d.color, marginLeft: 'auto' }} />}</button>))}</div>
                  {DESTINOS_CON_CAMA.includes(destino) && camaAsignada && (<div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: '13px', color: '#16A34A' }}>🛏️ Cama asignada: <strong>{camaAsignada}</strong></div>)}
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}><button onClick={() => setPasoModal(2)} className="btn btn-secondary">← Volver</button><button onClick={confirmarAtencion} disabled={!destino || guardando} className="btn btn-primary btn-lg">{guardando ? 'Guardando...' : '✅ Finalizar atención'}</button></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ModalCamas 
        open={mostrarModalCamas} 
        onClose={() => { setMostrarModalCamas(false); setPendienteConfirmacion(false); }}
        pacienteId={pacienteModal?.id}
        area={camaArea}
        onAsignar={(cama) => {
          setCamaAsignada(cama);
          setMostrarModalCamas(false);
          setPendienteConfirmacion(true);
          addToast(`Cama ${cama} asignada en ${camaArea}`, 'success', 3000, '🛏️ Cama asignada');
          setTimeout(() => confirmarAtencion(), 500);
        }}
      />
    </div>
  );
}