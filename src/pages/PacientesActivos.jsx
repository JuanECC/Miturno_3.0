import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import {
  doc, getDoc, updateDoc, setDoc, serverTimestamp, increment,
  collection, addDoc, query, where, onSnapshot, orderBy, getDocs,
  arrayUnion
} from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import ModalCamas from '../components/ModalCamas';
import DocumentoImprimible from '../components/DocumentoImprimible';
import { useReactToPrint } from 'react-to-print';
import {
  Search, ArrowRight, BedDouble, UserRound, Printer,
  ClipboardList, Activity, Send, Eye, Stethoscope
} from 'lucide-react';

const AREAS_SEGUIMIENTO = [
  { key: 'OBSERVACION', label: 'Observación', icon: '👁' },
  { key: 'HOSPITALIZACION', label: 'Hospitalización', icon: '🏨' },
  { key: 'CIRUGIA', label: 'Cirugía', icon: '🔪' },
  { key: 'TERAPIA_INTENSIVA', label: 'UCI', icon: '💊' },
  { key: 'INTERNAMIENTO', label: 'Internamiento', icon: '🏨' },
];

const DESTINOS_CON_CAMA = ['OBSERVACION', 'HOSPITALIZACION', 'CIRUGIA', 'TERAPIA_INTENSIVA', 'INTERNAMIENTO'];

// Campos específicos para valoración médica según área
const CAMPOS_VALORACION = {
  OBSERVACION: [
    { key: 'dolor', label: 'Dolor (0-10)', type: 'number' },
    { key: 'toleranciaOral', label: '¿Tolera vía oral?', type: 'select', options: ['Sí', 'No'] },
    { key: 'oxigenoSuplementario', label: '¿Requiere O₂ suplementario?', type: 'select', options: ['No', 'Sí'] },
  ],
  HOSPITALIZACION: [
    { key: 'evolucion', label: 'Evolución clínica', type: 'textarea' },
    { key: 'balanceLiquidos', label: 'Balance de líquidos (ml)', type: 'number' },
    { key: 'signosAlarma', label: '¿Presenta signos de alarma?', type: 'select', options: ['No', 'Sí'] },
  ],
  CIRUGIA: [
    { key: 'herida', label: 'Estado de herida quirúrgica', type: 'textarea' },
    { key: 'drenajes', label: 'Drenajes', type: 'textarea' },
    { key: 'dolor', label: 'Dolor postoperatorio (0-10)', type: 'number' },
  ],
  TERAPIA_INTENSIVA: [
    { key: 'glasgow', label: 'Escala de Glasgow (3-15)', type: 'number' },
    { key: 'ventilacion', label: 'Modalidad ventilatoria', type: 'select', options: ['Espontáneo', 'CPAP', 'BiPAP', 'AC', 'SIMV', 'Otro'] },
    { key: 'sedacion', label: 'Sedación', type: 'select', options: ['Sin sedación', 'Leve', 'Moderada', 'Profunda'] },
  ],
  INTERNAMIENTO: [
    { key: 'evolucion', label: 'Evolución clínica', type: 'textarea' },
    { key: 'dolor', label: 'Dolor (0-10)', type: 'number' },
  ],
};

