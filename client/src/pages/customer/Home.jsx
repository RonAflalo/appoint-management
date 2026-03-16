import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyAppointments } from '../../api/user';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTime, isFuture } from '../../utils/dateUtils';

export default function CustomerHome() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getMyAppointments()
      .then(data => setAppointments(data.appointments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upcomingAppointments = appointments
    .filter(a => isFuture(a.start_time) && ['pending', 'confirmed'].includes(a.status))
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const nextAppointment = upcomingAppointments[0];
  const recentAppointments = appointments.slice(0, 3);

  return (
    <div>
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 mb-6 text-white">
        <h1 className="text-2xl font-bold mb-1">שלום, {user?.name}! 👋</h1>
        <p className="text-indigo-200 text-sm mb-5">ברוך הבא למנהל התורים שלנו</p>

        {nextAppointment ? (
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 mb-4">
            <p className="text-indigo-100 text-xs mb-1">התור הקרוב שלך</p>
            <p className="font-semibold text-lg">{nextAppointment.service_name}</p>
            <p className="text-indigo-200 text-sm">עם {nextAppointment.worker_name}</p>
            <p className="text-white font-medium mt-1">{formatDateTime(nextAppointment.start_time)}</p>
          </div>
        ) : (
          <div className="bg-white/10 rounded-xl p-4 mb-4">
            <p className="text-indigo-200 text-sm">אין לך תורים קרובים</p>
          </div>
        )}

        <button
          onClick={() => navigate('/customer/book')}
          className="w-full py-3 bg-white text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition-colors text-base shadow-lg"
        >
          📅 קבע תור חדש
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-indigo-600">{upcomingAppointments.length}</div>
          <div className="text-xs text-gray-500 mt-1">תורים קרובים</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">
            {appointments.filter(a => a.status === 'completed').length}
          </div>
          <div className="text-xs text-gray-500 mt-1">ביקורים שהושלמו</div>
        </div>
      </div>

      {/* Recent appointments */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">תורים אחרונים</h2>
          <button
            onClick={() => navigate('/customer/appointments')}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            הכל
          </button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : recentAppointments.length === 0 ? (
          <div className="p-8 text-center">
            <span className="text-4xl mb-3 block">📋</span>
            <p className="text-gray-500 text-sm">עדיין אין תורים</p>
            <button
              onClick={() => navigate('/customer/book')}
              className="mt-3 text-sm text-indigo-600 font-medium hover:text-indigo-700"
            >
              קבע תור ראשון
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentAppointments.map(appt => (
              <div key={appt.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{appt.service_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(appt.start_time)}</div>
                </div>
                <StatusBadge status={appt.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
