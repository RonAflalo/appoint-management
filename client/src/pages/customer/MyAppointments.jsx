import { useState, useEffect } from 'react';
import { getMyAppointments, cancelAppointment } from '../../api/user';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDateTime, isFuture } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';

const TABS = [
  { value: 'upcoming', label: 'עתידיים' },
  { value: 'past', label: 'עבר' },
];

export default function CustomerMyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [cancelling, setCancelling] = useState(null);
  const { addToast } = useToast();

  const load = async () => {
    try {
      const data = await getMyAppointments();
      setAppointments(data.appointments || []);
    } catch (e) {
      addToast('שגיאה בטעינת התורים', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const upcomingAppointments = appointments.filter(
    a => isFuture(a.start_time) && ['pending', 'confirmed'].includes(a.status)
  ).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const pastAppointments = appointments.filter(
    a => !isFuture(a.start_time) || ['completed', 'cancelled'].includes(a.status)
  ).sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

  const displayedAppointments = activeTab === 'upcoming' ? upcomingAppointments : pastAppointments;

  const handleCancel = async (id) => {
    if (!confirm('האם אתה בטוח שברצונך לבטל את התור?')) return;
    setCancelling(id);
    try {
      await cancelAppointment(id);
      addToast('התור בוטל בהצלחה');
      load();
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה בביטול התור', 'error');
    } finally {
      setCancelling(null);
    }
  };

  const canCancel = (appt) => {
    return isFuture(appt.start_time) && ['pending', 'confirmed'].includes(appt.status);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">התורים שלי</h1>
        <p className="text-gray-500 text-sm mt-1">{appointments.length} תורים סה"כ</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${activeTab === tab.value ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600'}`}
          >
            {tab.label}
            <span className={`mr-2 text-xs px-1.5 py-0.5 rounded-full
              ${activeTab === tab.value ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
              {tab.value === 'upcoming' ? upcomingAppointments.length : pastAppointments.length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : displayedAppointments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <span className="text-5xl mb-4 block">{activeTab === 'upcoming' ? '📅' : '📋'}</span>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {activeTab === 'upcoming' ? 'אין תורים קרובים' : 'אין תורים בעבר'}
          </h3>
          <p className="text-gray-500 text-sm">
            {activeTab === 'upcoming' ? 'קבע תור חדש עכשיו!' : 'ההיסטוריה שלך תופיע כאן'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedAppointments.map(appt => (
            <div key={appt.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">{appt.service_name}</h3>
                  <p className="text-gray-500 text-sm">עם {appt.worker_name}</p>
                </div>
                <StatusBadge status={appt.status} />
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <span>📅</span>
                  <span>{formatDateTime(appt.start_time)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span>⏱️</span>
                  <span>{appt.duration_minutes} דקות</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <span>💰</span>
                  <span>₪{appt.price}</span>
                </div>
              </div>

              {appt.notes && (
                <div className="mb-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                  הערה: {appt.notes}
                </div>
              )}

              {/* Cancel button */}
              {canCancel(appt) && (
                <button
                  onClick={() => handleCancel(appt.id)}
                  disabled={cancelling === appt.id}
                  className="w-full py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {cancelling === appt.id ? 'מבטל...' : 'בטל תור'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
