import { useState, useEffect } from 'react';
import { getWorkerAppointments, updateWorkerAppointmentStatus } from '../../api/worker';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDateTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';

const TABS = [
  { value: '', label: 'הכל' },
  { value: 'pending', label: 'ממתין' },
  { value: 'confirmed', label: 'מאושר' },
  { value: 'completed', label: 'הושלם' },
  { value: 'cancelled', label: 'בוטל' },
];

export default function WorkerAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
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

  const handleStatusChange = async (id, status) => {
    try {
      await updateWorkerAppointmentStatus(id, status);
      addToast(status === 'completed' ? 'התור סומן כהושלם' : 'התור בוטל');
      load(activeTab);
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה בעדכון סטטוס', 'error');
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
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors
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

              {/* Actions */}
              {(appt.status === 'pending' || appt.status === 'confirmed') && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStatusChange(appt.id, 'completed')}
                    className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    ✓ סמן כהושלם
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('האם לבטל את התור?')) handleStatusChange(appt.id, 'cancelled');
                    }}
                    className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
                  >
                    ✕ בטל
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
