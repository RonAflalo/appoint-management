import { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { getAvailability, setAvailability } from '../../api/worker';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { toDateString, formatDate } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';

export default function WorkerAvailability() {
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [form, setForm] = useState({ is_blocked: false, custom_start: '', custom_end: '' });
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  const load = async () => {
    try {
      const data = await getAvailability();
      setOverrides(data.overrides || []);
    } catch (e) {
      addToast('שגיאה בטעינת הזמינות', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const dateStr = toDateString(selectedDate);
    const existing = overrides.find(o => o.date === dateStr);
    if (existing) {
      setForm({
        is_blocked: existing.is_blocked === 1,
        custom_start: existing.custom_start || '',
        custom_end: existing.custom_end || '',
      });
    } else {
      setForm({ is_blocked: false, custom_start: '', custom_end: '' });
    }
  }, [selectedDate, overrides]);

  const handleSave = async () => {
    const dateStr = toDateString(selectedDate);
    if (!form.is_blocked && form.custom_start && !form.custom_end) {
      addToast('יש להזין גם שעת סיום', 'error');
      return;
    }
    if (!form.is_blocked && form.custom_end && !form.custom_start) {
      addToast('יש להזין גם שעת התחלה', 'error');
      return;
    }
    setSaving(true);
    try {
      await setAvailability({
        date: dateStr,
        is_blocked: form.is_blocked,
        custom_start: !form.is_blocked ? form.custom_start || null : null,
        custom_end: !form.is_blocked ? form.custom_end || null : null,
      });
      addToast('הזמינות עודכנה בהצלחה');
      load();
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה בעדכון זמינות', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedDateStr = toDateString(selectedDate);
  const selectedOverride = overrides.find(o => o.date === selectedDateStr);

  const tileClassName = ({ date }) => {
    const dateStr = toDateString(date);
    const override = overrides.find(o => o.date === dateStr);
    if (!override) return null;
    return override.is_blocked ? 'blocked-day' : 'custom-hours-day';
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">זמינות</h1>
        <p className="text-gray-500 text-sm mt-1">הגדר ימים חסומים או שעות מותאמות</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <style>{`
            .blocked-day {
              background: #fee2e2 !important;
              color: #dc2626 !important;
              font-weight: 600;
              border-radius: 6px;
            }
            .custom-hours-day {
              background: #d1fae5 !important;
              color: #059669 !important;
              font-weight: 600;
              border-radius: 6px;
            }
            .blocked-day.react-calendar__tile--active,
            .custom-hours-day.react-calendar__tile--active {
              background: #6366f1 !important;
              color: white !important;
            }
          `}</style>
          <Calendar
            onChange={setSelectedDate}
            value={selectedDate}
            tileClassName={tileClassName}
            locale="he-IL"
            minDate={new Date()}
          />
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-red-100 rounded"></div>
              <span>חסום</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-100 rounded"></div>
              <span>שעות מותאמות</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              {selectedDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
              {selectedOverride && (
                <span className={`mr-2 text-xs px-2 py-0.5 rounded-full
                  ${selectedOverride.is_blocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {selectedOverride.is_blocked ? 'חסום' : 'שעות מותאמות'}
                </span>
              )}
            </h2>

            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={form.is_blocked}
                    onChange={e => setForm(p => ({ ...p, is_blocked: e.target.checked, custom_start: '', custom_end: '' }))}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                </div>
                <span className="text-sm font-medium text-gray-700">חסום יום זה</span>
              </label>

              {!form.is_blocked && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">השאר ריק לשימוש בשעות ברירת מחדל של העסק</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">שעת התחלה</label>
                      <input
                        type="time"
                        value={form.custom_start}
                        onChange={e => setForm(p => ({ ...p, custom_start: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <span className="text-gray-400 mt-5">-</span>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">שעת סיום</label>
                      <input
                        type="time"
                        value={form.custom_end}
                        onChange={e => setForm(p => ({ ...p, custom_end: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  שומר...
                </>
              ) : 'שמור זמינות'}
            </button>
          </div>

          {/* Override list */}
          {overrides.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">הגדרות קיימות</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {overrides.map(override => (
                  <div key={override.id} className={`flex items-center justify-between p-2 rounded-lg text-xs
                    ${override.is_blocked ? 'bg-red-50' : 'bg-green-50'}`}>
                    <span className="font-medium text-gray-700">{formatDate(override.date)}</span>
                    <span className={override.is_blocked ? 'text-red-600' : 'text-green-600'}>
                      {override.is_blocked ? 'חסום' : `${override.custom_start} - ${override.custom_end}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
