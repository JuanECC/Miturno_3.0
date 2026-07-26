import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Calendar, Clock, Plus, Trash2, ArrowRight } from 'lucide-react';
import { useToast } from '../components/Toast';

const ESPECIALIDADES = ['Medicina General', 'Ginecología', 'Pediatría', 'Cardiología', 'Traumatología', 'Neurología'];

export default function Citas() {
  const { addToast } = useToast();
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    nombre: '', edad: '', especialidad: 'Medicina General', motivo: '', fecha: '', hora: ''
  });
  const [guardando, setGuardando] = useState(false);
  const [sugerenciasHistorial, setSugerenciasHistorial] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  // Escuchar citas desde hoy
  useEffect(() => {
    const hoy = new Date();
    const hoyStr = hoy.getFullYear() + '-' + 
      String(hoy.getMonth() + 1).padStart(2, '0') + '-' + 
      String(hoy.getDate()).padStart(2, '0');
    
    const q = query(
      collection(db, 'citas'),
      where('fecha', '>=', hoyStr),
      orderBy('fecha', 'asc'),
      orderBy('hora', 'asc')
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCitas(lista);
      setLoading(false);
    }, (error) => {
      console.error('Error escuchando citas:', error);
      addToast('Error al cargar las citas', 'error', 4000, 'Error');
      setLoading(false);
    });
    
    return () => unsub();
  }, []);

  // Verificar citas que deben pasar a sala
  useEffect(() => {
    const verificarYActualizar = async () => {
      const ahora = new Date();
      const ahoraStr = ahora.getFullYear() + '-' + 
        String(ahora.getMonth() + 1).padStart(2, '0') + '-' + 
        String(ahora.getDate()).padStart(2, '0');
      const horaActual = String(ahora.getHours()).padStart(2, '0') + ':' + 
                         String(ahora.getMinutes()).padStart(2, '0');
      
      for (const cita of citas) {
        if (cita.estado !== 'pendiente') continue;
        
        const fechaCita = cita.fecha;
        const horaCita = cita.hora;
        if (!fechaCita || !horaCita) continue;
        
        const citaPasada = fechaCita < ahoraStr;
        const citaHoyHoraPasada = fechaCita === ahoraStr && horaCita <= horaActual;
        
        if (citaPasada || citaHoyHoraPasada) {
          try {
            const pacientesQuery = query(
              collection(db, 'pacientes'),
              where('cita_id', '==', cita.id)
            );
            const pacientesSnap = await getDocs(pacientesQuery);
            
            if (!pacientesSnap.empty) {
              await updateDoc(doc(db, 'citas', cita.id), { estado: 'en_sala' });
              continue;
            }
            
            await addDoc(collection(db, 'pacientes'), {
              nombre: cita.nombre,
              edad: cita.edad || 0,
              especialidad: cita.especialidad || 'Medicina General',
              motivo: cita.motivo || 'Cita programada',
              nivel_prioridad: 5,
              nombre_nivel: 'NO URGENTE',
              razon_triage: 'Cita programada (pase automático)',
              estado: 'espera',
              ubicacion_actual: 'Sala de espera',
              fecha_ingreso: serverTimestamp(),
              origen: 'cita',
              cita_id: cita.id
            });
            
            await updateDoc(doc(db, 'citas', cita.id), { estado: 'en_sala' });
            addToast(`⏰ Cita de ${cita.nombre} (${horaCita}) pasó a sala de espera`, 'info', 4000, '📅 Pase automático');
          } catch (err) {
            console.error('Error al mover cita a sala:', err);
          }
        }
      }
    };

    verificarYActualizar();
    const interval = setInterval(verificarYActualizar, 30000);
    return () => clearInterval(interval);
  }, [citas]);

  // Buscar en historial
  const buscarEnHistorial = async (texto) => {
    if (texto.length < 2) {
      setSugerenciasHistorial([]);
      setMostrarSugerencias(false);
      return;
    }
    try {
      const snap = await getDocs(collection(db, 'historial'));
      const tl = texto.toLowerCase().trim();
      const resultados = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(h => (h.nombre || '').toLowerCase().includes(tl))
        .slice(0, 5);
      setSugerenciasHistorial(resultados);
      setMostrarSugerencias(resultados.length > 0);
    } catch (err) {
      console.error('Error buscando en historial:', err);
    }
  };

  // Seleccionar sugerencia
  const seleccionarSugerencia = (h) => {
    setForm(prev => ({
      ...prev,
      nombre: h.nombre,
      edad: h.edad || '',
      especialidad: h.especialidad || 'Medicina General',
    }));
    setMostrarSugerencias(false);
    addToast(`"${h.nombre}" tiene ${h.totalEpisodios} episodio(s) previo(s)`, 'info', 4000, '📋 Historial');
  };

  // Agendar cita
  const agendarCita = async () => {
    if (!form.nombre.trim()) {
      addToast('El nombre del paciente es obligatorio', 'warning', 3000, 'Campo requerido');
      return;
    }
    if (!form.fecha) {
      addToast('Selecciona una fecha para la cita', 'warning', 3000, 'Fecha requerida');
      return;
    }
    if (!form.hora) {
      addToast('Selecciona una hora para la cita', 'warning', 3000, 'Hora requerida');
      return;
    }
    
    const hoy = new Date();
    const hoyStr = hoy.getFullYear() + '-' + 
      String(hoy.getMonth() + 1).padStart(2, '0') + '-' + 
      String(hoy.getDate()).padStart(2, '0');
    
    if (form.fecha < hoyStr) {
      addToast('No se pueden agendar citas en fechas pasadas', 'warning', 3000, 'Fecha inválida');
      return;
    }
    
    setGuardando(true);
    try {
      await addDoc(collection(db, 'citas'), {
        nombre: form.nombre.trim(),
        edad: parseInt(form.edad) || 0,
        especialidad: form.especialidad || 'Medicina General',
        motivo: form.motivo || 'Cita programada',
        fecha: form.fecha,
        hora: form.hora,
        estado: 'pendiente',
        createdAt: serverTimestamp()
      });
      
      addToast(`Cita para ${form.nombre} agendada el ${formatearFechaCorta(form.fecha)} a las ${form.hora}`, 'success', 4000, '✅ Cita creada');
      
      setForm({ 
        nombre: '', edad: '', especialidad: 'Medicina General', 
        motivo: '', fecha: '', hora: '' 
      });
      setFormOpen(false);
    } catch (err) {
      console.error('Error al agendar cita:', err);
      addToast('Error al agendar la cita. Intenta de nuevo.', 'error', 4000, 'Error');
    } finally {
      setGuardando(false);
    }
  };

  // Cancelar cita
  const cancelarCita = async (cita) => {
    if (!window.confirm(`¿Cancelar la cita de ${cita.nombre} del ${formatearFechaCorta(cita.fecha)} a las ${cita.hora}?`)) return;
    
    try {
      await deleteDoc(doc(db, 'citas', cita.id));
      addToast(`Cita de ${cita.nombre} cancelada`, 'success', 3000, '🗑️ Cancelada');
    } catch (err) {
      console.error('Error al cancelar cita:', err);
      addToast('Error al cancelar la cita', 'error', 4000, 'Error');
    }
  };

  // Mover a sala manualmente
  const moverASalaManual = async (cita) => {
    try {
      const pacientesQuery = query(
        collection(db, 'pacientes'),
        where('cita_id', '==', cita.id)
      );
      const pacientesSnap = await getDocs(pacientesQuery);
      
      if (!pacientesSnap.empty) {
        addToast('Esta cita ya tiene un paciente en sala de espera', 'warning', 3000, '⏳ Ya registrado');
        await updateDoc(doc(db, 'citas', cita.id), { estado: 'en_sala' });
        return;
      }
      
      await addDoc(collection(db, 'pacientes'), {
        nombre: cita.nombre,
        edad: cita.edad || 0,
        especialidad: cita.especialidad || 'Medicina General',
        motivo: cita.motivo || 'Cita programada',
        nivel_prioridad: 5,
        nombre_nivel: 'NO URGENTE',
        razon_triage: 'Cita programada (pase manual)',
        estado: 'espera',
        ubicacion_actual: 'Sala de espera',
        fecha_ingreso: serverTimestamp(),
        origen: 'cita',
        cita_id: cita.id
      });
      
      await updateDoc(doc(db, 'citas', cita.id), { estado: 'en_sala' });
      addToast(`${cita.nombre} movido a sala de espera`, 'success', 3000, '✅ En sala');
    } catch (err) {
      console.error('Error al mover a sala:', err);
      addToast('Error al mover paciente a sala', 'error', 4000, 'Error');
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '—';
    try {
      return new Date(fecha + 'T00:00:00').toLocaleDateString('es-MX', { 
        weekday: 'long', day: 'numeric', month: 'long' 
      });
    } catch { return fecha; }
  };

  const formatearFechaCorta = (fecha) => {
    if (!fecha) return '—';
    try {
      return new Date(fecha + 'T00:00:00').toLocaleDateString('es-MX', { 
        day: 'numeric', month: 'short' 
      });
    } catch { return fecha; }
  };

  const citasPendientes = citas.filter(c => c.estado === 'pendiente');
  const citasEnSala = citas.filter(c => c.estado === 'en_sala');
  const citasCompletadas = citas.filter(c => c.estado === 'completada');

  return (
    <div className="page-container">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 className="page-title">Citas Programadas</h1>
          <p className="page-subtitle">
            Los pacientes pasan automáticamente a sala de espera cuando llega su hora
          </p>
        </div>
        <button onClick={() => setFormOpen(!formOpen)} className="btn btn-primary">
          <Plus size={18} /> {formOpen ? 'Cancelar' : 'Nueva cita'}
        </button>
      </div>

      {formOpen && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 className="section-title">Agendar nueva cita</h3>
          <div style={{ 
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
            gap: '12px', marginTop: '12px' 
          }}>
            {/* 🆕 INPUT DE NOMBRE CON BUSCADOR DE HISTORIAL */}
            <div style={{ position: 'relative' }}>
              <label className="label">Nombre *</label>
              <input 
                type="text" 
                value={form.nombre} 
                onChange={e => {
                  setForm({...form, nombre: e.target.value});
                  buscarEnHistorial(e.target.value);
                }}
                onFocus={() => {
                  if (sugerenciasHistorial.length > 0) setMostrarSugerencias(true);
                }}
                onBlur={() => setTimeout(() => setMostrarSugerencias(false), 200)}
                placeholder="Nombre del paciente" 
                className="input-modern" 
              />
              {mostrarSugerencias && sugerenciasHistorial.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  backgroundColor: '#FFF', border: '1px solid #E5E7EB',
                  borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                  zIndex: 50, marginTop: '4px', overflow: 'hidden'
                }}>
                  {sugerenciasHistorial.map(h => (
                    <button
                      key={h.id}
                      onMouseDown={() => seleccionarSugerencia(h)}
                      style={{
                        width: '100%', padding: '12px 16px', border: 'none',
                        borderBottom: '1px solid #F3F4F6', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'none', textAlign: 'left'
                      }}
                    >
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: 500, color: '#1F2937' }}>{h.nombre}</p>
                        <p style={{ fontSize: '12px', color: '#9CA3AF' }}>
                          {h.edad} años · {h.especialidad || 'General'} · {h.totalEpisodios} episodio(s)
                        </p>
                      </div>
                      <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>
                        📋 Historial
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="label">Edad</label>
              <input 
                type="number" value={form.edad} 
                onChange={e => setForm({...form, edad: e.target.value})} 
                placeholder="0" className="input-modern" 
              />
            </div>
            <div>
              <label className="label">Especialidad</label>
              <select 
                value={form.especialidad} 
                onChange={e => setForm({...form, especialidad: e.target.value})} 
                className="input-modern"
              >
                {ESPECIALIDADES.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Motivo</label>
              <input 
                type="text" value={form.motivo} 
                onChange={e => setForm({...form, motivo: e.target.value})} 
                placeholder="Motivo de consulta" className="input-modern" 
              />
            </div>
            <div>
              <label className="label">Fecha *</label>
              <input 
                type="date" value={form.fecha} 
                onChange={e => setForm({...form, fecha: e.target.value})} 
                className="input-modern" 
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="label">Hora *</label>
              <input 
                type="time" value={form.hora} 
                onChange={e => setForm({...form, hora: e.target.value})} 
                className="input-modern" 
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button 
              onClick={agendarCita} disabled={guardando} 
              className="btn btn-primary"
            >
              {guardando ? 'Agendando...' : '✅ Agendar cita'}
            </button>
            <button 
              onClick={() => setFormOpen(false)} 
              className="btn btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="cards-grid-3">
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="kpi-value" style={{ color: '#3B82F6' }}>{citasPendientes.length}</div>
          <div className="kpi-label">⏳ Pendientes</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="kpi-value" style={{ color: '#EAB308' }}>{citasEnSala.length}</div>
          <div className="kpi-label">🟢 En sala de espera</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="kpi-value" style={{ color: '#16A34A' }}>{citasCompletadas.length}</div>
          <div className="kpi-label">✅ Completadas</div>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div className="skeleton" style={{ width: '200px', height: '16px', margin: '0 auto' }} />
          <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '12px' }}>Cargando citas...</p>
        </div>
      ) : citas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <p className="empty-state-text">No hay citas programadas</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {citasPendientes.length > 0 && (
            <div>
              <h3 className="section-title">⏳ Pendientes ({citasPendientes.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {citasPendientes.map(cita => (
                  <div key={cita.id} className="card" style={{ 
                    padding: '16px', display: 'flex', flexWrap: 'wrap', 
                    justifyContent: 'space-between', alignItems: 'center', 
                    gap: '12px', borderLeft: '4px solid #3B82F6' 
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '15px' }}>{cita.nombre}</span>
                        <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>
                          {cita.especialidad}
                        </span>
                        {cita.edad > 0 && (
                          <span style={{ fontSize: '13px', color: '#6B7280' }}>{cita.edad} años</span>
                        )}
                      </div>
                      {cita.motivo && (
                        <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>{cita.motivo}</p>
                      )}
                      <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '12px', color: '#9CA3AF' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} /> {formatearFecha(cita.fecha)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> {cita.hora}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button 
                        onClick={() => moverASalaManual(cita)} 
                        className="btn btn-primary btn-sm" 
                        title="Mover a sala de espera ahora"
                      >
                        <ArrowRight size={14} /> A sala
                      </button>
                      <button 
                        onClick={() => cancelarCita(cita)} 
                        className="btn btn-sm" 
                        style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                        title="Cancelar cita"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {citasEnSala.length > 0 && (
            <div>
              <h3 className="section-title">🟢 En sala de espera ({citasEnSala.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {citasEnSala.map(cita => (
                  <div key={cita.id} className="card" style={{ 
                    padding: '16px', display: 'flex', alignItems: 'center', 
                    gap: '12px', borderLeft: '4px solid #EAB308', opacity: 0.8 
                  }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{cita.nombre}</span>
                    <span className="badge" style={{ backgroundColor: '#FFF7ED', color: '#EAB308' }}>
                      En sala
                    </span>
                    <span style={{ fontSize: '13px', color: '#6B7280' }}>
                      {cita.especialidad} · {cita.hora}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {citasCompletadas.length > 0 && (
            <div>
              <h3 className="section-title">✅ Completadas ({citasCompletadas.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {citasCompletadas.map(cita => (
                  <div key={cita.id} className="card" style={{ 
                    padding: '16px', display: 'flex', alignItems: 'center', 
                    gap: '12px', borderLeft: '4px solid #16A34A', opacity: 0.7 
                  }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{cita.nombre}</span>
                    <span className="badge" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>
                      Completada
                    </span>
                    <span style={{ fontSize: '13px', color: '#6B7280' }}>
                      {cita.especialidad} · {cita.hora}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}