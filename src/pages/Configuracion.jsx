import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Volume2, VolumeX } from 'lucide-react';
import { useToast } from '../components/Toast';

export default function Configuracion() {
  const { addToast } = useToast();
  const [voces, setVoces] = useState([]);
  const [config, setConfig] = useState({
    vozTipo: 'femenino',
    vozRate: 0.85,
    vozVolume: 1,
    alertasActivas: true,
    tiempoAlerta: 10,
    triajePreferencia: 'ambos',
    licencia: 'hospital',
    capacidad: 20,
  });
  const [loading, setLoading] = useState(true);
  const [capacidadTemp, setCapacidadTemp] = useState(20);

  // Cargar configuración desde Firestore
  useEffect(() => {
    const cargarConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'configuracion', 'global'));
        if (snap.exists()) {
          const data = snap.data();
          setConfig(prev => ({ ...prev, ...data }));
          if (data.capacidad) {
            setCapacidadTemp(data.capacidad);
            localStorage.setItem('mt-capacidad', data.capacidad);
          }
        }
      } catch (err) {
        console.error('Error cargando configuración:', err);
        addToast('Error al cargar la configuración', 'error', 4000, 'Error');
      } finally {
        setLoading(false);
      }
    };
    cargarConfig();
  }, []);

  // Cargar voces
  useEffect(() => {
    const cargarVoces = () => {
      const disponibles = window.speechSynthesis.getVoices();
      const espanol = disponibles.filter(v => v.lang.startsWith('es'));
      setVoces(espanol);
    };

    cargarVoces();
    window.speechSynthesis.onvoiceschanged = cargarVoces;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const vocesMasculinas = voces.filter(v =>
    v.name.toLowerCase().includes('male') ||
    v.name.toLowerCase().includes('raul') ||
    v.name.toLowerCase().includes('pablo') ||
    v.name.toLowerCase().includes('carlos')
  );

  const vocesFemeninas = voces.filter(v =>
    v.name.toLowerCase().includes('female') ||
    v.name.toLowerCase().includes('sabina') ||
    v.name.toLowerCase().includes('maria') ||
    v.name.toLowerCase().includes('ana')
  );

  const guardarConfig = async (nuevaConfig) => {
    const updated = { ...config, ...nuevaConfig };
    setConfig(updated);
    try {
      await setDoc(doc(db, 'configuracion', 'global'), updated, { merge: true });
      addToast('Configuración guardada correctamente', 'success', 3000, '✅ Guardado');
    } catch (err) {
      console.error('Error guardando:', err);
      addToast('Error al guardar la configuración', 'error', 4000, 'Error');
    }
  };

  const guardarCapacidad = async () => {
    const num = parseInt(capacidadTemp);
    if (isNaN(num) || num < 1 || num > 500) {
      addToast('Ingresa un número entre 1 y 500', 'warning', 3000, 'Valor inválido');
      return;
    }
    try {
      await setDoc(doc(db, 'configuracion', 'global'), { capacidad: num }, { merge: true });
      setConfig(prev => ({ ...prev, capacidad: num }));
      localStorage.setItem('mt-capacidad', num);
      addToast(`Capacidad actualizada a ${num} ${config.licencia === 'clinica' ? 'cuartos' : 'camas'}`, 'success', 3000, '✅ Guardado');
    } catch (err) {
      console.error('Error guardando capacidad:', err);
      addToast('Error al guardar la capacidad', 'error', 4000, 'Error');
    }
  };

  const probarVoz = () => {
    const utterance = new SpeechSynthesisUtterance('Hola, soy la voz de Miturno. Sistema de triaje hospitalario.');
    utterance.lang = 'es-MX';
    utterance.rate = config.vozRate;
    utterance.volume = config.vozVolume;

    const voices = window.speechSynthesis.getVoices();
    const espanol = voices.filter(v => v.lang.startsWith('es'));
    const candidatas = config.vozTipo === 'masculino' ? vocesMasculinas : vocesFemeninas;

    if (candidatas.length > 0) {
      utterance.voice = candidatas[0];
    } else if (espanol.length > 0) {
      utterance.voice = espanol[0];
    }

    window.speechSynthesis.speak(utterance);
    addToast('Probando voz... 🎙️', 'info', 2000);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
          <div className="skeleton" style={{ width: '200px', height: '16px', margin: '0 auto' }} />
          <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '12px' }}>Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 className="page-title">Configuración del sistema</h1>
          <p className="page-subtitle">Personaliza la experiencia de Miturno</p>
        </div>
      </div>

      {/* ── CAPACIDAD / CAMAS ── */}
      <div className="card">
        <h3 className="section-title">🏥 Capacidad del sistema</h3>
        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
          Define el número máximo de {config.licencia === 'clinica' ? 'cuartos' : 'camas'} disponibles. 
          Este valor se usa en el Dashboard para calcular la saturación.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="label">
              Número de {config.licencia === 'clinica' ? 'cuartos' : 'camas'}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <input 
                type="number" 
                min="1" 
                max="500" 
                value={capacidadTemp} 
                onChange={(e) => setCapacidadTemp(e.target.value)}
                className="input-modern"
                style={{ width: '120px', textAlign: 'center', fontSize: '18px', fontWeight: 700 }}
              />
              <button 
                onClick={guardarCapacidad}
                className="btn btn-primary"
              >
                Guardar capacidad
              </button>
              <span style={{ fontSize: '13px', color: '#9CA3AF' }}>
                Actual: <strong>{config.capacidad || 20}</strong> {config.licencia === 'clinica' ? 'cuartos' : 'camas'}
              </span>
            </div>
          </div>
          
          <div style={{ 
            padding: '12px 16px', 
            borderRadius: '12px', 
            backgroundColor: '#F0FDF4', 
            border: '1px solid #BBF7D0',
            fontSize: '13px', 
            color: '#16A34A' 
          }}>
            💡 La capacidad se sincroniza automáticamente con todos los dashboards del sistema.
          </div>
        </div>
      </div>

      {/* ── LICENCIA DEL SISTEMA ── */}
      <div className="card">
        <h3 className="section-title">Licencia del sistema</h3>
        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
          Selecciona el modo de operación de Miturno
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { 
              value: 'hospital', 
              label: '🏥 Modo Hospitalario', 
              desc: 'Triaje Manchester obligatorio, todos los destinos, cola de espera priorizada.',
            },
            { 
              value: 'clinica', 
              label: '🏨 Modo Clínica', 
              desc: 'Triaje opcional para citas programadas, destinos simplificados, seguimiento por médico.',
            },
          ].map(opcion => (
            <label
              key={opcion.value}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '14px', cursor: 'pointer',
                padding: '16px', borderRadius: '14px',
                backgroundColor: config.licencia === opcion.value ? '#EFF6FF' : '#F9FAFB',
                border: `2px solid ${config.licencia === opcion.value ? '#3B82F6' : '#E5E7EB'}`,
                transition: 'all 0.15s ease'
              }}
            >
              <input
                type="radio"
                name="licencia"
                value={opcion.value}
                checked={config.licencia === opcion.value}
                onChange={() => guardarConfig({ licencia: opcion.value })}
                style={{ marginTop: '2px', accentColor: '#3B82F6', width: '16px', height: '16px', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937', marginBottom: '2px' }}>
                  {opcion.label}
                </div>
                <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: 1.4 }}>
                  {opcion.desc}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ── PREFERENCIA DE TRIAJE ── */}
      <div className="card">
        <h3 className="section-title">Preferencia de triaje</h3>
        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
          Elige qué método de triaje se usará por defecto en Recepción
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { value: 'manchester', label: '🏥 Triaje Manchester', desc: 'Sistema de clasificación tradicional basado en reglas clínicas.' },
            { value: 'mito', label: '🤖 Mito (IA)', desc: 'Diagnóstico asistido por inteligencia artificial.' },
            { value: 'ambos', label: '🔄 Ambos (Manchester + Mito)', desc: 'Muestra los dos diagnósticos y permite elegir el más adecuado.' },
          ].map(opcion => (
            <label key={opcion.value} style={{
              display: 'flex', alignItems: 'flex-start', gap: '14px', cursor: 'pointer',
              padding: '16px', borderRadius: '14px',
              backgroundColor: config.triajePreferencia === opcion.value ? '#EFF6FF' : '#F9FAFB',
              border: `2px solid ${config.triajePreferencia === opcion.value ? '#3B82F6' : '#E5E7EB'}`,
              transition: 'all 0.15s ease'
            }}>
              <input type="radio" name="triajePreferencia" value={opcion.value} checked={config.triajePreferencia === opcion.value}
                onChange={() => guardarConfig({ triajePreferencia: opcion.value })}
                style={{ marginTop: '2px', accentColor: '#3B82F6', width: '16px', height: '16px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937', marginBottom: '2px' }}>{opcion.label}</div>
                <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: 1.4 }}>{opcion.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ── VOZ ── */}
      <div className="card">
        <h3 className="section-title">
          <Volume2 size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Voz de alertas
        </h3>
        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
          Configura la voz que anunciará los pacientes en la sala de espera
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label className="label">Tipo de voz</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => guardarConfig({ vozTipo: 'femenino' })} className={`btn ${config.vozTipo === 'femenino' ? 'btn-primary' : 'btn-secondary'}`}>👩 Femenina</button>
              <button onClick={() => guardarConfig({ vozTipo: 'masculino' })} className={`btn ${config.vozTipo === 'masculino' ? 'btn-primary' : 'btn-secondary'}`}>👨 Masculina</button>
            </div>
            <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '6px' }}>
              {config.vozTipo === 'femenino'
                ? `${vocesFemeninas.length} voces femeninas disponibles`
                : `${vocesMasculinas.length} voces masculinas disponibles`}
            </p>
          </div>

          <div>
            <label className="label">Velocidad: {config.vozRate}x</label>
            <input type="range" min="0.5" max="1.5" step="0.05" value={config.vozRate} onChange={e => guardarConfig({ vozRate: parseFloat(e.target.value) })} style={{ width: '100%', accentColor: '#3B82F6' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9CA3AF' }}>
              <span>Lento</span><span>Normal</span><span>Rápido</span>
            </div>
          </div>

          <div>
            <label className="label">Volumen: {Math.round(config.vozVolume * 100)}%</label>
            <input type="range" min="0" max="1" step="0.1" value={config.vozVolume} onChange={e => guardarConfig({ vozVolume: parseFloat(e.target.value) })} style={{ width: '100%', accentColor: '#3B82F6' }} />
          </div>

          <button onClick={probarVoz} className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>🎙️ Probar voz</button>
        </div>
      </div>

      {/* ── ALERTAS ── */}
      <div className="card">
        <h3 className="section-title">Alertas visuales</h3>
        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
          Configura las alertas que aparecen en la pantalla de sala de espera
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <label className="label" style={{ marginBottom: 0 }}>Alertas activas</label>
              <p style={{ fontSize: '12px', color: '#9CA3AF' }}>Mostrar alerta cuando se llama a un paciente</p>
            </div>
            <button onClick={() => guardarConfig({ alertasActivas: !config.alertasActivas })} className={`btn btn-sm ${config.alertasActivas ? 'btn-primary' : 'btn-secondary'}`}>
              {config.alertasActivas ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {config.alertasActivas ? 'Activadas' : 'Desactivadas'}
            </button>
          </div>

          <div>
            <label className="label">Duración de alerta: {config.tiempoAlerta} segundos</label>
            <input type="range" min="5" max="30" step="1" value={config.tiempoAlerta} onChange={e => guardarConfig({ tiempoAlerta: parseInt(e.target.value) })} style={{ width: '100%', accentColor: '#3B82F6' }} />
          </div>
        </div>
      </div>

      {/* ── VOCES DISPONIBLES ── */}
      <div className="card">
        <h3 className="section-title">Voces instaladas en el sistema</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {voces.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#9CA3AF' }}>Cargando voces disponibles...</p>
          ) : (
            voces.map((voz, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', backgroundColor: '#F9FAFB', borderRadius: '12px'
              }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937' }}>{voz.name}</p>
                  <p style={{ fontSize: '11px', color: '#9CA3AF' }}>{voz.lang}</p>
                </div>
                <span className="badge" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                  {voz.name.toLowerCase().includes('male') || voz.name.toLowerCase().includes('raul') ? '👨 Masculina' :
                   voz.name.toLowerCase().includes('female') || voz.name.toLowerCase().includes('sabina') ? '👩 Femenina' : '🌐'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}