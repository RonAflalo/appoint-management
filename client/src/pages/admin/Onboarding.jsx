import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, updateSettings, getServices, createService, deleteService, completeOnboarding } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useToast } from '../../hooks/useToast';
import { DAYS_HE } from '../../utils/dateUtils';

const STEPS = [
  { icon: '🎉', label: 'ברוך הבא' },
  { icon: '🕐', label: 'שעות פעילות' },
  { icon: '✂️', label: 'שירותים' },
  { icon: '🔗', label: 'קישור הזמנה' },
];

export default function AdminOnboarding() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [business, setBusiness] = useState(null);
  const [workingHours, setWorkingHours] = useState({
    "0": null,
    "1": { start: "09:00", end: "18:00" },
    "2": { start: "09:00", end: "18:00" },
    "3": { start: "09:00", end: "18:00" },
    "4": { start: "09:00", end: "18:00" },
    "5": { start: "09:00", end: "14:00" },
    "6": null,
  });
  const [services, setServices] = useState([]);
  const [showAddService, setShowAddService] = useState(false);
  const [newService, setNewService] = useState({ name: '', duration_minutes: 30, price: 0 });

  useEffect(() => {
    Promise.all([getSettings(), getServices()])
      .then(([s, sv]) => {
        setBusiness(s.business);
        if (s.business?.working_hours) setWorkingHours(s.business.working_hours);
        setServices(sv.services || []);
      })
      .catch(() => addToast('שגיאה בטעינה', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const bookingLink = business?.slug ? `${window.location.origin}/book/${business.slug}` : null;

  const toggleDay = (day) => setWorkingHours(p => ({
    ...p, [day]: p[day] ? null : { start: '09:00', end: '18:00' },
  }));

  const updateDayTime = (day, field, value) => setWorkingHours(p => ({
    ...p, [day]: { ...p[day], [field]: value },
  }));

  const handleSaveHours = async () => {
    setSaving(true);
    try {
      await updateSettings({ working_hours: workingHours });
      setStep(2);
    } catch {
      addToast('שגיאה בשמירת שעות הפעילות', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddService = async () => {
    if (!newService.name.trim()) return;
    setSaving(true);
    try {
      const data = await createService({
        name: newService.name,
        duration_minutes: Number(newService.duration_minutes),
        price: Number(newService.price),
      });
      setServices(p => [...p, data.service]);
      setNewService({ name: '', duration_minutes: 30, price: 0 });
      setShowAddService(false);
    } catch {
      addToast('שגיאה בהוספת שירות', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (id) => {
    try {
      await deleteService(id);
      setServices(p => p.filter(s => s.id !== id));
    } catch {
      addToast('שגיאה במחיקת שירות', 'error');
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await completeOnboarding();
      addToast('ברוך הבא לתוריי! 🎉');
      navigate('/admin');
    } catch {
      addToast('שגיאה', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
      <LoadingSpinner />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col items-center py-8 px-4" dir="rtl">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-3 shadow-lg">
            <span className="text-2xl">📅</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">תוריי</h1>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-center mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all
                  ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-white text-gray-400 border-2 border-gray-200'}`}>
                  {i < step ? '✓' : s.icon}
                </div>
                <span className={`text-xs mt-1 hidden sm:block ${i === step ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-10 mx-1 mb-4 sm:mb-5 transition-colors ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <div className="p-6 md:p-8 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">ברוך הבא לתוריי!</h2>
              <p className="text-gray-500 text-sm mb-1">
                העסק <strong className="text-gray-800">{business?.name}</strong> נוצר בהצלחה.
              </p>
              <p className="text-gray-500 text-sm mb-6">
                בוא נגדיר יחד את שעות הפעילות, השירותים, ונכין את הקישור לקביעת תורים — לוקח רק כמה דקות.
              </p>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-6 text-sm text-right">
                <p className="font-semibold text-indigo-800 mb-1">מה נגדיר עכשיו:</p>
                <ul className="text-indigo-600 space-y-1">
                  <li>🕐 שעות פעילות העסק</li>
                  <li>✂️ השירותים שאתה מציע</li>
                  <li>🔗 הקישור האישי שלך לתורים</li>
                </ul>
              </div>
              <button
                onClick={() => setStep(1)}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors text-base"
              >
                בואו נתחיל! →
              </button>
            </div>
          )}

          {/* ── Step 1: Working Hours ── */}
          {step === 1 && (
            <div className="p-6 md:p-8">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-gray-900">שעות פעילות</h2>
                <p className="text-gray-500 text-sm mt-0.5">אלו הימים והשעות שבהם לקוחות יוכלו לקבוע תורים</p>
              </div>

              <div className="space-y-2 mb-6">
                {[0, 1, 2, 3, 4, 5, 6].map(day => {
                  const key = String(day);
                  const isOpen = !!workingHours[key];
                  return (
                    <div key={day} className={`p-3 rounded-xl border transition-colors ${isOpen ? 'border-indigo-100 bg-indigo-50/40' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-14 shrink-0 text-sm font-medium text-gray-700">{DAYS_HE[day]}</div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input type="checkbox" checked={isOpen} onChange={() => toggleDay(key)} className="sr-only peer" />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                        {!isOpen && <span className="text-sm text-gray-400">סגור</span>}
                        {isOpen && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <input type="time" value={workingHours[key]?.start || '09:00'} onChange={e => updateDayTime(key, 'start', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            <span className="text-gray-400 text-sm">—</span>
                            <input type="time" value={workingHours[key]?.end || '18:00'} onChange={e => updateDayTime(key, 'end', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(0)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl transition-colors text-sm">
                  ← חזרה
                </button>
                <button onClick={handleSaveHours} disabled={saving}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                  {saving
                    ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />שומר...</>
                    : 'שמור והמשך →'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Services ── */}
          {step === 2 && (
            <div className="p-6 md:p-8">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-gray-900">שירותים</h2>
                <p className="text-gray-500 text-sm mt-0.5">השירותים שהעסק שלך מציע — ניתן להוסיף ולערוך בכל עת</p>
              </div>

              <div className="space-y-2 mb-3">
                {services.length === 0 && !showAddService && (
                  <p className="text-gray-400 text-sm text-center py-6 bg-gray-50 rounded-xl">אין שירותים עדיין. הוסף שירות ראשון!</p>
                )}
                {services.map(svc => (
                  <div key={svc.id} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <div className="font-medium text-sm text-gray-900">{svc.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{svc.duration_minutes} דקות · ₪{svc.price}</div>
                    </div>
                    <button onClick={() => handleDeleteService(svc.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-xl leading-none px-2">×</button>
                  </div>
                ))}
              </div>

              {showAddService ? (
                <div className="border-2 border-indigo-200 rounded-xl p-4 mb-3 bg-indigo-50/30">
                  <h3 className="font-semibold text-sm text-gray-800 mb-3">שירות חדש</h3>
                  <div className="space-y-3">
                    <input type="text" placeholder="שם השירות (למשל: תספורת)" value={newService.name}
                      onChange={e => setNewService(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">משך (דקות)</label>
                        <input type="number" min="5" step="5" value={newService.duration_minutes}
                          onChange={e => setNewService(p => ({ ...p, duration_minutes: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">מחיר (₪)</label>
                        <input type="number" min="0" value={newService.price}
                          onChange={e => setNewService(p => ({ ...p, price: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setShowAddService(false); setNewService({ name: '', duration_minutes: 30, price: 0 }); }}
                        className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                        ביטול
                      </button>
                      <button onClick={handleAddService} disabled={saving || !newService.name.trim()}
                        className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors flex items-center justify-center gap-1">
                        {saving ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : '+ הוסף שירות'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddService(true)}
                  className="w-full py-2.5 border-2 border-dashed border-indigo-200 text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50 rounded-xl text-sm font-medium transition-colors mb-3">
                  + הוסף שירות
                </button>
              )}

              <div className="flex gap-3 mt-4">
                <button onClick={() => setStep(1)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl transition-colors text-sm">
                  ← חזרה
                </button>
                <button onClick={() => setStep(3)}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors text-sm">
                  המשך →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Booking Link ── */}
          {step === 3 && (
            <div className="p-6 md:p-8">
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🎊</div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">הכל מוכן!</h2>
                <p className="text-gray-500 text-sm">שתף את הקישור עם הלקוחות שלך</p>
              </div>

              {bookingLink && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
                  <p className="text-xs text-gray-400 mb-1">הקישור האישי שלך:</p>
                  <p className="font-mono text-indigo-600 text-sm break-all mb-3">{bookingLink}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { navigator.clipboard.writeText(bookingLink); addToast('הקישור הועתק!'); }}
                      className="flex-1 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-colors">
                      📋 העתק קישור
                    </button>
                    <a href={bookingLink} target="_blank" rel="noopener noreferrer"
                      className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors text-center">
                      👁 תצוגה מקדימה
                    </a>
                  </div>
                </div>
              )}

              <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-6 space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-green-700">
                  <span>✅</span><span>שעות פעילות הוגדרו</span>
                </div>
                <div className="flex items-center gap-2 text-green-700">
                  <span>✅</span><span>{services.length} שירות{services.length !== 1 ? 'ים' : ''} הוגדר{services.length !== 1 ? 'ו' : ''}</span>
                </div>
                <div className="flex items-center gap-2 text-green-700">
                  <span>✅</span><span>הקישור שלך מוכן לשיתוף</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl transition-colors text-sm">
                  ← חזרה
                </button>
                <button onClick={handleComplete} disabled={saving}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                  {saving
                    ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />מסיים...</>
                    : 'סיים והתחל! 🎉'}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">ניתן לשנות את כל ההגדרות בכל עת מתוך הדשבורד</p>
      </div>
    </div>
  );
}
