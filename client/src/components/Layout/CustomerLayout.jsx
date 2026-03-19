import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { logout } from '../../api/auth';
import EmailVerificationBanner from '../common/EmailVerificationBanner';

const navItems = [
  { path: '/customer', label: 'קביעת תור', icon: '📅', exact: true },
  { path: '/customer/appointments', label: 'התורים שלי', icon: '📋' },
];

export default function CustomerLayout({ children }) {
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

  return (
    <div className="flex flex-col min-h-screen bg-gray-50" dir="rtl">
      {/* Desktop top navbar */}
      <header className="hidden md:flex sticky top-0 z-30 items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          {user?.business?.logo_url
            ? <img src={user.business.logo_url} alt={user.business.name} className="h-8 w-8 rounded-lg object-contain" onError={e => e.target.style.display='none'} />
            : <span className="text-2xl">📅</span>
          }
          <h1 className="text-lg font-bold text-gray-900">{user?.business?.name || 'תוריי'}</h1>
        </div>
        <nav className="flex items-center gap-1">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${isActive(item) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">שלום, {user?.name}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
          >
            יציאה
          </button>
        </div>
      </header>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          {user?.business?.logo_url
            ? <img src={user.business.logo_url} alt={user.business.name} className="h-7 w-7 rounded-lg object-contain" onError={e => e.target.style.display='none'} />
            : <span className="text-xl">📅</span>
          }
          <h1 className="font-bold text-gray-900">{user?.business?.name || 'תוריי'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
          >
            יציאה
          </button>
        </div>
      </header>

      <EmailVerificationBanner />

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-6 overflow-y-auto pt-14 md:pt-0">
        <div className="max-w-2xl mx-auto px-4 py-4 md:py-6">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-30">
        <div className="flex">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex-1 flex flex-col items-center justify-center py-3 text-xs font-medium transition-colors
                ${isActive(item) ? 'text-indigo-600' : 'text-gray-500'}`}
            >
              <span className="text-xl mb-1">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
