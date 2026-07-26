import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { Plus, Pencil, Trash2, X, Eye, EyeOff, Users } from 'lucide-react';
import { useToast } from '../components/Toast';

const ROLES = [
  { key: 'admin', label: 'Administrador', icon: '🔧', desc: 'Acceso completo al sistema' },
  { key: 'doctor', label: 'Médico', icon: '🩺', desc: 'Atiende y da de alta' },
  { key: 'recepcionista', label: 'Recepcionista', icon: '🏥', desc: 'Registra e ingresa pacientes' },
  { key: 'pantalla', label: 'Pantalla', icon: '🖥', desc: 'Solo visualización de sala' },
];

export default function UsuariosPage() {
  const { addToast } = useToast();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [uidEditar, setUidEditar] = useState(null);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: '' });
  const [showPass, setShowPass] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ open: false, uid: null, nombre: '' });

  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'usuarios'));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const orden = ['admin', 'doctor', 'recepcionista', 'pantalla'];
      lista.sort((a, b) => orden.indexOf(a.rol) - orden.indexOf(b.rol));
      setUsuarios(lista);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      addToast('No se pudieron cargar los usuarios. Verifica la conexión.', 'error', 4000, 'Error de carga');
    } finally { setLoading(false); }
  };

  useEffect(() => { cargarUsuarios(); }, []);

  const contadores = { admin: 0, doctor: 0, recepcionista: 0, pantalla: 0 };
  usuarios.forEach(u => { if (contadores[u.rol] !== undefined) contadores[u.rol]++; });

  const abrirCrear = () => {
    setModoEdicion(false); setUidEditar(null);
    setForm({ nombre: '', email: '', password: '', rol: '' });
    setShowPass(false); setModalOpen(true);
  };

  const abrirEditar = (usuario) => {
    setModoEdicion(true); setUidEditar(usuario.id);
    setForm({ nombre: usuario.nombre || '', email: usuario.email || '', password: '', rol: usuario.rol || '' });
    setShowPass(false); setModalOpen(true);
  };

  const guardarUsuario = async () => {
    if (!form.nombre.trim()) {
      addToast('El nombre completo es obligatorio', 'warning', 3000, 'Campo requerido');
      return;
    }
    if (!form.rol) {
      addToast('Selecciona un rol para el usuario', 'warning', 3000, 'Rol requerido');
      return;
    }
    if (!modoEdicion && !form.email.trim()) {
      addToast('El correo electrónico es obligatorio', 'warning', 3000, 'Campo requerido');
      return;
    }
    if (!modoEdicion && form.password.length < 8) {
      addToast('La contraseña debe tener al menos 8 caracteres', 'warning', 3000, 'Contraseña muy corta');
      return;
    }

    setGuardando(true);
    try {
      if (modoEdicion) {
        await updateDoc(doc(db, 'usuarios', uidEditar), {
          nombre: form.nombre.trim(), rol: form.rol, actualizado_en: serverTimestamp(),
        });
        addToast(`Usuario "${form.nombre}" actualizado correctamente`, 'success', 3000, '✅ Actualizado');
      } else {
        const firebaseConfig = {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID,
        };
        const secondApp = initializeApp(firebaseConfig, 'secondary-' + Date.now());
        const secondAuth = getAuth(secondApp);
        const cred = await createUserWithEmailAndPassword(secondAuth, form.email.trim(), form.password);
        await secondAuth.signOut();
        await setDoc(doc(db, 'usuarios', cred.user.uid), {
          nombre: form.nombre.trim(), email: form.email.trim(), rol: form.rol,
          creado_en: serverTimestamp(), activo: true,
        });
        addToast(`Usuario "${form.nombre}" creado correctamente — ${form.email}`, 'success', 4000, '✅ Usuario creado');
      }
      setModalOpen(false); cargarUsuarios();
    } catch (err) {
      console.error('Error guardando usuario:', err);
      const mensajes = {
        'auth/email-already-in-use': 'Este correo ya está registrado en el sistema.',
        'auth/invalid-email': 'El correo electrónico no es válido.',
        'auth/weak-password': 'La contraseña es muy débil. Usa al menos 8 caracteres.',
      };
      addToast(mensajes[err.code] || err.message || 'Error al guardar usuario', 'error', 5000, 'Error');
    } finally { setGuardando(false); }
  };

  const confirmarEliminar = async () => {
    if (!deleteModal.uid) return;
    try {
      await deleteDoc(doc(db, 'usuarios', deleteModal.uid));
      addToast(`Usuario "${deleteModal.nombre}" eliminado del sistema`, 'success', 3000, '🗑️ Eliminado');
      setDeleteModal({ open: false, uid: null, nombre: '' });
      cargarUsuarios();
    } catch (err) {
      console.error('Error eliminando:', err);
      addToast('No se pudo eliminar el usuario. Intenta de nuevo.', 'error', 4000, 'Error');
    }
  };

  const rolColor = (rol) => {
    const map = {
      admin: { bg: '#F3E8FF', color: '#7C3AED', border: '#DDD6FE' },
      doctor: { bg: '#DCFCE7', color: '#15803D', border: '#BBF7D0' },
      recepcionista: { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
      pantalla: { bg: '#F3F4F6', color: '#4B5563', border: '#D1D5DB' },
    };
    return map[rol] || { bg: '#F3F4F6', color: '#4B5563', border: '#D1D5DB' };
  };

  return (
    <div className="page-container">
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 className="page-title">Gestión de usuarios</h1>
          <p className="page-subtitle">Crea, edita y desactiva cuentas del sistema</p>
        </div>
        <button onClick={abrirCrear} className="btn btn-primary">
          <Plus size={18} /> Nuevo usuario
        </button>
      </div>

      {/* ── CONTADORES ── */}
      <div className="cards-grid-4">
        {ROLES.map(r => (
          <div key={r.key} className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', backgroundColor: rolColor(r.key).bg, color: rolColor(r.key).color
            }}>
              {r.icon}
            </div>
            <div>
              <div className="kpi-value" style={{ fontSize: '24px' }}>{contadores[r.key]}</div>
              <div className="kpi-label">{r.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── LISTA DE USUARIOS ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="section-title" style={{ marginBottom: 0 }}>Usuarios registrados</h3>
          <span className="badge" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>{usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div className="skeleton" style={{ width: '200px', height: '16px', margin: '0 auto' }} />
          </div>
        ) : usuarios.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <p className="empty-state-text">No hay usuarios registrados</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {usuarios.map(u => {
              const rc = rolColor(u.rol);
              return (
                <div key={u.id} style={{
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px',
                  padding: '14px 20px', borderBottom: '1px solid #F9FAFB',
                  transition: 'background 0.15s ease'
                }}
                className="hover:bg-gray-50"
                >
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '14px', flexShrink: 0,
                    backgroundColor: rc.bg, color: rc.color, border: `1.5px solid ${rc.border}`
                  }}>
                    {(u.nombre || u.email || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '14px', color: '#1F2937' }}>{u.nombre || '—'}</p>
                    <p style={{ fontSize: '12px', color: '#9CA3AF' }}>{u.email || '—'}</p>
                  </div>
                  <span className="badge" style={{ backgroundColor: rc.bg, color: rc.color, border: `1px solid ${rc.border}`, flexShrink: 0 }}>
                    {ROLES.find(r => r.key === u.rol)?.icon} {ROLES.find(r => r.key === u.rol)?.label || u.rol}
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => abrirEditar(u)} className="btn btn-secondary btn-sm"><Pencil size={14} /> Editar</button>
                    <button onClick={() => setDeleteModal({ open: true, uid: u.id, nombre: u.nombre || u.email })} className="btn btn-danger btn-sm"><Trash2 size={14} /> Eliminar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL CREAR/EDITAR ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1F2937' }}>{modoEdicion ? 'Editar usuario' : 'Nuevo usuario'}</h2>
                <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '2px' }}>{modoEdicion ? 'Modificar datos de la cuenta' : 'Crear cuenta de acceso'}</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="btn btn-ghost btn-sm" style={{ width: '32px', height: '32px', padding: 0 }}><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div><label className="label">Nombre completo *</label><input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Dr. Juan Pérez" className="input-modern" /></div>

              {!modoEdicion && (
                <>
                  <div><label className="label">Correo electrónico *</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="usuario@hospital.com" className="input-modern" /></div>
                  <div>
                    <label className="label">Contraseña *</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 8 caracteres" className="input-modern" style={{ paddingRight: '40px' }} />
                      <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="label" style={{ marginBottom: '10px' }}>Rol en el sistema *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {ROLES.map(r => (
                    <button key={r.key} onClick={() => setForm({ ...form, rol: r.key })}
                      style={{
                        padding: '12px', borderRadius: '12px', border: '1.5px solid',
                        textAlign: 'left', cursor: 'pointer', background: 'none',
                        borderColor: form.rol === r.key ? rolColor(r.key).color : '#E5E7EB',
                        backgroundColor: form.rol === r.key ? rolColor(r.key).bg : '#FFFFFF',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontSize: '18px' }}>{r.icon}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', marginTop: '4px' }}>{r.label}</div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancelar</button>
              <button onClick={guardarUsuario} disabled={guardando} className="btn btn-primary">
                {guardando ? 'Guardando...' : modoEdicion ? 'Guardar cambios' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ELIMINAR ── */}
      {deleteModal.open && (
        <div className="modal-overlay" onClick={() => setDeleteModal({ open: false, uid: null, nombre: '' })}>
          <div className="modal-box" style={{ maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '28px', textAlign: 'center' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 16px'
              }}>
                <Trash2 size={24} style={{ color: '#DC2626' }} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', marginBottom: '8px' }}>Eliminar usuario</h3>
              <p style={{ fontSize: '14px', color: '#6B7280' }}>¿Eliminar la cuenta de <strong>{deleteModal.nombre}</strong>?</p>
              <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>El usuario no podrá iniciar sesión después de esto.</p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={() => setDeleteModal({ open: false, uid: null, nombre: '' })} className="btn btn-secondary" style={{ flex: 1 }}>Cancelar</button>
                <button onClick={confirmarEliminar} className="btn btn-danger" style={{ flex: 1 }}>Sí, eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}