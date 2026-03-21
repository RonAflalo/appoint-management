import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import GoogleSignInButton from '../../components/common/GoogleSignInButton';

const QA_USERS = [
  { business: 'סלון ענת', name: 'ענת כהן',    role: 'מנהל',   email: 'anat@demo.com' },
  { business: 'סלון ענת', name: 'משה לוי',    role: 'עובד',   email: 'moshe@demo.com' },
  { business: 'סלון ענת', name: 'יעל ברק',    role: 'עובד',   email: 'yael@demo.com' },
  { business: 'סלון ענת', name: 'דנה אברהם',  role: 'לקוח',   email: 'dana@demo.com' },
  { business: 'סלון ענת', name: 'רון שמש',    role: 'לקוח',   email: 'ron@demo.com' },
  { business: 'סלון ענת', name: 'נועה גבאי',  role: 'לקוח',   email: 'noa@demo.com' },
  { business: 'סלון ענת', name: 'אלי כץ',     role: 'לקוח',   email: 'eli@demo.com' },
  { business: 'סלון ענת', name: 'מיכל דוד',   role: 'לקוח',   email: 'michal@demo.com' },
  { business: 'ברבר דני', name: 'דני מזרחי',  role: 'מנהל',   email: 'danny@demo.com' },
  { business: 'ברבר דני', name: 'קובי שלום',  role: 'עובד',   email: 'kobi@demo.com' },
  { business: 'ברבר דני', name: 'אורי פרץ',   role: 'עובד',   email: 'uri@demo.com' },
  { business: 'ברבר דני', name: 'יוסי בן דוד',role: 'לקוח',   email: 'yossi@demo.com' },
  { business: 'ברבר דני', name: 'ג׳קי חיון',  role: 'לקוח',   email: 'jacky@demo.com' },
  { business: 'ברבר דני', name: 'אבי גולן',   role: 'לקוח',   email: 'avi@demo.com' },
];

const ROLE_STYLE = {
  'מנהל': 'bg-primary/10 text-primary',
  'עובד':  'bg-secondary/10 text-secondary',
  'לקוח':  'bg-emerald-100 text-emerald-700',
};

const OAUTH_ERRORS = {
  google_cancelled: 'הכניסה עם Google בוטלה',
  google_failed: 'שגיאה בכניסה עם Google, נסה שנית',
  google_no_email: 'לא ניתן לקבל אימייל מ-Google',
  invalid_state: 'שגיאת אבטחה, נסה שנית',
  account_disabled: 'החשבון אינו פעיל',
  no_business: 'יש להירשם דרך הקישור של העסק',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [qaOpen, setQaOpen] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');
  const oauthError = OAUTH_ERRORS[searchParams.get('error')] || null;

  const googleHref = `/api/auth/google${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('יש למלא אימייל וסיסמה'); return; }
    setLoading(true);
    try {
      const data = await login({ email, password });
      setUser(data.user);
      addToast('התחברת בהצלחה!');
      if (redirect) navigate(redirect);
      else if (data.user.role === 'admin') navigate('/admin');
      else if (data.user.role === 'worker') navigate('/worker');
      else navigate('/customer');
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6" dir="rtl">
      {/* Decorative blobs */}
      <div className="fixed -top-20 -right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed -bottom-20 -left-20 w-96 h-96 bg-secondary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="w-full max-w-[440px] flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl primary-gradient flex items-center justify-center shadow-lg shadow-primary/20 rotate-3">
            <span className="material-symbols-outlined text-white text-3xl">event_available</span>
          </div>
          <div>
            <h1 className="font-headline font-extrabold text-4xl tracking-tight text-on-surface">ברוכים השבים</h1>
            <p className="text-on-surface-variant mt-2">שמחים לראות אתכם, אנא התחברו לחשבונכם</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_32px_48px_-4px_rgba(25,28,30,0.08)] p-8 flex flex-col gap-6">
          {(error || oauthError) && (
            <div className="p-3 bg-error-container border border-red-200 rounded-xl text-error text-sm font-medium">
              {error || oauthError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-on-surface-variant pr-1">אימייל</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  dir="ltr"
                  className="w-full px-5 py-3.5 pl-11 bg-surface-container-low border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim text-on-surface placeholder:text-outline/50 transition-all"
                />
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline/40 text-xl">mail</span>
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center pr-1">
                <label className="text-sm font-semibold text-on-surface-variant">סיסמה</label>
                <Link to="/forgot-password" className="text-primary text-xs font-bold hover:underline">שכחת סיסמה?</Link>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-5 py-3.5 pl-11 bg-surface-container-low border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim text-on-surface placeholder:text-outline/50 transition-all"
                />
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline/40 text-xl">lock</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 primary-gradient text-white font-headline font-bold text-base rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> מתחבר...</>
              ) : 'התחברות למערכת'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-surface-container-high" />
            <span className="mx-4 text-outline text-xs font-semibold uppercase tracking-widest">או</span>
            <div className="flex-grow border-t border-surface-container-high" />
          </div>

          <GoogleSignInButton href={googleHref} />

          <p className="text-center text-sm text-on-surface-variant">
            עדיין אין לך חשבון?{' '}
            <Link
              to={redirect?.startsWith('/book/') ? `/register?slug=${redirect.split('/book/')[1]}` : '/register'}
              className="text-primary font-bold hover:underline mr-1"
            >
              הרשמה עכשיו
            </Link>
          </p>
        </div>

        {/* QA Panel - mobile only */}
        <div className="lg:hidden w-full">
          <button
            onClick={() => setQaOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-surface-container-lowest/80 hover:bg-surface-container-lowest border border-dashed border-outline-variant rounded-xl text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span>משתמשי בדיקה (QA)</span>
            <span className="material-symbols-outlined text-base">{qaOpen ? 'expand_less' : 'expand_more'}</span>
          </button>

          {qaOpen && (
            <div className="mt-2 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-lg overflow-hidden">
              <div className="px-4 py-2 bg-surface-container-low border-b border-outline-variant/20 text-xs text-on-surface-variant">
                סיסמה: <span className="font-mono font-bold text-on-surface">demo1234</span> — לחץ למילוי אוטומטי
              </div>
              {['סלון ענת', 'ברבר דני'].map(biz => (
                <div key={biz}>
                  <div className="px-4 py-1.5 bg-surface-container border-b border-outline-variant/10 text-xs font-semibold text-on-surface-variant">{biz}</div>
                  {QA_USERS.filter(u => u.business === biz).map(u => (
                    <button
                      key={u.email}
                      onClick={() => { setEmail(u.email); setPassword('demo1234'); setQaOpen(false); }}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-container-low transition-colors border-b border-outline-variant/10 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROLE_STYLE[u.role]}`}>{u.role}</span>
                        <span className="text-sm text-on-surface font-medium">{u.name}</span>
                      </div>
                      <span className="text-xs text-on-surface-variant font-mono">{u.email}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
