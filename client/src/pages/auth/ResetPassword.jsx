import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { resetPassword } from '../../api/auth';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('הסיסמה חייבת להכיל לפחות 6 תווים'); return; }
    if (password !== confirm) { setError('הסיסמאות אינן תואמות'); return; }
    setLoading(true);
    setError('');
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה באיפוס הסיסמה');
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
          <p className="text-gray-500 mt-2">איפוס סיסמה</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {done ? (
            <div className="text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">הסיסמה אופסה בהצלחה!</h2>
              <p className="text-gray-500 text-sm">מועבר לדף הכניסה...</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">סיסמה חדשה</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="לפחות 6 תווים"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">אימות סיסמה</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="הזן שוב את הסיסמה"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>מאפס...</>
                  ) : 'אפס סיסמה'}
                </button>
              </form>
              <div className="mt-5 text-center text-sm">
                <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">חזרה להתחברות</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
