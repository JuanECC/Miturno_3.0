import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROL_RUTA } from '../services/authService';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pastel-gris">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin puede entrar a cualquier parte
  if (user.rol === 'admin') {
    return children;
  }

  // Verificar roles permitidos
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.rol)) {
    return <Navigate to={ROL_RUTA[user.rol] || '/login'} replace />;
  }

  return children;
};

export default ProtectedRoute;