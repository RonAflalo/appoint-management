import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock useAuth so we control auth state
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

// Mock heavy page components to avoid import errors
vi.mock('../pages/Landing', () => ({ default: () => <div>landing</div> }));
vi.mock('../pages/PublicBooking', () => ({ default: () => <div>public booking</div> }));
vi.mock('../pages/auth/Login', () => ({ default: () => <div>login page</div> }));
vi.mock('../pages/auth/Register', () => ({ default: () => <div>register page</div> }));
vi.mock('../pages/admin/Dashboard', () => ({ default: () => <div>admin dashboard</div> }));
vi.mock('../pages/admin/Workers', () => ({ default: () => <div>admin workers</div> }));
vi.mock('../pages/admin/Services', () => ({ default: () => <div>admin services</div> }));
vi.mock('../pages/admin/Appointments', () => ({ default: () => <div>admin appointments</div> }));
vi.mock('../pages/admin/Settings', () => ({ default: () => <div>admin settings</div> }));
vi.mock('../pages/admin/WorkersCalendar', () => ({ default: () => <div>admin calendar</div> }));
vi.mock('../pages/worker/Schedule', () => ({ default: () => <div>worker schedule</div> }));
vi.mock('../pages/worker/Appointments', () => ({ default: () => <div>worker appointments</div> }));
vi.mock('../pages/worker/Availability', () => ({ default: () => <div>worker availability</div> }));
vi.mock('../pages/customer/Home', () => ({ default: () => <div>customer home</div> }));
vi.mock('../pages/customer/Book', () => ({ default: () => <div>customer book</div> }));
vi.mock('../pages/customer/MyAppointments', () => ({ default: () => <div>customer appointments</div> }));
vi.mock('../components/Layout/AdminLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../components/Layout/WorkerLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../components/Layout/CustomerLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../components/common/LoadingSpinner', () => ({ default: () => <div>spinner</div> }));

import { useAuth } from '../hooks/useAuth';
import App from '../App';

function renderAtPath(path, authState) {
  useAuth.mockReturnValue(authState);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('shows loading spinner while auth is being determined', () => {
    renderAtPath('/admin', { user: null, loading: true });
    expect(screen.getByText('spinner')).toBeInTheDocument();
  });

  it('redirects unauthenticated user to /login', () => {
    renderAtPath('/admin', { user: null, loading: false });
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('redirects to / when role does not match', () => {
    renderAtPath('/admin', { user: { id: 1, role: 'worker' }, loading: false });
    expect(screen.getByText('landing')).toBeInTheDocument();
  });

  it('renders admin page for admin role', () => {
    renderAtPath('/admin', { user: { id: 1, role: 'admin' }, loading: false });
    expect(screen.getByText('admin dashboard')).toBeInTheDocument();
  });

  it('renders worker page for worker role', () => {
    renderAtPath('/worker', { user: { id: 2, role: 'worker' }, loading: false });
    expect(screen.getByText('worker schedule')).toBeInTheDocument();
  });

  it('renders customer page for user role', () => {
    renderAtPath('/customer', { user: { id: 3, role: 'user' }, loading: false });
    expect(screen.getByText('customer home')).toBeInTheDocument();
  });

  it('prevents worker from accessing admin routes', () => {
    renderAtPath('/admin/workers', { user: { id: 2, role: 'worker' }, loading: false });
    // Should redirect to /
    expect(screen.getByText('landing')).toBeInTheDocument();
  });

  it('prevents customer from accessing worker routes', () => {
    renderAtPath('/worker/appointments', { user: { id: 3, role: 'user' }, loading: false });
    expect(screen.getByText('landing')).toBeInTheDocument();
  });

  it('allows unauthenticated access to public routes', () => {
    renderAtPath('/', { user: null, loading: false });
    expect(screen.getByText('landing')).toBeInTheDocument();
  });

  it('allows unauthenticated access to login page', () => {
    renderAtPath('/login', { user: null, loading: false });
    expect(screen.getByText('login page')).toBeInTheDocument();
  });
});
