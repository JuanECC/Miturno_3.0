import { useState, useEffect } from 'react';
import { useCapacidad } from '../hooks/useCapacidad';
import { suscribirPacientes } from '../services/firestoreService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Users, AlertTriangle, CheckCircle, Activity, Download, BedDouble, DoorOpen, TrendingUp } from 'lucide-react';
import { doc, onSnapshot, collection, query } from 'firebase/firestore';
import { db } from '../firebase/config';

const NIVELES = ['N1', 'N2', 'N3', 'N4', 'N5'];
const COLORES_NIVEL = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb'];
const COLORES_ALPHA = ['rgba(220,38,38,.12)', 'rgba(234,88,12,.12)', 'rgba(202,138,4,.12)', 'rgba(22,163,74,.12)', 'rgba(37,99,235,.12)'];
const NOMBRES_NIVEL = ['Resucitación', 'Emergencia', 'Urgencia', 'Menor', 'No urgente'];
const TIEMPOS_MAX = { 1: 'Inmediato', 2: '≤ 10 min', 3: '≤ 30 min', 4: '≤ 60 min', 5: '≤ 120 min' };
const COLORES_UBI = ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796', '#5a5c69'];

const AREAS = [
  { key: 'OBSERVACION', label: 'Observación', icon: '👁' },
  { key: 'HOSPITALIZACION', label: 'Hospitalización', icon: '🏨' },
  { key: 'CIRUGIA', label: 'Cirugía', icon: '🔪' },
  { key: 'TERAPIA_INTENSIVA', label: 'UCI', icon: '💊' },
  { key: 'INTERNAMIENTO', label: 'Internamiento', icon: '🏨' },
];

