import { useState, useEffect } from 'react';
import { getAppointments } from '../../api/admin';
import { getWorkers } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDateTime, toDateString } from '../../utils/dateUtils';

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = toDateString(new Date());
    Promise.all([
      getAppointments({}),
      getWorkers(),
    ]).then(([apptData, workersData]) => {
      setAppointments(apptData.appointments || []);
      setWorkers(workersData.workers || []);
    }).finally(() => setLoading(false));
  }, []);

  const today = toDateString(new Date());
  const todayAppointments = appointments.filter(a => a.start_time.startsWith(today));
  const pendingAppointments = appointments.filter(a => a.status === 'pending');
  const customers = [...new Set(appointments.map(a => a.customer_id))];
  const recentAppointments = appointments.slice(0, 10);

  const stats = [
    { label: 'תורים היום', value: todayAppointments.length, color: 'bg-blue-500', icon: '📅' },
    { label: 'ממתינים לאישור', value: pendingAppointments.length, color: 'bg-yellow-500', icon: '⏳' },
    { label: 'עובדים פעילים', value: workers.filter(w => w.is_active).length, color: 'bg-green-500', icon: '👥' },
    { label: 'לקוחות סה"כ', value: customers.length, color: 'bg-purple-500', icon: '👤' },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">דשבורד</h1>
        <p className="text-gray-500 text-sm mt-1">סקירה כללית של העסק</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center text-white text-lg`}>
                {stat.icon}
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Recent appointments */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">תורים אחרונים</h2>
        </div>
        {recentAppointments.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <span className="text-4xl mb-3 block">📅</span>
            <p>אין תורים להצגה</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <th className="px-4 py-3 text-right font-medium">לקוח</th>
                  <th className="px-4 py-3 text-right font-medium">עובד</th>
                  <th className="px-4 py-3 text-right font-medium">שירות</th>
                  <th className="px-4 py-3 text-right font-medium">תאריך ושעה</th>
                  <th className="px-4 py-3 text-right font-medium">סטטוס</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentAppointments.map(appt => (
                  <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{appt.customer_name}</td>
                    <td className="px-4 py-3 text-gray-600">{appt.worker_name}</td>
                    <td className="px-4 py-3 text-gray-600">{appt.service_name}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDateTime(appt.start_time)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={appt.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
