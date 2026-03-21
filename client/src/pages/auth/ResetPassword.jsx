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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6" dir="rtl">
      {/* Decorative blobs */}
      <div className="fixed -top-20 -right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed -bottom-20 -left-20 w-96 h-96 bg-secondary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="w-full max-w-[440px] flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl primary-gradient flex items-center justify-center shadow-lg shadow-primary/20 rotate-3">
            <span className="material-symbols-outlined text-white text-3xl">lock_reset</span>
          </div>
          <div>
            <h1 className="font-headline font-extrabold text-4xl tracking-tight text-on-surface">איפוס סיסמה</h1>
            <p className="text-on-surface-variant mt-2">הגדר סיסמה חדשה לחשבונך</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_32px_48px_-4px_rgba(25,28,30,0.08)] p-8 flex flex-col gap-6">
          {done ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <span className="material-symbols-outlined text-primary text-5xl">check_circle</span>
              <div>
                <h2 className="text-lg font-headline font-bold text-on-surface mb-2">הסיסמה אופסה בהצלחה!</h2>
                <p className="text-on-surface-variant text-sm">מועבר לדף הכניסה...</p>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-error-container border border-red-200 rounded-xl text-error text-sm font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* New Password */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-on-surface-variant pr-1">סיסמה חדשה</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="לפחות 6 תווים"
                      className="w-full px-5 py-3.5 pl-11 bg-surface-container-low border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim text-on-surface placeholder:text-outline/50 transition-all"
                    />
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline/40 text-xl">lock</span>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-on-surface-variant pr-1">אימות סיסמה</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="הזן שוב את הסיסמה"
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
                    <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> מאפס...</>
                  ) : 'אפס סיסמה'}
                </button>
              </form>

              <p className="text-center text-sm text-on-surface-variant">
                <Link to="/login" className="text-primary font-bold hover:underline">חזרה להתחברות</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
