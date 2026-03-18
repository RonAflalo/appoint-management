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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">מאשר את התור...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">⏱️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">הלינק אינו תקף</h1>
          <p className="text-gray-500 text-sm mb-6">{message}</p>
          <Link
            to="/customer"
            className="inline-block w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            לאזור האישי
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-md p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">התור אושר!</h1>
        {appointment && (
          <div className="bg-indigo-50 rounded-xl p-4 mb-6 text-right">
            <p className="text-sm font-semibold text-indigo-800 mb-1">{appointment.service_name}</p>
            {appointment.worker_name && (
              <p className="text-sm text-indigo-600">עם {appointment.worker_name}</p>
            )}
            <p className="text-sm text-indigo-600 mt-1">
              {new Date(appointment.start_time).toLocaleString('he-IL', {
                weekday: 'long', day: 'numeric', month: 'long',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        )}
        <p className="text-gray-500 text-sm mb-6">התור נקבע בהצלחה. נשלח לך אישור במייל.</p>
        <Link
          to="/customer/appointments"
          className="inline-block w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          לתורים שלי
        </Link>
      </div>
    </div>
  );
}
