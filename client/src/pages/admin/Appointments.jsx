import { useState, useEffect } from 'react';
import { getAppointments, updateAppointmentStatus, getWorkers, requestAdminReschedule } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { formatDateTime, toDateString } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';

const STATUS_OPTIONS = [
  { value: '', label: 'כל הסטטוסים' },
  { value: 'pending', label: 'ממתין' },
  { value: 'confirmed', label: 'מאושר' },
  { value: 'reschedule_requested', label: 'שינוי מועד' },
  { value: 'completed', label: 'הושלם' },
  { value: 'cancelled', label: 'בוטל' },
];

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ workerId: '', date: '', status: '' });
  const [rescheduleAppt, setRescheduleAppt] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleNote, setRescheduleNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.workerId) params.workerId = filters.workerId;
      if (filters.date) params.date = filters.date;
      if (filters.status) params.status = filters.status;
      const [apptData, workersData] = await Promise.all([getAppointments(params), getWorkers()]);
      setAppointments(apptData.appointments || []);
      setWorkers(workersData.workers || []);
    } catch {
      addToast('שגיאה בטעינת התורים', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);

  const handleStatus = async (id, status) => {
    try {
      await updateAppointmentStatus(id, status);
      addToast(status === 'confirmed' ? 'התור אושר' : status === 'cancelled' ? 'התור בוטל' : 'הסטטוס עודכן');
      load();
    } catch {
      addToast('שגיאה בעדכון סטטוס', 'error');
    }
  };

  const openReschedule = (appt) => {
    setRescheduleAppt(appt);
    setRescheduleDate(toDateString(new Date()));
    setRescheduleTime('');
    setRescheduleNote('');
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleDate || !rescheduleTime) {
      addToast('יש לבחור תאריך ושעה', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await requestAdminReschedule(rescheduleAppt.id, {
        suggested_time: `${rescheduleDate}T${rescheduleTime}:00`,
        note: rescheduleNote || undefined,
      });
      addToast('בקשת שינוי המועד נשלחה ללקוח');
      setRescheduleAppt(null);
      load();
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה בשליחת הבקשה', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const clearFilters = () => setFilters({ workerId: '', date: '', status: '' });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">תורים</h1>
        <p className="text-gray-500 text-sm mt-1">ניהול כל התורים</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <select
            value={filters.workerId}
            onChange={e => setFilters(p => ({ ...p, workerId: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">כל העובדים</option>
            {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>

          <input
            type="date"
            value={filters.date}
            onChange={e => setFilters(p => ({ ...p, date: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <select
            value={filters.status}
            onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>

          {(filters.workerId || filters.date || filters.status) && (
            <button onClick={clearFilters} className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm hover:bg-gray-100 rounded-lg transition-colors">
              נקה פילטרים ✕
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">{appointments.length} תורים מוצגים</p>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner />
      ) : appointments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <span className="text-5xl mb-4 block">📅</span>
          <h3 className="text-lg font-medium text-gray-900 mb-2">אין תורים</h3>
          <p className="text-gray-500 text-sm">לא נמצאו תורים התואמים לפילטרים</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[750px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-right font-medium text-gray-600">לקוח</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">עובד</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">שירות</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">תאריך ושעה</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">סטטוס</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {appointments.map(appt => (
                  <tr key={appt.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{appt.customer_name}</div>
                      <div className="text-xs text-gray-400">{appt.customer_email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{appt.worker_name}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{appt.service_name}</div>
                      <div className="text-xs text-gray-400">₪{appt.price} | {appt.duration_minutes} דק'</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateTime(appt.start_time)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={appt.status} />
                      {appt.status === 'reschedule_requested' && appt.suggested_time && (
                        <div className="text-xs text-orange-600 mt-1">מוצע: {formatDateTime(appt.suggested_time)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {appt.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleStatus(appt.id, 'confirmed')}
                              className="px-2.5 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-xs font-medium transition-colors"
                            >
                              אשר
                            </button>
                            <button
                              onClick={() => handleStatus(appt.id, 'cancelled')}
                              className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium transition-colors"
                            >
                              בטל
                            </button>
                          </>
                        )}
                        {appt.status === 'confirmed' && (
                          <>
                            <button
                              onClick={() => handleStatus(appt.id, 'completed')}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                            >
                              הושלם
                            </button>
                            <button
                              onClick={() => openReschedule(appt)}
                              className="px-2.5 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-xs font-medium transition-colors"
                            >
                              שנה מועד
                            </button>
                            <button
                              onClick={() => handleStatus(appt.id, 'cancelled')}
                              className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium transition-colors"
                            >
                              בטל
                            </button>
                          </>
                        )}
                        {appt.status === 'reschedule_requested' && (
                          <button
                            onClick={() => handleStatus(appt.id, 'cancelled')}
                            className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium transition-colors"
                          >
                            בטל
                          </button>
                        )}
                        {(appt.status === 'completed' || appt.status === 'cancelled') && (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      <Modal
        isOpen={!!rescheduleAppt}
        onClose={() => setRescheduleAppt(null)}
        title="בקשת שינוי מועד"
      >
        {rescheduleAppt && (
          <form onSubmit={handleReschedule} className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              <div>{rescheduleAppt.customer_name} — {rescheduleAppt.service_name}</div>
              <div className="text-xs text-gray-400 mt-0.5">מועד נוכחי: {formatDateTime(rescheduleAppt.start_time)}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תאריך חדש מוצע</label>
              <input
                type="date"
                value={rescheduleDate}
                min={toDateString(new Date())}
                onChange={e => setRescheduleDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">שעה חדשה מוצעת</label>
              <input
                type="time"
                value={rescheduleTime}
                onChange={e => setRescheduleTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">הערה ללקוח (אופציונלי)</label>
              <textarea
                value={rescheduleNote}
                onChange={e => setRescheduleNote(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="סיבה לשינוי..."
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? 'שולח...' : 'שלח בקשה ללקוח'}
              </button>
              <button
                type="button"
                onClick={() => setRescheduleAppt(null)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                ביטול
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
