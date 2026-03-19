import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { logout } from '../../api/auth';

const navItems = [
  { path: '/worker', label: 'לוח זמנים', icon: '📅', exact: true },
  { path: '/worker/appointments', label: 'התורים שלי', icon: '📋' },
  { path: '/worker/availability', label: 'זמינות', icon: '🕐' },
];

export default function WorkerLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, setUser } = useAuth();
  const { addToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      // ignore
    }
    setUser(null);
    navigate('/login');
    addToast('התנתקת בהצלחה');
  };

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-emerald-900 text-white w-64">
      <div className="p-6 border-b border-emerald-800">
        <h1 className="text-xl font-bold">מנהל תורים</h1>
        <p className="text-emerald-300 text-sm mt-1">{user?.name}</p>
        <span className="inline-block mt-1 text-xs bg-emerald-700 text-emerald-200 px-2 py-0.5 rounded-full">עובד</span>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium
              ${isActive(item) ? 'bg-emerald-700 text-white' : 'text-emerald-200 hover:bg-emerald-800'}`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-emerald-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 text-emerald-200 hover:bg-emerald-800 rounded-lg text-sm font-medium transition-colors"
        >
          <span>🚪</span>
          יציאה
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50" dir="rtl">
      {/* Desktop sidebar (right side) */}
      <aside className="hidden lg:flex flex-col border-l border-gray-200 shadow-lg flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute right-0 top-0 h-full z-50 shadow-xl">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
          <h1 className="font-bold text-emerald-900">מנהל תורים</h1>
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <span className="text-xl">☰</span>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 lg:pt-6 pt-16">
          {children}
        </div>
      </main>
    </div>
  );
}
