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
  const [busy, setBusy] = useState(null); // id of the appointment being mutated

  // Reschedule modal state
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

  const openRescheduleModal = (appt) => {
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
        <div className="space-y-3">
          {appointments.map(appt => (
            <div key={appt.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-gray-900 text-lg">{appt.customer_name}</div>
                  <div className="text-gray-500 text-sm">{appt.customer_email}</div>
                </div>
                <StatusBadge status={appt.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <span>✂️</span>
                  <span>{appt.service_name}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span>💰</span>
                  <span>₪{appt.price}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 col-span-2">
                  <span>📅</span>
                  <span>{formatDateTime(appt.start_time)}</span>
                </div>
              </div>

              {appt.notes && (
                <div className="mb-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                  הערה: {appt.notes}
                </div>
              )}

              {/* Reschedule info banner */}
              {appt.status === 'reschedule_requested' && appt.suggested_time && (
                <div className="mb-3 bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                  <div className="font-medium text-orange-800 mb-1">⏰ בקשת שינוי מועד נשלחה ללקוח</div>
                  <div className="text-orange-700">זמן מוצע: {formatDateTime(appt.suggested_time)}</div>
                  {appt.reschedule_note && (
                    <div className="text-orange-600 text-xs mt-1">הערה: {appt.reschedule_note}</div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {/* PENDING: approve + cancel */}
                {appt.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApprove(appt.id)}
                      disabled={busy === appt.id}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {busy === appt.id ? '...' : '✓ אשר תור'}
                    </button>
                    <button
                      onClick={() => handleCancel(appt.id)}
                      disabled={busy === appt.id}
                      className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      ✕ בטל
                    </button>
                  </>
                )}

                {/* CONFIRMED: complete + reschedule request + cancel */}
                {appt.status === 'confirmed' && (
                  <>
                    <button
                      onClick={() => handleComplete(appt.id)}
                      disabled={busy === appt.id}
                      className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      ✓ סמן כהושלם
                    </button>
                    <button
                      onClick={() => openRescheduleModal(appt)}
                      disabled={busy === appt.id}
                      className="flex-1 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      🔄 בקש שינוי מועד
                    </button>
                    <button
                      onClick={() => handleCancel(appt.id)}
                      disabled={busy === appt.id}
                      className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      ✕ בטל
                    </button>
                  </>
                )}

                {/* RESCHEDULE_REQUESTED: cancel only (waiting for customer) */}
                {appt.status === 'reschedule_requested' && (
                  <button
                    onClick={() => handleCancel(appt.id)}
                    disabled={busy === appt.id}
                    className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    ✕ בטל תור
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
                {submittingReschedule ? 'שולח...' : '📧 שלח ללקוח'}
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
