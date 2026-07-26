import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { Search, Send, ArrowRight } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';
import { archivarPaciente } from '../services/firestoreService';

const UBICACIONES = ['OBSERVACION', 'HOSPITALIZACION', 'CIRUGIA', 'TERAPIA_INTENSIVA', 'TRASLADO', 'INTERNAMIENTO'];
const COLORES_NIVEL = ['', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb'];
const FONDOS_NIVEL = ['', '#fef2f2', '#fff7ed', '#fefce8', '#f0fdf4', '#eff4ff'];
const ICONOS_UBICACION = {
  OBSERVACION: '👁', HOSPITALIZACION: '🏨', CIRUGIA: '🔪', TERAPIA_INTENSIVA: '💊', TRASLADO: '🚑', INTERNAMIENTO: '🏨'
};

export default function PacientesActivos() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [filtroUbicacion, setFiltroUbicacion] = useState('');
  const [notaTexto, setNotaTexto] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [modalAlta, setModalAlta] = useState({ open: false, paciente: null });
  const [licencia, setLicencia] = useState('hospital');

  // Escuchar licencia desde configuración
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracion', 'global'), (snap) => {
      if (snap.exists() && snap.data().licencia) {
        setLicencia(snap.data().licencia);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'pacientes'),
      where('ubicacion_actual', 'in', UBICACIONES)
    );
    const unsub = onSnapshot(q, (snap) => {
      setPacientes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Filtrar por médico actual en modo clínica
  const filtrados = pacientes
    .filter(p => !buscar || p.nombre?.toLowerCase().includes(buscar.toLowerCase()))
    .filter(p => !filtroUbicacion || p.ubicacion_actual === filtroUbicacion)
    .filter(p => {
      if (licencia !== 'clinica') return true;
      // En modo clínica, solo mostrar pacientes atendidos por el médico actual
      return p.atendido_por === user?.nombre || p.atendido_por === user?.email;
    });

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  const agregarNota = async (pacienteId) => {
    const nota = notaTexto[pacienteId]?.trim();
    if (!nota) return;
    try {
      await updateDoc(doc(db, 'pacientes', pacienteId), {
        notasSeguimiento: arrayUnion({
          fecha: new Date().toISOString(),
          autor: user?.nombre || 'Médico',
          nota
        }),
        fecha_ultima_actualizacion: serverTimestamp()
      });
      setNotaTexto(prev => ({ ...prev, [pacienteId]: '' }));
      addToast('Nota de seguimiento agregada', 'success', 3000, '✅ Seguimiento');
    } catch (err) {
      console.error(err);
      addToast('Error al agregar nota', 'error', 4000, 'Error');
    }
  };

  const cambiarUbicacion = async (pacienteId, nuevaUbicacion) => {
    try {
      await updateDoc(doc(db, 'pacientes', pacienteId), {
        ubicacion_actual: nuevaUbicacion,
        estado: 'proceso',
        fecha_ultima_actualizacion: serverTimestamp()
      });
      addToast(`Paciente movido a ${nuevaUbicacion}`, 'success', 3000, '✅ Actualizado');
    } catch (err) {
      console.error(err);
      addToast('Error al mover paciente', 'error', 4000, 'Error');
    }
  };

  const abrirModalAlta = (paciente) => {
    setModalAlta({ open: true, paciente });
  };

  const confirmarAlta = async () => {
    const pacienteData = modalAlta.paciente;
    if (!pacienteData) return;

    try {
      const archivado = await archivarPaciente(pacienteData);
      console.log('✅ Resultado archivar:', archivado);

      await updateDoc(doc(db, 'pacientes', pacienteData.id), {
        ubicacion_actual: 'ALTA',
        estado: 'completado',
        fecha_alta: serverTimestamp(),
        fecha_ultima_actualizacion: serverTimestamp()
      });

      setModalAlta({ open: false, paciente: null });
      addToast('Paciente dado de alta y archivado en historial clínico', 'success', 4000, '✅ ALTA completada');
    } catch (err) {
      console.error('❌ Error al dar de alta:', err);
      addToast('Error al dar de alta: ' + (err.message || 'Error desconocido'), 'error', 5000, 'Error');
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '—';
    try {
      if (fecha.seconds) return new Date(fecha.seconds * 1000).toLocaleString('es-MX');
      return new Date(fecha).toLocaleString('es-MX');
    } catch { return fecha; }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 className="page-title">Pacientes Activos</h1>
          <p className="page-subtitle">Seguimiento de pacientes hospitalizados y en observación{licencia === 'clinica' ? ' (mis pacientes)' : ''}</p>
        </div>
        <div className="badge" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', padding: '8px 14px', fontSize: '14px' }}>
          <span style={{ fontWeight: 600, color: '#1F2937' }}>{filtrados.length}</span>
          <span style={{ color: '#6B7280', marginLeft: '4px' }}>activos</span>
        </div>
      </div>

      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label className="label">Buscar paciente</label>
            <input type="text" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Nombre..." className="input-modern" />
          </div>
          <div style={{ minWidth: '180px' }}>
            <label className="label">Ubicación</label>
            <select value={filtroUbicacion} onChange={e => setFiltroUbicacion(e.target.value)} className="input-modern">
              <option value="">Todas</option>
              {UBICACIONES.map(u => <option key={u} value={u}>{ICONOS_UBICACION[u]} {u}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div className="skeleton" style={{ width: '200px', height: '16px', margin: '0 auto' }} />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏥</div>
          <p className="empty-state-text">{pacientes.length === 0 ? 'No hay pacientes activos' : 'Sin resultados'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtrados.map(p => {
            const n = Math.min(p.nivel_prioridad || 5, 5);
            const expandido = expandedId === p.id;
            const notas = p.notasSeguimiento || [];
            return (
              <div key={p.id} className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '14px',
                      backgroundColor: '#EFF6FF', color: '#3B82F6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '18px', flexShrink: 0
                    }}>
                      {(p.nombre || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '15px', color: '#1F2937' }}>{p.nombre}</span>
                        <span className="badge" style={{ backgroundColor: FONDOS_NIVEL[n], color: COLORES_NIVEL[n], border: `1px solid ${COLORES_NIVEL[n]}` }}>N{p.nivel_prioridad}</span>
                        <span className="badge" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                          {ICONOS_UBICACION[p.ubicacion_actual] || '📍'} {p.ubicacion_actual}
                        </span>
                        {p.cama_asignada && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB' }}>🛏 {p.cama_asignada}</span>}
                      </div>
                      <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>
                        {p.edad} años · {p.especialidad} · {p.atendido_por ? `Dr(a). ${p.atendido_por}` : 'Sin médico'} · Ingreso: {formatearFecha(p.fecha_ingreso)}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button onClick={() => toggleExpand(p.id)} className="btn btn-secondary btn-sm">
                      {expandido ? 'Ocultar' : 'Seguimiento'}
                    </button>
                    {UBICACIONES.filter(u => u !== p.ubicacion_actual).map(u => (
                      <button key={u} onClick={() => cambiarUbicacion(p.id, u)} className="btn btn-secondary btn-sm" title={`Mover a ${u}`}>
                        <ArrowRight size={14} /> {ICONOS_UBICACION[u]}
                      </button>
                    ))}
                    <button onClick={() => abrirModalAlta(p)} className="btn btn-sm" style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                      ✅ ALTA
                    </button>
                  </div>
                </div>

                {expandido && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                      {p.vitales?.ta && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB' }}>T/A: {p.vitales.ta}</span>}
                      {p.vitales?.temp && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB' }}>Temp: {p.vitales.temp}°C</span>}
                      {p.vitales?.fc && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB' }}>FC: {p.vitales.fc}</span>}
                      {p.vitales?.spo2 && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB' }}>SpO₂: {p.vitales.spo2}%</span>}
                      {p.vitales?.glu && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB' }}>Glucosa: {p.vitales.glu}</span>}
                      {p.diagnostico_cie10 && <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>📋 {p.diagnostico_cie10}</span>}
                    </div>

                    <h3 className="section-title">Notas de seguimiento</h3>
                    {notas.length === 0 ? (
                      <p style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '12px' }}>Sin notas registradas</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                        {notas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map((nota, i) => (
                          <div key={i} style={{ padding: '10px 14px', backgroundColor: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#3B82F6' }}>{nota.autor}</span>
                              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{formatearFecha(nota.fecha)}</span>
                            </div>
                            <p style={{ fontSize: '13px', color: '#1F2937' }}>{nota.nota}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        value={notaTexto[p.id] || ''}
                        onChange={e => setNotaTexto(prev => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="Escribir nota de seguimiento..."
                        className="input-modern"
                        style={{ flex: 1 }}
                        onKeyDown={e => e.key === 'Enter' && agregarNota(p.id)}
                      />
                      <button onClick={() => agregarNota(p.id)} className="btn btn-primary btn-sm">
                        <Send size={14} /> Agregar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de confirmación de ALTA */}
      {modalAlta.open && (
        <div className="modal-overlay" onClick={() => setModalAlta({ open: false, paciente: null })}>
          <div className="modal-box" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '28px', textAlign: 'center' }}>
              
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                backgroundColor: '#F0FDF4', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <span style={{ fontSize: '28px' }}>✅</span>
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1F2937', marginBottom: '8px' }}>
                Dar de alta al paciente
              </h3>
              
              <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '4px' }}>
                ¿Estás seguro de dar de alta a:
              </p>
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', marginBottom: '16px' }}>
                {modalAlta.paciente?.nombre}
              </p>
              
              <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '20px' }}>
                Se archivará automáticamente en el historial clínico
              </p>

              <div style={{
                backgroundColor: '#F9FAFB', borderRadius: '12px',
                padding: '12px', marginBottom: '20px',
                display: 'flex', justifyContent: 'center', gap: '16px',
                fontSize: '13px', color: '#6B7280'
              }}>
                <span>{modalAlta.paciente?.edad} años</span>
                <span>·</span>
                <span>{modalAlta.paciente?.especialidad}</span>
                <span>·</span>
                <span>{modalAlta.paciente?.ubicacion_actual}</span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setModalAlta({ open: false, paciente: null })}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarAlta}
                  className="btn"
                  style={{ flex: 1, background: '#16A34A', color: 'white' }}
                >
                  ✅ Confirmar ALTA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}