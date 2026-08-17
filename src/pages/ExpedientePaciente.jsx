import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import {
  doc, getDoc, collection, query, orderBy, onSnapshot,
  getDocs
} from 'firebase/firestore';
import {
  ArrowLeft, FileText, Pill, FlaskConical, History,
  ChevronDown, ChevronUp
} from 'lucide-react';

export default function ExpedientePaciente() {
  const { pacienteId } = useParams();
  const navigate = useNavigate();

  const [paciente, setPaciente] = useState(null);
  const [episodios, setEpisodios] = useState([]);
  const [episodioExpandido, setEpisodioExpandido] = useState(null);

  // Cargar datos demográficos del paciente
  useEffect(() => {
    if (!pacienteId) return;
    getDoc(doc(db, 'historial', pacienteId)).then((snap) => {
      if (snap.exists()) {
        setPaciente({ id: snap.id, ...snap.data() });
      } else {
        navigate('/historial');
      }
    });
  }, [pacienteId]);

  // Cargar episodios desde subcolección
  useEffect(() => {
    if (!pacienteId) return;
    const q = query(collection(db, 'historial', pacienteId, 'episodios'), orderBy('fechaAtencion', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEpisodios(lista);
    });
    return () => unsub();
  }, [pacienteId]);

  // Cargar episodios desde documento antiguo (array) si no hay subcolección
  useEffect(() => {
    if (!pacienteId || episodios.length > 0) return;
    getDoc(doc(db, 'historial', pacienteId)).then((snap) => {
      const data = snap.data();
      if (data && Array.isArray(data.episodios) && data.episodios.length > 0) {
        setEpisodios(data.episodios.map((ep, index) => ({ id: `old-${index}`, ...ep })));
      }
    });
  }, [pacienteId, episodios.length]);

  const formatearFecha = (fecha) => {
    if (!fecha) return '—';
    try {
      if (fecha.seconds) return new Date(fecha.seconds * 1000).toLocaleString('es-MX');
      if (fecha.toDate) return fecha.toDate().toLocaleString('es-MX');
      return new Date(fecha).toLocaleString('es-MX');
    } catch { return fecha; }
  };

  if (!paciente) {
    return <div className="page-container"><div className="card">Cargando expediente...</div></div>;
  }

  return (
    <div className="page-container">
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="page-title">Expediente Electrónico</h1>
          <p className="page-subtitle">
            {paciente.nombre} · {paciente.edad} años · {paciente.especialidad || 'General'}
          </p>
        </div>
        <div className="badge" style={{ marginLeft: 'auto', backgroundColor: '#EFF6FF', color: '#3B82F6' }}>
          📁 {episodios.length} episodio{episodios.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Lista de episodios */}
      {episodios.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <p className="empty-state-text">No hay episodios registrados</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {episodios.map(ep => {
            const expandido = episodioExpandido === ep.id;
            return (
              <div key={ep.id} className="card" style={{ padding: '16px' }}>
                <div
                  onClick={() => setEpisodioExpandido(expandido ? null : ep.id)}
                  style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', cursor: 'pointer', gap: '12px'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '15px' }}>
                        {formatearFecha(ep.fechaAtencion || ep.fechaAlta || ep.fechaIngreso)}
                      </span>
                      {ep.diagnostico_cie10 && (
                        <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>
                          {ep.diagnostico_cie10}
                        </span>
                      )}
                      {ep.destino && (
                        <span className="badge" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                          {ep.destino}
                        </span>
                      )}
                      {ep.nivel && (
                        <span className="badge" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                          N{ep.nivel}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                      {ep.motivo || 'Sin motivo registrado'}
                    </p>
                  </div>
                  {expandido ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>

                {expandido && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
                    {/* Historia clínica */}
                    {ep.historia_clinica && (
                      <div style={{ marginBottom: '16px' }}>
                        <h4 className="section-title">📋 Historia Clínica</h4>
                        {ep.historia_clinica.padecimiento && <p><strong>Padecimiento:</strong> {ep.historia_clinica.padecimiento}</p>}
                        {ep.historia_clinica.antecedentes && <p><strong>Antecedentes:</strong> {ep.historia_clinica.antecedentes}</p>}
                        {ep.historia_clinica.exploracion && <p><strong>Exploración:</strong> {ep.historia_clinica.exploracion}</p>}
                      </div>
                    )}

                    {/* Diagnóstico */}
                    {ep.diagnostico_descripcion && (
                      <div style={{ marginBottom: '16px' }}>
                        <h4 className="section-title">🩺 Diagnóstico</h4>
                        <p>{ep.diagnostico_cie10} - {ep.diagnostico_descripcion}</p>
                      </div>
                    )}

                    {/* Nota médica */}
                    {ep.nota_medica && (
                      <div style={{ marginBottom: '16px' }}>
                        <h4 className="section-title"><FileText size={14} /> Nota Médica</h4>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#1F2937' }}>{ep.nota_medica}</pre>
                      </div>
                    )}

                    {/* Indicaciones */}
                    {ep.indicaciones && ep.indicaciones.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <h4 className="section-title"><Pill size={14} /> Indicaciones</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {ep.indicaciones.map((ind, i) => (
                            <div key={i} style={{ padding: '8px 12px', backgroundColor: '#F9FAFB', borderRadius: '8px' }}>
                              <strong>{ind.medicamento}</strong> {ind.dosis} {ind.via} {ind.frecuencia}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Estudios */}
                    {ep.estudios && ep.estudios.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <h4 className="section-title"><FlaskConical size={14} /> Estudios</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {ep.estudios.map((est, i) => (
                            <div key={i} style={{ padding: '8px 12px', backgroundColor: '#F9FAFB', borderRadius: '8px' }}>
                              {est.descripcion} ({est.tipo}) - {est.estado}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Seguimiento */}
                    {ep.seguimiento && ep.seguimiento.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <h4 className="section-title"><History size={14} /> Seguimiento</h4>
                        {ep.seguimiento.map((seg, i) => (
                          <div key={i} style={{ padding: '8px 12px', backgroundColor: '#F9FAFB', borderRadius: '8px', marginBottom: '6px' }}>
                            {seg.nota && <p>{seg.nota}</p>}
                            {seg.vitales && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {seg.vitales.ta && <span className="badge">T/A: {seg.vitales.ta}</span>}
                                {seg.vitales.temp && <span className="badge">Temp: {seg.vitales.temp}°C</span>}
                                {seg.vitales.fc && <span className="badge">FC: {seg.vitales.fc}</span>}
                                {seg.vitales.spo2 && <span className="badge">SpO₂: {seg.vitales.spo2}%</span>}
                                {seg.vitales.glu && <span className="badge">Glucosa: {seg.vitales.glu}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Médico */}
                    {ep.medico && (
                      <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                        Atendido por: {ep.medico}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}