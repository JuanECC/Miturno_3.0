import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, getDocs, doc, updateDoc } from 'firebase/firestore';
import { calcularTriage, camposPorEspecialidad, NIVEL_INFO } from '../utils/triage';
import { Activity, SlidersHorizontal, Calendar, Clock, XCircle, UserPlus } from 'lucide-react';
import { useToast } from '../components/Toast';
import { sugerirTriageIA } from '../services/iaService';
import Mito from '../components/Mito';

const ESPECIALIDADES = ['Medicina General', 'Ginecología', 'Pediatría', 'Cardiología', 'Traumatología', 'Neurología'];

const RANGOS_VITALES = {
  ta: {
    normal: (v) => { const s = parseInt(v?.split('/')[0]); return s >= 90 && s <= 140; },
    alerta: (v) => { const s = parseInt(v?.split('/')[0]); return (s >= 80 && s < 90) || (s > 140 && s <= 160); },
    critico: (v) => { const s = parseInt(v?.split('/')[0]); return s < 80 || s > 160 || !v; },
  },
  temp: { normal: (v) => v >= 36.0 && v <= 37.5, alerta: (v) => (v >= 35.0 && v < 36.0) || (v > 37.5 && v <= 39.0), critico: (v) => v < 35.0 || v > 39.0 },
  fc: { normal: (v) => v >= 60 && v <= 100, alerta: (v) => (v >= 50 && v < 60) || (v > 100 && v <= 130), critico: (v) => v < 50 || v > 130 },
  spo2: { normal: (v) => v >= 96, alerta: (v) => v >= 90 && v < 96, critico: (v) => v < 90 },
  glu: { normal: (v) => v >= 70 && v <= 130, alerta: (v) => (v >= 54 && v < 70) || (v > 130 && v <= 300), critico: (v) => v < 54 || v > 300 },
};

const getVitalStatus = (tipo, valor) => {
  const rangos = RANGOS_VITALES[tipo];
  if (!rangos || !valor || valor === '') return 'neutral';
  const v = parseFloat(valor);
  if (isNaN(v) && tipo !== 'ta') return 'neutral';
  const val = tipo === 'ta' ? valor : v;
  if (rangos.critico(val)) return 'critico';
  if (rangos.alerta(val)) return 'alerta';
  if (rangos.normal(val)) return 'normal';
  return 'neutral';
};

const VITAL_COLORS = {
  neutral: { border: '#E5E7EB', bg: '#F9FAFB', indicator: '#D1D5DB' },
  normal: { border: '#16A34A', bg: '#F0FDF4', indicator: '#16A34A' },
  alerta: { border: '#EA580C', bg: '#FFF7ED', indicator: '#EA580C' },
  critico: { border: '#DC2626', bg: '#FEF2F2', indicator: '#DC2626' },
};

const ESCALA_DOLOR = [
  { valor: 0, label: 'Sin dolor', emoji: '😊', color: '#16A34A' },
  { valor: 2, label: 'Leve', emoji: '🙂', color: '#65A30D' },
  { valor: 4, label: 'Moderado', emoji: '😐', color: '#CA8A04' },
  { valor: 6, label: 'Fuerte', emoji: '😟', color: '#EA580C' },
  { valor: 8, label: 'Muy fuerte', emoji: '😫', color: '#DC2626' },
  { valor: 10, label: 'Insoportable', emoji: '😭', color: '#991B1B' },
];

