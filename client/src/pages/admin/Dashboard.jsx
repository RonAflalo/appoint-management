import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAppointments, getWorkers, getSettings } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDateTime, toDateString } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState(null);
  const [copied, setCopied] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      getAppointments({}),
      getWorkers(),
      getSettings(),
    ]).then(([apptData, workersData, settingsData]) => {
      setAppointments(apptData.appointments || []);
      setWorkers(workersData.workers || []);
      if (settingsData.business?.slug) {
        setSlug(settingsData.business.slug);
      }
      if (settingsData.business?.onboarding_complete === 0) {
        navigate('/admin/onboarding', { replace: true });
      }
    }).finally(() => setLoading(false));
  }, []);

  const bookingLink = slug ? `${window.location.origin}/book/${slug}` : null;

  const handleCopy = () => {
    if (!bookingLink) return;
    navigator.clipboard.writeText(bookingLink).then(() => {
      setCopied(true);
      addToast('הקישור הועתק!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const today = toDateString(new Date());
  const todayAppointments = appointments.filter(a => a.start_time.startsWith(today));
  const pendingAppointments = appointments.filter(a => a.status === 'pending');
  const customers = [...new Set(appointments.map(a => a.customer_id))];
  const recentAppointments = appointments.slice(0, 10);

  const activeWorkers = workers.filter(w => w.is_active);

  const stats = [
    { label: 'תורים היום', value: todayAppointments.length, color: 'bg-blue-500', icon: '📅' },
    { label: 'ממתינים לאישור', value: pendingAppointments.length, color: 'bg-yellow-500', icon: '⏳' },
    { label: 'עובדים פעילים', value: activeWorkers.length, color: 'bg-green-500', icon: '👥' },
    { label: 'לקוחות סה"כ', value: customers.length, color: 'bg-purple-500', icon: '👤' },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">דשבורד</h1>
        <p className="text-gray-500 text-sm mt-1">סקירה כללית של העסק</p>
      </div>

      {activeWorkers.filter(w => w.is_worker || w.role === 'worker').length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <span className="text-amber-500 text-xl flex-shrink-0">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800 text-sm">לא הוגדרו עובדים</p>
            <p className="text-amber-700 text-sm mt-0.5">
              כדי שלקוחות יוכלו לקבוע תורים, יש להוסיף לפחות עובד אחד פעיל.{' '}
              <a href="/admin/workers" className="font-bold underline hover:no-underline">הוסף עובד עכשיו</a>
            </p>
          </div>
        </div>
      )}

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

      {/* Booking link card */}
      {bookingLink && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-lg">🔗</div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">הקישור שלך להזמנות</h3>
              <p className="text-xs text-gray-500">שתף קישור זה עם הלקוחות שלך</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
            <span className="text-indigo-600 font-mono truncate flex-1">{bookingLink}</span>
            <button
              onClick={handleCopy}
              className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                copied ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
              }`}
            >
              {copied ? '✓ הועתק' : 'העתק קישור'}
            </button>
            <a
              href={bookingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              פתח
            </a>
          </div>
        </div>
      )}

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
