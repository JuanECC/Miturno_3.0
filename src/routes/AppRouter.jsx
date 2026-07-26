import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import MainLayout from '../layouts/MainLayout';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import DashboardSimple from '../pages/DashboardSimple';
import Recepcion from '../pages/Recepcion';
import Doctor from '../pages/Doctor';
import Pantalla from '../pages/Pantalla';
import Usuarios from '../pages/Usuarios';
import Configuracion from '../pages/Configuracion';
import HistorialClinico from '../pages/HistorialClinico';
import PacientesActivos from '../pages/PacientesActivos';
import Citas from '../pages/Citas';

export const router = createBrowserRouter([
  // ── LOGIN (público) ──
  { path: '/login', element: <Login /> },

  // ── ADMIN ──
  {
    path: '/admin',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'usuarios', element: <Usuarios /> },
      { path: 'citas', element: <Citas /> },
      { path: 'pacientes-activos', element: <PacientesActivos /> },
      { path: 'historial', element: <HistorialClinico /> },
      { path: 'configuracion', element: <Configuracion /> },
      { path: 'recepcion', element: <Recepcion /> },
      { path: 'doctor', element: <Doctor /> },
      { path: 'pantalla', element: <Pantalla /> },
    ],
  },

  // ── RECEPCIONISTA ──
  {
    path: '/recepcion',
    element: (
      <ProtectedRoute allowedRoles={['recepcionista', 'admin']}>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Recepcion /> },
      { path: 'dashboard', element: <DashboardSimple /> },
      { path: 'citas', element: <Citas /> },
      { path: 'historial', element: <HistorialClinico /> },
      { path: 'pacientes-activos', element: <PacientesActivos /> },
      { path: 'pantalla', element: <Pantalla /> },
    ],
  },

  // ── DOCTOR ──
  {
    path: '/doctor',
    element: (
      <ProtectedRoute allowedRoles={['doctor', 'admin']}>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Doctor /> },
      { path: 'dashboard', element: <DashboardSimple /> },
      { path: 'historial', element: <HistorialClinico /> },
      { path: 'pacientes-activos', element: <PacientesActivos /> },
      { path: 'pantalla', element: <Pantalla /> },
    ],
  },

  // ── PANTALLA (sala de espera) ──
  {
    path: '/pantalla',
    element: (
      <ProtectedRoute allowedRoles={['pantalla', 'admin', 'recepcionista', 'doctor']}>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Pantalla /> },
    ],
  },

  // ── REDIRECCIONES ──
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '*', element: <Navigate to="/login" replace /> },
]);