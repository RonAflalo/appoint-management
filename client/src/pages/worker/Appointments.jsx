import { useState, useEffect } from 'react';
import {
  getWorkerAppointments,
  updateWorkerAppointmentStatus,
  approveAppointment,
  cancelAppointmentByWorker,
  requestReschedule,
} from '../../api/worker';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { formatDateTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';

const TABS = [
  { value: '', label: 'הכל' },
  { value: 'pending', label: 'ממתין' },
  { value: 'confirmed', label: 'מאושר' },
  { value: 'reschedule_requested', label: 'שינוי מועד' },
  { value: 'completed', label: 'הושלם' },
  { value: 'cancelled', label: 'בוטל' },
];

export default function WorkerAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [busy, setBusy] = useState(null);

  // Detail modal
  const [detailAppt, setDetailAppt] = useState(null);

  // Reschedule modal
  const [rescheduleModal, setRescheduleModal] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState(null);
  const [suggestedDate, setSuggestedDate] = useState('');
  const [suggestedTime, setSuggestedTime] = useState('');
  const [rescheduleNote, setRescheduleNote] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  const { addToast } = useToast();

  const load = (status) => {
    setLoading(true);
    const params = {};
    if (status) params.status = status;
    getWorkerAppointments(params)
      .then(data => setAppointments(data.appointments || []))
      .catch(() => addToast('שגיאה בטעינת התורים', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(activeTab); }, [activeTab]);

  const withBusy = async (id, fn, successMsg) => {
    setBusy(id);
    try {
      await fn();
      addToast(successMsg);
      // Close detail modal if it was for this appointment
      setDetailAppt(prev => prev?.id === id ? null : prev);
      load(activeTab);
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleApprove = (id) =>
    withBusy(id, () => approveAppointment(id), 'התור אושר — הלקוח קיבל אימייל ✅');

  const handleCancel = (id) => {
    if (!confirm('האם לבטל את התור? הלקוח יקבל אימייל.')) return;
    withBusy(id, () => cancelAppointmentByWorker(id), 'התור בוטל — הלקוח קיבל אימייל');
  };

  const handleComplete = (id) =>
    withBusy(id, () => updateWorkerAppointmentStatus(id, 'completed'), 'התור סומן כהושלם');

  const openRescheduleModal = (appt, e) => {
    e?.stopPropagation();
    setRescheduleAppt(appt);
    setSuggestedDate('');
    setSuggestedTime('');
    setRescheduleNote('');
    setRescheduleModal(true);
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!suggestedDate || !suggestedTime) {
      addToast('יש לבחור תאריך ושעה מוצעים', 'error');
      return;
    }
    const suggestedISO = `${suggestedDate}T${suggestedTime}:00`;
    setSubmittingReschedule(true);
    try {
      await requestReschedule(rescheduleAppt.id, {
        suggested_time: suggestedISO,
        note: rescheduleNote || undefined,
      });
      addToast('בקשת שינוי המועד נשלחה ללקוח 📧');
      setRescheduleModal(false);
      load(activeTab);
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה בשליחת הבקשה', 'error');
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const ActionButtons = ({ appt }) => (
    <div className="flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
      {appt.status === 'pending' && (
        <>
          <button
            onClick={() => handleApprove(appt.id)}
            disabled={busy === appt.id}
            className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            {busy === appt.id ? '...' : 'אשר'}
          </button>
          <button
            onClick={() => handleCancel(appt.id)}
            disabled={busy === appt.id}
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            בטל
          </button>
        </>
      )}
      {appt.status === 'confirmed' && (
        <>
          <button
            onClick={() => handleComplete(appt.id)}
            disabled={busy === appt.id}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            הושלם
          </button>
          <button
            onClick={(e) => openRescheduleModal(appt, e)}
            disabled={busy === appt.id}
            className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            שנה מועד
          </button>
          <button
            onClick={() => handleCancel(appt.id)}
            disabled={busy === appt.id}
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            בטל
          </button>
        </>
      )}
      {appt.status === 'reschedule_requested' && (
        <button
          onClick={() => handleCancel(appt.id)}
          disabled={busy === appt.id}
          className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          בטל תור
        </button>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">התורים שלי</h1>
        <p className="text-gray-500 text-sm mt-1">ניהול התורים שלך</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${activeTab === tab.value
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : appointments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <span className="text-5xl mb-4 block">📋</span>
          <h3 className="text-lg font-medium text-gray-900 mb-2">אין תורים</h3>
          <p className="text-gray-500 text-sm">לא נמצאו תורים בקטגוריה זו</p>
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
            <tbody className="divide-y divide-gray-100">
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
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">תאריך ושעה</p>
                  <p className="text-gray-900 font-medium">{formatDateTime(detailAppt.start_time)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">משך</p>
                  <p className="text-gray-900 font-medium">{detailAppt.duration_minutes} דק'</p>
                </div>
              </div>
            </div>

            {/* Reschedule info */}
            {detailAppt.status === 'reschedule_requested' && detailAppt.suggested_time && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm">
                <p className="font-medium text-orange-800 mb-1">⏰ בקשת שינוי מועד נשלחה ללקוח</p>
                <p className="text-orange-700">זמן מוצע: {formatDateTime(detailAppt.suggested_time)}</p>
                {detailAppt.reschedule_note && (
                  <p className="text-orange-600 text-xs mt-1">הערה: {detailAppt.reschedule_note}</p>
                )}
              </div>
            )}

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

      {/* Reschedule Request Modal */}
      <Modal
        isOpen={rescheduleModal}
        onClose={() => setRescheduleModal(false)}
        title="בקשת שינוי מועד"
      >
        {rescheduleAppt && (
          <form onSubmit={handleRescheduleSubmit} className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              <div className="font-medium text-gray-800 mb-1">{rescheduleAppt.customer_name}</div>
              <div>{rescheduleAppt.service_name} — {formatDateTime(rescheduleAppt.start_time)}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">תאריך מוצע</label>
              <input
                type="date"
                value={suggestedDate}
                onChange={e => setSuggestedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">שעה מוצעת</label>
              <input
                type="time"
                value={suggestedTime}
                onChange={e => setSuggestedTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">הערה ללקוח (אופציונלי)</label>
              <textarea
                value={rescheduleNote}
                onChange={e => setRescheduleNote(e.target.value)}
                placeholder="למשל: נא לאשר עד מחר..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={submittingReschedule}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {submittingReschedule ? 'שולח...' : 'שלח ללקוח'}
              </button>
              <button
                type="button"
                onClick={() => setRescheduleModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
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
