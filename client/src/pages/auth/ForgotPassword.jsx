import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../api/auth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { setError('יש להזין אימייל'); return; }
    setLoading(true);
    setError('');
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בשליחת הבקשה');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">📅</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">תוריי</h1>
          <p className="text-gray-500 mt-2">שחזור סיסמה</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {sent ? (
            <div className="text-center">
              <div className="text-5xl mb-4">📬</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">הבקשה נשלחה!</h2>
              <p className="text-gray-500 text-sm mb-6">
                אם האימייל קיים במערכת, נשלח אליו קישור לאיפוס הסיסמה. בדוק את תיבת הדואר שלך.
              </p>
              <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium text-sm">
                חזרה להתחברות
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
              )}
              <p className="text-gray-600 text-sm mb-5">הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">כתובת אימייל</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    dir="ltr"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>שולח...</>
                  ) : 'שלח קישור לאיפוס'}
                </button>
              </form>
              <div className="mt-5 text-center text-sm text-gray-500">
                <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">חזרה להתחברות</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
