import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, updateSettings, getServices, createService, deleteService, completeOnboarding } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useToast } from '../../hooks/useToast';
import { DAYS_HE } from '../../utils/dateUtils';

const STEPS = [
  { icon: 'celebration', label: 'ברוך הבא' },
  { icon: 'schedule', label: 'שעות פעילות' },
  { icon: 'content_cut', label: 'שירותים' },
  { icon: 'link', label: 'קישור הזמנה' },
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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <LoadingSpinner />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-8 px-4" dir="rtl">
      {/* Decorative blobs */}
      <div className="fixed -top-20 -right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed -bottom-20 -left-20 w-96 h-96 bg-secondary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl primary-gradient mb-3 shadow-lg">
            <span className="material-symbols-outlined text-white text-2xl">event_available</span>
          </div>
          <h1 className="font-headline font-bold text-xl text-on-surface">תוריי</h1>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-center mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all
                  ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'primary-gradient text-white ring-4 ring-primary/20' : 'bg-surface-container text-on-surface-variant border-2 border-outline-variant'}`}>
                  {i < step
                    ? '✓'
                    : <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{s.icon}</span>
                  }
                </div>
                <span className={`text-xs mt-1 hidden sm:block ${i === step ? 'text-primary font-semibold' : 'text-on-surface-variant'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-10 mx-1 mb-4 sm:mb-5 transition-colors ${i < step ? 'bg-emerald-400' : 'bg-outline-variant'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_32px_48px_-4px_rgba(25,28,30,0.08)] overflow-hidden">

          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <div className="p-6 md:p-8 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-on-surface mb-2">ברוך הבא לתוריי!</h2>
              <p className="text-on-surface-variant text-sm mb-1">
                העסק <strong className="text-on-surface">{business?.name}</strong> נוצר בהצלחה.
              </p>
              <p className="text-on-surface-variant text-sm mb-6">
                בוא נגדיר יחד את שעות הפעילות, השירותים, ונכין את הקישור לקביעת תורים — לוקח רק כמה דקות.
              </p>
              <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 mb-6 text-sm text-right">
                <p className="font-semibold text-on-surface mb-1">מה נגדיר עכשיו:</p>
                <ul className="text-primary space-y-1">
                  <li>🕐 שעות פעילות העסק</li>
                  <li>✂️ השירותים שאתה מציע</li>
                  <li>🔗 הקישור האישי שלך לתורים</li>
                </ul>
              </div>
              <button
                onClick={() => setStep(1)}
                className="w-full py-3.5 primary-gradient text-white font-bold rounded-xl transition-opacity hover:opacity-90 text-base"
              >
                בואו נתחיל! →
              </button>
            </div>
          )}

          {/* ── Step 1: Working Hours ── */}
          {step === 1 && (
            <div className="p-6 md:p-8">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-on-surface">שעות פעילות</h2>
                <p className="text-on-surface-variant text-sm mt-0.5">אלו הימים והשעות שבהם לקוחות יוכלו לקבוע תורים</p>
              </div>

              <div className="space-y-2 mb-6">
                {[0, 1, 2, 3, 4, 5, 6].map(day => {
                  const key = String(day);
                  const isOpen = !!workingHours[key];
                  return (
                    <div key={day} className={`p-3 rounded-xl border transition-colors ${isOpen ? 'border-primary/20 bg-primary/5' : 'border-outline-variant/20 bg-surface-container-low'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-14 shrink-0 text-sm font-medium text-on-surface">{DAYS_HE[day]}</div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input type="checkbox" checked={isOpen} onChange={() => toggleDay(key)} className="sr-only peer" />
                          <div className="w-9 h-5 bg-surface-container peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-outline-variant after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                        {!isOpen && <span className="text-sm text-on-surface-variant">סגור</span>}
                        {isOpen && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <input type="time" value={workingHours[key]?.start || '09:00'} onChange={e => updateDayTime(key, 'start', e.target.value)}
                              className="bg-surface-container-low border-none rounded-xl px-2 py-1 text-sm focus:ring-2 focus:ring-primary-fixed-dim focus:outline-none" />
                            <span className="text-on-surface-variant text-sm">—</span>
                            <input type="time" value={workingHours[key]?.end || '18:00'} onChange={e => updateDayTime(key, 'end', e.target.value)}
                              className="bg-surface-container-low border-none rounded-xl px-2 py-1 text-sm focus:ring-2 focus:ring-primary-fixed-dim focus:outline-none" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(0)}
                  className="flex-1 py-3 bg-surface-container text-on-surface-variant font-semibold rounded-xl transition-colors text-sm hover:opacity-90">
                  ← חזרה
                </button>
                <button onClick={handleSaveHours} disabled={saving}
                  className="flex-1 py-3 primary-gradient disabled:opacity-50 text-white font-bold rounded-xl transition-opacity text-sm flex items-center justify-center gap-2">
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
                <h2 className="text-lg font-bold text-on-surface">שירותים</h2>
                <p className="text-on-surface-variant text-sm mt-0.5">השירותים שהעסק שלך מציע — ניתן להוסיף ולערוך בכל עת</p>
              </div>

              <div className="space-y-2 mb-3">
                {services.length === 0 && !showAddService && (
                  <p className="text-on-surface-variant text-sm text-center py-6 bg-surface-container-low rounded-xl">אין שירותים עדיין. הוסף שירות ראשון!</p>
                )}
                {services.map(svc => (
                  <div key={svc.id} className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/20">
                    <div>
                      <div className="font-medium text-sm text-on-surface">{svc.name}</div>
                      <div className="text-xs text-on-surface-variant mt-0.5">{svc.duration_minutes} דקות · ₪{svc.price}</div>
                    </div>
                    <button onClick={() => handleDeleteService(svc.id)}
                      className="text-on-surface-variant/30 hover:text-red-400 transition-colors text-xl leading-none px-2">×</button>
                  </div>
                ))}
              </div>

              {showAddService ? (
                <div className="border-2 border-primary/20 rounded-2xl p-4 mb-3 bg-primary/5">
                  <h3 className="font-semibold text-sm text-on-surface mb-3">שירות חדש</h3>
                  <div className="space-y-3">
                    <input type="text" placeholder="שם השירות (למשל: תספורת)" value={newService.name}
                      onChange={e => setNewService(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-on-surface-variant mb-1 block">משך (דקות)</label>
                        <input type="number" min="5" step="5" value={newService.duration_minutes}
                          onChange={e => setNewService(p => ({ ...p, duration_minutes: e.target.value }))}
                          className="w-full px-3 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-on-surface-variant mb-1 block">מחיר (₪)</label>
                        <input type="number" min="0" value={newService.price}
                          onChange={e => setNewService(p => ({ ...p, price: e.target.value }))}
                          className="w-full px-3 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setShowAddService(false); setNewService({ name: '', duration_minutes: 30, price: 0 }); }}
                        className="flex-1 py-2 bg-surface-container text-on-surface-variant rounded-xl text-sm hover:opacity-90 transition-opacity">
                        ביטול
                      </button>
                      <button onClick={handleAddService} disabled={saving || !newService.name.trim()}
                        className="flex-1 py-2 primary-gradient text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-opacity flex items-center justify-center gap-1">
                        {saving ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : '+ הוסף שירות'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddService(true)}
                  className="w-full py-2.5 border-2 border-dashed border-primary/20 text-primary hover:border-primary/40 hover:bg-primary/5 rounded-2xl text-sm font-medium transition-colors mb-3">
                  + הוסף שירות
                </button>
              )}

              <div className="flex gap-3 mt-4">
                <button onClick={() => setStep(1)}
                  className="flex-1 py-3 bg-surface-container text-on-surface-variant font-semibold rounded-xl transition-opacity hover:opacity-90 text-sm">
                  ← חזרה
                </button>
                <button onClick={() => setStep(3)}
                  className="flex-1 py-3 primary-gradient text-white font-bold rounded-xl transition-opacity hover:opacity-90 text-sm">
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
                <h2 className="text-xl font-bold text-on-surface mb-1">הכל מוכן!</h2>
                <p className="text-on-surface-variant text-sm">שתף את הקישור עם הלקוחות שלך</p>
              </div>

              {bookingLink && (
                <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-4 mb-4">
                  <p className="text-xs text-on-surface-variant mb-1">הקישור האישי שלך:</p>
                  <p className="font-mono text-primary text-sm break-all mb-3">{bookingLink}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { navigator.clipboard.writeText(bookingLink); addToast('הקישור הועתק!'); }}
                      className="flex-1 py-2 bg-primary/10 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors">
                      📋 העתק קישור
                    </button>
                    <a href={bookingLink} target="_blank" rel="noopener noreferrer"
                      className="flex-1 py-2 bg-surface-container text-on-surface-variant rounded-xl text-sm font-medium hover:opacity-90 transition-opacity text-center">
                      👁 תצוגה מקדימה
                    </a>
                  </div>
                </div>
              )}

              <div className="bg-emerald-50/50 border border-emerald-200/50 rounded-2xl p-4 mb-6 space-y-1.5 text-sm">
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
                  className="flex-1 py-3 bg-surface-container text-on-surface-variant font-semibold rounded-xl transition-opacity hover:opacity-90 text-sm">
                  ← חזרה
                </button>
                <button onClick={handleComplete} disabled={saving}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                  {saving
                    ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />מסיים...</>
                    : 'סיים והתחל! 🎉'}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-on-surface-variant mt-4">ניתן לשנות את כל ההגדרות בכל עת מתוך הדשבורד</p>
      </div>
    </div>
  );
}
