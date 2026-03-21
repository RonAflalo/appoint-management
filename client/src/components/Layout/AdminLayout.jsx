import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { logout } from '../../api/auth';
import EmailVerificationBanner from '../common/EmailVerificationBanner';
import AiChat from '../admin/AiChat';
import NotificationBell from '../admin/NotificationBell';

const navItems = [
  { path: '/admin', label: 'דשבורד', icon: 'grid_view', exact: true },
  { path: '/admin/workers', label: 'עובדים', icon: 'group' },
  { path: '/admin/workers-calendar', label: 'לוח עובדים', icon: 'calendar_month' },
  { path: '/admin/services', label: 'שירותים', icon: 'content_cut' },
  { path: '/admin/appointments', label: 'תורים', icon: 'event' },
  { path: '/admin/customers', label: 'לקוחות', icon: 'person' },
  { path: '/admin/analytics', label: 'אנליטיקה', icon: 'analytics' },
  { path: '/admin/store', label: 'חנות', icon: 'storefront' },
  { path: '/admin/recurring-rules', label: 'תורים קבועים', icon: 'repeat' },
  { path: '/admin/settings', label: 'הגדרות', icon: 'settings' },
];

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, setUser } = useAuth();
  const { addToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await logout(); } catch (_) {}
    setUser(null);
    navigate('/login');
    addToast('התנתקת בהצלחה');
  };

  const isActive = (item) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-surface-container-lowest w-64 rounded-l-3xl overflow-hidden">
      {/* Brand */}
      <div className="p-6 border-b border-outline-variant/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl primary-gradient flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-white text-lg">event_available</span>
          </div>
          <div>
            <h1 className="font-headline font-extrabold text-base text-primary leading-none">{user?.business?.name || 'תוריי'}</h1>
            <p className="text-xs text-on-surface-variant mt-0.5">{user?.name}</p>
          </div>
        </div>
        <span className="inline-block mt-3 text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-semibold">מנהל</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-full transition-all text-sm font-medium
              ${isActive(item)
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
          >
            <span className={`material-symbols-outlined text-xl ${isActive(item) ? 'text-primary' : ''}`}
              style={isActive(item) ? { fontVariationSettings: "'FILL' 1" } : {}}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-outline-variant/20">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-on-surface-variant hover:bg-red-50 hover:text-error rounded-full text-sm font-medium transition-colors"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          יציאה
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-surface-container" dir="rtl">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col flex-shrink-0 my-3 ml-3 shadow-sm">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute right-0 top-0 h-full z-50 shadow-2xl">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden fixed top-0 left-0 right-0 z-30 glass-header border-b border-outline-variant/20 flex items-center px-4 py-3">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors flex-shrink-0">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="font-headline font-extrabold text-primary flex-1 text-center">{user?.business?.name || 'תוריי'}</span>
          <NotificationBell />
        </header>

        <EmailVerificationBanner />
        <div className="flex-1 overflow-y-auto p-4 pt-20 lg:pt-8">
          {children}
        </div>
      </main>
      <AiChat />
    </div>
  );
}
