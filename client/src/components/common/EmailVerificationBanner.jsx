import { useState } from 'react';
import { resendVerification } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';

export default function EmailVerificationBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.email_verified || dismissed) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      await resendVerification();
      setSent(true);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 text-yellow-800 min-w-0">
        <span className="flex-shrink-0">⚠️</span>
        <span className="truncate">
          {sent ? 'אימייל אימות נשלח! בדוק את תיבת הדואר שלך.' : 'האימייל שלך טרם אומת. '}
          {!sent && (
            <button
              onClick={handleResend}
              disabled={sending}
              className="underline hover:no-underline font-medium disabled:opacity-50"
            >
              {sending ? 'שולח...' : 'שלח מחדש'}
            </button>
          )}
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-yellow-600 hover:text-yellow-800 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