export default function Dashboard() {
  const { capacidad } = useCapacidad();
  const [pacientes, setPacientes] = useState([]);
  const [camasData, setCamasData] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [ultimoRegistro, setUltimoRegistro] = useState(0);
  const [ahora, setAhora] = useState(new Date());
  const [licencia, setLicencia] = useState('hospital');
  const [areasExpandidas, setAreasExpandidas] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracion', 'global'), (snap) => {
      if (snap.exists() && snap.data().licencia) setLicencia(snap.data().licencia);
    });
    return () => unsub();
  }, []);

  useEffect(() => { const timer = setInterval(() => setAhora(new Date()), 1000); return () => clearInterval(timer); }, []);

  useEffect(() => { const unsub = suscribirPacientes(setPacientes); return () => unsub(); }, []);

  useEffect(() => {
    const q = query(collection(db, 'camas'));
    return onSnapshot(q, (snap) => setCamasData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const hoy = new Date();
  const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0);
  const finDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);

  const espera = pacientes.filter(p => p.estado === 'espera');
  const atendidosHoy = pacientes.filter(p => {
    const estadoValido = ['atendido', 'finalizado', 'alta', 'completado'].includes(p.estado?.toLowerCase?.() || '');
    if (!estadoValido) return false;
    const fechaAtencion = p.fecha_atencion?.seconds ? new Date(p.fecha_atencion.seconds * 1000) : p.fecha_alta?.seconds ? new Date(p.fecha_alta.seconds * 1000) : null;
    if (!fechaAtencion) return false;
    return fechaAtencion >= inicioDia && fechaAtencion <= finDia;
  }).length;

  const criticos = espera.filter(p => p.nivel_prioridad <= 2);
  const criticosRetrasados = criticos.filter(p => { const min = p.fecha_ingreso?.seconds ? Math.floor((Date.now() - p.fecha_ingreso.seconds * 1000) / 60000) : 0; return min >= 5; });
  const saturacion = Math.min(100, Math.round((espera.length / capacidad) * 100));
  const ingresosHoy = pacientes.filter(p => { if (!p.fecha_ingreso?.seconds) return false; const fecha = new Date(p.fecha_ingreso.seconds * 1000); return fecha >= inicioDia && fecha <= finDia; }).length;
  const camasOcupadas = camasData.filter(c => c.ocupada).length;
  const camasLibres = Math.max(0, camasData.length - camasOcupadas);

  useEffect(() => {
    const ahoraMs = Date.now(); if (ahoraMs - ultimoRegistro < 30 * 60 * 1000) return; setUltimoRegistro(ahoraMs);
    const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); setHistorico(prev => [...prev, { hora, total: espera.length }]);
  }, [pacientes]);

  const datosNiveles = NIVELES.map((n, i) => ({ nivel: n, pacientes: espera.filter(p => p.nivel_prioridad === i + 1).length }));
  const especialidades = espera.reduce((acc, p) => { const esp = p.especialidad || 'General'; acc[esp] = (acc[esp] || 0) + 1; return acc; }, {});
  const datosEspecialidades = Object.entries(especialidades).map(([name, value], i) => ({ name, value, fill: COLORES_UBI[i % COLORES_UBI.length] }));
  const ubicaciones = pacientes.reduce((acc, p) => { const ubi = p.ubicacion_actual || 'Espera'; acc[ubi] = (acc[ubi] || 0) + 1; return acc; }, {});
  const datosUbicaciones = Object.entries(ubicaciones).map(([name, value], i) => ({ name, value, fill: COLORES_UBI[i % COLORES_UBI.length] }));

  const exportarCSV = () => {
    const fecha = new Date().toLocaleDateString('es-MX').replace(/\//g, '-');
    let csv = `Reporte Miturno - ${fecha}\nEn espera,${espera.length}\nAtendidos hoy,${atendidosHoy}\nCapacidad,${capacidad}\nSaturación,${saturacion}%\n\nNivel,Nombre,Pacientes\n`;
    NIVELES.forEach((n, i) => csv += `${n},${NOMBRES_NIVEL[i]},${datosNiveles[i].pacientes}\n`);
    csv += `\nEspecialidad,Pacientes\n`; Object.entries(especialidades).forEach(([k, v]) => csv += `${k},${v}\n`);
    csv += `\nUbicación,Pacientes\n`; Object.entries(ubicaciones).forEach(([k, v]) => csv += `${k},${v}\n`);
    historico.forEach(h => csv += `${h.hora},${h.total}\n`);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `miturno-reporte-${fecha}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div><h1 className="page-title">Panel de control</h1><p className="page-subtitle">Datos en tiempo real · {licencia === 'hospital' ? 'Modo Hospitalario' : 'Modo Clínica'}</p>
          {criticosRetrasados.length > 0 && <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '12px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '13px', fontWeight: 500 }}><AlertTriangle size={16} />{criticosRetrasados.length} paciente{criticosRetrasados.length > 1 ? 's' : ''} crítico{criticosRetrasados.length > 1 ? 's' : ''} esperando más de 5 min</div>}
        </div>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '12px 16px', border: '1px solid #E5E7EB', textAlign: 'right' }}><div style={{ fontSize: '20px', fontFamily: 'monospace', fontWeight: 300, color: '#1F2937' }}>{ahora.toLocaleTimeString('es-MX')}</div><div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'capitalize' }}>{ahora.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
      </div>

      <div className="cards-grid-4">
        {licencia === 'hospital' ? (
          <><StatCard icon={<Users size={22} />} value={espera.length} label="Pacientes en espera" color="blue" /><StatCard icon={<AlertTriangle size={22} />} value={criticos.length} label="Críticos (N1 y N2)" color="red" /><StatCard icon={<CheckCircle size={22} />} value={atendidosHoy} label="Atendidos hoy" color="green" /><StatCard icon={<Activity size={22} />} value={`${saturacion}%`} label="Saturación" color={saturacion < 50 ? 'blue' : saturacion < 80 ? 'amber' : 'red'} /></>
        ) : (
          <><StatCard icon={<BedDouble size={22} />} value={camasOcupadas} label="Cuartos ocupados" color="red" /><StatCard icon={<DoorOpen size={22} />} value={camasLibres} label="Cuartos libres" color="green" /><StatCard icon={<TrendingUp size={22} />} value={ingresosHoy} label="Ingresos hoy" color="blue" /><StatCard icon={<CheckCircle size={22} />} value={atendidosHoy} label="Atendidos hoy" color="green" /></>
        )}
      </div>

      <div className="cards-grid-2">
        <div className="card"><h3 className="section-title">Distribución por nivel de triaje</h3><ResponsiveContainer width="100%" height={240}><BarChart data={datosNiveles}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="nivel" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="pacientes" radius={[6, 6, 0, 0]}>{datosNiveles.map((_, i) => <Cell key={i} fill={COLORES_ALPHA[i]} stroke={COLORES_NIVEL[i]} strokeWidth={2} />)}</Bar></BarChart></ResponsiveContainer><div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>{NIVELES.map((n, i) => <span key={n} className="badge" style={{ backgroundColor: COLORES_ALPHA[i], color: COLORES_NIVEL[i], border: `1px solid ${COLORES_NIVEL[i]}` }}>{n} {NOMBRES_NIVEL[i]}</span>)}</div></div>
        <div className="card"><h3 className="section-title">Demanda por especialidad</h3>{datosEspecialidades.length === 0 ? <div className="empty-state"><div className="empty-state-icon">📊</div><p className="empty-state-text">Sin pacientes en espera</p></div> : <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={datosEspecialidades} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{datosEspecialidades.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>}</div>
      </div>

      <div className="cards-grid-2">
        <div className="card"><h3 className="section-title">Distribución por ubicación</h3>{datosUbicaciones.length === 0 ? <div className="empty-state"><div className="empty-state-icon">📍</div><p className="empty-state-text">Sin pacientes para mostrar</p></div> : <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={datosUbicaciones} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{datosUbicaciones.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>}</div>
        <div className="card"><h3 className="section-title">Resumen de ubicaciones</h3>{Object.entries(ubicaciones).length === 0 ? <div className="empty-state"><div className="empty-state-icon">🏥</div><p className="empty-state-text">Sin pacientes activos</p></div> : <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}><thead><tr style={{ borderBottom: '1px solid #E5E7EB' }}><th style={{ textAlign: 'left', padding: '8px 0', fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>Ubicación</th><th style={{ textAlign: 'right', padding: '8px 0', fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>Pacientes</th></tr></thead><tbody>{Object.entries(ubicaciones).sort(([,a],[,b]) => b - a).map(([ubi, n]) => <tr key={ubi} style={{ borderBottom: '1px solid #F9FAFB' }}><td style={{ padding: '10px 0' }}>{ubi}</td><td style={{ textAlign: 'right', padding: '10px 0', fontWeight: 600 }}>{n}</td></tr>)}</tbody></table>}</div>
      </div>

      <div className="card"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}><h3 className="section-title" style={{ marginBottom: 0 }}>Curva de pacientes del día</h3><span className="badge" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>{historico.length} registros</span></div>{historico.length === 0 ? <div className="empty-state"><div className="empty-state-icon">📈</div><p className="empty-state-text">Recolectando datos...</p></div> : <ResponsiveContainer width="100%" height={200}><LineChart data={historico}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="hora" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>}</div>

      {/* 🆕 MAPA DE CAMAS POR ÁREA DESPLEGABLE */}
      <div className="card">
        <h3 className="section-title">Mapa de camas{licencia === 'clinica' ? ' / Cuartos' : ''}</h3>
        {camasData.length === 0 ? (
          <div style={{ width: '100%', textAlign: 'center', padding: '20px', color: '#9CA3AF', fontSize: '13px' }}>No hay camas configuradas. Ve a Configuración para establecer la capacidad.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {AREAS.filter(area => camasData.some(c => c.area === area.key)).map(area => {
              const camasArea = camasData.filter(c => c.area === area.key).sort((a, b) => a.numero - b.numero);
              const ocupadas = camasArea.filter(c => c.ocupada).length;
              const expandido = areasExpandidas[area.key] || false;
              const setExpandido = (val) => setAreasExpandidas(prev => ({ ...prev, [area.key]: val }));
              const muchasCamas = camasArea.length > 10;
              const camasMostradas = (muchasCamas && !expandido) ? camasArea.slice(0, 10) : camasArea;
              const ocultas = muchasCamas && !expandido ? camasArea.length - 10 : 0;

              return (
                <div key={area.key}>
                  <div onClick={() => muchasCamas && setExpandido(!expandido)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', cursor: muchasCamas ? 'pointer' : 'default', padding: '4px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>{area.icon}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937' }}>{area.label}</span>
                      <span className="badge" style={{ backgroundColor: '#F3F4F6', color: '#6B7280', fontSize: '11px' }}>{ocupadas}/{camasArea.length}</span>
                    </div>
                    {muchasCamas && <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{expandido ? '▲ Ocultar' : '▼ Ver todas'} · {camasArea.length} camas</span>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {camasMostradas.map(cama => (
                      <div key={cama.id} style={{ width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, border: '1px solid', backgroundColor: cama.ocupada ? '#FEF2F2' : '#F0FDF4', color: cama.ocupada ? '#DC2626' : '#16A34A', borderColor: cama.ocupada ? '#FECACA' : '#BBF7D0' }} title={`Cama ${cama.numero} - ${area.label}${cama.ocupada ? ' (Ocupada)' : ' (Libre)'}`}>{cama.numero}</div>
                    ))}
                    {ocultas > 0 && (
                      <div onClick={() => setExpandido(true)} style={{ width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, border: '1px dashed #D1D5DB', backgroundColor: '#F9FAFB', color: '#9CA3AF', cursor: 'pointer' }}>+{ocultas}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '12px', color: '#6B7280' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#BBF7D0' }} /> Libre</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#FECACA' }} /> Ocupada</span>
        </div>
      </div>

      <div className="card"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}><h3 className="section-title" style={{ marginBottom: 0 }}>Resumen por nivel</h3><button onClick={exportarCSV} className="btn btn-secondary btn-sm"><Download size={14} /> Exportar CSV</button></div><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse', minWidth: '500px' }}><thead><tr style={{ borderBottom: '1px solid #E5E7EB' }}><th style={{ textAlign: 'left', padding: '8px 0', fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>Nivel</th><th style={{ textAlign: 'left', padding: '8px 0', fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>Prioridad</th><th style={{ textAlign: 'right', padding: '8px 0', fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>Pacientes</th><th style={{ textAlign: 'right', padding: '8px 0', fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>Tiempo máx.</th><th style={{ textAlign: 'right', padding: '8px 0', fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>Distribución</th></tr></thead><tbody>{datosNiveles.map((d, i) => { const pct = espera.length > 0 ? Math.round((d.pacientes / espera.length) * 100) : 0; return (<tr key={d.nivel} style={{ borderBottom: '1px solid #F9FAFB' }}><td style={{ padding: '10px 0' }}><span className="badge" style={{ backgroundColor: COLORES_ALPHA[i], color: COLORES_NIVEL[i], border: `1px solid ${COLORES_NIVEL[i]}` }}>{d.nivel}</span></td><td style={{ padding: '10px 0' }}>{NOMBRES_NIVEL[i]}</td><td style={{ textAlign: 'right', padding: '10px 0', fontWeight: 600 }}>{d.pacientes}</td><td style={{ textAlign: 'right', padding: '10px 0', color: '#6B7280', fontSize: '13px' }}>{TIEMPOS_MAX[i + 1]}</td><td style={{ textAlign: 'right', padding: '10px 0' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}><span style={{ fontSize: '12px', color: '#9CA3AF' }}>{pct}%</span><div style={{ width: '80px', height: '6px', backgroundColor: '#F3F4F6', borderRadius: '3px', overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: '3px', width: `${pct}%`, backgroundColor: COLORES_NIVEL[i], transition: 'width 0.5s ease' }} /></div></div></td></tr>); })}</tbody></table></div></div>
    </div>
  );
}

function StatCard({ icon, value, label, color }) {
  const colors = { blue: { bg: '#EFF6FF', color: '#3B82F6' }, red: { bg: '#FEF2F2', color: '#DC2626' }, green: { bg: '#F0FDF4', color: '#16A34A' }, amber: { bg: '#FFF7ED', color: '#EA580C' } };
  const c = colors[color] || colors.blue;
  return (<div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}><div style={{ width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, color: c.color, flexShrink: 0 }}>{icon}</div><div><div className="kpi-value">{value}</div><div className="kpi-label">{label}</div></div></div>);
}