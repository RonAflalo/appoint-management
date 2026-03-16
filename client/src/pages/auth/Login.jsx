import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

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
      if (data.user.role === 'admin') navigate('/admin');
      else if (data.user.role === 'worker') navigate('/worker');
      else navigate('/customer');
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role) => {
    if (role === 'admin') {
      setEmail('admin@demo.com');
      setPassword('admin123');
    } else {
      setEmail('worker@demo.com');
      setPassword('worker123');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">✂️</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">מנהל תורים</h1>
          <p className="text-gray-500 mt-2">כניסה לחשבון שלך</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

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

          <div className="mt-6 text-center text-sm text-gray-500">
            אין לך חשבון?{' '}
            <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-medium">
              הירשם כאן
            </Link>
          </div>
        </div>

        {/* Demo credentials */}
        <div className="mt-6 bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">פרטי כניסה לדמו</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-gray-700">מנהל: </span>
                <span className="text-gray-500 font-mono text-xs">admin@demo.com / admin123</span>
              </div>
              <button
                onClick={() => fillDemo('admin')}
                className="text-xs text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
              >
                מלא
              </button>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-gray-700">עובד: </span>
                <span className="text-gray-500 font-mono text-xs">worker@demo.com / worker123</span>
              </div>
              <button
                onClick={() => fillDemo('worker')}
                className="text-xs text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50"
              >
                מלא
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
