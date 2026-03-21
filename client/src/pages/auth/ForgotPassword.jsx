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
            <h1 className="font-headline font-extrabold text-4xl tracking-tight text-on-surface">שחזור סיסמה</h1>
            <p className="text-on-surface-variant mt-2">נשלח לך קישור לאיפוס הסיסמה</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_32px_48px_-4px_rgba(25,28,30,0.08)] p-8 flex flex-col gap-6">
          {sent ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <span className="material-symbols-outlined text-primary text-5xl">mail</span>
              <div>
                <h2 className="text-lg font-headline font-bold text-on-surface mb-2">הבקשה נשלחה!</h2>
                <p className="text-on-surface-variant text-sm">
                  אם האימייל קיים במערכת, נשלח אליו קישור לאיפוס הסיסמה. בדוק את תיבת הדואר שלך.
                </p>
              </div>
              <Link to="/login" className="text-primary font-bold text-sm hover:underline mt-2">
                חזרה להתחברות
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-error-container border border-red-200 rounded-xl text-error text-sm font-medium">
                  {error}
                </div>
              )}

              <p className="text-on-surface-variant text-sm">הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה.</p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-on-surface-variant pr-1">כתובת אימייל</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      dir="ltr"
                      className="w-full px-5 py-3.5 pl-11 bg-surface-container-low border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim text-on-surface placeholder:text-outline/50 transition-all"
                    />
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline/40 text-xl">mail</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 primary-gradient text-white font-headline font-bold text-base rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> שולח...</>
                  ) : 'שלח קישור לאיפוס'}
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
