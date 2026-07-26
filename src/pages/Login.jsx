import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, ROL_RUTA } from '../services/authService';
import { LogIn, Eye, EyeOff, Shield } from 'lucide-react';

const MENSAJES_ERROR = {
  'auth/user-not-found': 'No existe una cuenta con este correo.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/too-many-requests': 'Demasiados intentos. Espere un momento.',
  'auth/invalid-credential': 'Credenciales incorrectas.',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const usuario = await login(email, password);
      const ruta = ROL_RUTA[usuario.rol] || '/admin';
      navigate(ruta, { replace: true });
    } catch (err) {
      setError(MENSAJES_ERROR[err.code] || err.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#F5F6F8' }}>
      
      {/* Panel izquierdo — Marca */}
      <div style={{
        display: 'none', width: '520px', backgroundColor: '#0F172A',
        position: 'relative', overflow: 'hidden', flexDirection: 'column',
        justifyContent: 'space-between', padding: '56px'
      }} className="lg:flex">
        
        {/* Fondos decorativos */}
        <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '400px', height: '400px', borderRadius: '50%', backgroundColor: 'rgba(59,130,246,0.08)' }} />
        <div style={{ position: 'absolute', bottom: '-80px', left: '-80px', width: '300px', height: '300px', borderRadius: '50%', backgroundColor: 'rgba(59,130,246,0.05)' }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '48px' }}>
            <div style={{
              width: '48px', height: '48px', background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
              borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(59,130,246,0.3)'
            }}>
              {/* Cruz médica del logo */}
              <svg viewBox="0 0 100 100" style={{ width: '28px', height: '28px' }} fill="white">
                <rect x="42" y="24" width="16" height="52" rx="4"/>
                <rect x="24" y="42" width="52" height="16" rx="4"/>
              </svg>
            </div>
            <div>
              <span style={{ fontSize: '24px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px' }}>Miturno</span>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase', marginTop: '2px' }}>Sistema Hospitalario</p>
            </div>
          </div>

          <h1 style={{ fontSize: '36px', fontWeight: 700, color: 'white', lineHeight: 1.2, letterSpacing: '-0.5px', marginBottom: '16px' }}>
            Triaje inteligente.<br />
            <span style={{ color: '#3B82F6' }}>Atención que salva vidas.</span>
          </h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, maxWidth: '380px' }}>
            Sistema de clasificación automática de pacientes con monitoreo en tiempo real y gestión hospitalaria integrada.
          </p>

          {/* Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '48px' }}>
            {[
              { icon: '⚡', title: 'Clasificación automática', desc: 'Triaje Manchester + protocolo obstétrico' },
              { icon: '📊', title: 'Estadísticas en vivo', desc: 'Dashboard con datos en tiempo real' },
              { icon: '🔒', title: 'Acceso por rol', desc: 'Recepcionista, médico, admin y pantalla' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '14px',
                  backgroundColor: 'rgba(59,130,246,0.1)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '18px',
                  flexShrink: 0
                }}>
                  {item.icon}
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{item.title}</p>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Shield size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Conexión segura · Datos encriptados</span>
          </div>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>Miturno v3.0 · Sistema hospitalario de urgencias</p>
        </div>
      </div>

      {/* Panel derecho — Formulario */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          
          {/* Logo móvil */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }} className="lg:hidden">
            <div style={{
              width: '56px', height: '56px', background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
              borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(59,130,246,0.3)'
            }}>
              <svg viewBox="0 0 100 100" style={{ width: '32px', height: '32px' }} fill="white">
                <rect x="42" y="24" width="16" height="52" rx="4"/>
                <rect x="24" y="42" width="52" height="16" rx="4"/>
              </svg>
            </div>
            <span style={{ fontSize: '22px', fontWeight: 700, color: '#1F2937' }}>Miturno</span>
            <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>Sistema Hospitalario</p>
          </div>

          {/* Card del formulario */}
          <div className="card" style={{ padding: '32px' }}>
            
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1F2937', letterSpacing: '-0.3px' }}>
                Iniciar sesión
              </h2>
              <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>
                Ingresa tus credenciales para acceder
              </p>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: '14px 16px', borderRadius: '14px',
                backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                marginBottom: '20px'
              }}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  backgroundColor: '#FEE2E2', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: '1px'
                }}>
                  <span style={{ color: '#DC2626', fontSize: '12px', fontWeight: 700 }}>!</span>
                </div>
                <p style={{ fontSize: '13px', color: '#DC2626', lineHeight: 1.4 }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Email */}
              <div>
                <label className="label">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="usuario@hospital.com"
                  autoComplete="email"
                  className="input-modern"
                  autoFocus
                  style={{ fontSize: '15px' }}
                />
              </div>

              {/* Contraseña */}
              <div>
                <label className="label">Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="input-modern"
                    style={{ fontSize: '15px', paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
                      padding: '4px', display: 'flex'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Recordar + Olvidé */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" style={{ width: '16px', height: '16px', borderRadius: '4px', accentColor: '#3B82F6' }} />
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>Recordarme</span>
                </label>
                <button type="button" style={{ fontSize: '13px', color: '#3B82F6', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {/* Botón */}
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: '4px' }}
              >
                {loading ? (
                  <>
                    <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    Verificando...
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    Ingresar al sistema
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p style={{ textAlign: 'center', fontSize: '12px', color: '#9CA3AF', marginTop: '20px' }}>
            ¿Problemas para acceder? Contacta al administrador
          </p>
        </div>
      </div>

      {/* Animación del spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}