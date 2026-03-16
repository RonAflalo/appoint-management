import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useToast } from '../../hooks/useToast';
import { DAYS_HE } from '../../utils/dateUtils';

const DEFAULT_HOURS = {
  "0": null,
  "1": { start: "09:00", end: "18:00" },
  "2": { start: "09:00", end: "18:00" },
  "3": { start: "09:00", end: "18:00" },
  "4": { start: "09:00", end: "18:00" },
  "5": { start: "09:00", end: "14:00" },
  "6": null,
};

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [workingHours, setWorkingHours] = useState(DEFAULT_HOURS);
  const { addToast } = useToast();

  useEffect(() => {
    getSettings().then(data => {
      const b = data.business;
      setName(b.name || '');
      setAddress(b.address || '');
      setWorkingHours(b.working_hours || DEFAULT_HOURS);
    }).catch(() => {
      addToast('שגיאה בטעינת ההגדרות', 'error');
    }).finally(() => setLoading(false));
  }, []);

  const toggleDay = (day) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: prev[day] ? null : { start: '09:00', end: '18:00' },
    }));
  };

  const updateDayTime = (day, field, value) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('יש להזין שם עסק', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateSettings({ name, address, working_hours: workingHours });
      addToast('ההגדרות נשמרו בהצלחה');
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה בשמירת ההגדרות', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">הגדרות</h1>
        <p className="text-gray-500 text-sm mt-1">הגדרות העסק ושעות פעילות</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Business info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">פרטי העסק</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">שם העסק</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="שם העסק"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">כתובת</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="כתובת העסק"
              />
            </div>
          </div>
        </div>

        {/* Working hours */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">שעות פעילות</h2>
          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5, 6].map(day => {
              const dayKey = String(day);
              const isOpen = workingHours[dayKey] !== null && workingHours[dayKey] !== undefined;
              return (
                <div key={day} className={`p-3 rounded-lg border transition-colors
                  ${isOpen ? 'border-indigo-100 bg-indigo-50/30' : 'border-gray-100 bg-gray-50'}`}>
                  {/* Top row: day name + toggle */}
                  <div className="flex items-center gap-3">
                    <div className="w-20 shrink-0 text-sm font-medium text-gray-700">{DAYS_HE[day]}</div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={isOpen}
                        onChange={() => toggleDay(dayKey)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                    {/* Show "סגור" inline on desktop, hidden on mobile when open (shown below) */}
                    {!isOpen && <span className="text-sm text-gray-400">סגור</span>}
                    {/* Show times inline on desktop */}
                    {isOpen && (
                      <div className="hidden sm:flex items-center gap-2 text-sm">
                        <input
                          type="time"
                          value={workingHours[dayKey]?.start || '09:00'}
                          onChange={e => updateDayTime(dayKey, 'start', e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-gray-400">-</span>
                        <input
                          type="time"
                          value={workingHours[dayKey]?.end || '18:00'}
                          onChange={e => updateDayTime(dayKey, 'end', e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                  </div>
                  {/* Time inputs on their own row for mobile only */}
                  {isOpen && (
                    <div className="flex sm:hidden items-center gap-2 mt-2 pe-1">
                      <input
                        type="time"
                        value={workingHours[dayKey]?.start || '09:00'}
                        onChange={e => updateDayTime(dayKey, 'start', e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-gray-400 shrink-0">-</span>
                      <input
                        type="time"
                        value={workingHours[dayKey]?.end || '18:00'}
                        onChange={e => updateDayTime(dayKey, 'end', e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              שומר...
            </>
          ) : 'שמור הגדרות'}
        </button>
      </form>
    </div>
  );
}
