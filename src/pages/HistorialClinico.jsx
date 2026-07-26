import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Search, FileText, ChevronDown, ChevronUp, Printer, Filter } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useReactToPrint } from 'react-to-print';

const ESPECIALIDADES = ['', 'Medicina General', 'Ginecología', 'Pediatría', 'Cardiología', 'Traumatología', 'Neurología'];
const COLORES_NIVEL = ['', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb'];
const FONDOS_NIVEL = ['', '#fef2f2', '#fff7ed', '#fefce8', '#f0fdf4', '#eff4ff'];

export default function HistorialClinico() {
  const { addToast } = useToast();
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [espFilter, setEspFilter] = useState('');
  const [nivelFilter, setNivelFilter] = useState('');
  const [episodioExpandido, setEpisodioExpandido] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const printRef = useRef();

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Historial_${pdfData?.nombre || 'paciente'}`,
    onAfterPrint: () => setPdfData(null),
  });

  useEffect(() => {
    cargarHistorial();
  }, []);

  useEffect(() => {
    if (pdfData) {
      const timer = setTimeout(() => {
        if (printRef.current) {
          handlePrint();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pdfData]);

  const cargarHistorial = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'historial'), orderBy('fechaUltimaVisita', 'desc'));
      const snap = await getDocs(q);
      const datos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setHistorial(datos);
    } catch (err) {
      console.error('Error cargando historial:', err);
      addToast('Error al cargar el historial clínico', 'error', 4000, 'Error');
    } finally {
      setLoading(false);
    }
  };

  const historialFiltrado = historial.filter(h => {
    const matchBuscar = !buscar || h.nombre?.toLowerCase().includes(buscar.toLowerCase());
    const matchEsp = !espFilter || h.episodios?.some(e => e.especialidad === espFilter);
    const matchNivel = !nivelFilter || h.episodios?.some(e => e.nivel <= parseInt(nivelFilter));
    return matchBuscar && matchEsp && matchNivel;
  });

  const toggleEpisodio = (historialId, episodioId) => {
    const key = `${historialId}_${episodioId}`;
    setEpisodioExpandido(episodioExpandido === key ? null : key);
  };

  const generarPDF = (historialData, episodio) => {
    setPdfData({
      nombre: historialData.nombre,
      edad: historialData.edad,
      episodio,
      fechaImpresion: new Date().toLocaleString('es-MX'),
    });
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return '—';
    try {
      if (fecha.seconds) {
        return new Date(fecha.seconds * 1000).toLocaleString('es-MX');
      }
      return new Date(fecha).toLocaleString('es-MX');
    } catch {
      return fecha;
    }
  };

  return (
    <div className="page-container">
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 className="page-title">Historial Clínico</h1>
          <p className="page-subtitle">Registros médicos de pacientes atendidos</p>
        </div>
        <div className="badge" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', padding: '8px 14px', fontSize: '14px' }}>
          <span style={{ fontWeight: 600, color: '#1F2937' }}>{historial.length}</span>
          <span style={{ color: '#6B7280', marginLeft: '4px' }}>expedientes</span>
        </div>
      </div>

      {/* ── FILTROS ── */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label className="label">Buscar paciente</label>
            <input
              type="text"
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              placeholder="Nombre del paciente..."
              className="input-modern"
            />
          </div>
          <div style={{ minWidth: '160px' }}>
            <label className="label">Especialidad</label>
            <select value={espFilter} onChange={e => setEspFilter(e.target.value)} className="input-modern">
              <option value="">Todas</option>
              {ESPECIALIDADES.filter(e => e).map(e => <option key={e}>{e}</option>)}
            </select>
          </div>
          <div style={{ minWidth: '140px' }}>
            <label className="label">Nivel máximo</label>
            <select value={nivelFilter} onChange={e => setNivelFilter(e.target.value)} className="input-modern">
              <option value="">Todos</option>
              <option value="1">N1 — Resucitación</option>
              <option value="2">N2 — Emergencia</option>
              <option value="3">N3 — Urgencia</option>
              <option value="4">N4 — Menor</option>
              <option value="5">N5 — No urgente</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── LISTA DE EXPEDIENTES ── */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div className="skeleton" style={{ width: '200px', height: '16px', margin: '0 auto' }} />
          <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '12px' }}>Cargando historial...</p>
        </div>
      ) : historialFiltrado.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p className="empty-state-text">
            {historial.length === 0 ? 'No hay historiales clínicos registrados' : 'Sin resultados con esos filtros'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {historialFiltrado.map(h => {
            const episodios = (h.episodios || []).sort((a, b) => {
              const fechaA = a.fechaAlta?.seconds || new Date(a.fechaAlta).getTime() / 1000 || 0;
              const fechaB = b.fechaAlta?.seconds || new Date(b.fechaAlta).getTime() / 1000 || 0;
              return fechaB - fechaA;
            });
            const ultimoEpisodio = episodios[0];

            return (
              <div key={h.id} className="card">
                {/* Cabecera del paciente */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: episodios.length > 0 ? '16px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '14px',
                      backgroundColor: '#EFF6FF', color: '#3B82F6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '18px'
                    }}>
                      {(h.nombre || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '16px', color: '#1F2937' }}>{h.nombre}</p>
                      <p style={{ fontSize: '13px', color: '#6B7280' }}>
                        {h.edad} años · {episodios.length} episodio{episodios.length !== 1 ? 's' : ''}
                        {ultimoEpisodio && ` · Última visita: ${formatearFecha(ultimoEpisodio.fechaAlta)}`}
                      </p>
                    </div>
                  </div>
                  <span className="badge" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                    Exp. #{h.id.slice(-6).toUpperCase()}
                  </span>
                </div>

                {/* Lista de episodios */}
                {episodios.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {episodios.map((ep, idx) => {
                      const key = `${h.id}_${ep.id}`;
                      const expandido = episodioExpandido === key;
                      const n = Math.min(ep.nivel || 5, 5);

                      return (
                        <div key={ep.id} style={{
                          backgroundColor: '#F9FAFB',
                          borderRadius: '14px',
                          overflow: 'hidden',
                          border: '1px solid #E5E7EB'
                        }}>
                          {/* Resumen del episodio */}
                          <div
                            onClick={() => toggleEpisodio(h.id, ep.id)}
                            style={{
                              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px',
                              padding: '14px 16px', cursor: 'pointer',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                          >
                            <span style={{
                              fontSize: '13px', fontWeight: 600, color: '#6B7280',
                              minWidth: '80px'
                            }}>
                              Episodio {episodios.length - idx}
                            </span>
                            <span className="badge" style={{
                              backgroundColor: FONDOS_NIVEL[n],
                              color: COLORES_NIVEL[n],
                              border: `1px solid ${COLORES_NIVEL[n]}`
                            }}>
                              N{ep.nivel}
                            </span>
                            <span style={{ fontSize: '13px', color: '#6B7280' }}>
                              {formatearFecha(ep.fechaIngreso)}
                            </span>
                            <span style={{ fontSize: '13px', color: '#1F2937', fontWeight: 500 }}>
                              {ep.especialidad}
                            </span>
                            <span style={{ fontSize: '13px', color: '#6B7280' }}>
                              Dr(a). {ep.medico}
                            </span>

                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); generarPDF(h, ep); }}
                                className="btn btn-secondary btn-sm"
                                title="Imprimir PDF"
                              >
                                <Printer size={14} />
                              </button>
                              {expandido ? <ChevronUp size={16} style={{ color: '#9CA3AF' }} /> : <ChevronDown size={16} style={{ color: '#9CA3AF' }} />}
                            </div>
                          </div>

                          {/* Detalle expandido */}
                          {expandido && (
                            <div style={{
                              padding: '16px 20px',
                              borderTop: '1px solid #E5E7EB',
                              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                              gap: '16px'
                            }}>
                              <div>
                                <p className="label">Motivo de consulta</p>
                                <p style={{ fontSize: '14px', color: '#1F2937' }}>{ep.motivo || '—'}</p>
                              </div>
                              <div>
                                <p className="label">Diagnóstico</p>
                                <p style={{ fontSize: '14px', color: '#1F2937' }}>
                                  {ep.diagnostico ? `${ep.diagnostico} — ${ep.diagnosticoDesc || ''}` : '—'}
                                </p>
                              </div>
                              <div>
                                <p className="label">Tratamiento</p>
                                <p style={{ fontSize: '14px', color: '#1F2937' }}>{ep.tratamiento || '—'}</p>
                              </div>
                              <div>
                                <p className="label">Destino</p>
                                <p style={{ fontSize: '14px', color: '#1F2937' }}>{ep.destino || '—'}</p>
                              </div>
                              {ep.signosVitales && Object.keys(ep.signosVitales).length > 0 && (
                                <div>
                                  <p className="label">Signos vitales</p>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {ep.signosVitales.ta && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB' }}>T/A: {ep.signosVitales.ta}</span>}
                                    {ep.signosVitales.temp && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB' }}>Temp: {ep.signosVitales.temp}°C</span>}
                                    {ep.signosVitales.fc && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB' }}>FC: {ep.signosVitales.fc}</span>}
                                    {ep.signosVitales.spo2 && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB' }}>SpO₂: {ep.signosVitales.spo2}%</span>}
                                    {ep.signosVitales.glu && <span className="badge" style={{ backgroundColor: '#FFF', border: '1px solid #E5E7EB' }}>Glucosa: {ep.signosVitales.glu}</span>}
                                  </div>
                                </div>
                              )}
                              {ep.signosAlarma?.length > 0 && (
                                <div>
                                  <p className="label">Signos de alarma</p>
                                  <p style={{ fontSize: '13px', color: '#DC2626', fontWeight: 500 }}>⚠ {ep.signosAlarma.join(' · ')}</p>
                                </div>
                              )}
                              <div>
                                <p className="label">Fechas</p>
                                <p style={{ fontSize: '13px', color: '#6B7280' }}>
                                  Ingreso: {formatearFecha(ep.fechaIngreso)}<br />
                                  Alta: {formatearFecha(ep.fechaAlta)}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════ PDF OCULTO ═══════════════ */}
      <div style={{ display: 'none' }}>
        <div ref={printRef} style={{ padding: '20px', fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#000' }}>
          {pdfData && (
            <>
              <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '16px' }}>🏥 MITURNO — INFORME DE ATENCIÓN</h2>
                <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#666' }}>Generado el {pdfData.fechaImpresion}</p>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '6px 10px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f5f5f5', width: '20%' }}>Paciente</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #ddd' }}>{pdfData.nombre}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f5f5f5', width: '15%' }}>Edad</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #ddd' }}>{pdfData.edad} años</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 10px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f5f5f5' }}>Especialidad</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #ddd' }}>{pdfData.episodio.especialidad}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f5f5f5' }}>Nivel</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #ddd', fontWeight: 'bold', color: COLORES_NIVEL[Math.min(pdfData.episodio.nivel || 5, 5)] }}>
                      N{pdfData.episodio.nivel}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '6px 10px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f5f5f5' }}>Ingreso</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #ddd' }}>{formatearFecha(pdfData.episodio.fechaIngreso)}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #ddd', fontWeight: 'bold', background: '#f5f5f5' }}>Alta</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #ddd' }}>{formatearFecha(pdfData.episodio.fechaAlta)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginBottom: '12px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>SIGNOS VITALES</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {pdfData.episodio.signosVitales?.ta && <span style={{ padding: '3px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '11px' }}>T/A: {pdfData.episodio.signosVitales.ta}</span>}
                  {pdfData.episodio.signosVitales?.temp && <span style={{ padding: '3px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '11px' }}>Temp: {pdfData.episodio.signosVitales.temp}°C</span>}
                  {pdfData.episodio.signosVitales?.fc && <span style={{ padding: '3px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '11px' }}>FC: {pdfData.episodio.signosVitales.fc}</span>}
                  {pdfData.episodio.signosVitales?.spo2 && <span style={{ padding: '3px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '11px' }}>SpO₂: {pdfData.episodio.signosVitales.spo2}%</span>}
                  {pdfData.episodio.signosVitales?.glu && <span style={{ padding: '3px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '11px' }}>Glucosa: {pdfData.episodio.signosVitales.glu}</span>}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>DIAGNÓSTICO</h3>
                <p><strong>Motivo:</strong> {pdfData.episodio.motivo || '—'}</p>
                <p><strong>Diagnóstico:</strong> {pdfData.episodio.diagnostico ? `${pdfData.episodio.diagnostico} — ${pdfData.episodio.diagnosticoDesc || ''}` : '—'}</p>
                <p><strong>Tratamiento:</strong> {pdfData.episodio.tratamiento || '—'}</p>
                <p><strong>Médico:</strong> {pdfData.episodio.medico || '—'}</p>
                <p><strong>Destino:</strong> {pdfData.episodio.destino || '—'}</p>
              </div>

              <p style={{ fontSize: '9px', color: '#999', textAlign: 'center', marginTop: '20px' }}>
                Hospital Miturno · Sistema de triaje hospitalario · Documento generado automáticamente
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}