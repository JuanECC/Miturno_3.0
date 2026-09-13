import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import {
  doc, getDoc, collection, query, orderBy, onSnapshot
} from 'firebase/firestore';
import { ArrowLeft, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import DocumentoImprimible from '../components/DocumentoImprimible';
import { useReactToPrint } from 'react-to-print';

export default function ExpedientePaciente() {
  const { pacienteId } = useParams();
  const navigate = useNavigate();
  const printRef = useRef();

  const [paciente, setPaciente] = useState(null);
  const [episodios, setEpisodios] = useState([]);
  const [episodioExpandido, setEpisodioExpandido] = useState(null);
  const [episodioParaImprimir, setEpisodioParaImprimir] = useState(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Episodio_${paciente?.nombre || 'paciente'}`,
    onAfterPrint: () => setEpisodioParaImprimir(null),
  });

  // Cargar datos demográficos
  useEffect(() => {
    if (!pacienteId) return;
    getDoc(doc(db, 'historial', pacienteId)).then((snap) => {
      if (snap.exists()) {
        setPaciente({ id: snap.id, ...snap.data() });
      } else {
        navigate(-1);
      }
    });
  }, [pacienteId]);

  // Cargar episodios desde subcolección nueva
  useEffect(() => {
    if (!pacienteId) return;
    const q = query(
      collection(db, 'historial', pacienteId, 'episodios'),
      orderBy('fechaAtencion', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEpisodios(lista);
    });
    return () => unsub();
  }, [pacienteId]);

  // Fallback a array antiguo si no hay subcolección
  useEffect(() => {
    if (!pacienteId || episodios.length > 0) return;
    getDoc(doc(db, 'historial', pacienteId)).then((snap) => {
      const data = snap.data();
      if (data && Array.isArray(data.episodios) && data.episodios.length > 0) {
        const ordenados = [...data.episodios].sort((a, b) => {
          const fechaA = a.fechaAlta?.seconds || a.fechaAtencion?.seconds || 0;
          const fechaB = b.fechaAlta?.seconds || b.fechaAtencion?.seconds || 0;
          return fechaB - fechaA;
        });
        setEpisodios(ordenados.map((ep, index) => ({ id: `old-${index}`, ...ep })));
      }
    });
  }, [pacienteId, episodios.length]);

  const formatearFecha = (fecha) => {
    if (!fecha) return '—';
    try {
      if (fecha.seconds) return new Date(fecha.seconds * 1000).toLocaleString('es-MX');
      if (fecha.toDate) return fecha.toDate().toLocaleString('es-MX');
      return new Date(fecha).toLocaleString('es-MX');
    } catch { return '—'; }
  };

  // Preparar e imprimir un episodio
  const imprimirEpisodio = (ep) => {
    setEpisodioParaImprimir(ep);
    setTimeout(() => handlePrint(), 300);
  };

  if (!paciente) {
    return <div className="page-container"><div className="card">Cargando expediente...</div></div>;
  }

  return (
    <div className="page-container">
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{ flex: 1, cursor: 'pointer' }}
                    onClick={() => setEpisodioExpandido(expandido ? null : ep.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '15px' }}>
                        {formatearFecha(ep.fechaAtencion || ep.fechaIngreso)}
                      </span>
                      {ep.diagnostico_cie10 && (
                        <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}>
                          {ep.diagnostico_cie10}
                        </span>
                      )}
                      {ep.destino && <span className="badge" style={{ backgroundColor: '#F3F4F6' }}>{ep.destino}</span>}
                      {ep.nivel && <span className="badge" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>N{ep.nivel}</span>}
                    </div>
                    <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                      {ep.motivo || 'Sin motivo registrado'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      onClick={() => imprimirEpisodio(ep)}
                      className="btn btn-secondary btn-sm"
                      title="Imprimir episodio"
                    >
                      <Printer size={14} />
                    </button>
                    <button
                      onClick={() => setEpisodioExpandido(expandido ? null : ep.id)}
                      className="btn btn-ghost btn-sm"
                    >
                      {expandido ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {expandido && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
                    {ep.historia_clinica && (
                      <div style={{ marginBottom: '16px' }}>
                        <h4 className="section-title">Historia Clínica</h4>
                        {ep.historia_clinica.padecimiento && <p><strong>Padecimiento:</strong> {ep.historia_clinica.padecimiento}</p>}
                        {ep.historia_clinica.antecedentes && <p><strong>Antecedentes:</strong> {ep.historia_clinica.antecedentes}</p>}
                        {ep.historia_clinica.exploracion && <p><strong>Exploración:</strong> {ep.historia_clinica.exploracion}</p>}
                      </div>
                    )}

                    {ep.diagnostico_descripcion && (
                      <div style={{ marginBottom: '16px' }}>
                        <h4 className="section-title">Diagnóstico</h4>
                        <p>{ep.diagnostico_cie10} - {ep.diagnostico_descripcion}</p>
                      </div>
                    )}

                    {ep.nota_medica && (
                      <div style={{ marginBottom: '16px' }}>
                        <h4 className="section-title">Nota Médica</h4>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{ep.nota_medica}</pre>
                      </div>
                    )}

                    {ep.indicaciones && ep.indicaciones.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <h4 className="section-title">Indicaciones</h4>
                        {ep.indicaciones.map((ind, i) => (
                          <div key={i} style={{ padding: '6px 0' }}>
                            <strong>{ind.medicamento}</strong> {ind.dosis} {ind.via} {ind.frecuencia}
                          </div>
                        ))}
                      </div>
                    )}

                    {ep.estudios && ep.estudios.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <h4 className="section-title">Estudios</h4>
                        {ep.estudios.map((est, i) => (
                          <div key={i} style={{ padding: '6px 0' }}>
                            {est.descripcion} ({est.tipo}) - {est.estado}
                          </div>
                        ))}
                      </div>
                    )}

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

      {/* Documento imprimible oculto */}
      <div style={{ display: 'none' }}>
        <DocumentoImprimible
          ref={printRef}
          tipo="atencion"
          datos={{
            paciente,
            medico: episodioParaImprimir?.medico || '',
            fecha: formatearFecha(episodioParaImprimir?.fechaAtencion || episodioParaImprimir?.fechaIngreso),
            destino: episodioParaImprimir?.destino || '',
            diagnostico: episodioParaImprimir?.diagnostico_cie10 || '',
            diagnosticoDesc: episodioParaImprimir?.diagnostico_descripcion || '',
            motivo: episodioParaImprimir?.motivo || '',
            nota: episodioParaImprimir?.nota_medica || '',
            indicaciones: episodioParaImprimir?.indicaciones || [],
            estudios: episodioParaImprimir?.estudios || [],
          }}
        />
      </div>
    </div>
  );
}