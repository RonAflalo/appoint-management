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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">מאמת את האימייל...</p>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">האימייל אומת בהצלחה!</h2>
              <p className="text-gray-500 text-sm mb-6">החשבון שלך אומת. כעת תוכל ליהנות מכל הפיצ'רים.</p>
              <Link to="/customer" className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 transition-colors">
                המשך לאפליקציה
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="text-5xl mb-4">❌</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">אימות נכשל</h2>
              <p className="text-gray-500 text-sm mb-6">{message}</p>
              <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium text-sm">
                חזרה להתחברות
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
