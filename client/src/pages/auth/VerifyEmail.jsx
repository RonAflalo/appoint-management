import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { verifyEmail } from '../../api/auth';

export default function VerifyEmail() {
  const { token } = useParams();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(err => {
        setMessage(err.response?.data?.message || 'קישור לא תקף');
        setStatus('error');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="fixed -top-20 -right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed -bottom-20 -left-20 w-96 h-96 bg-secondary/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="w-full max-w-md">
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_32px_48px_-4px_rgba(25,28,30,0.08)] p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary mx-auto mb-4"></div>
              <p className="text-on-surface-variant">מאמת את האימייל...</p>
            </>
          )}
          {status === 'success' && (
            <>
              <span className="material-symbols-outlined text-5xl text-emerald-500 mb-4 block">mark_email_read</span>
              <h2 className="text-xl font-headline font-bold text-on-surface mb-2">האימייל אומת בהצלחה!</h2>
              <p className="text-on-surface-variant text-sm mb-6">החשבון שלך אומת. כעת תוכל ליהנות מכל הפיצ'רים.</p>
              <Link to="/customer" className="inline-block px-6 py-3 primary-gradient text-white rounded-xl font-bold text-sm transition-opacity">
                המשך לאפליקציה
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <span className="material-symbols-outlined text-5xl text-error mb-4 block">cancel</span>
              <h2 className="text-xl font-headline font-bold text-on-surface mb-2">אימות נכשל</h2>
              <p className="text-on-surface-variant text-sm mb-6">{message}</p>
              <Link to="/login" className="text-primary hover:underline font-bold text-sm">
                חזרה להתחברות
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
