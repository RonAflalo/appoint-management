import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoadingSpinner from './components/common/LoadingSpinner';

// Public pages
import Landing from './pages/Landing';
import PublicBooking from './pages/PublicBooking';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyEmail from './pages/auth/VerifyEmail';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminWorkers from './pages/admin/Workers';
import AdminServices from './pages/admin/Services';
import AdminAppointments from './pages/admin/Appointments';
import AdminSettings from './pages/admin/Settings';
import AdminWorkersCalendar from './pages/admin/WorkersCalendar';
import AdminCustomers from './pages/admin/Customers';
import AdminOnboarding from './pages/admin/Onboarding';

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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/book/:slug" element={<PublicBooking />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/verify-email/:token" element={<VerifyEmail />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

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
      <Route path="/admin/workers-calendar" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><AdminWorkersCalendar /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/customers" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminLayout><AdminCustomers /></AdminLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/onboarding" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminOnboarding />
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
