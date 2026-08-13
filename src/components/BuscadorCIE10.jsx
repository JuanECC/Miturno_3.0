import { useState, useEffect, useRef } from 'react';
import cie10Data from '../data/cie10.json';
import { Search, X } from 'lucide-react';

export default function BuscadorCIE10({ onSelect, defaultValue = '' }) {
  const [busqueda, setBusqueda] = useState(defaultValue);
  const [resultados, setResultados] = useState([]);
  const [mostrar, setMostrar] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setMostrar(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (busqueda.trim().length < 2) {
      setResultados([]);
      return;
    }
    const q = busqueda.toLowerCase().trim();
    const filtrados = cie10Data.filter(
      (item) =>
        item.codigo.toLowerCase().includes(q) ||
        item.descripcion.toLowerCase().includes(q)
    );
    setResultados(filtrados.slice(0, 20));
  }, [busqueda]);

  const handleSelect = (item) => {
    setSeleccionado(item);
    setBusqueda(`${item.codigo} - ${item.descripcion}`);
    setMostrar(false);
    onSelect(item);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setMostrar(true);
            setSeleccionado(null);
          }}
          onFocus={() => setMostrar(true)}
          placeholder="Buscar diagnóstico por código o descripción..."
          className="input-modern"
          autoComplete="off"
        />
        <Search size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
      </div>

      {mostrar && resultados.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          backgroundColor: '#FFF', border: '1px solid #E5E7EB',
          borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
          zIndex: 50, maxHeight: '250px', overflowY: 'auto', marginTop: '4px'
        }}>
          {resultados.map((item, idx) => (
            <button
              key={`${item.codigo}-${idx}`}
              onClick={() => handleSelect(item)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 14px',
                border: 'none', borderBottom: '1px solid #F3F4F6',
                background: 'none', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '13px', color: '#1F2937', flex: 1 }}>{item.descripcion}</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#3B82F6', marginLeft: '8px' }}>{item.codigo}</span>
            </button>
          ))}
        </div>
      )}
      {seleccionado && (
        <p style={{ fontSize: '11px', color: '#16A34A', marginTop: '4px' }}>
          ✓ {seleccionado.codigo} - {seleccionado.descripcion}
        </p>
      )}
    </div>
  );
}