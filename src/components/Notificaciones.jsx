import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { Bell, AlertTriangle, UserCheck, Calendar, Clock, MessageCircle } from 'lucide-react';

export default function Notificaciones() {
  const { user } = useAuth();
  const [mostrar, setMostrar] = useState(false);
  const [criticos, setCriticos] = useState([]);
  const [ultimoLlamado, setUltimoLlamado] = useState(null);
  const [proximaCita, setProximaCita] = useState(null);
  const [ultimoMensaje, setUltimoMensaje] = useState(null);
  const [totalNotif, setTotalNotif] = useState(0);

  // Escuchar pacientes críticos
  useEffect(() => {
    if (!user || user.rol === 'pantalla') return;

    const q = query(
      collection(db, 'pacientes'),
      where('estado', '==', 'espera'),
      where('nivel_prioridad', '<=', 2)
    );
    
    const unsub = onSnapshot(q, 
      (snap) => {
        const criticosData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCriticos(criticosData);
      },
      () => {}
    );
    
    return () => unsub();
  }, [user]);

  // Escuchar último llamado
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'llamados'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    
    const unsub = onSnapshot(q, 
      (snap) => {
        if (!snap.empty) {
          const llamado = snap.docs[0].data();
          const haceCuanto = llamado.timestamp?.seconds 
            ? Math.floor((Date.now() - llamado.timestamp.seconds * 1000) / 60000)
            : null;
          
          setUltimoLlamado({
            paciente: llamado.paciente,
            consultorio: llamado.consultorio,
            haceCuanto
          });
        }
      },
      () => {}
    );
    
    return () => unsub();
  }, [user]);

  // Escuchar próxima cita
  useEffect(() => {
    if (!user || !['admin', 'recepcionista'].includes(user.rol)) return;

    const hoy = new Date();
    const hoyStr = hoy.getFullYear() + '-' + 
      String(hoy.getMonth() + 1).padStart(2, '0') + '-' + 
      String(hoy.getDate()).padStart(2, '0');
    const horaActual = String(hoy.getHours()).padStart(2, '0') + ':' + 
                       String(hoy.getMinutes()).padStart(2, '0');
    
    const q = query(
      collection(db, 'citas'),
      where('fecha', '==', hoyStr),
      where('estado', '==', 'pendiente'),
      where('hora', '>=', horaActual),
      orderBy('hora', 'asc'),
      limit(1)
    );
    
    const unsub = onSnapshot(q, 
      (snap) => {
        if (!snap.empty) {
          const cita = snap.docs[0].data();
          setProximaCita({
            nombre: cita.nombre,
            hora: cita.hora,
            especialidad: cita.especialidad
          });
        } else {
          setProximaCita(null);
        }
      },
      () => {}
    );
    
    return () => unsub();
  }, [user]);

  // 🆕 Escuchar último mensaje del chat
  useEffect(() => {
    if (!user || user.rol === 'pantalla') return;
    
    const q = query(
      collection(db, 'mensajes'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    
    const unsub = onSnapshot(q, 
      (snap) => {
        if (!snap.empty) {
          const msg = snap.docs[0].data();
          const haceCuanto = msg.timestamp?.seconds 
            ? Math.floor((Date.now() - msg.timestamp.seconds * 1000) / 60000)
            : null;
          
          if (haceCuanto !== null && haceCuanto < 10 && msg.autor !== (user?.nombre || user?.email)) {
            setUltimoMensaje({
              texto: msg.texto,
              autor: msg.autor,
              haceCuanto,
              tipo: msg.tipo || 'global',
            });
          }
        }
      },
      () => {}
    );
    
    return () => unsub();
  }, [user]);

  // Calcular total
  useEffect(() => {
    let total = criticos.length;
    if (ultimoLlamado && ultimoLlamado.haceCuanto !== null && ultimoLlamado.haceCuanto < 5) total += 1;
    if (ultimoMensaje && ultimoMensaje.haceCuanto !== null && ultimoMensaje.haceCuanto < 5) total += 1;
    setTotalNotif(total);
  }, [criticos, ultimoLlamado, ultimoMensaje]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setMostrar(!mostrar)}
        style={{
          position: 'relative',
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: '#6B7280',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Notificaciones"
      >
        <Bell size={18} />
        {totalNotif > 0 && (
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            minWidth: '18px',
            height: '18px',
            borderRadius: '9px',
            backgroundColor: '#EF4444',
            color: 'white',
            fontSize: '10px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            border: '2px solid white'
          }}>
            {totalNotif}
          </span>
        )}
      </button>

      {mostrar && (
        <>
          <div
            onClick={() => setMostrar(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40
            }}
          />
          
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '340px',
            maxHeight: '400px',
            overflowY: 'auto',
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E5E7EB',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            zIndex: 50,
            padding: '8px'
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontWeight: 600, fontSize: '14px', color: '#1F2937' }}>
                Notificaciones
              </span>
              {totalNotif > 0 && (
                <span className="badge" style={{ 
                  backgroundColor: '#FEF2F2', 
                  color: '#DC2626',
                  fontSize: '11px'
                }}>
                  {totalNotif} pendiente{totalNotif > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div style={{ padding: '8px' }}>
              {/* Pacientes críticos */}
              {criticos.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '8px',
                    padding: '0 8px'
                  }}>
                    <AlertTriangle size={14} style={{ color: '#DC2626' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#DC2626', textTransform: 'uppercase' }}>
                      Pacientes críticos ({criticos.length})
                    </span>
                  </div>
                  {criticos.map(p => (
                    <div key={p.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      backgroundColor: '#FEF2F2',
                      marginBottom: '4px',
                      fontSize: '13px'
                    }}>
                      <span style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%', 
                        backgroundColor: '#DC2626',
                        flexShrink: 0
                      }} />
                      <span style={{ fontWeight: 500, color: '#991B1B' }}>{p.nombre}</span>
                      <span className="badge" style={{ 
                        backgroundColor: '#FECACA', 
                        color: '#DC2626',
                        fontSize: '10px',
                        marginLeft: 'auto'
                      }}>
                        N{p.nivel_prioridad}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 🆕 Último mensaje del chat */}
              {ultimoMensaje && ultimoMensaje.haceCuanto !== null && ultimoMensaje.haceCuanto < 5 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '8px',
                    padding: '0 8px'
                  }}>
                    <MessageCircle size={14} style={{ color: '#8B5CF6' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#8B5CF6', textTransform: 'uppercase' }}>
                      Nuevo mensaje
                    </span>
                  </div>
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    backgroundColor: '#F3E8FF',
                    fontSize: '13px'
                  }}>
                    <div style={{ fontWeight: 500, color: '#6D28D9' }}>
                      💬 {ultimoMensaje.autor}
                    </div>
                    <div style={{ color: '#6B7280', fontSize: '11px', marginTop: '2px' }}>
                      {ultimoMensaje.texto.length > 50 
                        ? ultimoMensaje.texto.substring(0, 50) + '...' 
                        : ultimoMensaje.texto}
                    </div>
                    <div style={{ color: '#9CA3AF', fontSize: '10px', marginTop: '2px' }}>
                      {ultimoMensaje.tipo === 'privado' ? '🔒 Chat privado' : '📢 Chat general'} · Hace {ultimoMensaje.haceCuanto} min
                    </div>
                  </div>
                </div>
              )}

              {/* Último llamado */}
              {ultimoLlamado && ultimoLlamado.haceCuanto !== null && ultimoLlamado.haceCuanto < 5 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '8px',
                    padding: '0 8px'
                  }}>
                    <UserCheck size={14} style={{ color: '#3B82F6' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#3B82F6', textTransform: 'uppercase' }}>
                      Último llamado
                    </span>
                  </div>
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    backgroundColor: '#EFF6FF',
                    fontSize: '13px'
                  }}>
                    <div style={{ fontWeight: 500, color: '#1E40AF' }}>
                      📢 {ultimoLlamado.paciente}
                    </div>
                    <div style={{ color: '#6B7280', fontSize: '11px', marginTop: '2px' }}>
                      {ultimoLlamado.consultorio} · Hace {ultimoLlamado.haceCuanto} min
                    </div>
                  </div>
                </div>
              )}

              {/* Próxima cita */}
              {proximaCita && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '8px',
                    padding: '0 8px'
                  }}>
                    <Calendar size={14} style={{ color: '#16A34A' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#16A34A', textTransform: 'uppercase' }}>
                      Próxima cita
                    </span>
                  </div>
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    backgroundColor: '#F0FDF4',
                    fontSize: '13px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 500, color: '#065F46' }}>
                        {proximaCita.nombre}
                      </span>
                      <span style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '3px',
                        color: '#6B7280', 
                        fontSize: '11px',
                        marginLeft: 'auto'
                      }}>
                        <Clock size={11} />
                        {proximaCita.hora}
                      </span>
                    </div>
                    {proximaCita.especialidad && (
                      <div style={{ color: '#6B7280', fontSize: '11px', marginTop: '2px' }}>
                        {proximaCita.especialidad}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sin notificaciones */}
              {criticos.length === 0 && !ultimoLlamado && !proximaCita && !ultimoMensaje && (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: '#9CA3AF',
                  fontSize: '13px'
                }}>
                  ✅ No hay notificaciones pendientes
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}