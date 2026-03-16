import { useState, useEffect } from 'react';
import { getAppointments, updateAppointmentStatus, getWorkers } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDateTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';

const STATUS_OPTIONS = [
  { value: '', label: 'כל הסטטוסים' },
  { value: 'pending', label: 'ממתין' },
  { value: 'confirmed', label: 'מאושר' },
  { value: 'completed', label: 'הושלם' },
  { value: 'cancelled', label: 'בוטל' },
];

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ workerId: '', date: '', status: '' });
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
    } catch (e) {
      addToast('שגיאה בטעינת התורים', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);

  const handleStatusChange = async (id, status) => {
    try {
      await updateAppointmentStatus(id, status);
      addToast('הסטטוס עודכן');
      load();
    } catch (e) {
      addToast('שגיאה בעדכון סטטוס', 'error');
    }
  };

  const clearFilters = () => {
    setFilters({ workerId: '', date: '', status: '' });
  };

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
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm hover:bg-gray-100 rounded-lg transition-colors"
            >
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
            <table className="w-full text-sm min-w-[700px]">
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
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={appt.status}
                        onChange={e => handleStatusChange(appt.id, e.target.value)}
                        className="text-xs px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="pending">ממתין</option>
                        <option value="confirmed">מאושר</option>
                        <option value="completed">הושלם</option>
                        <option value="cancelled">בוטל</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
