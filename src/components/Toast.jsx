import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);

const TOAST_STYLES = {
  success: {
    bg: '#F0FDF4', border: '#BBF7D0', icon: '#16A34A', text: '#15803D',
    iconBg: '#DCFCE7', progress: '#16A34A'
  },
  error: {
    bg: '#FEF2F2', border: '#FECACA', icon: '#DC2626', text: '#991B1B',
    iconBg: '#FEE2E2', progress: '#DC2626'
  },
  warning: {
    bg: '#FFF7ED', border: '#FED7AA', icon: '#EA580C', text: '#9A3412',
    iconBg: '#FFEDD5', progress: '#EA580C'
  },
  info: {
    bg: '#EFF6FF', border: '#BFDBFE', icon: '#3B82F6', text: '#1E40AF',
    iconBg: '#DBEAFE', progress: '#3B82F6'
  },
};

const TOAST_ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(100);
  const styles = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
  const Icon = TOAST_ICONS[toast.type] || Info;

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    
    const duration = toast.duration || 4000;
    const interval = 50;
    const steps = duration / interval;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      setProgress(100 - (currentStep / steps) * 100);
      if (currentStep >= steps) {
        clearInterval(timer);
        handleClose();
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  const handleClose = () => {
    setLeaving(true);
    setTimeout(() => onRemove(toast.id), 400);
  };

  return (
    <div
      style={{
        backgroundColor: styles.bg,
        border: `1.5px solid ${styles.border}`,
        borderRadius: '16px',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
        transform: visible && !leaving ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible && !leaving ? 1 : 0,
        transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease',
        pointerEvents: 'auto',
        position: 'relative',
        overflow: 'hidden',
        minWidth: '320px',
        maxWidth: '420px'
      }}
    >
      {/* Barra de progreso */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, height: '3px',
        backgroundColor: styles.progress,
        width: `${progress}%`,
        transition: 'width 50ms linear',
        borderRadius: '0 0 16px 16px'
      }} />

      {/* Icono */}
      <div style={{
        width: '36px', height: '36px', borderRadius: '12px',
        backgroundColor: styles.iconBg, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={20} style={{ color: styles.icon }} />
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '13px', fontWeight: 600, color: styles.text,
          marginBottom: '2px', letterSpacing: '-0.1px'
        }}>
          {toast.title || (toast.type === 'success' ? '¡Completado!' : toast.type === 'error' ? 'Error' : toast.type === 'warning' ? 'Atención' : 'Información')}
        </p>
        <p style={{ fontSize: '13px', color: styles.text, opacity: 0.85, lineHeight: 1.4 }}>
          {toast.message}
        </p>
      </div>

      {/* Cerrar */}
      <button
        onClick={handleClose}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: styles.icon, opacity: 0.5, padding: '4px',
          display: 'flex', flexShrink: 0, borderRadius: '8px',
          transition: 'opacity 0.15s ease'
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000, title) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration, title }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      
      {/* Contenedor de toasts */}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: '12px',
        pointerEvents: 'none'
      }}>
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}