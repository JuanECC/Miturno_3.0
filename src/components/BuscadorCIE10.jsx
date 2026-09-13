import { useState, useEffect, useRef } from 'react';
import cie10Data from '../data/cie10.json';
import { Search } from 'lucide-react';

export default function BuscadorCIE10({ onSelect, defaultValue = '' }) {
  const [busqueda, setBusqueda] = useState(defaultValue);
  const [resultados, setResultados] = useState([]);
  const [mostrar, setMostrar] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setMostrar(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (busqueda.trim().length < 2) { setResultados([]); return; }
    const q = busqueda.toLowerCase().trim();
    const filtrados = cie10Data.filter(item =>
      item.codigo.toLowerCase().includes(q) || item.descripcion.toLowerCase().includes(q)
    ).slice(0, 30);
    setResultados(filtrados);
  }, [busqueda]);

  const handleSelect = (item) => {
    setSeleccionado(item);
    setBusqueda(`${item.codigo} - ${item.descripcion}`);
    setMostrar(false);
    onSelect(item);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        type="text"
        value={busqueda}
        onChange={e => { setBusqueda(e.target.value); setMostrar(true); setSeleccionado(null); }}
        onFocus={() => setMostrar(true)}
        placeholder="Buscar por código o descripción CIE-10..."
        className="input-modern"
      />
      <Search size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
      {mostrar && resultados.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50,
          maxHeight: '300px', overflowY: 'auto', marginTop: '4px'
        }}>
          {resultados.map((item, idx) => (
            <button
              key={`${item.codigo}-${idx}`}
              onClick={() => handleSelect(item)}
              style={{ width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderBottom: '1px solid #F3F4F6', background: 'none', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F9FAFB'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontWeight: 'bold', marginRight: '8px' }}>{item.codigo}</span>
              <span style={{ fontSize: '13px' }}>{item.descripcion}</span>
            </button>
          ))}
        </div>
      )}
      {seleccionado && (
        <p style={{ marginTop: '4px', color: '#16A34A', fontSize: '13px' }}>
          ✓ {seleccionado.codigo} - {seleccionado.descripcion}
        </p>
      )}
    </div>
  );
}