import { useState, useEffect, useCallback } from 'react';
import { getWorkersCalendar, getWorkersDayDetail } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import { formatTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const DAYS_HE_SHORT = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];

const STATUS_STYLE = {
  available:       { dot: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  label: 'זמין'          },
  blocked:         { dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    label: 'חסום'          },
  custom_hours:    { dot: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'שעות מותאמות' },
  business_closed: { dot: 'bg-gray-300',   text: 'text-gray-400',   bg: 'bg-gray-50',   border: 'border-gray-100',   label: 'סגור'          },
};

export default function AdminWorkersCalendar() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Day detail panel
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayDetail, setDayDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const { addToast } = useToast();

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-12

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setCalendarData(null);
    try {
      const data = await getWorkersCalendar(year, month);
      setCalendarData(data);
    } catch {
      addToast('שגיאה בטעינת לוח העובדים', 'error');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  const handleDayClick = async (dateStr) => {
    if (selectedDate === dateStr) { setSelectedDate(null); setDayDetail(null); return; }
    setSelectedDate(dateStr);
    setDayDetail(null);
    setLoadingDetail(true);
    try {
      const data = await getWorkersDayDetail(dateStr);
      setDayDetail(data);
    } catch {
      addToast('שגיאה בטעינת פרטי היום', 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  // Build calendar grid (Sun=0 … Sat=6, first day as padding)
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow    = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const totalCells  = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const day = i - firstDow + 1;
    return (day >= 1 && day <= daysInMonth) ? day : null;
  });

  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  })();

  const dateStr = (day) =>
    `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

  return (
    <div dir="rtl">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-headline font-extrabold text-3xl text-on-surface">לוח עובדים</h1>
          <p className="text-on-surface-variant text-sm mt-1">סקירת זמינות וסטטוס כלל העובדים לפי יום</p>
        </div>
        {/* Month navigation */}
        <div className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl px-4 py-2 shadow-sm">
          <button onClick={prevMonth} className="p-1 hover:bg-surface-container-low rounded-lg transition-colors text-on-surface-variant">
            {/* Right arrow (RTL: goes to prev month) */}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span className="font-semibold text-on-surface min-w-32 text-center">
            {MONTHS_HE[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-surface-container-low rounded-lg transition-colors text-on-surface-variant">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {Object.entries(STATUS_STYLE).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${s.dot}`}></span>
            <span className="text-on-surface-variant">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-4 items-start">
        {/* Calendar */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <LoadingSpinner />
          ) : (
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/20 overflow-hidden">
              {/* Day-of-week header */}
              <div className="grid grid-cols-7 border-b border-outline-variant/20">
                {DAYS_HE_SHORT.map(d => (
                  <div key={d} className="py-2 text-center text-xs font-semibold text-on-surface-variant bg-surface-container">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {cells.map((day, idx) => {
                  if (!day) return (
                    <div key={`empty-${idx}`} className="min-h-20 border-b border-s border-outline-variant/20 bg-surface-container-low/50" />
                  );

                  const ds = dateStr(day);
                  const dayData = calendarData?.days?.[ds];
                  const isToday = ds === todayStr;
                  const isSelected = ds === selectedDate;

                  return (
                    <div
                      key={ds}
                      onClick={() => handleDayClick(ds)}
                      className={`min-h-20 border-b border-s border-outline-variant/20 p-1.5 cursor-pointer transition-colors
                        ${isSelected ? 'bg-primary/10 ring-2 ring-inset ring-primary' : 'hover:bg-surface-container-low'}
                        ${!dayData?.isBusinessOpen ? 'bg-surface-container-low/50' : ''}`}
                    >
                      {/* Day number */}
                      <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                        ${isToday ? 'bg-primary text-white' : 'text-on-surface'}`}>
                        {day}
                      </div>

                      {/* Worker pills — hide on very small screens, show abbreviated */}
                      {dayData && dayData.isBusinessOpen && (
                        <div className="space-y-0.5">
                          {dayData.workers.map(w => {
                            const s = STATUS_STYLE[w.status] || STATUS_STYLE.available;
                            return (
                              <div
                                key={w.id}
                                className={`flex items-center gap-1 text-xs rounded px-1 py-0.5 truncate ${s.bg} ${s.text}`}
                              >
                                <span className={`shrink-0 inline-block w-1.5 h-1.5 rounded-full ${s.dot}`}></span>
                                <span className="truncate hidden sm:block">{w.name}</span>
                                {w.status !== 'blocked' && w.appointmentCount > 0 && (
                                  <span className="shrink-0 font-bold hidden sm:block">({w.appointmentCount})</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Business closed label */}
                      {dayData && !dayData.isBusinessOpen && (
                        <div className="text-xs text-on-surface-variant mt-1">סגור</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Day detail side panel */}
        {selectedDate && (
          <div className="w-80 shrink-0 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/20 overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 primary-gradient text-white">
              <h3 className="font-semibold text-sm">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('he-IL', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                })}
              </h3>
              <button onClick={() => { setSelectedDate(null); setDayDetail(null); }}
                className="text-white/70 hover:text-white leading-none flex items-center justify-center">
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {loadingDetail ? (
                <LoadingSpinner size="sm" />
              ) : !dayDetail ? null : !dayDetail.isBusinessOpen ? (
                <div className="text-center py-6 text-on-surface-variant">
                  <span className="text-3xl block mb-2">🔒</span>
                  <p className="text-sm font-medium">העסק סגור ביום זה</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dayDetail.workers.map(worker => {
                    const s = STATUS_STYLE[worker.status] || STATUS_STYLE.available;
                    return (
                      <div key={worker.id} className={`rounded-xl border ${s.border} ${s.bg} overflow-hidden`}>
                        {/* Worker header */}
                        <div className="flex items-center justify-between px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${s.dot}`}></span>
                            <span className={`font-semibold text-sm ${s.text}`}>{worker.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {worker.status === 'custom_hours' && (
                              <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                                {worker.customStart}–{worker.customEnd}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text} border ${s.border}`}>
                              {s.label}
                            </span>
                          </div>
                        </div>

                        {/* Appointments list */}
                        {worker.appointments.length > 0 && (
                          <div className="border-t border-opacity-50 border-current">
                            {worker.appointments.map(appt => (
                              <div key={appt.id}
                                className="flex items-start justify-between px-3 py-2 border-t border-outline-variant/20 bg-surface-container-lowest/60 text-xs gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium text-on-surface truncate">{appt.customer_name}</div>
                                  <div className="text-on-surface-variant truncate">{appt.service_name}</div>
                                  <div className="text-on-surface-variant">
                                    {formatTime(appt.start_time)}–{formatTime(appt.end_time)}
                                  </div>
                                </div>
                                <div className="shrink-0 mt-0.5">
                                  <StatusBadge status={appt.status} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* No appointments */}
                        {(worker.status === 'available' || worker.status === 'custom_hours')
                          && worker.appointments.length === 0 && (
                          <div className="px-3 pb-2.5 text-xs text-on-surface-variant bg-surface-container-lowest/60">אין תורים</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
