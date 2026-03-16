import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { getWorkerAppointments, getAvailability } from '../../api/worker';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import { toDateString, formatTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';

export default function WorkerSchedule() {
  const [appointments, setAppointments] = useState([]);
  const [blockedDates, setBlockedDates] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { addToast } = useToast();

  useEffect(() => {
    Promise.all([
      getWorkerAppointments({}),
      getAvailability(),
    ])
      .then(([apptData, availData]) => {
        setAppointments(apptData.appointments || []);
        const blocked = new Set(
          (availData.overrides || [])
            .filter(o => o.is_blocked)
            .map(o => o.date)
        );
        setBlockedDates(blocked);
      })
      .catch(() => addToast('שגיאה בטעינת הנתונים', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const selectedDateStr = toDateString(selectedDate);
  const dayAppointments = appointments.filter(a => a.start_time.startsWith(selectedDateStr));

  // Dates that have appointments
  const appointmentDates = new Set(appointments.map(a => a.start_time.substring(0, 10)));

  const tileClassName = ({ date }) => {
    const dateStr = toDateString(date);
    if (blockedDates.has(dateStr)) return 'is-blocked';
    if (appointmentDates.has(dateStr)) return 'has-appointments';
    return null;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">לוח זמנים</h1>
        <p className="text-gray-500 text-sm mt-1">בחר תאריך לצפייה בתורים</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <style>{`
            .has-appointments {
              background: #e0e7ff !important;
              color: #4338ca !important;
              font-weight: 600;
              border-radius: 6px;
            }
            .has-appointments.react-calendar__tile--active {
              background: #6366f1 !important;
              color: white !important;
            }
            .is-blocked {
              background: #fee2e2 !important;
              color: #b91c1c !important;
              font-weight: 600;
              border-radius: 6px;
              text-decoration: line-through;
            }
            .is-blocked.react-calendar__tile--active {
              background: #ef4444 !important;
              color: white !important;
              text-decoration: line-through;
            }
          `}</style>
          <Calendar
            onChange={setSelectedDate}
            value={selectedDate}
            tileClassName={tileClassName}
            locale="he-IL"
          />
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-indigo-100 rounded"></div>
              <span>יש תורים</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-red-100 rounded"></div>
              <span>יום חסום</span>
            </div>
          </div>
        </div>

        {/* Day appointments */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            תורים ל-{selectedDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h2>

          {dayAppointments.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <span className="text-4xl mb-3 block">📅</span>
              <p className="text-gray-500">אין תורים ביום זה</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dayAppointments
                .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                .map(appt => (
                  <div key={appt.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{appt.customer_name}</div>
                        <div className="text-sm text-gray-500 mt-0.5">{appt.service_name}</div>
                        <div className="text-sm text-emerald-600 font-medium mt-1">
                          {formatTime(appt.start_time)} - {formatTime(appt.end_time)}
                        </div>
                      </div>
                      <StatusBadge status={appt.status} />
                    </div>
                    {appt.notes && (
                      <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                        {appt.notes}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
