import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc, serverTimestamp, collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import BuscadorCIE10 from '../components/BuscadorCIE10';
import ModalCamas from '../components/ModalCamas';
import {
  ArrowLeft, Activity, ClipboardList, FileText, Pill, FlaskConical, History, UserRound, X
} from 'lucide-react';

const TABS = [
  { key: 'resumen', label: 'Resumen', icon: Activity },
  { key: 'historia', label: 'Historia Clínica', icon: ClipboardList },
  { key: 'diagnostico', label: 'Diagnóstico', icon: FileText },
  { key: 'nota', label: 'Nota Médica', icon: FileText },
  { key: 'indicaciones', label: 'Indicaciones', icon: Pill },
  { key: 'estudios', label: 'Estudios', icon: FlaskConical },
  { key: 'seguimiento', label: 'Seguimiento', icon: History },
];

export default function Consulta() {
  const { pacienteId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [paciente, setPaciente] = useState(null);
  const [activeTab, setActiveTab] = useState('resumen');
  const [licencia, setLicencia] = useState('hospital');
  const [mostrarModalCamas, setMostrarModalCamas] = useState(false);
  const [destinoSeleccionado, setDestinoSeleccionado] = useState('');
  const [camaAsignada, setCamaAsignada] = useState('');

  // Historia clínica
  const [historia, setHistoria] = useState({
    padecimiento: '',
    antecedentes: '',
    exploracion: '',
  });

  // Diagnóstico
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [diagnosticoPrincipal, setDiagnosticoPrincipal] = useState('');

  // Cargar paciente
  useEffect(() => {
    if (!pacienteId) return;
    const unsub = onSnapshot(doc(db, 'pacientes', pacienteId), (snap) => {
      if (snap.exists()) {
        setPaciente({ id: snap.id, ...snap.data() });
      } else {
        addToast('Paciente no encontrado', 'error', 3000);
        navigate('/doctor');
      }
    });
    return () => unsub();
  }, [pacienteId]);

  // Cargar licencia
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracion', 'global'), (snap) => {
      if (snap.exists() && snap.data().licencia) setLicencia(snap.data().licencia);
    });
    return () => unsub();
  }, []);

  // Cargar historia clínica previa
  useEffect(() => {
    if (!pacienteId) return;
    const historiaRef = doc(db, 'pacientes', pacienteId, 'historia_clinica', 'actual');
    getDoc(historiaRef).then((snap) => {
      if (snap.exists()) setHistoria(snap.data());
    });
  }, [pacienteId]);

  // Guardar historia clínica
  const guardarHistoria = async () => {
    try {
      await updateDoc(doc(db, 'pacientes', pacienteId, 'historia_clinica', 'actual'), {
        ...historia,
        actualizado_en: serverTimestamp(),
        autor: user?.nombre || 'Médico',
      });
      addToast('Historia clínica guardada', 'success', 3000, '✅');
    } catch (err) {
      console.error('Error guardando historia:', err);
      addToast('Error al guardar', 'error', 3000);
    }
  };

  // Agregar diagnóstico
  const agregarDiagnostico = (diag) => {
    if (!diag) return;
    setDiagnosticos(prev => [...prev, diag]);
    if (!diagnosticoPrincipal) setDiagnosticoPrincipal(diag.codigo);
  };

  // Finalizar atención (destino)
  const finalizarAtencion = async (destino) => {
    if (!paciente) return;
    if (destino === 'ALTA') {
      // Lógica de alta (se implementará completa más adelante)
      navigate('/doctor');
      return;
    }
    // Para destinos que requieren cama, mostrar modal
    setDestinoSeleccionado(destino);
    setMostrarModalCamas(true);
  };

  const confirmarDestino = async () => {
    try {
      await updateDoc(doc(db, 'pacientes', pacienteId), {
        estado: destinoSeleccionado === 'ALTA' ? 'alta' : destinoSeleccionado.toLowerCase(),
        ubicacion_actual: destinoSeleccionado,
        fecha_atencion: serverTimestamp(),
        atendido_por: user?.nombre || user?.email,
      });
      addToast('Atención finalizada', 'success', 3000, '✅');
      navigate('/doctor');
    } catch (err) {
      console.error('Error finalizando:', err);
      addToast('Error al finalizar', 'error', 3000);
    }
  };

  if (!paciente) {
    return <div className="page-container"><div className="card">Cargando paciente...</div></div>;
  }

  const DESTINOS = licencia === 'clinica'
    ? [{ key: 'ALTA', label: 'Alta', icon: '✅' }, { key: 'INTERNAMIENTO', label: 'Internamiento', icon: '🏨' }]
    : [
        { key: 'ALTA', label: 'Alta', icon: '✅' },
        { key: 'OBSERVACION', label: 'Observación', icon: '👁' },
        { key: 'HOSPITALIZACION', label: 'Hospitalización', icon: '🏨' },
        { key: 'CIRUGIA', label: 'Cirugía', icon: '🔪' },
        { key: 'TERAPIA_INTENSIVA', label: 'UCI', icon: '💊' },
        { key: 'TRASLADO', label: 'Traslado', icon: '🚑' },
      ];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/doctor')} className="btn btn-ghost btn-sm"><ArrowLeft size={18} /></button>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>{paciente.nombre}</h2>
            <p style={{ fontSize: '13px', color: '#6B7280' }}>
              {paciente.edad} años · {paciente.especialidad} · Nivel {paciente.nivel_prioridad}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {DESTINOS.map(dest => (
            <button
              key={dest.key}
              onClick={() => finalizarAtencion(dest.key)}
              className={`btn btn-sm ${dest.key === 'ALTA' ? 'btn-secondary' : 'btn-primary'}`}
            >
              {dest.icon} {dest.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', borderBottom: '1px solid #E5E7EB', paddingBottom: '8px' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '10px',
                border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                backgroundColor: active ? '#EFF6FF' : 'transparent',
                color: active ? '#3B82F6' : '#6B7280',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenido según pestaña */}
      {activeTab === 'resumen' && (
        <div className="cards-grid-2">
          <div className="card">
            <h3 className="section-title">Datos del paciente</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p><strong>Nombre:</strong> {paciente.nombre}</p>
              <p><strong>Edad:</strong> {paciente.edad} años</p>
              <p><strong>Especialidad:</strong> {paciente.especialidad || 'General'}</p>
              <p><strong>Motivo:</strong> {paciente.motivo}</p>
              <p><strong>Antecedentes:</strong> {paciente.antecedentes || 'Ninguno'}</p>
              {paciente.signosAlarma?.length > 0 && (
                <p><strong>Signos de alarma:</strong> {paciente.signosAlarma.join(', ')}</p>
              )}
            </div>
          </div>
          <div className="card">
            <h3 className="section-title">Signos vitales</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {paciente.vitales?.ta && <span className="badge" style={{ backgroundColor: '#F3F4F6' }}>T/A: {paciente.vitales.ta}</span>}
              {paciente.vitales?.temp && <span className="badge" style={{ backgroundColor: '#F3F4F6' }}>Temp: {paciente.vitales.temp}°C</span>}
              {paciente.vitales?.fc && <span className="badge" style={{ backgroundColor: '#F3F4F6' }}>FC: {paciente.vitales.fc}</span>}
              {paciente.vitales?.spo2 && <span className="badge" style={{ backgroundColor: '#F3F4F6' }}>SpO₂: {paciente.vitales.spo2}%</span>}
              {paciente.vitales?.glu && <span className="badge" style={{ backgroundColor: '#F3F4F6' }}>Glucosa: {paciente.vitales.glu}</span>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'historia' && (
        <div className="card">
          <h3 className="section-title">Historia clínica</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="label">Padecimiento actual</label>
              <textarea
                value={historia.padecimiento}
                onChange={(e) => setHistoria(prev => ({ ...prev, padecimiento: e.target.value }))}
                rows={3}
                placeholder="Describe el padecimiento actual..."
                className="input-modern"
              />
            </div>
            <div>
              <label className="label">Antecedentes de importancia</label>
              <textarea
                value={historia.antecedentes}
                onChange={(e) => setHistoria(prev => ({ ...prev, antecedentes: e.target.value }))}
                rows={2}
                placeholder="Antecedentes heredofamiliares, personales, etc."
                className="input-modern"
              />
            </div>
            <div>
              <label className="label">Exploración física</label>
              <textarea
                value={historia.exploracion}
                onChange={(e) => setHistoria(prev => ({ ...prev, exploracion: e.target.value }))}
                rows={4}
                placeholder="Describe los hallazgos de la exploración física..."
                className="input-modern"
              />
            </div>
            <button onClick={guardarHistoria} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              💾 Guardar historia
            </button>
          </div>
        </div>
      )}

      {activeTab === 'diagnostico' && (
        <div className="card">
          <h3 className="section-title">Diagnóstico CIE-10</h3>
          <BuscadorCIE10 onSelect={agregarDiagnostico} />
          {diagnosticos.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <h4 className="label">Diagnósticos seleccionados</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {diagnosticos.map((diag, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#F9FAFB', borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px' }}>{diag.descripcion}</span>
                    <span style={{ fontWeight: 600, color: '#3B82F6' }}>{diag.codigo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {['nota', 'indicaciones', 'estudios', 'seguimiento'].includes(activeTab) && (
        <div className="card">
          <h3 className="section-title">Módulo en desarrollo</h3>
          <p style={{ color: '#9CA3AF' }}>Esta sección se implementará en la siguiente fase.</p>
        </div>
      )}

      {/* Modal de cama */}
      <ModalCamas
        open={mostrarModalCamas}
        onClose={() => setMostrarModalCamas(false)}
        pacienteId={pacienteId}
        area={destinoSeleccionado}
        onAsignar={(cama) => {
          setCamaAsignada(cama);
          setMostrarModalCamas(false);
          confirmarDestino();
        }}
      />
    </div>
  );
}