export default function PacientesActivos() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const printRef = useRef();

  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [filtroArea, setFiltroArea] = useState('');

  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [seguimientos, setSeguimientos] = useState([]);
  const [modalSeguimiento, setModalSeguimiento] = useState(false);
  const [modalCambioArea, setModalCambioArea] = useState(false);
  const [modalAlta, setModalAlta] = useState(false);
  const [modalCamas, setModalCamas] = useState(false);
  const [areaDestino, setAreaDestino] = useState(null);

  const [nuevaValoracion, setNuevaValoracion] = useState({
    ta: '', temp: '', fc: '', spo2: '', glu: '',
    nota: '',
    extra: {},
  });

  const [pacienteImprimir, setPacienteImprimir] = useState(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Seguimiento_${pacienteImprimir?.nombre || 'paciente'}`,
    onAfterPrint: () => setPacienteImprimir(null),
  });

  // ─── Cargar pacientes activos ───
  useEffect(() => {
    const q = query(
      collection(db, 'pacientes'),
      where('ubicacion_actual', 'in', AREAS_SEGUIMIENTO.map(a => a.key))
    );
    const unsub = onSnapshot(q, (snap) => {
      setPacientes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ─── Cargar seguimientos del paciente seleccionado ───
  useEffect(() => {
    if (!pacienteSeleccionado) return;
    const q = query(
      collection(db, 'pacientes', pacienteSeleccionado.id, 'seguimiento'),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setSeguimientos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [pacienteSeleccionado]);

  const filtrados = pacientes
    .filter(p => !buscar || p.nombre?.toLowerCase().includes(buscar.toLowerCase()))
    .filter(p => !filtroArea || p.ubicacion_actual === filtroArea);

  const formatearFecha = (fecha) => {
    if (!fecha) return '—';
    try {
      if (fecha.seconds) return new Date(fecha.seconds * 1000).toLocaleString('es-MX');
      if (fecha.toDate) return fecha.toDate().toLocaleString('es-MX');
      return new Date(fecha).toLocaleString('es-MX');
    } catch { return '—'; }
  };

  // ─── Abrir modal de seguimiento ───
  const abrirSeguimiento = (paciente) => {
    setPacienteSeleccionado(paciente);
    setModalSeguimiento(true);
  };

  // ─── Guardar nueva valoración / nota de seguimiento ───
  const guardarSeguimiento = async () => {
    if (!pacienteSeleccionado) return;
    if (!nuevaValoracion.nota.trim() && !Object.values(nuevaValoracion.extra).some(v => v?.toString().trim())) {
      addToast('Escribe una nota o completa la valoración', 'warning', 3000);
      return;
    }

    try {
      await addDoc(collection(db, 'pacientes', pacienteSeleccionado.id, 'seguimiento'), {
        ta: nuevaValoracion.ta,
        temp: nuevaValoracion.temp,
        fc: nuevaValoracion.fc,
        spo2: nuevaValoracion.spo2,
        glu: nuevaValoracion.glu,
        nota: nuevaValoracion.nota,
        extra: nuevaValoracion.extra,
        timestamp: serverTimestamp(),
        autor: user?.nombre || 'Médico',
      });

      setNuevaValoracion({
        ta: '', temp: '', fc: '', spo2: '', glu: '',
        nota: '',
        extra: {},
      });
      addToast('Valoración guardada', 'success', 3000, '📈');
    } catch (err) {
      console.error('Error guardando seguimiento:', err);
      addToast('Error al guardar seguimiento', 'error', 4000);
    }
  };

  // ─── Cambiar de área ───
  const abrirCambioArea = (paciente) => {
    setPacienteSeleccionado(paciente);
    setModalCambioArea(true);
  };

  const seleccionarNuevaArea = (areaKey) => {
    if (!pacienteSeleccionado) return;
    setAreaDestino(areaKey);
    setModalCambioArea(false);
    if (DESTINOS_CON_CAMA.includes(areaKey)) {
      setModalCamas(true);
    } else {
      confirmarCambioArea(areaKey, null);
    }
  };

  const confirmarCambioArea = async (nuevaArea, camaNueva) => {
    try {
      const pacienteId = pacienteSeleccionado.id;

      if (pacienteSeleccionado.cama_asignada && pacienteSeleccionado.cama_asignada !== camaNueva) {
        await updateDoc(doc(db, 'camas', pacienteSeleccionado.cama_asignada), {
          ocupada: false,
          paciente_id: null,
        });
      }

      if (camaNueva) {
        await updateDoc(doc(db, 'camas', camaNueva), {
          ocupada: true,
          paciente_id: pacienteId,
        });
      }

      await updateDoc(doc(db, 'pacientes', pacienteId), {
        ubicacion_actual: nuevaArea,
        cama_asignada: camaNueva || '',
        movimientos: arrayUnion({
          de: pacienteSeleccionado.ubicacion_actual,
          a: nuevaArea,
          fecha: serverTimestamp(),
          autor: user?.nombre || 'Médico',
        }),
      });

      addToast(`Paciente movido a ${nuevaArea}`, 'success', 3000, '✅');
      setModalCamas(false);
      setPacienteSeleccionado(null);
    } catch (err) {
      console.error('Error cambiando área:', err);
      addToast('Error al cambiar área', 'error', 4000);
    }
  };

  // ─── Mandar a consulta ───
  const mandarAConsulta = async (paciente) => {
    try {
      await updateDoc(doc(db, 'pacientes', paciente.id), {
        estado: 'en consulta',
        ubicacion_actual: 'Sala de espera',
        consulta_inicio: serverTimestamp(),
        atendido_por: user?.nombre || user?.email,
      });

      addToast(`Paciente ${paciente.nombre} enviado a consulta`, 'success', 3000, '🩺');
      navigate(`/doctor/consulta/${paciente.id}`);
    } catch (err) {
      console.error('Error mandando a consulta:', err);
      addToast('Error al mandar a consulta', 'error', 4000);
    }
  };

  // ─── Dar de alta ───
  const abrirAlta = (paciente) => {
    setPacienteSeleccionado(paciente);
    setModalAlta(true);
  };

  const confirmarAlta = async () => {
    if (!pacienteSeleccionado) return;
    const p = pacienteSeleccionado;

    try {
      if (p.cama_asignada) {
        await updateDoc(doc(db, 'camas', p.cama_asignada), {
          ocupada: false,
          paciente_id: null,
        });
      }

      const historialId = await obtenerHistorialId(p);

      const q = query(
        collection(db, 'historial', historialId, 'episodios'),
        orderBy('fechaAtencion', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);

      const seguimientosData = seguimientos.map(s => ({
        autor: s.autor,
        nota: s.nota,
        ta: s.ta,
        temp: s.temp,
        fc: s.fc,
        spo2: s.spo2,
        glu: s.glu,
        extra: s.extra,
        timestamp: s.timestamp,
      }));

      if (!snap.empty) {
        await updateDoc(doc(db, 'historial', historialId, 'episodios', snap.docs[0].id), {
          fechaAlta: serverTimestamp(),
          destino: 'ALTA',
          seguimientos: seguimientosData,
          signosVitalesAlta: seguimientosData.length > 0
            ? {
                ta: seguimientosData[seguimientosData.length - 1].ta,
                temp: seguimientosData[seguimientosData.length - 1].temp,
                fc: seguimientosData[seguimientosData.length - 1].fc,
                spo2: seguimientosData[seguimientosData.length - 1].spo2,
                glu: seguimientosData[seguimientosData.length - 1].glu,
              }
            : {},
          medicoAlta: user?.nombre || user?.email,
        });
      } else {
        await addDoc(collection(db, 'historial', historialId, 'episodios'), {
          fechaIngreso: p.fecha_ingreso || serverTimestamp(),
          fechaAlta: serverTimestamp(),
          destino: 'ALTA',
          motivo: p.motivo,
          diagnostico_cie10: p.diagnostico_cie10 || '',
          diagnostico_descripcion: p.diagnostico_descripcion || '',
          seguimientos: seguimientosData,
          medicoAlta: user?.nombre || user?.email,
        });
      }

      await setDoc(doc(db, 'historial', historialId), {
        nombre: p.nombre,
        edad: p.edad,
        especialidad: p.especialidad,
        fechaUltimaVisita: serverTimestamp(),
      }, { merge: true });

      await updateDoc(doc(db, 'pacientes', p.id), {
        estado: 'alta',
        ubicacion_actual: 'ALTA',
        fecha_alta: serverTimestamp(),
      });

      addToast('Paciente dado de alta y expediente actualizado', 'success', 4000, '✅');
      setModalAlta(false);
      setPacienteSeleccionado(null);
    } catch (err) {
      console.error('Error al dar de alta:', err);
      addToast('Error al dar de alta', 'error', 4000);
    }
  };

  // ─── Imprimir resumen ───
  const abrirImpresion = (paciente) => {
    setPacienteImprimir(paciente);
    setTimeout(() => handlePrint(), 500);
  };

  // ─── Obtener historialId (compatible con IDs antiguos) ───
  const obtenerHistorialId = async (paciente) => {
    const q1 = query(collection(db, 'historial'), where('pacienteId', '==', paciente.id));
    const s1 = await getDocs(q1);
    if (!s1.empty) return s1.docs[0].id;

    const q2 = query(collection(db, 'historial'), where('nombre', '==', paciente.nombre), where('edad', '==', paciente.edad));
    const s2 = await getDocs(q2);
    if (!s2.empty) return s2.docs[0].id;

    return paciente.id;
  };

  if (loading) {
    return <div className="page-container"><div className="card">Cargando pacientes activos...</div></div>;
  }

  return (
    <div className="page-container">
      {/* Encabezado */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 className="page-title">Pacientes Activos</h1>
          <p className="page-subtitle">Seguimiento intrahospitalario por área</p>
        </div>
        <div className="badge" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', padding: '8px 14px' }}>
          <span style={{ fontWeight: 600 }}>{filtrados.length}</span> activos
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label className="label">Buscar paciente</label>
            <input type="text" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Nombre..." className="input-modern" />
          </div>
          <div style={{ minWidth: '180px' }}>
            <label className="label">Área</label>
            <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)} className="input-modern">
              <option value="">Todas</option>
              {AREAS_SEGUIMIENTO.map(area => <option key={area.key} value={area.key}>{area.icon} {area.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de pacientes */}
      {filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏥</div>
          <p className="empty-state-text">No hay pacientes activos</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtrados.map(p => {
            const area = AREAS_SEGUIMIENTO.find(a => a.key === p.ubicacion_actual);
            return (
              <div key={p.id} className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '14px', backgroundColor: '#EFF6FF', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '18px' }}>
                      {(p.nombre || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '15px' }}>{p.nombre}</span>
                        <span className="badge" style={{ backgroundColor: '#F3F4F6' }}>{area?.icon} {area?.label || p.ubicacion_actual}</span>
                        {p.cama_asignada && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB' }}>🛏 {p.cama_asignada}</span>}
                        {p.doctor_asignado && <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>👨‍⚕️ {p.doctor_asignado}</span>}
                      </div>
                      <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>
                        {p.edad} años · {p.especialidad} · Nivel {p.nivel_prioridad}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button onClick={() => abrirSeguimiento(p)} className="btn btn-secondary btn-sm">
                      <ClipboardList size={14} /> Seguimiento
                    </button>
                    <button onClick={() => mandarAConsulta(p)} className="btn btn-sm btn-primary">
                      <Stethoscope size={14} /> Consulta
                    </button>
                    <button onClick={() => abrirCambioArea(p)} className="btn btn-secondary btn-sm">
                      <ArrowRight size={14} /> Cambiar
                    </button>
                    <button onClick={() => abrirImpresion(p)} className="btn btn-secondary btn-sm">
                      <Printer size={14} />
                    </button>
                    <button onClick={() => abrirAlta(p)} className="btn btn-sm" style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                      ✅ ALTA
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Seguimiento */}
      {modalSeguimiento && pacienteSeleccionado && (
        <div className="modal-overlay" onClick={() => setModalSeguimiento(false)}>
          <div className="modal-box" style={{ maxWidth: '650px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Valoración médica — {pacienteSeleccionado.nombre}</h3>
              <button onClick={() => setModalSeguimiento(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            <div style={{ padding: '20px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Signos vitales */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                <div><label className="label">T/A</label><input type="text" value={nuevaValoracion.ta} onChange={e => setNuevaValoracion(prev => ({ ...prev, ta: e.target.value }))} className="input-modern" /></div>
                <div><label className="label">Temp (°C)</label><input type="number" value={nuevaValoracion.temp} onChange={e => setNuevaValoracion(prev => ({ ...prev, temp: e.target.value }))} className="input-modern" /></div>
                <div><label className="label">FC (lpm)</label><input type="number" value={nuevaValoracion.fc} onChange={e => setNuevaValoracion(prev => ({ ...prev, fc: e.target.value }))} className="input-modern" /></div>
                <div><label className="label">SpO₂ (%)</label><input type="number" value={nuevaValoracion.spo2} onChange={e => setNuevaValoracion(prev => ({ ...prev, spo2: e.target.value }))} className="input-modern" /></div>
                <div><label className="label">Glucosa</label><input type="number" value={nuevaValoracion.glu} onChange={e => setNuevaValoracion(prev => ({ ...prev, glu: e.target.value }))} className="input-modern" /></div>
              </div>

              {/* Campos específicos según área */}
              {CAMPOS_VALORACION[pacienteSeleccionado.ubicacion_actual]?.map(campo => {
                const extra = nuevaValoracion.extra || {};
                if (campo.type === 'textarea') {
                  return (
                    <div key={campo.key} style={{ marginBottom: '10px' }}>
                      <label className="label">{campo.label}</label>
                      <textarea
                        rows={2}
                        value={extra[campo.key] || ''}
                        onChange={e => setNuevaValoracion(prev => ({ ...prev, extra: { ...prev.extra, [campo.key]: e.target.value } }))}
                        className="input-modern"
                      />
                    </div>
                  );
                }
                if (campo.type === 'select') {
                  return (
                    <div key={campo.key} style={{ marginBottom: '10px' }}>
                      <label className="label">{campo.label}</label>
                      <select
                        value={extra[campo.key] || ''}
                        onChange={e => setNuevaValoracion(prev => ({ ...prev, extra: { ...prev.extra, [campo.key]: e.target.value } }))}
                        className="input-modern"
                      >
                        <option value="">—</option>
                        {campo.options.map(opt => <option key={opt}>{opt}</option>)}
                      </select>
                    </div>
                  );
                }
                return (
                  <div key={campo.key} style={{ marginBottom: '10px' }}>
                    <label className="label">{campo.label}</label>
                    <input
                      type={campo.type}
                      value={extra[campo.key] || ''}
                      onChange={e => setNuevaValoracion(prev => ({ ...prev, extra: { ...prev.extra, [campo.key]: e.target.value } }))}
                      className="input-modern"
                    />
                  </div>
                );
              })}

              {/* Nota de evolución */}
              <div style={{ marginBottom: '16px' }}>
                <label className="label">Nota de evolución</label>
                <textarea
                  rows={3}
                  value={nuevaValoracion.nota}
                  onChange={e => setNuevaValoracion(prev => ({ ...prev, nota: e.target.value }))}
                  placeholder="Describe la evolución del paciente..."
                  className="input-modern"
                />
              </div>

              <button onClick={guardarSeguimiento} className="btn btn-primary" style={{ width: '100%' }}>
                <Send size={14} /> Guardar valoración
              </button>

              {/* Historial de seguimientos */}
              {seguimientos.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h4 className="label">Historial de valoraciones</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {seguimientos.map(seg => (
                      <div key={seg.id} style={{ padding: '10px', backgroundColor: '#F9FAFB', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#3B82F6' }}>{seg.autor}</span>
                          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{formatearFecha(seg.timestamp)}</span>
                        </div>
                        {seg.nota && <p style={{ fontSize: '13px', marginTop: '4px' }}>{seg.nota}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambio de Área */}
      {modalCambioArea && pacienteSeleccionado && (
        <div className="modal-overlay" onClick={() => setModalCambioArea(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Mover paciente</h3>
              <button onClick={() => setModalCambioArea(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {AREAS_SEGUIMIENTO.filter(a => a.key !== pacienteSeleccionado.ubicacion_actual).map(area => (
                <button key={area.key} onClick={() => seleccionarNuevaArea(area.key)} className="btn btn-secondary" style={{ padding: '14px', justifyContent: 'flex-start', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>{area.icon}</span> {area.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Camas */}
      <ModalCamas
        open={modalCamas}
        onClose={() => setModalCamas(false)}
        pacienteId={pacienteSeleccionado?.id || ''}
        area={areaDestino || ''}
        onAsignar={(cama) => {
          setModalCamas(false);
          confirmarCambioArea(areaDestino, cama);
        }}
      />

      {/* Modal Alta */}
      {modalAlta && pacienteSeleccionado && (
        <div className="modal-overlay" onClick={() => setModalAlta(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Confirmar alta</h3>
              <button onClick={() => setModalAlta(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            <div style={{ padding: '20px 24px', textAlign: 'center' }}>
              <p>¿Dar de alta a <strong>{pacienteSeleccionado.nombre}</strong>?</p>
              <p style={{ fontSize: '13px', color: '#6B7280' }}>Se actualizará el expediente con las valoraciones de seguimiento.</p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button onClick={() => setModalAlta(false)} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                <button onClick={confirmarAlta} className="btn btn-primary" style={{ flex: 1 }}>Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Documento imprimible oculto (solo si hay paciente) */}
      {pacienteImprimir && (
        <div style={{ display: 'none' }}>
          <DocumentoImprimible
            ref={printRef}
            tipo="atencion"
            datos={{
              paciente: pacienteImprimir || {},
              medico: user?.nombre || user?.email,
              fecha: new Date().toLocaleString('es-MX'),
              destino: pacienteImprimir?.ubicacion_actual || '',
              diagnostico: pacienteImprimir?.diagnostico_cie10 || '',
              diagnosticoDesc: pacienteImprimir?.diagnostico_descripcion || '',
              motivo: pacienteImprimir?.motivo || '',
              nota: '',
              indicaciones: [],
              estudios: [],
            }}
          />
        </div>
      )}
    </div>
  );
}