import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, limit, doc, updateDoc } from 'firebase/firestore';
import { Maximize, Minimize } from 'lucide-react';

const TIEMPOS_MAX = { 1: 0, 2: 10, 3: 30, 4: 60, 5: 120 };
const NOMBRES_NIVEL = { 1: 'RESUCITACIÓN', 2: 'EMERGENCIA', 3: 'URGENTE', 4: 'MENOR', 5: 'NO URGENTE' };
const MENSAJES_TICKER = [
  '🏥 Miturno — Sistema de triaje hospitalario',
  'Por favor manténgase en la sala de espera hasta ser llamado por su nombre',
  'En caso de sentir cambio en su estado de salud, informe inmediatamente al personal',
  'Nuestro personal médico está trabajando para atenderle lo antes posible',
  'La prioridad de atención se asigna según el nivel de urgencia médica',
  'Prohibido comer, fumar o hablar por teléfono en la sala de espera',
  'Servicios sanitarios al fondo del pasillo a la derecha',
  'Si necesita atención urgente, avise al personal de recepción',
];

export default function Pantalla() {
  const [pacientes, setPacientes] = useState([]);
  const [ahora, setAhora] = useState(new Date());
  const [modoTV, setModoTV] = useState(false);
  const [tickerIdx, setTickerIdx] = useState(0);
  const [llamadoActual, setLlamadoActual] = useState(null);
  const [licencia, setLicencia] = useState('hospital');
  const [config, setConfig] = useState({
    alertasActivas: true,
    vozTipo: 'femenino',
    vozRate: 0.85,
    vozVolume: 1,
    tiempoAlerta: 10,
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracion', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setConfig(prev => ({ ...prev, ...data }));
        if (data.licencia) setLicencia(data.licencia);
      }
    }, (err) => {
      console.error('Error escuchando configuración:', err);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIdx(prev => (prev + 1) % MENSAJES_TICKER.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'pacientes'), where('estado', 'in', ['espera', 'en consulta']));
    return onSnapshot(q, (snap) => {
      const ahoraMs = Date.now();
      const lista = snap.docs
        .map(d => {
          const p = d.data();
          const minutos = p.fecha_ingreso?.seconds
            ? Math.floor((ahoraMs - p.fecha_ingreso.seconds * 1000) / 60000)
            : 0;
          return { id: d.id, ...p, minutos };
        })
        .sort((a, b) => {
          if (licencia === 'clinica') {
            return (a.numero_turno || 999) - (b.numero_turno || 999);
          }
          return a.nivel_prioridad - b.nivel_prioridad || a.minutos - b.minutos;
        });
      setPacientes(lista);
    });
  }, [licencia]);

  useEffect(() => {
    const q = query(
      collection(db, 'llamados'),
      where('activo', '==', true),
      limit(1)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const docData = snap.docs[0];
        const llamado = docData.data();
        setLlamadoActual(llamado);

        if (window.speechSynthesis && config.alertasActivas) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(`${llamado.paciente}, pase a ${llamado.consultorio}.`);
          utterance.lang = 'es-MX';
          utterance.rate = config.vozRate;
          utterance.volume = config.vozVolume;

          const aplicarVoz = () => {
            const voices = window.speechSynthesis.getVoices();
            const espanol = voices.filter(v => v.lang.startsWith('es'));
            const candidatas = config.vozTipo === 'masculino'
              ? espanol.filter(v => v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('raul') || v.name.toLowerCase().includes('pablo') || v.name.toLowerCase().includes('carlos'))
              : espanol.filter(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('sabina') || v.name.toLowerCase().includes('maria') || v.name.toLowerCase().includes('ana'));
            if (candidatas.length > 0) utterance.voice = candidatas[0];
            else if (espanol.length > 0) utterance.voice = espanol[0];
            window.speechSynthesis.speak(utterance);
          };

          if (window.speechSynthesis.getVoices().length === 0) {
            window.speechSynthesis.onvoiceschanged = () => {
              window.speechSynthesis.onvoiceschanged = null;
              aplicarVoz();
            };
          } else {
            aplicarVoz();
          }
        }

        const timer = setTimeout(() => setLlamadoActual(null), config.tiempoAlerta * 1000);
        updateDoc(doc(db, 'llamados', docData.id), { activo: false }).catch(() => {});
        return () => clearTimeout(timer);
      }
    });

    return () => unsub();
  }, [config]);

  const contadores = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  pacientes.forEach(p => {
    if (p.nivel_prioridad >= 1 && p.nivel_prioridad <= 5) contadores[p.nivel_prioridad]++;
  });
  const total = pacientes.length;

  const toggleModoTV = () => {
    if (!modoTV) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    setModoTV(!modoTV);
  };

  const coloresNivel = (n) => ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb'][n - 1] || '#6b7280';
  const fondosNivel = (n) => ['#fef2f2', '#fff7ed', '#fefce8', '#f0fdf4', '#eff4ff'][n - 1] || '#f9fafb';

  return (
    <div className="page-container">
      {llamadoActual && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          zIndex: 100, backgroundColor: '#1F2937', color: 'white',
          padding: '40px 56px', borderRadius: '28px',
          boxShadow: '0 25px 80px rgba(0,0,0,0.4)',
          textAlign: 'center', animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          minWidth: '420px'
        }}>
          <div style={{ fontSize: '56px', marginBottom: '16px', animation: 'pulse 1.5s ease-in-out infinite' }}>📢</div>
          <div style={{
            fontSize: '14px', fontWeight: 600, color: '#9CA3AF',
            textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px'
          }}>
            Paciente llamado
          </div>
          <div style={{
            fontSize: '36px', fontWeight: 700, marginBottom: '10px',
            letterSpacing: '-0.5px'
          }}>
            {llamadoActual.paciente}
          </div>
          <div style={{
            fontSize: '16px', color: '#9CA3AF',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px'
          }}>
            <span>{llamadoActual.consultorio}</span>
            <span style={{
              width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#9CA3AF'
            }} />
            <span style={{
              backgroundColor: fondosNivel(llamadoActual.nivel),
              color: coloresNivel(llamadoActual.nivel),
              padding: '4px 10px', borderRadius: '8px',
              fontSize: '13px', fontWeight: 600
            }}>
              N{llamadoActual.nivel} · {NOMBRES_NIVEL[llamadoActual.nivel]}
            </span>
          </div>
        </div>
      )}

      {llamadoActual && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99,
          backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.3s ease'
        }} />
      )}

      <div className="card" style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
        gap: '12px', padding: modoTV ? '16px 20px' : '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', backgroundColor: '#3B82F6',
            borderRadius: '12px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'white', fontSize: '18px'
          }}>
            🏥
          </div>
          <div>
            <p style={{ fontWeight: 600, color: '#1F2937', fontSize: '15px' }}>
              Sala de Espera{licencia === 'clinica' ? ' · Consultorios' : ''}
            </p>
            <p style={{ fontSize: '11px', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', backgroundColor: '#22C55E', borderRadius: '50%' }} />
              Actualización en tiempo real{licencia === 'clinica' ? ' · Orden de llegada' : ''}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB' }}>
          {licencia === 'hospital' ? (
            [1, 2, 3, 4, 5].map(n => (
              <div key={n} style={{
                padding: modoTV ? '8px 16px' : '8px 12px',
                textAlign: 'center', borderRight: '1px solid #E5E7EB',
                backgroundColor: contadores[n] > 0 ? fondosNivel(n) : 'transparent',
                opacity: contadores[n] > 0 ? 1 : 0.5
              }}>
                <div style={{ fontSize: modoTV ? '28px' : '20px', fontWeight: 700, fontFamily: 'monospace', color: coloresNivel(n) }}>{contadores[n]}</div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>N{n}</div>
              </div>
            ))
          ) : null}
          <div style={{ padding: modoTV ? '8px 16px' : '8px 12px', textAlign: 'center', backgroundColor: '#F9FAFB' }}>
            <div style={{ fontSize: modoTV ? '28px' : '20px', fontWeight: 700, fontFamily: 'monospace', color: '#1F2937' }}>{total}</div>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase' }}>Total</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={toggleModoTV} className={`btn btn-sm ${modoTV ? 'btn-primary' : 'btn-secondary'}`}>
            {modoTV ? <Minimize size={14} /> : <Maximize size={14} />}
            <span className="hidden sm:inline">{modoTV ? 'Salir de TV' : 'Modo TV'}</span>
          </button>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: modoTV ? '36px' : '22px', fontFamily: 'monospace', fontWeight: 300, color: '#1F2937', lineHeight: 1 }}>
              {ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: modoTV ? '14px' : '11px', color: '#9CA3AF', textTransform: 'capitalize' }}>
              {ahora.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: modoTV ? '100%' : '900px', margin: '0 auto', width: '100%' }}>
        {pacientes.length === 0 ? (
          <div className="empty-state" style={{ minHeight: '300px' }}>
            <div className="empty-state-icon" style={{ fontSize: '48px' }}>✅</div>
            <p className="empty-state-text" style={{ fontSize: '16px' }}>No hay pacientes en espera</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pacientes.map((p, i) => {
              const enConsulta = p.estado === 'en consulta';
              const retrasado = !enConsulta && p.minutos > (TIEMPOS_MAX[p.nivel_prioridad] ?? 120);
              const esSiguiente = i === 0 && !enConsulta;
              const n = p.nivel_prioridad || 5;
              return (
                <div key={p.id} className="card"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: modoTV ? '20px' : '16px',
                    borderLeft: `5px solid ${enConsulta ? '#EA580C' : coloresNivel(n)}`,
                    borderColor: enConsulta ? '#FED7AA' : (esSiguiente ? '#BFDBFE' : '#E5E7EB'),
                    backgroundColor: enConsulta ? '#FFF7ED' : (esSiguiente ? '#F8FAFC' : '#FFFFFF'),
                    opacity: enConsulta ? 0.9 : 1,
                  }}
                >
                  <div style={{
                    width: modoTV ? '44px' : '36px', height: modoTV ? '44px' : '36px',
                    borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '14px', fontWeight: 700,
                    fontFamily: 'monospace', flexShrink: 0,
                    backgroundColor: enConsulta ? '#EA580C' : (esSiguiente ? '#3B82F6' : '#F3F4F6'),
                    color: enConsulta ? 'white' : (esSiguiente ? 'white' : '#6B7280')
                  }}>
                    {enConsulta ? '🩺' : (licencia === 'clinica' && p.numero_turno ? p.numero_turno : i + 1)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {enConsulta && (
                        <span className="badge" style={{
                          backgroundColor: '#FFF7ED', color: '#EA580C',
                          fontWeight: 600, fontSize: modoTV ? '13px' : '10px',
                          border: '1px solid #FED7AA'
                        }}>
                          🩺 En consulta{p.doctor_asignado ? ` · Dr(a). ${p.doctor_asignado.split(' ')[0]}` : p.atendido_por ? ` · ${p.atendido_por.split(' ')[0]}` : ''}
                        </span>
                      )}
                      {!enConsulta && esSiguiente && <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>→ Siguiente</span>}
                      <span style={{ fontWeight: 600, color: '#1F2937', fontSize: modoTV ? '20px' : '15px' }}>{p.nombre}</span>
                      {licencia === 'clinica' && p.doctor_asignado ? (
                        <>
                          <span className="badge" style={{ backgroundColor: '#EFF6FF', color: '#3B82F6', border: '1px solid #BFDBFE', fontSize: modoTV ? '13px' : '11px' }}>
                            👨‍⚕️ {p.doctor_asignado}
                          </span>
                          {p.numero_turno && (
                            <span className="badge" style={{ backgroundColor: '#F3F4F6', color: '#1F2937', border: '1px solid #D1D5DB', fontSize: modoTV ? '13px' : '11px', fontWeight: 700 }}>
                              🔢 T{p.numero_turno}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="badge" style={{ backgroundColor: fondosNivel(n), color: coloresNivel(n), border: `1px solid ${coloresNivel(n)}`, fontSize: modoTV ? '13px' : '11px' }}>
                          N{n} · {NOMBRES_NIVEL[n]}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: modoTV ? '14px' : '12px', color: '#6B7280', marginTop: '2px' }}>
                      {p.edad} años · {p.especialidad || 'General'}
                    </p>
                    {p.signosAlarma?.length > 0 && (
                      <p style={{ fontSize: '11px', color: '#DC2626', fontWeight: 500, marginTop: '2px' }}>
                        ⚠ {p.signosAlarma.join(' · ')}
                      </p>
                    )}
                  </div>
                  <div style={{
                    textAlign: 'right', flexShrink: 0, fontFamily: 'monospace',
                    fontSize: modoTV ? '16px' : '13px',
                    color: enConsulta ? '#EA580C' : (retrasado ? '#DC2626' : '#6B7280'),
                    fontWeight: enConsulta ? 500 : (retrasado ? 700 : 400)
                  }}>
                    {enConsulta ? 'En curso' : `${p.minutos} min`}
                    {retrasado && <span style={{ display: 'block', fontSize: '10px' }}>⚠ Demorado</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{
          marginTop: '16px', padding: '12px 16px', borderRadius: '12px',
          backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
          color: '#3B82F6', fontSize: '13px'
        }}>
          📢 <strong>Información:</strong> Los pacientes serán llamados por su nombre. Por favor mantenga silencio en la sala.
        </div>
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        backgroundColor: '#3B82F6', color: 'white', padding: '10px 0',
        overflow: 'hidden', zIndex: 50
      }}>
        <div className="animate-marquee" style={{ whiteSpace: 'nowrap', display: 'inline-block', fontSize: '13px' }}>
          {MENSAJES_TICKER[tickerIdx]}
          <span style={{ margin: '0 24px' }}>·</span>
          {MENSAJES_TICKER[(tickerIdx + 1) % MENSAJES_TICKER.length]}
          <span style={{ margin: '0 24px' }}>·</span>
          {MENSAJES_TICKER[(tickerIdx + 2) % MENSAJES_TICKER.length]}
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}