import { useState } from 'react';

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
  'מנהל': 'bg-purple-100 text-purple-700',
  'עובד':  'bg-blue-100 text-blue-700',
  'לקוח':  'bg-green-100 text-green-700',
};
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { login } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import GoogleSignInButton from '../../components/common/GoogleSignInButton';

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
    if (!email || !password) {
      setError('יש למלא אימייל וסיסמה');
      return;
    }
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">📅</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">תוריי</h1>
          <p className="text-gray-500 mt-2">כניסה לחשבון שלך</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {(error || oauthError) && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error || oauthError}
            </div>
          )}

          {/* Google sign in */}
          <GoogleSignInButton href={googleHref} />

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">או עם אימייל וסיסמה</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                כתובת אימייל
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                סיסמה
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="הזן סיסמה"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  מתחבר...
                </>
              ) : 'כניסה'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/forgot-password" className="text-sm text-indigo-500 hover:text-indigo-700">
              שכחתי סיסמה
            </Link>
          </div>

          <div className="mt-4 text-center text-sm text-gray-500">
            אין לך חשבון?{' '}
            <Link
              to={redirect?.startsWith('/book/') ? `/register?slug=${redirect.split('/book/')[1]}` : '/register'}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              הירשם כאן
            </Link>
          </div>
        </div>

      </div>

      {/* QA quick-login panel — mobile only */}
      <div className="lg:hidden mt-4 w-full max-w-md">
        <button
          onClick={() => setQaOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-white/70 hover:bg-white border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <span>משתמשי בדיקה (QA)</span>
          <span>{qaOpen ? '▲' : '▼'}</span>
        </button>

        {qaOpen && (
          <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-400">
              סיסמה לכולם: <span className="font-mono font-bold text-gray-600">demo1234</span> — לחץ על משתמש למילוי אוטומטי
            </div>
            {['סלון ענת', 'ברבר דני'].map(biz => (
              <div key={biz}>
                <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">{biz}</div>
                {QA_USERS.filter(u => u.business === biz).map(u => (
                  <button
                    key={u.email}
                    onClick={() => { setEmail(u.email); setPassword('demo1234'); setQaOpen(false); }}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_STYLE[u.role]}`}>{u.role}</span>
                      <span className="text-sm text-gray-800 font-medium">{u.name}</span>
                    </div>
                    <span className="text-xs text-gray-400 font-mono">{u.email}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
