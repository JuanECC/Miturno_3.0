import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, doc, serverTimestamp, addDoc } from 'firebase/firestore';
import { Stethoscope, Search, Clock, Activity, Filter } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';

const TIEMPOS_MAX = { 1: 0, 2: 10, 3: 30, 4: 60, 5: 120 };
const ESPECIALIDADES = ['', 'Medicina General', 'Traumatología', 'Cardiología', 'Pediatría', 'Ginecología'];

export default function Doctor() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pacientes, setPacientes] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [espFilter, setEspFilter] = useState('');
  const [nivelFilter, setNivelFilter] = useState('');
  const [licencia, setLicencia] = useState('hospital');
  const [soloCriticos, setSoloCriticos] = useState(false);
  const [soloMios, setSoloMios] = useState(false);
  const [citasDelDia, setCitasDelDia] = useState([]);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [ahora, setAhora] = useState(Date.now());

  // Escuchar configuración para obtener la licencia
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracion', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.licencia) {
          setLicencia(data.licencia);
          if (data.licencia === 'clinica') setSoloMios(true);
        }
      }
    });
    return () => unsub();
  }, []);

  // Reloj
  useEffect(() => {
    const timer = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Escuchar citas del día
  useEffect(() => {
    const hoy = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'citas'),
      where('fecha', '==', hoy),
      where('estado', 'in', ['pendiente', 'en_sala'])
    );
    const unsub = onSnapshot(q, (snap) => {
      const citas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      citas.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
      setCitasDelDia(citas);
    });
    return () => unsub();
  }, []);

  // Escuchar pacientes en espera y en consulta
  useEffect(() => {
    const q = query(
      collection(db, 'pacientes'),
      where('estado', 'in', ['espera', 'en consulta'])
    );
    return onSnapshot(q, (snap) => {
      setPacientes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Filtros de pacientes
  const pacientesFiltrados = pacientes
    .filter(p => !buscar || p.nombre?.toLowerCase().includes(buscar.toLowerCase()) || p.motivo?.toLowerCase().includes(buscar.toLowerCase()))
    .filter(p => !espFilter || p.especialidad === espFilter)
    .filter(p => !nivelFilter || p.nivel_prioridad <= parseInt(nivelFilter))
    .filter(p => !soloCriticos || p.nivel_prioridad <= 2)
    .filter(p => {
      if (!soloMios) return true;
      const nombreDoctor = user?.nombre || user?.email || '';
      if (licencia === 'clinica') return p.doctor_asignado === nombreDoctor;
      return p.atendido_por === nombreDoctor;
    })
    .filter(p => {
      if (licencia !== 'clinica') return true;
      const nombreDoctor = user?.nombre || user?.email || '';
      return p.doctor_asignado === nombreDoctor;
    })
    .sort((a, b) => a.nivel_prioridad - b.nivel_prioridad || (a.fecha_ingreso?.seconds || 0) - (b.fecha_ingreso?.seconds || 0));

  const criticos = pacientes.filter(p => p.nivel_prioridad <= 2).length;
  const esperaPromedio = pacientes.length > 0
    ? Math.round(pacientes.reduce((s, p) => {
        const min = p.fecha_ingreso?.seconds ? Math.floor((ahora - p.fecha_ingreso.seconds * 1000) / 60000) : 0;
        return s + min;
      }, 0) / pacientes.length)
    : 0;

  const getMinutos = (p) => p.fecha_ingreso?.seconds ? Math.floor((ahora - p.fecha_ingreso.seconds * 1000) / 60000) : 0;

  const timerClass = (nivel, minutos) => {
    const max = TIEMPOS_MAX[nivel] ?? 120;
    if (max === 0 || minutos > max * 1.5) return { color: '#DC2626', fontWeight: 700 };
    if (minutos > max * 0.8) return { color: '#EA580C', fontWeight: 500 };
    return { color: '#16A34A', fontWeight: 400 };
  };

  const coloresNivel = ['', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb'];
  const fondosNivel = ['', '#fef2f2', '#fff7ed', '#fefce8', '#f0fdf4', '#eff4ff'];

  // Atender paciente: navegar a pantalla de consulta
  const atenderPaciente = (paciente) => {
    navigate(`/doctor/consulta/${paciente.id}`);
  };

  // Llamar y atender al siguiente
  const llamarYAtender = async () => {
    const siguiente = pacientesFiltrados.filter(p => p.estado === 'espera')[0];
    if (!siguiente) return;

    try {
      await addDoc(collection(db, 'llamados'), {
        paciente: siguiente.nombre,
        nivel: siguiente.nivel_prioridad,
        consultorio: user?.nombre || user?.email || 'Consultorio',
        timestamp: serverTimestamp(),
        activo: true,
      });

      addToast(`📢 Llamando a ${siguiente.nombre}`, 'info', 3000, 'Paciente llamado');
      navigate(`/doctor/consulta/${siguiente.id}`);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  return (
    <div className="page-container">
      {/* Encabezado con KPIs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 className="page-title">Consultorio médico</h1>
          <p className="page-subtitle">Pacientes en espera y en consulta{licencia === 'clinica' ? ' · Modo Clínica' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
            <div className="kpi-value" style={{ fontSize: '22px' }}>{pacientesFiltrados.length}</div>
            <div className="kpi-label">En espera/consulta</div>
          </div>
          <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
            <div className="kpi-value" style={{ fontSize: '22px', color: '#DC2626' }}>{criticos}</div>
            <div className="kpi-label">Críticos</div>
          </div>
          <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
            <div className="kpi-value" style={{ fontSize: '22px' }}>{esperaPromedio} min</div>
            <div className="kpi-label">Espera prom.</div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label className="label">Buscar paciente</label>
            <input type="text" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Nombre o motivo..." className="input-modern" />
          </div>
          <div style={{ minWidth: '160px' }}>
            <label className="label">Especialidad</label>
            <select value={espFilter} onChange={e => setEspFilter(e.target.value)} className="input-modern">
              <option value="">Todas</option>
              {ESPECIALIDADES.filter(e => e).map(e => <option key={e}>{e}</option>)}
            </select>
          </div>
          <div style={{ minWidth: '160px' }}>
            <label className="label">Nivel máximo</label>
            <select value={nivelFilter} onChange={e => setNivelFilter(e.target.value)} className="input-modern">
              <option value="">Todos</option>
              <option value="1">N1 — Resucitación</option>
              <option value="2">N2 — Emergencia</option>
              <option value="3">N3 — Urgencia</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setSoloCriticos(!soloCriticos)} className={`btn btn-sm ${soloCriticos ? 'btn-primary' : 'btn-secondary'}`} title="Solo críticos">
              <Activity size={14} /> 🔴 Críticos
            </button>
            <button onClick={() => setSoloMios(!soloMios)} className={`btn btn-sm ${soloMios ? 'btn-primary' : 'btn-secondary'}`} title="Solo mis pacientes">
              <Filter size={14} /> 👤 Míos
            </button>
            <button onClick={() => setMostrarCalendario(!mostrarCalendario)} className={`btn btn-sm ${mostrarCalendario ? 'btn-primary' : 'btn-secondary'}`} title="Calendario de citas">
              📅 Citas ({citasDelDia.length})
            </button>
          </div>
        </div>
      </div>

      {/* Calendario de citas */}
      {mostrarCalendario && (
        <div className="card" style={{ padding: '20px', border: '2px solid #BFDBFE', backgroundColor: '#F8FAFC' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="section-title" style={{ marginBottom: 0 }}>📅 Mis citas del día · {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            <button onClick={() => setMostrarCalendario(false)} className="btn btn-ghost btn-sm">✕</button>
          </div>
          {citasDelDia.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0', minHeight: '60px' }}><p className="empty-state-text">No hay citas programadas para hoy</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {citasDelDia.map(cita => (
                <div key={cita.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', backgroundColor: cita.estado === 'en_sala' ? '#F0FDF4' : '#FFF7ED', border: `1.5px solid ${cita.estado === 'en_sala' ? '#BBF7D0' : '#FED7AA'}` }}>
                  <div style={{ fontSize: '20px' }}>{cita.estado === 'en_sala' ? '🟢' : '⏳'}</div>
                  <div style={{ flex: 1 }}><span style={{ fontWeight: 600, fontSize: '14px' }}>{cita.nombre}</span><span style={{ fontSize: '12px', color: '#6B7280', marginLeft: '8px' }}>{cita.especialidad} · {cita.motivo}</span></div>
                  <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', fontSize: '13px', fontWeight: 600 }}>🕐 {cita.hora}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista de pacientes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
        {pacientesFiltrados.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🩺</div>
            <p className="empty-state-text">{pacientes.length === 0 ? 'No hay pacientes' : 'Sin resultados'}</p>
          </div>
        ) : (
          pacientesFiltrados.slice(0, 50).map((p, i) => {
            const minutos = getMinutos(p);
            const v = p.vitales || {};
            const n = Math.min((p.nivel_prioridad || 5), 5);
            const enConsulta = p.estado === 'en consulta';
            const esSiguiente = i === 0 && !enConsulta;
            const tClass = timerClass(p.nivel_prioridad, minutos);
            return (
              <div key={p.id} className="card"
                style={{
                  display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
                  alignItems: 'center', gap: '12px',
                  borderColor: enConsulta ? '#FED7AA' : (esSiguiente ? '#BFDBFE' : '#E5E7EB'),
                  backgroundColor: enConsulta ? '#FFF7ED' : (esSiguiente ? '#F8FAFC' : '#FFFFFF')
                }}
              >
                <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: 0, alignItems: 'center' }}>
                  <div style={{ width: '4px', height: '50px', borderRadius: '2px', flexShrink: 0, backgroundColor: coloresNivel[n] }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      {enConsulta && <span className="badge" style={{ backgroundColor: '#FFF7ED', color: '#EA580C', fontWeight: 600, fontSize: '10px' }}>🩺 En consulta</span>}
                      {!enConsulta && esSiguiente && <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6', fontWeight: 600, fontSize: '10px' }}>→ Siguiente</span>}
                      <span style={{ fontWeight: 600, fontSize: '15px' }}>{p.nombre}</span>
                      <span className="badge" style={{ backgroundColor: fondosNivel[n], color: coloresNivel[n], border: `1px solid ${coloresNivel[n]}` }}>N{p.nivel_prioridad}</span>
                      {!enConsulta && <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: tClass.fontWeight, color: tClass.color }}>⏱ {minutos} min</span>}
                      {licencia === 'clinica' && p.numero_turno && <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6', fontSize: '10px' }}>🔢 T{p.numero_turno}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', color: '#6B7280' }}>{p.edad} años · {p.especialidad}</span>
                      {p.signosAlarma?.length > 0 && <span style={{ fontSize: '11px', color: '#DC2626', fontWeight: 500 }}>⚠ {p.signosAlarma.join(' · ')}</span>}
                      <span style={{ fontSize: '13px', color: '#1F2937' }}><strong>Motivo:</strong> {p.motivo}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {v.ta && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', fontSize: '11px' }}>T/A: {v.ta}</span>}
                      {v.temp && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', fontSize: '11px' }}>Temp: {v.temp}°C</span>}
                      {v.fc && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', fontSize: '11px' }}>FC: {v.fc}</span>}
                      {v.spo2 && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB', fontSize: '11px' }}>SpO₂: {v.spo2}%</span>}
                    </div>
                  </div>
                </div>
                <button onClick={() => atenderPaciente(p)} className={`btn ${enConsulta ? 'btn-primary' : (esSiguiente ? 'btn-primary' : 'btn-secondary')}`} style={{ flexShrink: 0 }}>
                  {enConsulta ? 'Continuar atención' : (esSiguiente ? 'Atender ahora' : 'Atender')}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Botón flotante llamar y atender */}
      {pacientesFiltrados.filter(p => p.estado === 'espera').length > 0 && (
        <button onClick={llamarYAtender} className="btn btn-primary btn-lg"
          style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 40, boxShadow: '0 4px 20px rgba(59,130,246,0.3)' }}>
          📢 Llamar y atender · {pacientesFiltrados.filter(p => p.estado === 'espera')[0]?.nombre?.split(' ')[0]}
        </button>
      )}
    </div>
  );
}