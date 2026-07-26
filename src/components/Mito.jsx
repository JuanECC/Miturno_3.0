import { useState, useEffect } from 'react';

export default function Mito({ estado = 'normal', mensaje = '', onDiagnosticar }) {
  const [mostrarBocadillo, setMostrarBocadillo] = useState(false);
  const [hablando, setHablando] = useState(false);

  useEffect(() => {
    if (mensaje && mensaje.length > 0) {
      setMostrarBocadillo(true);
      setHablando(true);
      const timer = setTimeout(() => {
        setMostrarBocadillo(false);
        setHablando(false);
      }, 6000);
      return () => clearTimeout(timer);
    } else {
      setMostrarBocadillo(false);
      setHablando(false);
    }
  }, [mensaje]);

  const getColors = () => {
    switch (estado) {
      case 'critico': return { 
        face: '#3B0F0F', eyes: '#EF4444', mouth: '#EF4444', logo: '#EF4444', 
        foot: '#DC2626', ball: '#EF4444', glow: 'rgba(239,68,68,0.6)',
        earGlow: '#EF4444', bodyBg: '#FEF2F2'
      };
      case 'analizando': return { 
        face: '#1A2E1A', eyes: '#EAB308', mouth: '#EAB308', logo: '#EAB308', 
        foot: '#CA8A04', ball: '#FACC15', glow: 'rgba(234,179,8,0.6)',
        earGlow: '#EAB308', bodyBg: '#FFF7ED'
      };
      case 'exito': return { 
        face: '#0F2B1A', eyes: '#22C55E', mouth: '#22C55E', logo: '#22C55E', 
        foot: '#16A34A', ball: '#4ADE80', glow: 'rgba(34,197,94,0.6)',
        earGlow: '#22C55E', bodyBg: '#F0FDF4'
      };
      case 'dormido': return { 
        face: '#1A1D27', eyes: '#6B7280', mouth: '#6B7280', logo: '#9CA3AF', 
        foot: '#6B7280', ball: '#9CA3AF', glow: 'rgba(156,163,175,0.3)',
        earGlow: '#6B7280', bodyBg: '#F9FAFB'
      };
      default: return { 
        face: '#07152F', eyes: '#5EE5E7', mouth: '#5EE5E7', logo: '#19C5CE', 
        foot: '#18C4CD', ball: '#65E3E6', glow: 'rgba(94,229,231,0.6)',
        earGlow: '#5EE5E7', bodyBg: '#FFFFFF'
      };
    }
  };

  const c = getColors();

  return (
    <div style={{ position: 'relative' }}>
      
      {/* Bocadillo */}
      {mostrarBocadillo && mensaje && (
        <div style={{
          position: 'absolute', bottom: 155, right: -10,
          background: '#1F2937', color: '#FFF', borderRadius: 14,
          padding: '10px 14px', maxWidth: 200, textAlign: 'center',
          fontSize: 11, fontWeight: 500, zIndex: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,.2)',
          animation: 'mitoBubbleIn 0.4s ease'
        }}>
          {mensaje}
          <div style={{ position: 'absolute', bottom: -7, right: 30, transform: 'rotate(45deg)', width: 14, height: 14, background: '#1F2937' }} />
          {hablando && (
            <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 6 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{
                  width: 3, height: 8, background: c.eyes, borderRadius: 2,
                  animation: `mitoSound 0.5s ease-in-out ${i * 0.15}s infinite`
                }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Robot */}
      <div style={{ 
        width: 98, height: 168, position: 'relative',
        animation: hablando ? 'mitoTalk 0.4s ease-in-out infinite' : 'mitoFloat 3s ease-in-out infinite',
        cursor: onDiagnosticar ? 'pointer' : 'default'
      }} onClick={onDiagnosticar}>
        
        {/* Antena */}
        <div style={{ position: 'absolute', width: 4, height: 17, top: 0, left: 47, background: '#172B4D', borderRadius: 3 }}>
          <div style={{ 
            position: 'absolute', width: 11, height: 11, top: -8, left: -3, borderRadius: '50%', 
            background: `linear-gradient(145deg, #65E3E6, ${c.ball})`,
            boxShadow: `0 0 ${estado === 'analizando' ? 8 : 4}px ${c.glow}`
          }} />
        </div>

        {/* Cabeza */}
        <div style={{ position: 'absolute', width: 90, height: 63, top: 13, left: 4, borderRadius: 27, background: 'linear-gradient(145deg, #FFF, #E7EAF2)', boxShadow: '0 3px 6px rgba(0,0,0,.15)' }}>
          
          {/* Orejas */}
          <div style={{ position: 'absolute', width: 9, height: 24, top: 19, left: -4, background: '#16345F', borderRadius: 6 }}>
            <div style={{ position: 'absolute', width: 5, height: 11, top: 7, left: 2, background: c.earGlow, borderRadius: '50%', opacity: 0.7 }} />
          </div>
          <div style={{ position: 'absolute', width: 9, height: 24, top: 19, right: -4, background: '#16345F', borderRadius: 6 }}>
            <div style={{ position: 'absolute', width: 5, height: 11, top: 7, left: 2, background: c.earGlow, borderRadius: '50%', opacity: 0.7 }} />
          </div>

          {/* Pantalla facial */}
          <div style={{ position: 'absolute', width: 71, height: 44, top: 10, left: 10, borderRadius: 20, background: `linear-gradient(145deg, #1D3155, ${c.face})`, boxShadow: 'inset 1px 1px 3px rgba(255,255,255,.08), inset -1px -1px 3px rgba(0,0,0,.4)' }}>
            
            <div style={{ position: 'absolute', width: 24, height: 8, top: 4, left: 8, background: 'rgba(255,255,255,.12)', borderRadius: '50%', transform: 'rotate(-25deg)' }} />

            {/* Ojos */}
            <div style={{ position: 'absolute', width: '100%', top: 14, display: 'flex', justifyContent: 'space-around', padding: '0 14px' }}>
              <div style={{ 
                width: 10, height: 14, background: c.eyes, borderRadius: '50%', 
                boxShadow: `0 0 ${estado === 'analizando' ? 8 : 5}px ${c.glow}`,
                animation: estado === 'analizando' ? 'mitoBlinkFast 0.4s infinite' : estado === 'critico' ? 'mitoBlinkFast 0.6s infinite' : 'mitoBlink 4s infinite'
              }} />
              <div style={{ 
                width: 10, height: 14, background: c.eyes, borderRadius: '50%', 
                boxShadow: `0 0 ${estado === 'analizando' ? 8 : 5}px ${c.glow}`,
                animation: estado === 'analizando' ? 'mitoBlinkFast 0.4s infinite' : estado === 'critico' ? 'mitoBlinkFast 0.6s infinite' : 'mitoBlink 4s infinite'
              }} />
            </div>

            {/* Boca */}
            <div style={{ 
              position: 'absolute', width: hablando ? 16 : 14, height: hablando ? 9 : 7,
              bottom: 9, left: 28,
              borderBottom: `2px solid ${c.mouth}`, borderRadius: '50%',
              opacity: estado === 'dormido' ? 0.3 : 1,
            }} />
          </div>
        </div>

        {/* Cuerpo */}
        <div style={{ position: 'absolute', width: 65, height: 57, top: 71, left: 17, borderRadius: '17px 17px 21px 21px', background: 'linear-gradient(145deg, #FFF, #E5E8EF)', boxShadow: '0 2px 4px rgba(0,0,0,.15)' }}>
          <div style={{ position: 'absolute', width: '100%', top: 18, textAlign: 'center', fontSize: 7, fontWeight: 'bold', color: '#172B4D' }}>
            <span style={{ color: c.logo }}>Mi</span>Turno
          </div>
          <div style={{ position: 'absolute', width: 11, height: 2, bottom: 8, left: 27, background: c.foot, borderRadius: 3 }} />
        </div>

        {/* Brazos */}
        <div style={{ position: 'absolute', width: 17, height: 44, top: 76, left: 0, background: 'linear-gradient(145deg, #FFF, #DFE3EC)', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,.15)', transform: 'rotate(35deg)' }}>
          <div style={{ position: 'absolute', width: 9, height: 9, bottom: -4, left: 4, background: '#172B4D', borderRadius: '50%' }} />
        </div>
        <div style={{ position: 'absolute', width: 17, height: 44, top: 76, right: 0, background: 'linear-gradient(145deg, #FFF, #DFE3EC)', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,.15)', transform: 'rotate(-30deg)' }}>
          <div style={{ position: 'absolute', width: 9, height: 9, bottom: -4, left: 4, background: '#172B4D', borderRadius: '50%' }} />
        </div>

        {/* Piernas */}
        <div style={{ position: 'absolute', width: 19, height: 36, top: 124, left: 22, background: 'linear-gradient(145deg, #FFF, #DFE3EC)', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,.15)' }}>
          <div style={{ position: 'absolute', width: 12, height: 9, top: 2, left: 3, background: '#AEB8CE', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', width: 29, height: 17, bottom: -8, left: -5, background: 'linear-gradient(145deg, #FFF, #E1E4EB)', borderRadius: '11px 11px 7px 7px', borderBottom: `3px solid ${c.foot}`, boxShadow: '0 1px 2px rgba(0,0,0,.15)' }} />
        </div>
        <div style={{ position: 'absolute', width: 19, height: 36, top: 124, right: 22, background: 'linear-gradient(145deg, #FFF, #DFE3EC)', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,.15)' }}>
          <div style={{ position: 'absolute', width: 12, height: 9, top: 2, left: 3, background: '#AEB8CE', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', width: 29, height: 17, bottom: -8, left: -5, background: 'linear-gradient(145deg, #FFF, #E1E4EB)', borderRadius: '11px 11px 7px 7px', borderBottom: `3px solid ${c.foot}`, boxShadow: '0 1px 2px rgba(0,0,0,.15)' }} />
        </div>
      </div>

      <style>{`
        @keyframes mitoFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes mitoTalk { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-2px) scale(1.03); } }
        @keyframes mitoBlink { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
        @keyframes mitoBlinkFast { 0%,80%,100% { transform: scaleY(1); } 90% { transform: scaleY(0.1); } }
        @keyframes mitoSound { 0%,100% { height: 4px; } 50% { height: 12px; } }
        @keyframes mitoBubbleIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}