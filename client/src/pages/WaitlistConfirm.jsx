import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { confirmWaitlistEntry } from '../api/user';

export default function WaitlistConfirm() {
  const { token } = useParams();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');
  const [appointment, setAppointment] = useState(null);

  useEffect(() => {
    confirmWaitlistEntry(token)
      .then((data) => {
        setAppointment(data.appointment);
        setStatus('success');
      })
      .catch((e) => {
        setMessage(e.response?.data?.message || 'אירעה שגיאה');
        setStatus('error');
      });
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto mb-4" />
          <p className="text-on-surface-variant">מאשר את התור...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_32px_48px_-4px_rgba(25,28,30,0.08)] p-8 max-w-sm w-full text-center">
          <span className="material-symbols-outlined text-5xl text-amber-500 mb-4 block">timer_off</span>
          <h1 className="text-xl font-headline font-bold text-on-surface mb-2">הלינק אינו תקף</h1>
          <p className="text-on-surface-variant text-sm mb-6">{message}</p>
          <Link
            to="/customer"
            className="inline-block w-full py-3 primary-gradient text-white rounded-xl text-sm font-bold transition-opacity"
          >
            לאזור האישי
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-surface-container-lowest rounded-2xl shadow-[0_32px_48px_-4px_rgba(25,28,30,0.08)] p-8 max-w-sm w-full text-center">
        <span className="material-symbols-outlined text-5xl text-emerald-500 mb-4 block">check_circle</span>
        <h1 className="text-xl font-headline font-bold text-on-surface mb-2">התור אושר!</h1>
        {appointment && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-6 text-right">
            <p className="text-sm font-semibold text-on-surface mb-1">{appointment.service_name}</p>
            {appointment.worker_name && (
              <p className="text-sm text-on-surface-variant">עם {appointment.worker_name}</p>
            )}
            <p className="text-sm text-primary font-medium mt-1">
              {new Date(appointment.start_time).toLocaleString('he-IL', {
                weekday: 'long', day: 'numeric', month: 'long',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        )}
        <p className="text-on-surface-variant text-sm mb-6">התור נקבע בהצלחה. נשלח לך אישור במייל.</p>
        <Link
          to="/customer/appointments"
          className="inline-block w-full py-3 primary-gradient text-white rounded-xl text-sm font-bold transition-opacity"
        >
          לתורים שלי
        </Link>
      </div>
    </div>
  );
}
