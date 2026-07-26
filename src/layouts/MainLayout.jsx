import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { logout } from '../services/authService';
import {
  LayoutDashboard, ClipboardList, Stethoscope, Monitor,
  Users, LogOut, Menu, X, Sun, Moon,
  UserCog, Hospital, Settings, FileText, BedDouble, Calendar
} from 'lucide-react';
import Notificaciones from '../components/Notificaciones';

const NAV_ITEMS = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/usuarios', label: 'Usuarios', icon: UserCog },
    { to: '/admin/citas', label: 'Citas', icon: Calendar },
    { to: '/admin/pacientes-activos', label: 'Pacientes Activos', icon: BedDouble },
    { to: '/admin/historial', label: 'Historial Clínico', icon: FileText },
    { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
    { to: '/recepcion', label: 'Recepción', icon: ClipboardList },
    { to: '/doctor', label: 'Consultorio', icon: Stethoscope },
    { to: '/pantalla', label: 'Sala de espera', icon: Monitor },
  ],
  recepcionista: [
    { to: '/recepcion', label: 'Admisión', icon: ClipboardList, end: true },
    { to: '/recepcion/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/recepcion/citas', label: 'Citas', icon: Calendar },
    { to: '/recepcion/pacientes-activos', label: 'Pacientes Activos', icon: BedDouble },
    { to: '/recepcion/historial', label: 'Historial Clínico', icon: FileText },
    { to: '/pantalla', label: 'Pantalla', icon: Monitor },
  ],
  doctor: [
    { to: '/doctor', label: 'Consultorio', icon: Stethoscope, end: true },
    { to: '/doctor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/doctor/pacientes-activos', label: 'Pacientes Activos', icon: BedDouble },
    { to: '/doctor/historial', label: 'Historial Clínico', icon: FileText },
    { to: '/pantalla', label: 'Pantalla', icon: Monitor },
  ],
  pantalla: [
    { to: '/pantalla', label: 'Sala de espera', icon: Monitor },
  ],
};

const ROLES_LABEL = {
  admin: 'Administrador',
  recepcionista: 'Recepcionista',
  doctor: 'Médico',
  pantalla: 'Pantalla',
};

export default function MainLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('mt-theme');
      const isDark = saved === 'dark';
      if (isDark) {
        document.body.classList.add('dark');
      } else {
        document.body.classList.remove('dark');
      }
      return isDark;
    } catch {
      return false;
    }
  });

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    try {
      localStorage.setItem('mt-theme', next ? 'dark' : 'light');
    } catch {}
    if (next) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = NAV_ITEMS[user?.rol] || [];
  const inicial = (user?.nombre || user?.email || '?')[0].toUpperCase();

  return (
    <div className="main-layout" style={{ minHeight: '100vh', display: 'flex' }}>
      
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)'
          }}
          className="lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        width: '260px', backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column',
        borderRight: '1px solid #E5E7EB',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease'
      }} className="lg:translate-x-0 lg:static lg:z-auto">
        
        {/* Logo */}
        <div style={{
          height: '64px', display: 'flex', alignItems: 'center', gap: '12px',
          padding: '0 20px', borderBottom: '1px solid #E5E7EB', flexShrink: 0
        }}>
          <div style={{
            width: '36px', height: '36px', backgroundColor: '#3B82F6',
            borderRadius: '12px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'white'
          }}>
            <Hospital size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="sidebar-title" style={{ fontWeight: 600, color: '#1F2937', fontSize: '15px', lineHeight: 1.2 }}>
              Miturno
            </p>
            <p className="sidebar-subtitle" style={{ fontSize: '11px', color: '#9CA3AF' }}>
              {ROLES_LABEL[user?.rol] || user?.rol}
            </p>
          </div>
        </div>

        {/* Navegación */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '12px',
                  fontSize: '14px', fontWeight: 500,
                  backgroundColor: isActive ? '#EFF6FF' : 'transparent',
                  color: isActive ? '#3B82F6' : '#6B7280',
                  textDecoration: 'none', transition: 'all 0.15s ease'
                })}
              >
                <item.icon size={18} strokeWidth={1.75} />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px', borderTop: '1px solid #E5E7EB', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 12px', borderRadius: '12px',
            backgroundColor: '#F9FAFB'
          }}>
            <div style={{
              width: '32px', height: '32px', backgroundColor: '#EFF6FF',
              borderRadius: '10px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#3B82F6',
              fontWeight: 600, fontSize: '13px'
            }}>
              {inicial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="sidebar-user-name" style={{
                fontSize: '13px', fontWeight: 500, color: '#1F2937',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {user?.nombre || 'Usuario'}
              </p>
              <p className="sidebar-user-email" style={{
                fontSize: '11px', color: '#9CA3AF',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {user?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              style={{
                width: '28px', height: '28px', borderRadius: '8px',
                border: 'none', background: 'none', cursor: 'pointer',
                color: '#9CA3AF', display: 'flex', alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido principal - Click cierra sidebar en móvil */}
      <div 
        onClick={() => setSidebarOpen(false)}
        style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}
      >
        
        {/* Header */}
        <header style={{
          height: '64px', backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', position: 'sticky', top: 0, zIndex: 30
        }} className="lg:px-8">
          
          {/* Botón menú móvil */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="lg:hidden"
              onClick={(e) => {
                e.stopPropagation();
                setSidebarOpen(true);
              }}
              style={{
                width: '36px', height: '36px', borderRadius: '10px',
                border: 'none', background: 'none', cursor: 'pointer',
                color: '#6B7280', display: 'flex', alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Menu size={20} />
            </button>
          </div>

          {/* Acciones derecha */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* 🆕 Notificaciones */}
            <Notificaciones />

            {/* Toggle tema */}
            <button
              onClick={toggleDarkMode}
              style={{
                width: '36px', height: '36px', borderRadius: '10px',
                border: 'none', background: 'none', cursor: 'pointer',
                color: '#6B7280', display: 'flex', alignItems: 'center',
                justifyContent: 'center'
              }}
              title={darkMode ? 'Modo claro' : 'Modo oscuro'}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Contenido */}
        <main
          className="main-content"
          style={{
            flex: 1, padding: '24px 16px', maxWidth: '1400px',
            margin: '0 auto', width: '100%'
          }}
        >
          <Outlet />
        </main>
        
      </div>
    </div>
  );
}