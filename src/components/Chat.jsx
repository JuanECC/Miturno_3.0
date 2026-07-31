import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { MessageCircle, X, Send, Users, User, ArrowLeft } from 'lucide-react';

export default function Chat() {
  const { user } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [pestana, setPestana] = useState('general');
  const [chatPrivado, setChatPrivado] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [noLeidosGlobal, setNoLeidosGlobal] = useState(0);
  const [noLeidosPrivados, setNoLeidosPrivados] = useState({});
  const fondoRef = useRef(null);

  // Cargar usuarios para chats privados
  useEffect(() => {
    if (!abierto) return;
    const q = query(collection(db, 'usuarios'), where('rol', 'in', ['admin', 'doctor', 'recepcionista']));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsuarios(lista.filter(u => u.id !== user?.uid));
    });
    return () => unsub();
  }, [abierto]);

  // Escuchar chat global
  useEffect(() => {
    if (!abierto) return;
    const q = query(collection(db, 'mensajes'), where('tipo', '==', 'global'), orderBy('timestamp', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.reverse();
      if (pestana === 'general') setMensajes(lista);
    });
    return () => unsub();
  }, [abierto, pestana]);

  // Escuchar chat privado
  useEffect(() => {
    if (!abierto || !chatPrivado) return;
    const miId = user?.uid;
    const otroId = chatPrivado.id;
    const chatId = [miId, otroId].sort().join('_');
    
    const q = query(
      collection(db, 'mensajes'),
      where('chatId', '==', chatId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.reverse();
      setMensajes(lista);
    });
    return () => unsub();
  }, [abierto, chatPrivado]);

  useEffect(() => {
    if (fondoRef.current) fondoRef.current.scrollTop = fondoRef.current.scrollHeight;
  }, [mensajes]);

  const enviarMensaje = async () => {
    if (!texto.trim()) return;
    
    const mensajeData = {
      texto: texto.trim(),
      autor: user?.nombre || user?.email,
      autorId: user?.uid,
      rol: user?.rol,
      timestamp: serverTimestamp(),
    };

    if (pestana === 'general') {
      mensajeData.tipo = 'global';
    } else if (chatPrivado) {
      mensajeData.tipo = 'privado';
      mensajeData.chatId = [user?.uid, chatPrivado.id].sort().join('_');
      mensajeData.para = chatPrivado.id;
    }

    try {
      await addDoc(collection(db, 'mensajes'), mensajeData);
      setTexto('');
    } catch (err) {
      console.error('Error enviando mensaje:', err);
    }
  };

  const abrirChatPrivado = (usuario) => {
    setChatPrivado(usuario);
    setPestana('privado');
    setNoLeidosPrivados(prev => ({ ...prev, [usuario.id]: 0 }));
  };

  const volverAGeneral = () => {
    setChatPrivado(null);
    setPestana('general');
  };

  const abrirPanel = () => {
    setAbierto(true);
    setNoLeidosGlobal(0);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  };

  const coloresRol = {
    admin: { bg: '#F3E8FF', color: '#7C3AED' },
    doctor: { bg: '#DCFCE7', color: '#15803D' },
    recepcionista: { bg: '#FFF7ED', color: '#C2410C' },
  };

  const formatearHora = (ts) => {
    if (!ts?.toDate) return '';
    return ts.toDate().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  if (!user || user.rol === 'pantalla') return null;

  const totalNoLeidos = noLeidosGlobal + Object.values(noLeidosPrivados).reduce((a, b) => a + b, 0);

  return (
    <>
      <button
        onClick={abrirPanel}
        style={{
          position: 'fixed', bottom: '80px', right: '24px', zIndex: 99,
          width: '56px', height: '56px', borderRadius: '28px',
          backgroundColor: '#3B82F6', color: 'white', border: 'none',
          cursor: 'pointer', boxShadow: '0 4px 20px rgba(59,130,246,0.4)',
          display: abierto ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Chat"
      >
        <MessageCircle size={24} />
        {totalNoLeidos > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            minWidth: '22px', height: '22px', borderRadius: '11px',
            backgroundColor: '#EF4444', color: 'white', fontSize: '11px',
            fontWeight: 700, display: 'flex', alignItems: 'center',
            justifyContent: 'center', border: '2px solid white', padding: '0 5px',
          }}>
            {totalNoLeidos}
          </span>
        )}
      </button>

      {abierto && (
        <div style={{
          position: 'fixed', bottom: '80px', right: '24px', zIndex: 99,
          width: '380px', height: '520px', backgroundColor: '#FFFFFF',
          borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: '1px solid #E5E7EB',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px', backgroundColor: '#3B82F6', color: 'white',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {pestana === 'privado' && (
                <button onClick={volverAGeneral} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}>
                  <ArrowLeft size={18} />
                </button>
              )}
              <span style={{ fontWeight: 600, fontSize: '14px' }}>
                {pestana === 'general' ? '💬 Chat general' : `👤 ${chatPrivado?.nombre || 'Chat'}`}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => { setPestana('general'); setChatPrivado(null); }}
                style={{
                  background: pestana === 'general' ? 'rgba(255,255,255,0.3)' : 'none',
                  border: 'none', color: 'white', cursor: 'pointer',
                  padding: '4px 8px', borderRadius: '6px', fontSize: '12px',
                }}
              >
                <Users size={16} />
              </button>
              <button onClick={() => setAbierto(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Lista de usuarios (solo en pestaña general) */}
          {pestana === 'general' && (
            <div style={{
              padding: '8px 12px', borderBottom: '1px solid #E5E7EB',
              display: 'flex', gap: '6px', overflowX: 'auto', flexShrink: 0,
            }}>
              {usuarios.map(u => (
                <button
                  key={u.id}
                  onClick={() => abrirChatPrivado(u)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 10px', borderRadius: '20px', border: '1px solid #E5E7EB',
                    backgroundColor: '#F9FAFB', cursor: 'pointer', fontSize: '12px',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    backgroundColor: '#22C55E',
                  }} />
                  {u.nombre || u.email}
                </button>
              ))}
            </div>
          )}

          {/* Mensajes */}
          <div ref={fondoRef} style={{
            flex: 1, overflowY: 'auto', padding: '16px',
            display: 'flex', flexDirection: 'column', gap: '12px',
            backgroundColor: '#F9FAFB',
          }}>
            {mensajes.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '13px', marginTop: '40px' }}>
                No hay mensajes aún
              </div>
            ) : (
              mensajes.map(msg => {
                const esPropio = msg.autorId === user?.uid;
                const rolColor = coloresRol[msg.rol] || { color: '#6B7280' };
                
                return (
                  <div key={msg.id} style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: esPropio ? 'flex-end' : 'flex-start',
                  }}>
                    {!esPropio && (
                      <span style={{
                        fontSize: '10px', fontWeight: 600,
                        color: rolColor.color, marginBottom: '2px', paddingLeft: '4px',
                      }}>
                        {msg.autor}
                      </span>
                    )}
                    <div style={{
                      maxWidth: '80%', padding: '10px 14px',
                      borderRadius: esPropio ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      backgroundColor: esPropio ? '#3B82F6' : '#FFFFFF',
                      color: esPropio ? 'white' : '#1F2937', fontSize: '13px',
                      lineHeight: 1.4, border: esPropio ? 'none' : '1px solid #E5E7EB',
                      wordBreak: 'break-word',
                    }}>
                      {msg.texto}
                    </div>
                    <span style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px', paddingRight: '4px' }}>
                      {formatearHora(msg.timestamp)}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 16px', borderTop: '1px solid #E5E7EB',
            display: 'flex', gap: '8px', backgroundColor: '#FFFFFF', flexShrink: 0,
          }}>
            <input
              type="text" value={texto} onChange={e => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={pestana === 'general' ? 'Mensaje general...' : `Mensaje para ${chatPrivado?.nombre || '...'}`}
              className="input-modern"
              style={{ flex: 1, height: '42px', fontSize: '13px' }}
              autoFocus
            />
            <button
              onClick={enviarMensaje} disabled={!texto.trim()}
              className="btn btn-primary"
              style={{ width: '42px', height: '42px', padding: 0, borderRadius: '12px' }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}