export default function Recepcion() {
  const { addToast } = useToast();
  
  const [form, setForm] = useState({
    nombre: '', edad: '', especialidad: 'Medicina General', motivo: '', antecedentes: '',
    vitales: { ta: '', temp: '', fc: '', spo2: '', glu: '', peso: '' }, signosAlarma: [], escalaDolor: 0,
  });
  const [especialFields, setEspecialFields] = useState(null);
  const [especialValues, setEspecialValues] = useState({});
  const [triageResult, setTriageResult] = useState(null);
  const [pacientesEspera, setPacientesEspera] = useState([]);
  const [registrando, setRegistrando] = useState(false);
  const [slidersActivos, setSlidersActivos] = useState(false);
  const [sugerenciasHistorial, setSugerenciasHistorial] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [iaResult, setIaResult] = useState(null);
  const [consultandoIA, setConsultandoIA] = useState(false);
  const [mitoEstado, setMitoEstado] = useState('dormido');
  const [mitoMensaje, setMitoMensaje] = useState('');
  const [triajeSeleccionado, setTriajeSeleccionado] = useState('manchester');
  const [preferenciaTriaje, setPreferenciaTriaje] = useState('ambos');

  const [licencia, setLicencia] = useState('hospital');
  const [citaProgramada, setCitaProgramada] = useState(false);
  const [citaSeleccionada, setCitaSeleccionada] = useState(null);
  const [citasDelDia, setCitasDelDia] = useState([]);
  const [mostrarPanelCitas, setMostrarPanelCitas] = useState(false);

  // 🆕 Estados para modo clínica
  const [doctores, setDoctores] = useState([]);
  const [doctorSeleccionado, setDoctorSeleccionado] = useState('');
  const [numeroTurno, setNumeroTurno] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracion', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.licencia) setLicencia(data.licencia);
        if (data.triajePreferencia) {
          setPreferenciaTriaje(data.triajePreferencia);
          if (data.triajePreferencia === 'mito') setTriajeSeleccionado('ia');
          else if (data.triajePreferencia === 'manchester') setTriajeSeleccionado('manchester');
          else setTriajeSeleccionado('manchester');
        }
      }
    });
    return () => unsub();
  }, []);

  // 🆕 Cargar doctores (solo modo clínica)
  useEffect(() => {
    if (licencia !== 'clinica') return;
    const q = query(collection(db, 'usuarios'), where('rol', '==', 'doctor'));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDoctores(lista);
    });
    return () => unsub();
  }, [licencia]);

  // 🆕 Calcular número de turno del día
  useEffect(() => {
    if (licencia !== 'clinica' || !doctorSeleccionado) { setNumeroTurno(null); return; }
    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const finHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);
    const turnosHoy = pacientesEspera.filter(p => {
      if (!p.fecha_ingreso?.seconds) return false;
      const fecha = new Date(p.fecha_ingreso.seconds * 1000);
      return fecha >= inicioHoy && fecha <= finHoy && p.doctor_asignado === doctorSeleccionado;
    }).length;
    setNumeroTurno(turnosHoy + 1);
  }, [licencia, doctorSeleccionado, pacientesEspera]);

  useEffect(() => {
    const hoy = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'citas'), where('fecha', '==', hoy), where('estado', 'in', ['pendiente', 'en_sala']));
    const unsub = onSnapshot(q, (snap) => {
      const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      citas.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
      setCitasDelDia(citas);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'pacientes'), where('estado', '==', 'espera'));
    return onSnapshot(q, (snap) => setPacientesEspera(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  useEffect(() => { setEspecialFields(camposPorEspecialidad(form.especialidad)); setEspecialValues({}); }, [form.especialidad]);

  useEffect(() => {
    if (!form.nombre && !form.motivo) { setMitoEstado('dormido'); setMitoMensaje(''); return; }
    const datos = { ...form, obs: especialValues, ped: especialValues, cardio: especialValues, trauma: especialValues, neuro: especialValues };
    const resultado = calcularTriage(datos);
    setTriageResult(resultado);
    if (resultado.nivel <= 2) { setMitoEstado('critico'); setMitoMensaje(`¡Nivel ${resultado.nivel}!`); }
    else if (resultado.nivel === 3) { setMitoEstado('normal'); setMitoMensaje(`Nivel ${resultado.nivel}`); }
    else { setMitoEstado('normal'); setMitoMensaje(`Nivel ${resultado.nivel}`); }
  }, [form, especialValues]);

  const toggleAlarma = (a) => setForm(prev => ({ ...prev, signosAlarma: prev.signosAlarma.includes(a) ? prev.signosAlarma.filter(x => x !== a) : [...prev.signosAlarma, a] }));

  const seleccionarCita = (cita) => {
    if (cita.estado === 'en_sala') { addToast('Este paciente ya está en sala de espera', 'warning', 3000, '⏳ Ya registrado'); return; }
    setForm({ nombre: cita.nombre, edad: cita.edad || '', especialidad: cita.especialidad || 'Medicina General', motivo: cita.motivo || 'Cita programada', antecedentes: '', vitales: { ta: '', temp: '', fc: '', spo2: '', glu: '', peso: '' }, signosAlarma: [], escalaDolor: 0 });
    setCitaProgramada(true); setCitaSeleccionada(cita); setTriageResult(null); setIaResult(null); setSugerenciasHistorial([]); setMostrarPanelCitas(false);
    addToast(`Cita de ${cita.nombre} seleccionada · ${cita.hora}`, 'info', 3000, '📅 Cita cargada');
  };

  const deseleccionarCita = () => {
    setCitaProgramada(false); setCitaSeleccionada(null);
    setForm({ nombre: '', edad: '', especialidad: 'Medicina General', motivo: '', antecedentes: '', vitales: { ta: '', temp: '', fc: '', spo2: '', glu: '', peso: '' }, signosAlarma: [], escalaDolor: 0 });
    setTriageResult(null); setIaResult(null);
  };

  const buscarEnHistorial = async (texto) => {
    if (texto.length < 2) { setSugerenciasHistorial([]); setMostrarSugerencias(false); return; }
    try {
      const snap = await getDocs(collection(db, 'historial'));
      const tl = texto.toLowerCase().trim();
      const resultados = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(h => (h.nombre || '').toLowerCase().includes(tl)).slice(0, 5);
      setSugerenciasHistorial(resultados); setMostrarSugerencias(resultados.length > 0);
    } catch (err) { console.error(err); }
  };

  const seleccionarSugerencia = (h) => {
    setForm(prev => ({ ...prev, nombre: h.nombre, edad: h.edad || '' }));
    setMostrarSugerencias(false);
    addToast(`"${h.nombre}" tiene ${h.totalEpisodios} episodio(s) previo(s)`, 'info', 4000, '📋 Historial');
  };

  const pedirSugerenciaIA = async () => {
    if (!form.nombre && !form.motivo) { addToast('Completa nombre y motivo', 'warning', 3000, 'Datos insuficientes'); return; }
    setConsultandoIA(true); setIaResult(null); setMitoEstado('analizando'); setMitoMensaje('Analizando datos del paciente...');
    try {
      const resultado = await sugerirTriageIA({ ...form, obs: especialValues, ped: especialValues, cardio: especialValues, trauma: especialValues, neuro: especialValues });
      setIaResult(resultado); setMitoEstado('exito'); setMitoMensaje(`Sugiero N${resultado.nivel}: ${resultado.nombre}. ${resultado.recomendacion}`);
      addToast('Mito analizó los datos', 'success', 3000, '🤖 Diagnóstico completado');
    } catch (err) { setMitoEstado('normal'); setMitoMensaje('No pude consultar la IA...'); addToast('No se pudo consultar la IA', 'error', 4000, 'Error'); }
    finally { setConsultandoIA(false); }
  };

  const handleRegistrar = async () => {
    if (!form.nombre || !form.motivo) { addToast('Completa los campos obligatorios', 'warning', 3000, 'Campos requeridos'); return; }
    if (licencia === 'clinica' && !citaProgramada && !doctorSeleccionado) { addToast('Selecciona un doctor para el paciente', 'warning', 3000, 'Doctor requerido'); return; }
    if (citaSeleccionada?.estado === 'en_sala') { addToast('Esta cita ya fue registrada en sala de espera', 'error', 4000, '⏳ Duplicado'); return; }

    const requiereTriaje = licencia === 'hospital' || !citaProgramada;
    if (requiereTriaje) {
      const triajeDisponible = preferenciaTriaje === 'mito' ? iaResult : preferenciaTriaje === 'manchester' ? triageResult : (triajeSeleccionado === 'ia' && iaResult) ? iaResult : triageResult;
      if (!triajeDisponible) {
        const mensaje = preferenciaTriaje === 'mito' ? 'Solicita el diagnóstico de Mito (IA) para continuar' : preferenciaTriaje === 'manchester' ? 'Completa los datos para evaluar el triaje Manchester' : 'Completa el triaje (Manchester o Mito) para continuar';
        addToast(mensaje, 'warning', 3000, 'Triaje pendiente'); return;
      }
    }

    let triajeFinal;
    if (!requiereTriaje) { triajeFinal = { nivel: 5, nombre: 'NO URGENTE', tiempo: '≤ 120 min', razones: ['Cita programada'] }; }
    else if (preferenciaTriaje === 'mito') { triajeFinal = iaResult; }
    else if (preferenciaTriaje === 'manchester') { triajeFinal = triageResult; }
    else { triajeFinal = triajeSeleccionado === 'ia' && iaResult ? iaResult : triageResult; }

    setRegistrando(true);
    try {
      if (citaSeleccionada?.id) {
        const pacientesExistentes = pacientesEspera.filter(p => p.cita_id === citaSeleccionada.id);
        if (pacientesExistentes.length > 0) { addToast('Este paciente ya fue registrado desde esta cita', 'warning', 4000, '⏳ Ya en sala'); setRegistrando(false); return; }
      }

      const pacienteData = {
        ...form, obs: especialValues, ped: especialValues, cardio: especialValues, trauma: especialValues, neuro: especialValues,
        nivel_prioridad: triajeFinal.nivel, nombre_nivel: triajeFinal.nombre,
        razon_triage: triajeFinal.razones ? (Array.isArray(triajeFinal.razones) ? triajeFinal.razones.join(' | ') : triajeFinal.razones) : (triajeFinal.razon || ''),
        tiempo_atencion: triajeFinal.tiempo || '', banderas_triage: triageResult?.banderas || [],
        estado: 'espera', ubicacion_actual: 'Sala de espera', fecha_ingreso: serverTimestamp(),
        origen_triaje: citaProgramada ? 'cita' : preferenciaTriaje === 'mito' ? 'ia' : triajeSeleccionado,
      };
      if (citaSeleccionada) { pacienteData.origen = 'cita'; pacienteData.cita_id = citaSeleccionada.id; }
      if (licencia === 'clinica') { pacienteData.doctor_asignado = doctorSeleccionado; pacienteData.numero_turno = numeroTurno; }

      const docRef = await addDoc(collection(db, 'pacientes'), pacienteData);

      if (citaSeleccionada) {
        try { await updateDoc(doc(db, 'citas', citaSeleccionada.id), { estado: 'en_sala', paciente_id: docRef.id }); }
        catch (err) { console.error('Error al actualizar estado de cita:', err); addToast('Paciente registrado pero la cita no se actualizó', 'warning', 4000, '⚠️ Inconsistencia'); }
      }

      if (triajeFinal.nivel <= 2) addToast(`${form.nombre} — Nivel ${triajeFinal.nivel}: ${triajeFinal.nombre}. ¡Notificar al médico!`, 'warning', 8000, '⚠️ ¡Paciente crítico!');
      else if (citaProgramada) addToast(`${form.nombre} registrado desde cita · ${citaSeleccionada?.hora || ''}`, 'success', 4000, '📅 Cita registrada');
      else if (licencia === 'clinica') addToast(`${form.nombre} registrado — Turno #${numeroTurno} · Dr(a). ${doctorSeleccionado}`, 'success', 4000, '✅ Registro exitoso');
      else addToast(`${form.nombre} registrado — Nivel ${triajeFinal.nivel}: ${triajeFinal.nombre}`, 'success', 4000, '✅ Registro exitoso');

      setForm({ nombre: '', edad: '', especialidad: 'Medicina General', motivo: '', antecedentes: '', vitales: { ta: '', temp: '', fc: '', spo2: '', glu: '', peso: '' }, signosAlarma: [], escalaDolor: 0 });
      setTriageResult(null); setEspecialValues({}); setSugerenciasHistorial([]); setIaResult(null);
      setCitaProgramada(false); setCitaSeleccionada(null); setDoctorSeleccionado(''); setNumeroTurno(null);
      if (preferenciaTriaje === 'mito') setTriajeSeleccionado('ia'); else if (preferenciaTriaje === 'manchester') setTriajeSeleccionado('manchester'); else setTriajeSeleccionado('manchester');
      setMitoEstado('exito'); setMitoMensaje('¡Paciente registrado con éxito!');
      setTimeout(() => { setMitoEstado('dormido'); setMitoMensaje(''); }, 4000);
    } catch (err) { console.error(err); addToast('No se pudo registrar al paciente', 'error', 5000, 'Error'); }
    finally { setRegistrando(false); }
  };

  const coloresNivel = ['', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb'];
  const fondosNivel = ['', '#fef2f2', '#fff7ed', '#fefce8', '#f0fdf4', '#eff4ff'];
  const vitalesConfig = [
    { id: 'ta', label: 'T/A (mmHg)', ph: '120/80', minSist: 60, maxSist: 220, step: 1 },
    { id: 'temp', label: 'Temp (°C)', ph: '36.5', min: 30, max: 45, step: 0.1 }, { id: 'fc', label: 'F.C. (lpm)', ph: '80', min: 30, max: 250, step: 1 },
    { id: 'spo2', label: 'SpO₂ (%)', ph: '98', min: 50, max: 100, step: 1 }, { id: 'glu', label: 'Glucosa (mg/dL)', ph: '90', min: 20, max: 600, step: 1 },
    { id: 'peso', label: 'Peso (kg)', ph: '70', min: 0.5, max: 300, step: 0.1 },
  ];
  const handleVitalChange = (id, value) => setForm(prev => ({ ...prev, vitales: { ...prev.vitales, [id]: value } }));
  const handleTASliderChange = (v) => { const s = parseInt(v); const a = form.vitales.ta || '120/80'; const d = a.split('/')[1] || '80'; setForm(prev => ({ ...prev, vitales: { ...prev.vitales, ta: `${s}/${d}` } })); };
  const dolorActual = ESCALA_DOLOR.find(d => d.valor === form.escalaDolor) || ESCALA_DOLOR[0];
  const mostrarTriaje = licencia === 'hospital' || !citaProgramada;
  const mostrarManchester = mostrarTriaje && (preferenciaTriaje === 'manchester' || preferenciaTriaje === 'ambos');
  const mostrarMito = mostrarTriaje && (preferenciaTriaje === 'mito' || preferenciaTriaje === 'ambos');
  const mostrarSelector = preferenciaTriaje === 'ambos' && iaResult && triageResult && mostrarTriaje;
  const citasPendientes = citasDelDia.filter(c => c.estado === 'pendiente');
  const citasEnSala = citasDelDia.filter(c => c.estado === 'en_sala');

  return (
    <div className="page-container">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 className="page-title">Admisión y Triaje</h1>
          <p className="page-subtitle">Clasificación automática · Labor de parto = prioridad absoluta
            {citaSeleccionada && <span style={{ marginLeft: '12px', padding: '4px 10px', borderRadius: '8px', backgroundColor: '#EFF6FF', color: '#3B82F6', fontSize: '12px', fontWeight: 600 }}>📅 Desde cita: {citaSeleccionada.hora}</span>}
          </p>
          {pacientesEspera.filter(p => p.nivel_prioridad <= 2).length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '13px', fontWeight: 500 }}>
              ⚠️ {pacientesEspera.filter(p => p.nivel_prioridad <= 2).length} pacientes críticos en espera
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div className="badge" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', padding: '8px 14px', fontSize: '14px' }}>
            <span style={{ fontWeight: 600, color: '#1F2937' }}>{pacientesEspera.length}</span>
            <span style={{ color: '#6B7280', marginLeft: '4px' }}>en espera</span>
          </div>
          <button onClick={() => setMostrarPanelCitas(!mostrarPanelCitas)} className="badge" style={{ backgroundColor: mostrarPanelCitas ? '#EFF6FF' : '#FFFFFF', border: `1.5px solid ${mostrarPanelCitas ? '#3B82F6' : '#E5E7EB'}`, padding: '8px 14px', fontSize: '14px', cursor: 'pointer', transition: 'all 0.15s ease' }}>
            <Calendar size={14} style={{ marginRight: '6px' }} />
            <span style={{ fontWeight: 600, color: '#1F2937' }}>{citasDelDia.length}</span>
            <span style={{ color: '#6B7280', marginLeft: '4px' }}>citas hoy</span>
            {citasPendientes.length > 0 && <span style={{ marginLeft: '6px', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#FEF3C7', color: '#92400E', fontSize: '11px', fontWeight: 600 }}>{citasPendientes.length} pend.</span>}
          </button>
        </div>
      </div>

      {mostrarPanelCitas && (
        <div className="card" style={{ padding: '20px', border: '2px solid #BFDBFE', backgroundColor: '#F8FAFC' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="section-title" style={{ marginBottom: 0 }}>📅 Citas programadas para hoy · {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            <button onClick={() => setMostrarPanelCitas(false)} className="btn btn-ghost btn-sm"><XCircle size={16} /></button>
          </div>
          {citasDelDia.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0', minHeight: '80px' }}><div className="empty-state-icon">📭</div><p className="empty-state-text">No hay citas programadas para hoy</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {citasDelDia.map(cita => {
                const esSeleccionada = citaSeleccionada?.id === cita.id;
                const enSala = cita.estado === 'en_sala';
                return (
                  <div key={cita.id} onClick={() => !enSala && seleccionarCita(cita)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', border: `2px solid ${esSeleccionada ? '#3B82F6' : enSala ? '#D1D5DB' : '#E5E7EB'}`, backgroundColor: esSeleccionada ? '#EFF6FF' : enSala ? '#F9FAFB' : '#FFFFFF', cursor: enSala ? 'not-allowed' : 'pointer', opacity: enSala ? 0.7 : 1, transition: 'all 0.15s ease' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: enSala ? '#D1FAE5' : esSeleccionada ? '#DBEAFE' : '#FEF3C7', color: enSala ? '#065F46' : esSeleccionada ? '#1E40AF' : '#92400E', fontSize: '16px', flexShrink: 0 }}>{enSala ? '🟢' : esSeleccionada ? '📌' : '⏳'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: '#1F2937' }}>{cita.nombre}</span>
                        <span className="badge" style={{ backgroundColor: enSala ? '#D1FAE5' : '#FEF3C7', color: enSala ? '#065F46' : '#92400E', fontSize: '10px' }}>{enSala ? 'En sala' : 'Pendiente'}</span>
                        {cita.especialidad && <span className="badge" style={{ backgroundColor: '#F3F4F6', color: '#6B7280', fontSize: '10px' }}>{cita.especialidad}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '2px', fontSize: '12px', color: '#9CA3AF' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={11} /> {cita.hora}</span>
                        {cita.edad > 0 && <span>{cita.edad} años</span>}
                        {cita.motivo && <span>{cita.motivo}</span>}
                      </div>
                    </div>
                    {!enSala && <button onClick={(e) => { e.stopPropagation(); seleccionarCita(cita); }} className={`btn btn-sm ${esSeleccionada ? 'btn-primary' : 'btn-secondary'}`} style={{ flexShrink: 0 }}>{esSeleccionada ? 'Seleccionada' : 'Registrar'}</button>}
                    {enSala && <span style={{ fontSize: '12px', color: '#9CA3AF', flexShrink: 0 }}>Ya en sala</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="recepcion-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {citaSeleccionada && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', backgroundColor: '#EFF6FF', border: '1.5px solid #3B82F6', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={16} style={{ color: '#3B82F6' }} /><span style={{ fontWeight: 500, color: '#1F2937' }}>Registrando desde cita: <strong>{citaSeleccionada.nombre}</strong> · {citaSeleccionada.hora}</span></div>
              <button onClick={deseleccionarCita} className="btn btn-ghost btn-sm" style={{ color: '#DC2626' }}><XCircle size={14} style={{ marginRight: '4px' }} />Cancelar cita</button>
            </div>
          )}

          <div className="card">
            <h3 className="section-title">1 · Identificación del paciente</h3>
            <div className="cards-grid-2" style={{ gap: '12px' }}>
              <div style={{ position: 'relative' }}>
                <label className="label">Nombre completo *</label>
                <input type="text" value={form.nombre} onChange={e => { setForm({ ...form, nombre: e.target.value }); buscarEnHistorial(e.target.value); }} onFocus={() => { if (sugerenciasHistorial.length > 0) setMostrarSugerencias(true); }} onBlur={() => setTimeout(() => setMostrarSugerencias(false), 200)} placeholder="Nombre del paciente" className="input-modern" autoFocus />
                {mostrarSugerencias && sugerenciasHistorial.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50, marginTop: '4px', overflow: 'hidden' }}>
                    {sugerenciasHistorial.map(h => (
                      <button key={h.id} onMouseDown={() => seleccionarSugerencia(h)} style={{ width: '100%', padding: '12px 16px', border: 'none', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', textAlign: 'left' }}>
                        <div><p style={{ fontSize: '14px', fontWeight: 500, color: '#1F2937' }}>{h.nombre}</p><p style={{ fontSize: '12px', color: '#9CA3AF' }}>{h.edad} años · {h.totalEpisodios} episodio(s)</p></div>
                        <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>📋 Historial</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div><label className="label">Edad *</label><input type="number" value={form.edad} onChange={e => setForm({ ...form, edad: e.target.value })} placeholder="0" min="0" max="120" className="input-modern" /></div>
              <div><label className="label">Especialidad</label><select value={form.especialidad} onChange={e => setForm({ ...form, especialidad: e.target.value })} className="input-modern">{ESPECIALIDADES.map(e => <option key={e}>{e}</option>)}</select></div>
              
              {/* 🆕 Selector de doctor (solo modo clínica) */}
              {licencia === 'clinica' && (
                <div>
                  <label className="label">Seleccionar doctor *</label>
                  <select value={doctorSeleccionado} onChange={(e) => setDoctorSeleccionado(e.target.value)} className="input-modern">
                    <option value="">— Elegir doctor —</option>
                    {doctores.map(d => <option key={d.id} value={d.nombre || d.email}>👨‍⚕️ {d.nombre || d.email}</option>)}
                  </select>
                  {numeroTurno && <p style={{ fontSize: '12px', color: '#3B82F6', marginTop: '4px', fontWeight: 500 }}>🔢 Turno #{numeroTurno} del día</p>}
                </div>
              )}

              <div><label className="label">Motivo de consulta *</label><input type="text" value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} placeholder="Describa brevemente" className="input-modern" /></div>
            </div>
          </div>

          {especialFields && (
            <div className="card"><h3 className="section-title">{especialFields.titulo}</h3>
              <div className="cards-grid-2" style={{ gap: '12px' }}>
                {especialFields.campos.map(c => c.tipo === 'check' ? (
                  <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '12px', border: '1.5px solid', cursor: 'pointer', borderColor: especialValues[c.value] ? '#3B82F6' : '#E5E7EB', backgroundColor: especialValues[c.value] ? '#EFF6FF' : '#FFF' }}>
                    <input type="checkbox" checked={!!especialValues[c.value]} onChange={e => setEspecialValues(prev => ({ ...prev, [c.value]: e.target.checked }))} />
                    <span style={{ fontSize: '14px', flex: 1 }}>{c.label}</span>{c.urgente && <span className="badge" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>⚑ Relevante</span>}
                  </label>
                ) : c.tipo === 'select' ? (
                  <div key={c.id}><label className="label">{c.label}</label><select value={especialValues[c.id] || ''} onChange={e => setEspecialValues(prev => ({ ...prev, [c.id]: e.target.value }))} className="input-modern"><option value="">—</option>{c.opciones.map(o => <option key={o}>{o}</option>)}</select></div>
                ) : (
                  <div key={c.id}><label className="label">{c.label}</label><input type={c.tipo} value={especialValues[c.id] || ''} onChange={e => setEspecialValues(prev => ({ ...prev, [c.id]: e.target.value }))} placeholder={c.placeholder} className="input-modern" /></div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="section-title" style={{ marginBottom: 0 }}>2 · Signos vitales</h3>
              <button onClick={() => setSlidersActivos(!slidersActivos)} className={`btn btn-sm ${slidersActivos ? 'btn-primary' : 'btn-secondary'}`}><SlidersHorizontal size={14} /> Sliders</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}><label className="label" style={{ marginBottom: 0 }}>T/A (mmHg)</label><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: VITAL_COLORS[getVitalStatus('ta', form.vitales.ta)].indicator }} /></div>
                <input type="text" value={form.vitales.ta} onChange={e => handleVitalChange('ta', e.target.value)} placeholder="120/80" className="input-modern" style={{ borderColor: VITAL_COLORS[getVitalStatus('ta', form.vitales.ta)].border, backgroundColor: VITAL_COLORS[getVitalStatus('ta', form.vitales.ta)].bg }} />
                {slidersActivos && <input type="range" min={60} max={220} step={1} value={parseInt(form.vitales.ta?.split('/')[0]) || 120} onChange={e => handleTASliderChange(e.target.value)} style={{ width: '100%', marginTop: '6px', accentColor: VITAL_COLORS[getVitalStatus('ta', form.vitales.ta)].indicator }} />}
              </div>
              {vitalesConfig.filter(v => v.id !== 'ta').map(v => {
                const status = getVitalStatus(v.id, form.vitales[v.id]); const colors = VITAL_COLORS[status];
                return (
                  <div key={v.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}><label className="label" style={{ marginBottom: 0 }}>{v.label}</label><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: colors.indicator }} /></div>
                    <input type="number" value={form.vitales[v.id]} onChange={e => handleVitalChange(v.id, e.target.value)} placeholder={v.ph} className="input-modern" style={{ borderColor: colors.border, backgroundColor: colors.bg }} />
                    {slidersActivos && <input type="range" min={v.min} max={v.max} step={v.step} value={parseFloat(form.vitales[v.id]) || v.min} onChange={e => handleVitalChange(v.id, e.target.value)} style={{ width: '100%', marginTop: '6px', accentColor: colors.indicator }} />}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="card"><h3 className="section-title">3 · Signos de alarma</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[{ id: 'al1', label: '💨 Dificultad respiratoria', value: 'Dificultad Respiratoria' }, { id: 'al2', label: '❤️ Dolor torácico', value: 'Dolor Torácico' }, { id: 'al3', label: '🩸 Sangrado activo', value: 'Sangrado Activo' }].map(a => (
                  <button key={a.id} onClick={() => toggleAlarma(a.value)} style={{ padding: '14px', borderRadius: '12px', border: '1.5px solid', fontSize: '13px', fontWeight: 500, cursor: 'pointer', borderColor: form.signosAlarma.includes(a.value) ? '#FECACA' : '#E5E7EB', backgroundColor: form.signosAlarma.includes(a.value) ? '#FEF2F2' : '#FFF', color: form.signosAlarma.includes(a.value) ? '#DC2626' : '#6B7280', width: '100%' }}>{a.label}</button>
                ))}
              </div>
            </div>
            <div className="card"><h3 className="section-title">Escala del dolor</h3>
              <div style={{ textAlign: 'center', marginBottom: '12px' }}><span style={{ fontSize: '48px' }}>{dolorActual.emoji}</span><div style={{ fontSize: '18px', fontWeight: 600, color: dolorActual.color, marginTop: '4px' }}>{form.escalaDolor}/10 — {dolorActual.label}</div></div>
              <input type="range" min={0} max={10} step={2} value={form.escalaDolor} onChange={e => setForm(prev => ({ ...prev, escalaDolor: parseInt(e.target.value) }))} style={{ width: '100%', accentColor: dolorActual.color }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: '#9CA3AF' }}>{ESCALA_DOLOR.map(d => <span key={d.valor} style={{ color: form.escalaDolor === d.valor ? d.color : '#9CA3AF', fontWeight: form.escalaDolor === d.valor ? 600 : 400, cursor: 'pointer' }} onClick={() => setForm(prev => ({ ...prev, escalaDolor: d.valor }))}>{d.valor}</span>)}</div>
            </div>
          </div>

          <div className="card"><h3 className="section-title">4 · Antecedentes relevantes</h3><textarea value={form.antecedentes} onChange={e => setForm({ ...form, antecedentes: e.target.value })} rows={2} placeholder="Diabetes, hipertensión, cirugías previas..." className="input-modern" /></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ position: 'sticky', top: '88px' }}>
            <h3 className="section-title">Triaje automático {preferenciaTriaje === 'mito' && ' · Mito (IA)'}{preferenciaTriaje === 'manchester' && ' · Manchester'}{preferenciaTriaje === 'ambos' && ' · Manchester + Mito'}</h3>
            <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '10px', backgroundColor: citaProgramada ? '#EFF6FF' : '#F0FDF4', border: `1.5px solid ${citaProgramada ? '#BFDBFE' : '#BBF7D0'}`, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {citaProgramada ? <><Calendar size={14} style={{ color: '#3B82F6' }} /><span style={{ color: '#1E40AF', fontWeight: 500 }}>Paciente con cita programada</span></> : <><UserPlus size={14} style={{ color: '#16A34A' }} /><span style={{ color: '#065F46', fontWeight: 500 }}>Paciente walk-in (sin cita)</span></>}
            </div>

            {mostrarTriaje ? (
              <>
                {mostrarManchester && triageResult && (
                  <div style={{ padding: '16px', borderRadius: '12px', border: '2px solid', backgroundColor: fondosNivel[triageResult.nivel] || '#f9fafb', borderColor: coloresNivel[triageResult.nivel] || '#d1d5db', color: coloresNivel[triageResult.nivel] || '#374151', marginBottom: '12px' }}>
                    <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'monospace', lineHeight: 1 }}>{triageResult.nivel === 0 ? 'LP' : `N${triageResult.nivel}`}</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>{triageResult.nombre}</div>
                    <div style={{ fontSize: '12px', marginTop: '2px', opacity: 0.8 }}>{triageResult.razones[0]}</div>
                  </div>
                )}
                {mostrarManchester && !triageResult && (
                  <div className="empty-state" style={{ padding: '20px 0', marginBottom: '12px' }}><Activity size={28} style={{ marginBottom: '6px', opacity: 0.3 }} /><p className="empty-state-text" style={{ fontSize: '12px' }}>Complete el formulario</p></div>
                )}
                {mostrarMito && <button onClick={pedirSugerenciaIA} disabled={consultandoIA} className="btn btn-secondary" style={{ width: '100%', marginBottom: '12px' }}>{consultandoIA ? '🤖 Mito está analizando...' : '🤖 Diagnóstico de Mito'}</button>}
                {mostrarMito && iaResult && (
                  <div style={{ padding: '14px', borderRadius: '12px', border: '2px solid', backgroundColor: fondosNivel[iaResult.nivel] || '#EFF6FF', borderColor: coloresNivel[iaResult.nivel] || '#3B82F6', color: coloresNivel[iaResult.nivel] || '#1F2937', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><span style={{ fontSize: '16px' }}>🤖</span><span style={{ fontSize: '14px', fontWeight: 600, color: coloresNivel[iaResult.nivel] || '#3B82F6' }}>Mito sugiere: N{iaResult.nivel} — {iaResult.nombre}</span>{iaResult.nivel === triageResult?.nivel && mostrarManchester && <span className="badge" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', fontSize: '10px' }}>✓ Coincide</span>}</div>
                    <p style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>{iaResult.razon}</p>
                    <p style={{ fontSize: '11px', fontWeight: 500, opacity: 0.9 }}>💡 {iaResult.recomendacion}</p>
                  </div>
                )}
                {mostrarSelector && (
                  <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', marginBottom: '12px' }}>
                    <p className="label" style={{ marginBottom: '8px' }}>Seleccionar triaje para registro:</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', backgroundColor: triajeSeleccionado === 'manchester' ? '#EFF6FF' : 'transparent', border: `1.5px solid ${triajeSeleccionado === 'manchester' ? '#3B82F6' : '#E5E7EB'}`, fontSize: '13px' }}><input type="radio" name="triaje" checked={triajeSeleccionado === 'manchester'} onChange={() => setTriajeSeleccionado('manchester')} /><span>🏥 Manchester: N{triageResult?.nivel} — {triageResult?.nombre}</span></label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', backgroundColor: triajeSeleccionado === 'ia' ? '#EFF6FF' : 'transparent', border: `1.5px solid ${triajeSeleccionado === 'ia' ? '#3B82F6' : '#E5E7EB'}`, fontSize: '13px' }}><input type="radio" name="triaje" checked={triajeSeleccionado === 'ia'} onChange={() => setTriajeSeleccionado('ia')} /><span>🤖 Mito: N{iaResult?.nivel} — {iaResult?.nombre}</span></label>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', marginBottom: '12px', fontSize: '13px', color: '#16A34A' }}>📅 Cita programada — Se registrará sin triaje (N5 por defecto).</div>
            )}

            <button onClick={handleRegistrar} disabled={registrando} className="btn btn-primary btn-lg" style={{ width: '100%' }}>{registrando ? 'Registrando...' : `Confirmar y registrar${citaProgramada ? ' (cita)' : ''}`}</button>

            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
              <h3 className="section-title">Referencia de niveles</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F9FAFB' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: coloresNivel[n] }} /><span style={{ fontSize: '12px', fontWeight: 500 }}>N{n} · {NIVEL_INFO[n]?.nombre}</span></div>
                    <span style={{ fontSize: '10px', color: '#9CA3AF' }}>{NIVEL_INFO[n]?.tiempo}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 100 }}>
        <Mito estado={mitoEstado} mensaje={mitoMensaje} onDiagnosticar={pedirSugerenciaIA} />
      </div>
    </div>
  );
}