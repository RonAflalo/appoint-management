import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getSettings, updateSettings, uploadImage, getCalendarStatus, disconnectCalendar } from '../../api/admin';
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

function ImageUploadField({ label, hint, value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const { addToast } = useToast();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadImage(file);
      onChange(data.url);
    } catch {
      addToast('שגיאה בהעלאת התמונה', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-on-surface mb-1.5">{label}</label>
      {hint && <p className="text-xs text-on-surface-variant mb-2">{hint}</p>}
      <div className="flex items-start gap-3">
        {value ? (
          <div className="relative flex-shrink-0">
            <img
              src={value}
              alt={label}
              className="h-20 w-20 object-cover rounded-xl border-outline-variant/20 bg-surface-container-low"
              onError={e => { e.target.style.display = 'none'; }}
            />
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="h-20 w-20 rounded-xl border-2 border-dashed border-outline-variant/20 flex items-center justify-center text-on-surface-variant text-3xl flex-shrink-0 bg-surface-container-low">
            +
          </div>
        )}
        <label className="cursor-pointer">
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors
            ${uploading
              ? 'bg-surface-container text-on-surface-variant cursor-not-allowed'
              : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}>
            {uploading ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-on-surface-variant border-t-transparent"></div>
                מעלה...
              </>
            ) : value ? 'החלף תמונה' : 'העלה תמונה'}
          </span>
        </label>
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [workingHours, setWorkingHours] = useState(DEFAULT_HOURS);
  const [cancellationHours, setCancellationHours] = useState(0);
  const [termsEnabled, setTermsEnabled] = useState(false);
  const [termsText, setTermsText] = useState('');
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { addToast } = useToast();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const calParam = params.get('calendar');
    if (calParam === 'connected') addToast('חיבור Google Calendar הצליח!');
    if (calParam === 'error') addToast('שגיאה בחיבור Google Calendar', 'error');

    Promise.allSettled([getSettings(), getCalendarStatus()]).then(([settingsRes, calRes]) => {
      if (settingsRes.status === 'fulfilled') {
        const b = settingsRes.value.business;
        setName(b.name || '');
        setAddress(b.address || '');
        setPhone(b.phone || '');
        setDescription(b.description || '');
        setLogoUrl(b.logo_url || '');
        setCoverUrl(b.cover_url || '');
        setInstagramUrl(b.instagram_url || '');
        setFacebookUrl(b.facebook_url || '');
        setWorkingHours(b.working_hours || DEFAULT_HOURS);
        setCancellationHours(b.cancellation_hours ?? 0);
        setTermsEnabled(!!b.terms_enabled);
        setTermsText(b.terms_text || '');
      } else {
        addToast('שגיאה בטעינת ההגדרות', 'error');
      }
      if (calRes.status === 'fulfilled') {
        setCalendarConnected(!!calRes.value.connected);
      }
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
      await updateSettings({
        name, address, phone, description,
        logo_url: logoUrl || null,
        cover_url: coverUrl || null,
        instagram_url: instagramUrl || null,
        facebook_url: facebookUrl || null,
        working_hours: workingHours,
        cancellation_hours: Number(cancellationHours),
        terms_enabled: termsEnabled ? 1 : 0,
        terms_text: termsText || null,
      });
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
        <h1 className="font-headline font-extrabold text-3xl text-on-surface">הגדרות</h1>
        <p className="text-on-surface-variant text-sm mt-1">הגדרות העסק ושעות פעילות</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Business info */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6">
          <h2 className="font-headline font-bold text-lg text-on-surface mb-4">פרטי העסק</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">שם העסק</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
                placeholder="שם העסק"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">כתובת</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
                placeholder="כתובת העסק"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">טלפון</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
                placeholder="050-0000000"
                dir="ltr"
              />
              <p className="text-xs text-on-surface-variant mt-1">ישמש גם לחיוג ישיר ו-WhatsApp מדף הלקוח</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">תיאור העסק</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim resize-none"
                placeholder="תיאור קצר של העסק שיוצג ללקוחות"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6">
          <h2 className="font-headline font-bold text-lg text-on-surface mb-4">תמונות</h2>
          <div className="space-y-6">
            <ImageUploadField
              label="לוגו"
              hint="מוצג בדף הזמנת התורים ובאפליקציה (מרובע, מומלץ 200×200 פיקסל)"
              value={logoUrl}
              onChange={setLogoUrl}
            />
            <ImageUploadField
              label="תמונת רקע / כריכה"
              hint="מוצגת בראש דף הזמנת התורים (רחבה, מומלץ 1200×400 פיקסל)"
              value={coverUrl}
              onChange={setCoverUrl}
            />
          </div>
        </div>

        {/* Social links */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6">
          <h2 className="font-headline font-bold text-lg text-on-surface mb-1">קישורים חברתיים</h2>
          <p className="text-sm text-on-surface-variant mb-4">יוצגו כאייקונים ללחיצה בדף הלקוח</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5 flex items-center gap-2">
                <span className="text-pink-500">📸</span> Instagram
              </label>
              <input
                type="url"
                value={instagramUrl}
                onChange={e => setInstagramUrl(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
                placeholder="https://instagram.com/your_handle"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5 flex items-center gap-2">
                <span className="text-blue-600">📘</span> Facebook
              </label>
              <input
                type="url"
                value={facebookUrl}
                onChange={e => setFacebookUrl(e.target.value)}
                className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
                placeholder="https://facebook.com/your_page"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Cancellation policy */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6">
          <h2 className="font-headline font-bold text-lg text-on-surface mb-1">מדיניות ביטול</h2>
          <p className="text-sm text-on-surface-variant mb-4">מינימום שעות ביטול לפני התור (0 = ביטול חופשי בכל עת)</p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              max="168"
              value={cancellationHours}
              onChange={e => setCancellationHours(e.target.value)}
              className="w-24 px-3 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
            />
            <span className="text-sm text-on-surface-variant">שעות לפני התור</span>
          </div>
          {cancellationHours > 0 && (
            <p className="mt-2 text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
              לקוחות לא יוכלו לבטל תור פחות מ-{cancellationHours} שעות לפני המועד
            </p>
          )}
        </div>

        {/* Terms */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6">
          <h2 className="font-headline font-bold text-lg text-on-surface mb-1">תנאי שימוש</h2>
          <p className="text-sm text-on-surface-variant mb-4">אם מופעל, הלקוח יידרש לאשר את התנאים לפני קביעת תור</p>
          <label className="flex items-center gap-3 cursor-pointer mb-4">
            <div className="relative">
              <input
                type="checkbox"
                checked={termsEnabled}
                onChange={e => setTermsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-surface-container peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-outline-variant/20 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </div>
            <span className="text-sm font-medium text-on-surface">הצג תנאי שימוש בדף ההזמנה</span>
          </label>
          {termsEnabled && (
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">טקסט תנאי השימוש</label>
              <textarea
                value={termsText}
                onChange={e => setTermsText(e.target.value)}
                rows={5}
                placeholder="כתוב כאן את תנאי השימוש שיוצגו ללקוחות..."
                className="w-full px-4 py-2.5 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim resize-none"
              />
            </div>
          )}
        </div>

        {/* Google Calendar */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6">
          <h2 className="font-headline font-bold text-lg text-on-surface mb-1">Google Calendar</h2>
          <p className="text-sm text-on-surface-variant mb-4">
            חבר את חשבון Google שלך כדי לסנכרן תורים אוטומטית ליומן
          </p>
          {calendarConnected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-xl px-4 py-2.5">
                <span>✅</span>
                <span>Google Calendar מחובר</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setDisconnecting(true);
                  try {
                    await disconnectCalendar();
                    setCalendarConnected(false);
                    addToast('Google Calendar נותק');
                  } catch {
                    addToast('שגיאה בניתוק', 'error');
                  } finally {
                    setDisconnecting(false);
                  }
                }}
                disabled={disconnecting}
                className="text-sm bg-red-50 text-error rounded-xl hover:bg-red-100 px-4 py-2 font-medium transition-colors disabled:opacity-50"
              >
                {disconnecting ? 'מנתק...' : 'נתק'}
              </button>
            </div>
          ) : (
            <a
              href="/api/auth/google/calendar"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface-container text-on-surface rounded-xl text-sm font-medium hover:bg-surface-container-high transition-colors shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              חבר Google Calendar
            </a>
          )}
        </div>

        {/* Working hours */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6">
          <h2 className="font-headline font-bold text-lg text-on-surface mb-4">שעות פעילות</h2>
          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5, 6].map(day => {
              const dayKey = String(day);
              const isOpen = workingHours[dayKey] !== null && workingHours[dayKey] !== undefined;
              return (
                <div key={day} className={`p-3 rounded-xl transition-colors
                  ${isOpen ? 'bg-primary/10' : 'bg-surface-container-low'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-20 shrink-0 text-sm font-medium text-on-surface">{DAYS_HE[day]}</div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={isOpen}
                        onChange={() => toggleDay(dayKey)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-container peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-outline-variant/20 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                    {!isOpen && <span className="text-sm text-on-surface-variant">סגור</span>}
                    {isOpen && (
                      <div className="hidden sm:flex items-center gap-2 text-sm">
                        <input
                          type="time"
                          value={workingHours[dayKey]?.start || '09:00'}
                          onChange={e => updateDayTime(dayKey, 'start', e.target.value)}
                          className="px-2 py-1 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
                        />
                        <span className="text-on-surface-variant">-</span>
                        <input
                          type="time"
                          value={workingHours[dayKey]?.end || '18:00'}
                          onChange={e => updateDayTime(dayKey, 'end', e.target.value)}
                          className="px-2 py-1 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
                        />
                      </div>
                    )}
                  </div>
                  {isOpen && (
                    <div className="flex sm:hidden items-center gap-2 mt-2 pe-1">
                      <input
                        type="time"
                        value={workingHours[dayKey]?.start || '09:00'}
                        onChange={e => updateDayTime(dayKey, 'start', e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
                      />
                      <span className="text-on-surface-variant shrink-0">-</span>
                      <input
                        type="time"
                        value={workingHours[dayKey]?.end || '18:00'}
                        onChange={e => updateDayTime(dayKey, 'end', e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
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
          className="primary-gradient disabled:opacity-50 text-white rounded-xl px-5 py-2.5 font-bold text-sm transition-opacity flex items-center gap-2"
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
