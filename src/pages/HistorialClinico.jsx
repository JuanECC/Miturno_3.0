import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Search, FolderOpen } from 'lucide-react';

const ESPECIALIDADES = ['', 'Medicina General', 'Ginecología', 'Pediatría', 'Cardiología', 'Traumatología', 'Neurología'];

export default function HistorialClinico() {
  const navigate = useNavigate();
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [espFilter, setEspFilter] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'historial'), orderBy('fechaUltimaVisita', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setHistorial(lista);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const historialFiltrado = historial.filter(h => {
    const matchBuscar = !buscar || h.nombre?.toLowerCase().includes(buscar.toLowerCase());
    const matchEsp = !espFilter || h.especialidad === espFilter;
    return matchBuscar && matchEsp;
  });

  const formatearFecha = (fecha) => {
    if (!fecha) return '—';
    try {
      if (fecha.seconds) return new Date(fecha.seconds * 1000).toLocaleString('es-MX');
      if (fecha.toDate) return fecha.toDate().toLocaleString('es-MX');
      return new Date(fecha).toLocaleString('es-MX');
    } catch { return '—'; }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 className="page-title">Historial Clínico</h1>
          <p className="page-subtitle">Expediente electrónico de pacientes atendidos</p>
        </div>
        <div className="badge" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', padding: '8px 14px' }}>
          <span style={{ fontWeight: 600 }}>{historial.length}</span> expedientes
        </div>
      </div>

      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label className="label">Buscar paciente</label>
            <input type="text" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Nombre..." className="input-modern" />
          </div>
          <div style={{ minWidth: '180px' }}>
            <label className="label">Especialidad</label>
            <select value={espFilter} onChange={e => setEspFilter(e.target.value)} className="input-modern">
              <option value="">Todas</option>
              {ESPECIALIDADES.filter(e => e).map(e => <option key={e}>{e}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div className="skeleton" style={{ width: '200px', height: '16px', margin: '0 auto' }} />
        </div>
      ) : historialFiltrado.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p className="empty-state-text">{historial.length === 0 ? 'No hay expedientes' : 'Sin resultados'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {historialFiltrado.map(h => (
            <div
              key={h.id}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'border-color 0.2s' }}
              onClick={() => navigate(`/expediente/${h.id}`)}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#3B82F6'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}
            >
              <div style={{
                width: '44px', height: '44px', borderRadius: '14px',
                backgroundColor: '#EFF6FF', color: '#3B82F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '18px', flexShrink: 0
              }}>
                {(h.nombre || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '15px' }}>{h.nombre}</span>
                  {h.edad > 0 && <span style={{ fontSize: '13px', color: '#6B7280' }}>{h.edad} años</span>}
                  {h.especialidad && <span className="badge" style={{ backgroundColor: '#F3F4F6' }}>{h.especialidad}</span>}
                </div>
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>
                  {h.totalEpisodios || 0} episodio(s) · Última visita: {formatearFecha(h.fechaUltimaVisita)}
                </p>
              </div>
              <FolderOpen size={18} style={{ color: '#9CA3AF', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}