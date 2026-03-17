import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { getBusinessInfo, getPublicServices, getPublicWorkers, getPublicSlots, getPublicAvailableDays, publicBook } from '../api/public';
import { toDateString, formatTime } from '../utils/dateUtils';
import { useAuth } from '../hooks/useAuth';
import BusinessSocialLinks from '../components/common/BusinessSocialLinks';

function buildCalendarUrl(slot, durationMinutes, title, details, location) {
  const startDate = new Date(slot);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(startDate)}/${fmt(endDate)}`,
    details,
    location: location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const STEPS = ['ברוך הבא', 'בחר שירות', 'בחר עובד', 'בחר תאריך', 'בחר שעה', 'פרטים ואישור'];

export default function PublicBooking() {
  const { slug } = useParams();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [business, setBusiness] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loadingBusiness, setLoadingBusiness] = useState(true);

  const [services, setServices] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [unavailableDates, setUnavailableDates] = useState(new Set());

  const [loadingData, setLoadingData] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingDays, setLoadingDays] = useState(false);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);

  const [selectedService, setSelectedService] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [bookingError, setBookingError] = useState('');

  useEffect(() => {
    getBusinessInfo(slug)
      .then(data => {
        if (data.success) setBusiness(data.business);
        else setNotFound(true);
      })
      .catch(err => {
        if (err.response?.status === 404) setNotFound(true);
        else setNotFound(true);
      })
      .finally(() => setLoadingBusiness(false));
  }, [slug]);

  useEffect(() => {
    if (!business) return;
    setLoadingData(true);
    Promise.all([getPublicServices(slug), getPublicWorkers(slug)])
      .then(([sData, wData]) => {
        setServices(sData.services || []);
        setWorkers(wData.workers || []);
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [business, slug]);

  const fetchUnavailableDays = async (refDate, serviceOverride, workerOverride) => {
    const svc = serviceOverride ?? selectedService;
    const wrk = workerOverride !== undefined ? workerOverride : selectedWorker;
    if (!svc) return;
    setLoadingDays(true);
    try {
      const d = refDate || new Date();
      const params = { serviceId: svc.id, year: d.getFullYear(), month: d.getMonth() + 1 };
      if (wrk) params.workerId = wrk.id;
      const data = await getPublicAvailableDays(slug, params);
      setUnavailableDates(new Set(data.unavailableDates || []));
    } catch (_) {
    } finally {
      setLoadingDays(false);
    }
  };

  const fetchSlots = async (date) => {
    if (!selectedService) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot(null);
    try {
      const params = { serviceId: selectedService.id, date: toDateString(date) };
      if (selectedWorker) params.workerId = selectedWorker.id;
      const data = await getPublicSlots(slug, params);
      setSlots(data.slots || []);
    } catch (_) {
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    fetchSlots(date);
  };

  const isCustomer = user && user.role === 'user';

  const handleBook = async () => {
    const bookName = isCustomer ? user.name : guestName;
    const bookEmail = isCustomer ? user.email : guestEmail;
    if (!isCustomer && (!bookName || !bookEmail)) {
      setBookingError('יש להתחבר או להירשם לפני קביעת תור');
      return;
    }
    if (!selectedService || !selectedSlot) return;
    setBooking(true);
    setBookingError('');

    let workerId = selectedWorker?.id;
    if (!workerId) {
      try {
        const params = { serviceId: selectedService.id, date: toDateString(selectedDate) };
        const data = await getPublicSlots(slug, params);
        const slotWorkers = data.slotWorkers;
        if (slotWorkers && slotWorkers[selectedSlot] && slotWorkers[selectedSlot].length > 0) {
          workerId = slotWorkers[selectedSlot][0];
        }
      } catch (_) {}
    }

    if (!workerId) {
      setBookingError('לא נמצא עובד זמין לשעה זו');
      setBooking(false);
      return;
    }

    try {
      await publicBook(slug, {
        workerId,
        serviceId: selectedService.id,
        start_time: selectedSlot,
        notes: notes || undefined,
        guestName: bookName,
        guestEmail: bookEmail,
      });
      setBooked(true);
    } catch (err) {
      setBookingError(err.response?.data?.message || 'שגיאה בקביעת התור');
    } finally {
      setBooking(false);
    }
  };

  const goNext = () => {
    if (step === 2) {
      fetchUnavailableDays(selectedDate || new Date());
      if (selectedDate) fetchSlots(selectedDate);
    }
    if (step < STEPS.length - 1) setStep(s => s + 1);
  };

  const canGoNext = () => {
    if (step === 0) return true;
    if (step === 1) return !!selectedService;
    if (step === 2) return true;
    if (step === 3) return !!selectedDate;
    if (step === 4) return !!selectedSlot;
    return true;
  };

  if (loadingBusiness) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">טוען...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">😔</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">עסק לא נמצא</h1>
          <p className="text-gray-500 mb-6">הכתובת שחיפשת אינה קיימת במערכת</p>
          <Link to="/" className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors">
            חזור לדף הבית
          </Link>
        </div>
      </div>
    );
  }

  if (!loadingBusiness && !notFound && !loadingData && workers.length === 0) {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white px-4 pt-10 pb-8 text-center">
          {business?.logo_url ? (
            <img src={business.logo_url} alt={business.name} className="w-16 h-16 object-contain rounded-xl mx-auto mb-3 bg-white/10 p-1" onError={e => e.target.style.display='none'} />
          ) : (
            <div className="text-4xl mb-3">📅</div>
          )}
          <h1 className="text-2xl font-black mb-1">{business?.name}</h1>
          {business?.address && <p className="text-indigo-200 text-sm">{business.address}</p>}
          {(business?.phone || business?.instagram_url || business?.facebook_url) && (
            <div className="flex justify-center mt-3">
              <BusinessSocialLinks business={business} variant="light" />
            </div>
          )}
        </div>
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="text-5xl mb-4">🔧</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">העסק עדיין לא מוכן לקביעת תורים</h2>
          <p className="text-gray-500">בעל העסק טרם הגדיר עובדים. נסה שנית מאוחר יותר.</p>
        </div>
      </div>
    );
  }

  if (booked) {
    const calUrl = selectedSlot && selectedService
      ? buildCalendarUrl(
          selectedSlot,
          selectedService.duration_minutes,
          `תור ל-${selectedService.name} ב-${business?.name || ''}`,
          `עובד: ${selectedWorker?.name || 'הקצאה אוטומטית'}`,
          business?.address || ''
        )
      : null;

    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">התור נקבע בהצלחה!</h1>
            <p className="text-gray-500 mb-2">אימייל אישור נשלח ל-<span className="font-medium text-gray-800">{(user?.role === 'user' ? user.email : null) || guestEmail}</span></p>
            <div className="bg-indigo-50 rounded-xl p-4 my-6 text-right space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">שירות</span>
                <span className="font-semibold">{selectedService?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">עובד</span>
                <span className="font-semibold">{selectedWorker?.name || 'הקצאה אוטומטית'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">תאריך ושעה</span>
                <span className="font-semibold">{selectedSlot ? formatTime(selectedSlot) : ''} — {selectedDate?.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
            <div className="space-y-3">
              {calUrl && (
                <a
                  href={calUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full border-2 border-indigo-200 text-indigo-700 py-3 rounded-xl font-medium hover:bg-indigo-50 transition-colors text-sm"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                  </svg>
                  הוסף ליומן Google
                </a>
              )}
              <Link
                to={`/book/${slug}`}
                onClick={() => { setBooked(false); setStep(0); setSelectedService(null); setSelectedWorker(null); setSelectedDate(null); setSelectedSlot(null); setGuestName(''); setGuestEmail(''); setNotes(''); }}
                className="block w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
              >
                קביעת תור נוסף
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [coverFailed, setCoverFailed] = useState(false);
  const hasCover = !!business?.cover_url && !coverFailed;
  const hasSocial = business?.phone || business?.instagram_url || business?.facebook_url;

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      {/* Business hero header */}
      {hasCover ? (
        <div>
          {/* Cover image */}
          <div className="relative w-full h-44 sm:h-56 overflow-hidden">
            <img
              src={business.cover_url}
              alt={business.name}
              className="w-full h-full object-cover"
              onError={() => setCoverFailed(true)}
            />
            <div className="absolute inset-0 bg-black/30" />
          </div>
          {/* Business info bar */}
          <div className="bg-white shadow-sm border-b border-gray-100">
            <div className="max-w-lg mx-auto px-4 py-4">
              <div className="flex items-center gap-3">
                {business.logo_url && (
                  <img src={business.logo_url} alt={business.name} className="w-12 h-12 rounded-xl object-contain border border-gray-200 bg-white flex-shrink-0" onError={e => e.target.style.display='none'} />
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-black text-gray-900 truncate">{business.name}</h1>
                  {business.address && <p className="text-sm text-gray-400 truncate">{business.address}</p>}
                  {business.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{business.description}</p>}
                </div>
                {hasSocial && <BusinessSocialLinks business={business} variant="dark" />}
              </div>
            </div>
            {step === 0 && (
              <div className="px-4 pb-4 flex flex-col items-center gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="w-full max-w-xs bg-indigo-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow"
                >
                  קבע תור עכשיו
                </button>
                {isCustomer ? (
                  <p className="text-gray-400 text-sm">שלום, {user.name} 👋</p>
                ) : (
                  <p className="text-gray-400 text-sm">
                    <Link to={`/login?redirect=/book/${slug}`} className="underline font-medium text-indigo-600">כניסה</Link>
                    {' '}/{' '}
                    <Link to={`/register?slug=${slug}`} className="underline font-medium text-indigo-600">הרשמה</Link>
                    {' '}לחוויה מהירה יותר
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white px-4 pt-10 pb-8 text-center">
          {business?.logo_url ? (
            <img src={business.logo_url} alt={business.name} className="w-16 h-16 object-contain rounded-xl mx-auto mb-3 bg-white/10 p-1" onError={e => e.target.style.display='none'} />
          ) : (
            <div className="text-4xl mb-3">📅</div>
          )}
          <h1 className="text-2xl font-black mb-1">{business?.name}</h1>
          {business?.address && <p className="text-indigo-200 text-sm">{business.address}</p>}
          {business?.description && <p className="text-indigo-100 text-sm mt-1 max-w-md mx-auto">{business.description}</p>}
          {hasSocial && (
            <div className="flex justify-center mt-3">
              <BusinessSocialLinks business={business} variant="light" />
            </div>
          )}
          {step === 0 && (
            <div className="mt-4 flex flex-col items-center gap-3">
              <button
                onClick={() => setStep(1)}
                className="bg-white text-indigo-700 font-bold px-8 py-3 rounded-xl hover:bg-indigo-50 transition-colors shadow-lg"
              >
                קבע תור עכשיו
              </button>
              {isCustomer ? (
                <p className="text-indigo-200 text-sm">שלום, {user.name} 👋</p>
              ) : (
                <p className="text-indigo-200 text-sm">
                  <Link to={`/login?redirect=/book/${slug}`} className="underline font-medium text-white hover:text-indigo-100">כניסה</Link>
                  {' '}/{' '}
                  <Link to={`/register?slug=${slug}`} className="underline font-medium text-white hover:text-indigo-100">הרשמה</Link>
                  {' '}לחוויה מהירה יותר
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {step > 0 && (
        <div className="max-w-lg mx-auto px-4 py-6">
          {/* Step indicator */}
          <div className="flex items-center justify-center mb-6 overflow-x-auto pb-1">
            {STEPS.slice(1).map((s, i) => (
              <div key={i} className="flex items-center flex-shrink-0">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors
                  ${i + 1 < step ? 'bg-indigo-600 text-white'
                    : i + 1 === step ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                    : 'bg-gray-100 text-gray-400'}`}>
                  {i + 1 < step ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 2 && (
                  <div className={`h-0.5 w-6 mx-1 transition-colors ${i + 1 < step ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{STEPS[step]}</h2>

            {/* Step 1: Service */}
            {step === 1 && (
              <div className="space-y-3">
                {loadingData ? (
                  <div className="text-center py-8 text-gray-400">טוען שירותים...</div>
                ) : services.map(service => (
                  <button
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-right
                      ${selectedService?.id === service.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-gray-300'}`}
                  >
                    <div>
                      <div className="font-semibold text-gray-900">{service.name}</div>
                      <div className="text-sm text-gray-500 mt-0.5">{service.duration_minutes} דקות</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-indigo-600">₪{service.price}</div>
                      {selectedService?.id === service.id && <div className="text-indigo-500">✓</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Worker */}
            {step === 2 && (
              <div className="space-y-3">
                <button
                  onClick={() => setSelectedWorker(null)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-right
                    ${selectedWorker === null ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-gray-300'}`}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                    כ
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">כל עובד זמין</div>
                    <div className="text-sm text-gray-500">הצג שעות זמינות לכל העובדים</div>
                  </div>
                  {selectedWorker === null && <span className="mr-auto text-indigo-500 text-lg">✓</span>}
                </button>
                {workers.map(worker => (
                  <button
                    key={worker.id}
                    onClick={() => setSelectedWorker(worker)}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-right
                      ${selectedWorker?.id === worker.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-gray-300'}`}
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                      {worker.name[0]}
                    </div>
                    <div className="font-semibold text-gray-900">{worker.name}</div>
                    {selectedWorker?.id === worker.id && <span className="mr-auto text-indigo-500 text-lg">✓</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Step 3: Date */}
            {step === 3 && (
              <div>
                <style>{`
                  .unavailable-day { background: #fee2e2 !important; color: #b91c1c !important; border-radius: 6px; cursor: not-allowed !important; opacity: 0.7; }
                  .unavailable-day:hover { background: #fecaca !important; }
                  .unavailable-day abbr { text-decoration: line-through; }
                `}</style>
                {loadingDays && (
                  <p className="text-xs text-gray-400 text-center mb-2 flex items-center justify-center gap-1">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-500"></span>
                    בודק זמינות ימים...
                  </p>
                )}
                <Calendar
                  onChange={handleDateSelect}
                  value={selectedDate}
                  minDate={new Date()}
                  locale="he-IL"
                  className="w-full"
                  tileClassName={({ date, view }) => {
                    if (view !== 'month') return null;
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    if (date < today) return null;
                    return unavailableDates.has(toDateString(date)) ? 'unavailable-day' : null;
                  }}
                  tileDisabled={({ date, view }) => {
                    if (view !== 'month') return false;
                    return unavailableDates.has(toDateString(date));
                  }}
                  onActiveStartDateChange={({ activeStartDate, view }) => {
                    if (view === 'month' && activeStartDate) fetchUnavailableDays(activeStartDate);
                  }}
                />
                {selectedDate && (
                  <p className="mt-3 text-sm text-indigo-600 font-medium text-center">
                    נבחר: {selectedDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 justify-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-red-100 rounded border border-red-200"></div>
                    <span>אין זמינות</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-white rounded border border-gray-300"></div>
                    <span>זמין לתור</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Time */}
            {step === 4 && (
              <div>
                {loadingSlots ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="text-4xl mb-3 block">😔</span>
                    <p className="text-gray-500 font-medium">אין שעות זמינות ביום זה</p>
                    <button onClick={() => setStep(3)} className="mt-4 text-indigo-600 font-medium text-sm hover:text-indigo-700">
                      חזור לבחירת תאריך
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map(slot => (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-3 rounded-xl text-sm font-medium transition-all border-2
                          ${selectedSlot === slot ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-100 hover:border-indigo-300 text-gray-700 hover:bg-indigo-50'}`}
                      >
                        {formatTime(slot)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Details */}
            {step === 5 && (
              <div className="space-y-4">
                <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">שירות</span>
                    <span className="font-semibold">{selectedService?.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">עובד</span>
                    <span className="font-semibold">{selectedWorker?.name || 'הקצאה אוטומטית'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">תאריך</span>
                    <span className="font-semibold">{selectedDate?.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">שעה</span>
                    <span className="font-semibold">{selectedSlot ? formatTime(selectedSlot) : ''}</span>
                  </div>
                  <div className="border-t border-indigo-100 pt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">מחיר</span>
                    <span className="font-bold text-indigo-600 text-lg">₪{selectedService?.price}</span>
                  </div>
                </div>

                {isCustomer ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                      {user.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-green-800">מזמין כ-{user.name}</p>
                      <p className="text-xs text-green-600">{user.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-3">
                    <p className="text-amber-800 font-semibold text-sm">נדרש חשבון לקביעת תור</p>
                    <p className="text-gray-500 text-xs">יש להתחבר או להירשם כדי לקבוע תור</p>
                    <div className="flex gap-3 justify-center mt-2">
                      <Link
                        to={`/register?slug=${slug}`}
                        className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                      >
                        הרשמה
                      </Link>
                      <Link
                        to={`/login?redirect=/book/${slug}`}
                        className="bg-white border border-indigo-300 text-indigo-600 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition-colors"
                      >
                        כניסה
                      </Link>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">הערות (אופציונלי)</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="הוסף הערה..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                {bookingError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                    {bookingError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
              >
                חזור
              </button>
            )}
            {step < 5 ? (
              <button
                onClick={goNext}
                disabled={!canGoNext()}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-200 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
              >
                המשך
              </button>
            ) : (
              <button
                onClick={handleBook}
                disabled={booking || !isCustomer}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                {booking ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    קובע תור...
                  </>
                ) : '✓ אשר תור'}
              </button>
            )}
          </div>
        </div>
      )}

      {step === 0 && (
        <div className="max-w-lg mx-auto px-4 py-8 text-center">
          <p className="text-gray-400 text-sm">לחץ על הכפתור למעלה כדי להתחיל בתהליך קביעת התור</p>
        </div>
      )}
    </div>
  );
}
