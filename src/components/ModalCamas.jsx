import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { BedDouble, X } from 'lucide-react';

const NOMBRES_AREA = {
  OBSERVACION: 'Observación',
  HOSPITALIZACION: 'Hospitalización',
  CIRUGIA: 'Cirugía',
  TERAPIA_INTENSIVA: 'UCI',
  INTERNAMIENTO: 'Internamiento',
};

const ICONOS_AREA = {
  OBSERVACION: '👁',
  HOSPITALIZACION: '🏨',
  CIRUGIA: '🔪',
  TERAPIA_INTENSIVA: '💊',
  INTERNAMIENTO: '🏨',
};

export default function ModalCamas({ open, onClose, pacienteId, area, onAsignar }) {
  const [camas, setCamas] = useState([]);
  const [camaSeleccionada, setCamaSeleccionada] = useState('');

  useEffect(() => {
    if (!open || !area) return;
    const q = query(
      collection(db, 'camas'),
      where('area', '==', area),
      where('ocupada', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => a.numero - b.numero);
      setCamas(lista);
    });
    return () => unsub();
  }, [open, area]);

  const asignarCama = async () => {
    if (!camaSeleccionada) return;
    try {
      await updateDoc(doc(db, 'camas', camaSeleccionada), {
        ocupada: true,
        paciente_id: pacienteId
      });
      await updateDoc(doc(db, 'pacientes', pacienteId), {
        cama_asignada: camaSeleccionada
      });
      onAsignar(camaSeleccionada);
    } catch (err) {
      console.error('Error asignando cama:', err);
    }
  };

  if (!open) return null;

  const nombreArea = NOMBRES_AREA[area] || area;
  const iconoArea = ICONOS_AREA[area] || '🏥';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px 28px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
              {iconoArea} Asignar cama
            </h2>
            <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>
              {nombreArea} · Selecciona una cama disponible
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm">
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px 28px' }}>
          {camas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#9CA3AF' }}>
              <BedDouble size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontSize: '14px' }}>No hay camas disponibles en {nombreArea}</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>
                Puedes continuar sin asignar cama
              </p>
            </div>
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '8px',
                marginBottom: '16px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {camas.map(cama => (
                  <button
                    key={cama.id}
                    onClick={() => setCamaSeleccionada(cama.id)}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: '10px',
                      border: '2px solid',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      backgroundColor: camaSeleccionada === cama.id ? '#EFF6FF' : '#F0FDF4',
                      borderColor: camaSeleccionada === cama.id ? '#3B82F6' : '#BBF7D0',
                      color: camaSeleccionada === cama.id ? '#3B82F6' : '#16A34A',
                      transition: 'all 0.15s ease'
                    }}
                    title={`Cama ${cama.numero} - ${nombreArea}`}
                  >
                    {cama.numero}
                  </button>
                ))}
              </div>

              <div style={{
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: '#F9FAFB',
                fontSize: '12px',
                color: '#6B7280',
                textAlign: 'center',
                marginBottom: '12px'
              }}>
                🟢 {camas.length} camas disponibles en {nombreArea}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} className="btn btn-secondary">
              Omitir
            </button>
            <button
              onClick={asignarCama}
              disabled={!camaSeleccionada}
              className="btn btn-primary"
            >
              ✅ Asignar cama
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}