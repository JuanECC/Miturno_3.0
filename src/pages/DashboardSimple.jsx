import { useState, useEffect } from 'react';
import { suscribirPacientes } from '../services/firestoreService';
import { Users, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../hooks/useAuth';

const COLORES_NIVEL = ['', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb'];
const FONDOS_NIVEL = ['', '#fef2f2', '#fff7ed', '#fefce8', '#f0fdf4', '#eff4ff'];
const NOMBRES_NIVEL = ['', 'Resucitación', 'Emergencia', 'Urgencia', 'Menor', 'No urgente'];

export default function DashboardSimple() {
  const { user } = useAuth();
  const [pacientes, setPacientes] = useState([]);
  const [capacidad, setCapacidad] = useState(20);
  const [ahora, setAhora] = useState(new Date());

  // Reloj
  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cargar capacidad desde Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracion', 'global'), (snap) => {
      if (snap.exists()) {
        if (snap.data().capacidad) setCapacidad(snap.data().capacidad);
      }
    });
    return () => unsub();
  }, []);

  // Pacientes en tiempo real
  useEffect(() => {
    const unsub = suscribirPacientes(setPacientes);
    return () => unsub();
  }, []);

  // Fechas del día actual
  const hoy = new Date();
  const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0);
  const finDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);

  // ── MÉTRICAS ──
  const espera = pacientes.filter(p => p.estado === 'espera');

  const atendidosHoy = pacientes.filter(p => {
    const estadoValido = ['atendido', 'finalizado', 'alta', 'completado'].includes(
      p.estado?.toLowerCase?.() || ''
    );
    if (!estadoValido) return false;
    
    const fechaAtencion = p.fecha_atencion?.seconds 
      ? new Date(p.fecha_atencion.seconds * 1000) 
      : p.fecha_alta?.seconds 
        ? new Date(p.fecha_alta.seconds * 1000) 
        : null;
    
    if (!fechaAtencion) return false;
    return fechaAtencion >= inicioDia && fechaAtencion <= finDia;
  }).length;

  const criticos = espera.filter(p => p.nivel_prioridad <= 2).length;

  const saturacion = Math.min(100, Math.round((espera.length / capacidad) * 100));

  const esperaPromedio = espera.length > 0
    ? Math.round(espera.reduce((s, p) => {
        const min = p.fecha_ingreso?.seconds 
          ? Math.floor((Date.now() - p.fecha_ingreso.seconds * 1000) / 60000) 
          : 0;
        return s + min;
      }, 0) / espera.length)
    : 0;

  // Pacientes ordenados por prioridad
  const pacientesOrdenados = [...espera]
    .sort((a, b) => a.nivel_prioridad - b.nivel_prioridad || 
      (a.fecha_ingreso?.seconds || 0) - (b.fecha_ingreso?.seconds || 0));

  const getMinutos = (p) => p.fecha_ingreso?.seconds 
    ? Math.floor((Date.now() - p.fecha_ingreso.seconds * 1000) / 60000) 
    : 0;

  return (
    <div className="page-container">
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 className="page-title">
            {user?.rol === 'doctor' ? '🩺 Panel del consultorio' : '🏥 Panel de recepción'}
          </h1>
          <p className="page-subtitle">
            {ahora.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '12px 16px', border: '1px solid #E5E7EB', textAlign: 'right' }}>
          <div style={{ fontSize: '20px', fontFamily: 'monospace', fontWeight: 300, color: '#1F2937' }}>
            {ahora.toLocaleTimeString('es-MX')}
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="cards-grid-4">
        <StatCard icon={<Users size={22} />} value={espera.length} label="En espera" color="blue" />
        <StatCard icon={<AlertTriangle size={22} />} value={criticos} label="Críticos (N1-N2)" color="red" />
        <StatCard icon={<CheckCircle size={22} />} value={atendidosHoy} label="Atendidos hoy" color="green" />
        <StatCard icon={<Clock size={22} />} value={`${esperaPromedio} min`} label="Espera promedio" color="amber" />
      </div>

      {/* ── BARRA DE SATURACIÓN ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280' }}>Ocupación</span>
          <span style={{ 
            fontSize: '13px', fontWeight: 600, 
            color: saturacion > 80 ? '#DC2626' : saturacion > 50 ? '#EA580C' : '#16A34A' 
          }}>
            {espera.length} / {capacidad} · {saturacion}%
          </span>
        </div>
        <div style={{ width: '100%', height: '10px', backgroundColor: '#F3F4F6', borderRadius: '5px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '5px',
            width: `${Math.min(saturacion, 100)}%`,
            backgroundColor: saturacion > 80 ? '#DC2626' : saturacion > 50 ? '#EA580C' : '#16A34A',
            transition: 'width 0.5s ease'
          }} />
        </div>
      </div>

      {/* ── LISTA DE PACIENTES EN ESPERA ── */}
      <div className="card">
        <h3 className="section-title">📋 Pacientes en espera ({espera.length})</h3>
        
        {pacientesOrdenados.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <p className="empty-state-text">No hay pacientes en espera</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pacientesOrdenados.slice(0, 20).map((p, i) => {
              const minutos = getMinutos(p);
              const n = Math.min(p.nivel_prioridad || 5, 5);
              const esPrimero = i === 0;
              
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 16px', borderRadius: '12px',
                  backgroundColor: esPrimero ? '#F8FAFC' : '#FFFFFF',
                  border: `1.5px solid ${esPrimero ? '#BFDBFE' : '#E5E7EB'}`,
                  borderLeft: `4px solid ${COLORES_NIVEL[n]}`,
                }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: esPrimero ? '#3B82F6' : '#F3F4F6',
                    color: esPrimero ? 'white' : '#6B7280',
                    fontSize: '13px', fontWeight: 700, flexShrink: 0
                  }}>
                    {i + 1}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#1F2937' }}>
                        {p.nombre}
                      </span>
                      <span className="badge" style={{ 
                        backgroundColor: FONDOS_NIVEL[n], 
                        color: COLORES_NIVEL[n], 
                        border: `1px solid ${COLORES_NIVEL[n]}`,
                        fontSize: '10px'
                      }}>
                        N{n} · {NOMBRES_NIVEL[n]}
                      </span>
                      {p.origen === 'cita' && (
                        <span className="badge" style={{ 
                          backgroundColor: '#EFF6FF', color: '#3B82F6', fontSize: '10px' 
                        }}>
                          📅 Cita
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                      {p.edad} años · {p.especialidad || 'General'} · {p.motivo}
                    </p>
                    {p.signosAlarma?.length > 0 && (
                      <p style={{ fontSize: '11px', color: '#DC2626', fontWeight: 500, marginTop: '2px' }}>
                        ⚠️ {p.signosAlarma.join(' · ')}
                      </p>
                    )}
                  </div>

                  <div style={{ 
                    textAlign: 'right', flexShrink: 0,
                    fontFamily: 'monospace', fontSize: '13px',
                    color: minutos > 30 ? '#DC2626' : minutos > 15 ? '#EA580C' : '#6B7280',
                    fontWeight: minutos > 30 ? 600 : 400
                  }}>
                    {minutos} min
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, color }) {
  const colors = {
    blue: { bg: '#EFF6FF', color: '#3B82F6' },
    red: { bg: '#FEF2F2', color: '#DC2626' },
    green: { bg: '#F0FDF4', color: '#16A34A' },
    amber: { bg: '#FFF7ED', color: '#EA580C' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: c.bg, color: c.color, flexShrink: 0
      }}>
        {icon}
      </div>
      <div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{label}</div>
      </div>
    </div>
  );
}