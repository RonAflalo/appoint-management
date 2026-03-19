import { useState, useEffect } from 'react';
import { getAppointments, updateAppointmentStatus, getWorkers, requestAdminReschedule } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { formatDateTime, toDateString } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';

const STATUS_LABELS = { pending: 'ממתין', confirmed: 'מאושר', completed: 'הושלם', cancelled: 'בוטל', reschedule_requested: 'שינוי מועד' };

function exportCSV(appointments) {
  const headers = ['לקוח', 'אימייל', 'טלפון', 'שירות', 'עובד', 'תאריך ושעה', 'מחיר', 'סטטוס', 'הערות'];
  const rows = appointments.map(a => [
    a.customer_name, a.customer_email, a.customer_phone || '',
    a.service_name, a.worker_name, formatDateTime(a.start_time),
    a.price, STATUS_LABELS[a.status] || a.status, a.notes || '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const bom = '\uFEFF'; // UTF-8 BOM for Excel Hebrew support
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `תורים_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportPDF(appointments) {
  const date = new Date().toLocaleDateString('he-IL');
  const rows = appointments.map(a => `
    <tr>
      <td>${a.customer_name}<br/><small>${a.customer_email}</small>${a.customer_phone ? `<br/><small>${a.customer_phone}</small>` : ''}</td>
      <td>${a.service_name}</td>
      <td>${a.worker_name}</td>
      <td>${formatDateTime(a.start_time)}</td>
      <td>₪${a.price}</td>
      <td>${STATUS_LABELS[a.status] || a.status}</td>
      <td>${a.notes || ''}</td>
    </tr>
  `).join('');

  const html = `
    <html dir="rtl">
    <head>
      <meta charset="UTF-8"/>
      <style>
        body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
        h2 { color: #4f46e5; margin-bottom: 4px; }
        p { color: #666; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #4f46e5; color: white; padding: 8px; text-align: right; }
        td { padding: 7px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
        tr:nth-child(even) td { background: #f5f5ff; }
        small { color: #888; font-size: 10px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h2>דוח תורים</h2>
      <p>תאריך הפקה: ${date} | סה"כ תורים: ${appointments.length}</p>
      <table>
        <thead><tr>
          <th>לקוח</th><th>שירות</th><th>עובד</th>
          <th>תאריך ושעה</th><th>מחיר</th><th>סטטוס</th><th>הערות</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

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

  // Detail modal
  const [detailAppt, setDetailAppt] = useState(null);

  // Reschedule modal
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
      // Update detail modal if open
      setDetailAppt(prev => prev?.id === id ? { ...prev, status } : prev);
      load();
    } catch {
      addToast('שגיאה בעדכון סטטוס', 'error');
    }
  };

  const openReschedule = (appt, e) => {
    e?.stopPropagation();
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

  const ActionButtons = ({ appt, stopProp = false }) => {
    const wrap = (fn) => (e) => { if (stopProp) e.stopPropagation(); fn(); };
    return (
      <div className="flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
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
              onClick={(e) => openReschedule(appt, e)}
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
    );
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">תורים</h1>
          <p className="text-gray-500 text-sm mt-1">ניהול כל התורים</p>
        </div>
        {appointments.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => exportCSV(appointments)}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              ⬇ CSV
            </button>
            <button
              onClick={() => exportPDF(appointments)}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              ⬇ PDF
            </button>
          </div>
        )}
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
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-right font-medium text-gray-600">לקוח</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">תאריך ושעה</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {appointments.map(appt => (
                <tr
                  key={appt.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setDetailAppt(appt)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{appt.customer_name}</span>
                      <StatusBadge status={appt.status} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-sm">
                    {formatDateTime(appt.start_time)}
                  </td>
                  <td className="px-4 py-3">
                    <ActionButtons appt={appt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={!!detailAppt}
        onClose={() => setDetailAppt(null)}
        title="פרטי תור"
      >
        {detailAppt && (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <StatusBadge status={detailAppt.status} />
              {detailAppt.status === 'reschedule_requested' && detailAppt.suggested_time && (
                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                  מוצע: {formatDateTime(detailAppt.suggested_time)}
                </span>
              )}
            </div>

            {/* Customer */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
              <p className="text-xs text-gray-400 font-medium uppercase">לקוח</p>
              <p className="font-semibold text-gray-900">{detailAppt.customer_name}</p>
              <p className="text-sm text-gray-500" dir="ltr">{detailAppt.customer_email}</p>
              {detailAppt.customer_phone && (
                <p className="text-sm text-gray-500" dir="ltr">{detailAppt.customer_phone}</p>
              )}
            </div>

            {/* Appointment details */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
              <p className="text-xs text-gray-400 font-medium uppercase">פרטי התור</p>
              <div className="grid grid-cols-2 gap-y-2.5 text-sm">
                <div>
                  <p className="text-xs text-gray-400">שירות</p>
                  <p className="text-gray-900 font-medium">{detailAppt.service_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">מחיר</p>
                  <p className="text-gray-900 font-medium">₪{detailAppt.price}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">משך</p>
                  <p className="text-gray-900 font-medium">{detailAppt.duration_minutes} דק'</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">עובד</p>
                  <p className="text-gray-900 font-medium">{detailAppt.worker_name}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">תאריך ושעה</p>
                  <p className="text-gray-900 font-medium">{formatDateTime(detailAppt.start_time)}</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {detailAppt.notes && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-sm text-yellow-800">
                <p className="text-xs text-yellow-600 font-medium mb-1">הערת לקוח</p>
                {detailAppt.notes}
              </div>
            )}

            {/* Actions inside modal */}
            <div className="pt-1">
              <ActionButtons appt={detailAppt} />
            </div>
          </div>
        )}
      </Modal>

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
