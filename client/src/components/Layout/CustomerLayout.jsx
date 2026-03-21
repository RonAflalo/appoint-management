import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { logout } from '../../api/auth';
import EmailVerificationBanner from '../common/EmailVerificationBanner';

const baseNavItems = [
  { path: '/customer', label: 'קביעת תור', icon: 'event_available', exact: true },
  { path: '/customer/appointments', label: 'התורים שלי', icon: 'event' },
];

export default function CustomerLayout({ children }) {
  const { user, setUser } = useAuth();
  const navItems = user?.business?.store_enabled
    ? [...baseNavItems, { path: '/customer/store', label: 'חנות', icon: 'storefront' }]
    : baseNavItems;
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

  return (
    <div className="flex flex-col min-h-screen bg-surface-container" dir="rtl">
      {/* Desktop header */}
      <header className="hidden md:flex sticky top-0 z-30 glass-header border-b border-outline-variant/20 items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2.5">
          {user?.business?.logo_url
            ? <img src={user.business.logo_url} alt={user.business.name} className="h-8 w-8 rounded-xl object-contain" onError={e => e.target.style.display='none'} />
            : <div className="w-8 h-8 rounded-xl primary-gradient flex items-center justify-center"><span className="material-symbols-outlined text-white text-base">event_available</span></div>
          }
          <h1 className="font-headline font-extrabold text-base text-on-surface">{user?.business?.name || 'תוריי'}</h1>
        </div>
        <nav className="flex items-center gap-1">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors
                ${isActive(item) ? 'bg-primary/10 text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container'}`}
            >
              <span className="material-symbols-outlined text-base"
                style={isActive(item) ? { fontVariationSettings: "'FILL' 1" } : {}}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-on-surface-variant">שלום, {user?.name}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-on-surface-variant hover:text-error transition-colors px-3 py-1.5 rounded-xl hover:bg-red-50"
          >
            יציאה
          </button>
        </div>
      </header>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 glass-header border-b border-outline-variant/20 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {user?.business?.logo_url
            ? <img src={user.business.logo_url} alt={user.business.name} className="h-7 w-7 rounded-lg object-contain" onError={e => e.target.style.display='none'} />
            : <div className="w-7 h-7 rounded-lg primary-gradient flex items-center justify-center"><span className="material-symbols-outlined text-white text-sm">event_available</span></div>
          }
          <h1 className="font-headline font-bold text-on-surface">{user?.business?.name || 'תוריי'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-on-surface-variant">{user?.name}</span>
          <button onClick={handleLogout} className="text-xs text-on-surface-variant hover:text-error px-2 py-1 rounded-lg hover:bg-red-50">יציאה</button>
        </div>
      </header>

      <EmailVerificationBanner />

      <main className="flex-1 pb-24 md:pb-6 overflow-y-auto pt-16 md:pt-0">
        <div className="max-w-2xl mx-auto px-4 py-4 md:py-4">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface-container-lowest/90 backdrop-blur-lg border-t border-outline-variant/20 rounded-t-3xl shadow-lg">
        <div className="flex py-3 px-2">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 text-xs font-semibold transition-colors rounded-xl
                ${isActive(item) ? 'text-primary' : 'text-on-surface-variant'}`}
            >
              <span className="material-symbols-outlined text-2xl"
                style={isActive(item) ? { fontVariationSettings: "'FILL' 1" } : {}}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
