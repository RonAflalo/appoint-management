import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoadingSpinner from './components/common/LoadingSpinner';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminWorkers from './pages/admin/Workers';
import AdminServices from './pages/admin/Services';
import AdminAppointments from './pages/admin/Appointments';
import AdminSettings from './pages/admin/Settings';

// Worker pages
import WorkerSchedule from './pages/worker/Schedule';
import WorkerAppointments from './pages/worker/Appointments';
import WorkerAvailability from './pages/worker/Availability';

// Customer pages
import CustomerHome from './pages/customer/Home';
import CustomerBook from './pages/customer/Book';
import CustomerMyAppointments from './pages/customer/MyAppointments';

// Layouts
import AdminLayout from './components/Layout/AdminLayout';
import WorkerLayout from './components/Layout/WorkerLayout';
import CustomerLayout from './components/Layout/CustomerLayout';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'worker') return <Navigate to="/worker" replace />;
  return <Navigate to="/customer" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Admin routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><AdminDashboard /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/workers" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><AdminWorkers /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/services" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><AdminServices /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/appointments" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><AdminAppointments /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/settings" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><AdminSettings /></AdminLayout>
        </ProtectedRoute>
      } />

      {/* Worker routes */}
      <Route path="/worker" element={
        <ProtectedRoute allowedRoles={['worker']}>
          <WorkerLayout><WorkerSchedule /></WorkerLayout>
        </ProtectedRoute>
      } />
      <Route path="/worker/appointments" element={
        <ProtectedRoute allowedRoles={['worker']}>
          <WorkerLayout><WorkerAppointments /></WorkerLayout>
        </ProtectedRoute>
      } />
      <Route path="/worker/availability" element={
        <ProtectedRoute allowedRoles={['worker']}>
          <WorkerLayout><WorkerAvailability /></WorkerLayout>
        </ProtectedRoute>
      } />

      {/* Customer routes */}
      <Route path="/customer" element={
        <ProtectedRoute allowedRoles={['user']}>
          <CustomerLayout><CustomerHome /></CustomerLayout>
        </ProtectedRoute>
      } />
      <Route path="/customer/book" element={
        <ProtectedRoute allowedRoles={['user']}>
          <CustomerLayout><CustomerBook /></CustomerLayout>
        </ProtectedRoute>
      } />
      <Route path="/customer/appointments" element={
        <ProtectedRoute allowedRoles={['user']}>
          <CustomerLayout><CustomerMyAppointments /></CustomerLayout>
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
