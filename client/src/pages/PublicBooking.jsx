import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { getBusinessInfo, getPublicServices, getPublicWorkers, getPublicSlots, getPublicAvailableDays, publicBook } from '../api/public';
import { addToWaitlist } from '../api/user';
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
  const [bookedSlots, setBookedSlots] = useState([]);
  const [unavailableDates, setUnavailableDates] = useState(new Set());

  const [loadingData, setLoadingData] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingDays, setLoadingDays] = useState(false);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [joinedWaitlist, setJoinedWaitlist] = useState(false);

  const [selectedService, setSelectedService] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [coverFailed, setCoverFailed] = useState(false);

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
    getPublicServices(slug)
      .then(sData => {
        setServices(sData.services || []);
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
    setBookedSlots([]);
    setSelectedSlot(null);
    try {
      const params = { serviceId: selectedService.id, date: toDateString(date) };
      if (selectedWorker) params.workerId = selectedWorker.id;
      const data = await getPublicSlots(slug, params);
      setSlots(data.slots || []);
      setBookedSlots(data.bookedSlots || []);
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
    if (!bookName || !bookEmail) {
      setBookingError('יש להזין שם ואימייל');
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
        terms_accepted: termsAccepted,
      });
      setBooked(true);
    } catch (err) {
      setBookingError(err.response?.data?.message || 'שגיאה בקביעת התור');
    } finally {
      setBooking(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!isCustomer || !selectedService || !selectedSlot) return;
    setJoiningWaitlist(true);
    setBookingError('');
    try {
      await addToWaitlist({ slug, serviceId: selectedService.id, workerId: selectedWorker?.id || null, slotTime: selectedSlot });
      setJoinedWaitlist(true);
    } catch (err) {
      setBookingError(err.response?.data?.message || 'שגיאה בהצטרפות לרשימת המתנה');
    } finally {
      setJoiningWaitlist(false);
    }
  };

  const goNext = () => {
    if (step === 1 && selectedService) {
      // About to show workers: load workers filtered by selected service
      setLoadingWorkers(true);
      getPublicWorkers(slug, selectedService.id)
        .then(d => setWorkers(d.workers || []))
        .catch(() => {})
        .finally(() => setLoadingWorkers(false));
    }
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
    // step 5: guest details required, terms if enabled
    if (step === 5) {
      const hasName = isCustomer ? true : !!guestName.trim();
      const hasEmail = isCustomer ? true : !!guestEmail.trim();
      const hasTerms = !business?.terms_enabled || termsAccepted;
      return hasName && hasEmail && hasTerms;
    }
    return true;
  };

  if (loadingBusiness) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-surface-container-low">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-on-surface-variant">טוען...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">😔</div>
          <h1 className="text-2xl font-bold text-on-surface mb-2">עסק לא נמצא</h1>
          <p className="text-on-surface-variant mb-6">הכתובת שחיפשת אינה קיימת במערכת</p>
          <Link to="/" className="primary-gradient text-white px-6 py-3 rounded-2xl font-medium transition-opacity hover:opacity-90">
            חזור לדף הבית
          </Link>
        </div>
      </div>
    );
  }

  if (!loadingBusiness && !notFound && !loadingData && !loadingWorkers && step >= 2 && workers.length === 0) {
    return (
      <div dir="rtl" className="min-h-screen bg-surface-container-low">
        <div className="text-white px-4 pt-10 pb-8 text-center" style={{ background: 'linear-gradient(135deg, #3525cd 0%, #712ae2 100%)' }}>
          {business?.logo_url ? (
            <img src={business.logo_url} alt={business.name} className="w-16 h-16 object-contain rounded-xl mx-auto mb-3 bg-white/10 p-1" onError={e => e.target.style.display='none'} />
          ) : (
            <div className="text-4xl mb-3">📅</div>
          )}
          <h1 className="text-2xl font-black mb-1">{business?.name}</h1>
          {business?.address && <p className="text-white/70 text-sm">{business.address}</p>}
          {(business?.phone || business?.instagram_url || business?.facebook_url) && (
            <div className="flex justify-center mt-3">
              <BusinessSocialLinks business={business} variant="light" />
            </div>
          )}
        </div>
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="text-5xl mb-4">🔧</div>
          <h2 className="text-xl font-bold text-on-surface mb-2">העסק עדיין לא מוכן לקביעת תורים</h2>
          <p className="text-on-surface-variant">בעל העסק טרם הגדיר עובדים. נסה שנית מאוחר יותר.</p>
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
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full mx-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-[0_32px_48px_-4px_rgba(25,28,30,0.08)] p-8 text-center">
            <span className="material-symbols-outlined text-6xl text-emerald-500 mb-4 block">check_circle</span>
            <h1 className="text-2xl font-bold text-on-surface mb-2">התור נקבע בהצלחה!</h1>
            <p className="text-on-surface-variant mb-2">אימייל אישור נשלח ל-<span className="font-medium text-on-surface">{(user?.role === 'user' ? user.email : null) || guestEmail}</span></p>
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 my-6 text-right space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">שירות</span>
                <span className="font-semibold">{selectedService?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">עובד</span>
                <span className="font-semibold">{selectedWorker?.name || 'הקצאה אוטומטית'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">תאריך ושעה</span>
                <span className="font-semibold">{selectedSlot ? formatTime(selectedSlot) : ''} — {selectedDate?.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
            <div className="space-y-3">
              {calUrl && (
                <a
                  href={calUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full border-2 border-primary/20 text-primary py-3 rounded-2xl font-medium hover:bg-primary/5 transition-colors text-sm"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                  </svg>
                  הוסף ליומן Google
                </a>
              )}
              <Link
                to="/customer"
                className="block w-full primary-gradient text-white py-3 rounded-xl font-medium text-center hover:opacity-90 transition-opacity"
              >
                עבור לעמוד הלקוח
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (joinedWaitlist) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full mx-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-[0_32px_48px_-4px_rgba(25,28,30,0.08)] p-8 text-center">
            <div className="text-6xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold text-on-surface mb-2">נוספת לרשימת המתנה!</h1>
            <p className="text-on-surface-variant mb-2">אם השעה תתפנה, נשלח לך אימייל עם קישור לאישור התור.</p>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 my-4 text-right space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">שירות</span>
                <span className="font-semibold">{selectedService?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">תאריך ושעה</span>
                <span className="font-semibold">{selectedSlot ? formatTime(selectedSlot) : ''} — {selectedDate?.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3 mb-4">
              ⏰ לאחר קבלת האימייל יהיו לך 30 דקות לאשר את התור — אחרת ייעבר ללקוח הבא בתור
            </p>
            <Link to="/customer" className="block w-full primary-gradient text-white py-3 rounded-xl font-medium hover:opacity-90 transition-opacity">
              עבור לעמוד הלקוח
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hasCover = !!business?.cover_url && !coverFailed;
  const hasSocial = business?.phone || business?.instagram_url || business?.facebook_url;

  return (
    <div dir="rtl" className="min-h-screen bg-surface-container-low">
      {/* Business hero header */}
      {hasCover ? (
        <div>
          {/* Cover image with business name/logo overlaid */}
          <div className="relative w-full h-44 sm:h-56 overflow-hidden">
            <img
              src={business.cover_url}
              alt={business.name}
              className="w-full h-full object-cover"
              onError={() => setCoverFailed(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex items-end gap-3">
              {business.logo_url ? (
                <img src={business.logo_url} alt={business.name} className="w-12 h-12 rounded-xl object-contain bg-white/20 p-1 flex-shrink-0" onError={e => e.target.style.display='none'} />
              ) : (
                <span className="text-3xl">📅</span>
              )}
              <div className="min-w-0">
                <h1 className="text-xl font-black text-white leading-tight">{business.name}</h1>
                {business.description && <p className="text-white/75 text-xs line-clamp-1 mt-0.5">{business.description}</p>}
              </div>
            </div>
          </div>
          {/* Social icons + address + CTA */}
          <div className="bg-surface-container-lowest shadow-sm border-b border-outline-variant/20">
            {hasSocial && (
              <div className="max-w-lg mx-auto px-4 pt-4 pb-1 flex justify-center">
                <BusinessSocialLinks business={business} variant="dark" />
              </div>
            )}
            {step === 0 && (
              <div className="px-4 py-4 flex flex-col items-center gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="w-full max-w-xs primary-gradient text-white font-bold px-8 py-3 rounded-2xl hover:opacity-90 transition-opacity shadow"
                >
                  קבע תור עכשיו
                </button>
                {isCustomer ? (
                  <p className="text-on-surface-variant text-sm">שלום, {user.name} 👋</p>
                ) : (
                  <p className="text-on-surface-variant text-sm">
                    <Link to={`/login?redirect=/book/${slug}`} className="text-primary font-bold underline">כניסה</Link>
                    {' '}/{' '}
                    <Link to={`/register?slug=${slug}`} className="text-primary font-bold underline">הרשמה</Link>
                    {' '}לחוויה מהירה יותר
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="text-white px-4 pt-10 pb-8 text-center" style={{ background: 'linear-gradient(135deg, #3525cd 0%, #712ae2 100%)' }}>
            {business?.logo_url ? (
              <img src={business.logo_url} alt={business.name} className="w-16 h-16 object-contain rounded-xl mx-auto mb-3 bg-white/10 p-1" onError={e => e.target.style.display='none'} />
            ) : (
              <div className="text-4xl mb-3">📅</div>
            )}
            <h1 className="text-2xl font-black mb-1">{business?.name}</h1>
            {business?.description && <p className="text-white/70 text-sm mt-1 max-w-md mx-auto">{business.description}</p>}
          </div>
          <div className="bg-surface-container-lowest shadow-sm border-b border-outline-variant/20">
            {hasSocial && (
              <div className="max-w-lg mx-auto px-4 pt-4 pb-1 flex justify-center">
                <BusinessSocialLinks business={business} variant="dark" />
              </div>
            )}
            {step === 0 && (
              <div className="px-4 py-4 flex flex-col items-center gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="w-full max-w-xs primary-gradient text-white font-bold px-8 py-3 rounded-2xl hover:opacity-90 transition-opacity shadow"
                >
                  קבע תור עכשיו
                </button>
                {isCustomer ? (
                  <p className="text-on-surface-variant text-sm">שלום, {user.name} 👋</p>
                ) : (
                  <p className="text-on-surface-variant text-sm">
                    <Link to={`/login?redirect=/book/${slug}`} className="text-primary font-bold underline">כניסה</Link>
                    {' '}/{' '}
                    <Link to={`/register?slug=${slug}`} className="text-primary font-bold underline">הרשמה</Link>
                    {' '}לחוויה מהירה יותר
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {step > 0 && (
        <div className="max-w-lg mx-auto px-4 py-6">
          {/* Step indicator */}
          <div className="flex items-center justify-center mb-6 overflow-x-auto pb-1">
            {STEPS.slice(1).map((s, i) => (
              <div key={i} className="flex items-center flex-shrink-0">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors
                  ${i + 1 < step ? 'bg-primary text-white'
                    : i + 1 === step ? 'bg-primary text-white ring-4 ring-primary/20'
                    : 'bg-surface-container text-on-surface-variant'}`}>
                  {i + 1 < step ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 2 && (
                  <div className={`h-0.5 w-6 mx-1 transition-colors ${i + 1 < step ? 'bg-primary' : 'bg-surface-container'}`}></div>
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/20 p-5 mb-4">
            <h2 className="text-on-surface text-lg font-headline font-bold mb-4">{STEPS[step]}</h2>

            {/* Step 1: Service */}
            {step === 1 && (
              <div className="space-y-3">
                {loadingData ? (
                  <div className="text-center py-8 text-on-surface-variant">טוען שירותים...</div>
                ) : services.map(service => (
                  <button
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-right
                      ${selectedService?.id === service.id ? 'border-primary bg-primary/10' : 'border-outline-variant/20 hover:border-outline-variant'}`}
                  >
                    <div>
                      <div className="font-semibold text-on-surface">{service.name}</div>
                      <div className="text-sm text-on-surface-variant mt-0.5">{service.duration_minutes} דקות</div>
                    </div>
                    <div className="text-right">
                      <div className="text-primary font-bold text-lg">₪{service.price}</div>
                      {selectedService?.id === service.id && <div className="text-primary">✓</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Worker */}
            {step === 2 && (
              <div className="space-y-3">
                {loadingWorkers ? (
                  <div className="py-6 flex justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setSelectedWorker(null)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-right
                        ${selectedWorker === null ? 'border-primary bg-primary/10' : 'border-outline-variant/20 hover:border-outline-variant'}`}
                    >
                      <div className="w-10 h-10 primary-gradient rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        כ
                      </div>
                      <div>
                        <div className="font-semibold text-on-surface">כל עובד זמין</div>
                        <div className="text-sm text-on-surface-variant">הצג שעות זמינות לכל העובדים</div>
                      </div>
                      {selectedWorker === null && <span className="mr-auto text-primary text-lg">✓</span>}
                    </button>
                    {workers.map(worker => (
                      <button
                        key={worker.id}
                        onClick={() => setSelectedWorker(worker)}
                        className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-right
                          ${selectedWorker?.id === worker.id ? 'border-primary bg-primary/10' : 'border-outline-variant/20 hover:border-outline-variant'}`}
                      >
                        <div className="w-10 h-10 bg-secondary/20 text-secondary rounded-full flex items-center justify-center font-bold flex-shrink-0">
                          {worker.name[0]}
                        </div>
                        <div className="font-semibold text-on-surface">{worker.name}</div>
                        {selectedWorker?.id === worker.id && <span className="mr-auto text-primary text-lg">✓</span>}
                      </button>
                    ))}
                  </>
                )}
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
                  <p className="text-xs text-on-surface-variant text-center mb-2 flex items-center justify-center gap-1">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-surface-container border-t-on-surface-variant"></span>
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
                  <p className="mt-3 text-sm text-primary font-medium text-center">
                    נבחר: {selectedDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-4 text-xs text-on-surface-variant justify-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-red-100 rounded border border-red-200"></div>
                    <span>אין זמינות</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-surface-container-lowest rounded border border-outline-variant/20"></div>
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
                    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="text-4xl mb-3 block">😔</span>
                    <p className="text-on-surface-variant font-medium">אין שעות זמינות ביום זה</p>
                    <button onClick={() => setStep(3)} className="mt-4 text-primary font-medium text-sm hover:opacity-80">
                      חזור לבחירת תאריך
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {[...slots, ...bookedSlots].sort().map(slot => {
                      const isTaken = bookedSlots.includes(slot);
                      return (
                        <button
                          key={slot}
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-3 rounded-xl text-sm font-medium transition-all border-2
                            ${selectedSlot === slot && isTaken
                              ? 'border-red-500 bg-red-500 text-white'
                              : selectedSlot === slot
                              ? 'border-primary bg-primary text-white'
                              : isTaken
                              ? 'border-red-200 bg-red-50 text-red-400 hover:bg-red-100'
                              : 'border-outline-variant/20 hover:border-primary text-on-surface hover:bg-primary/5'
                            }`}
                        >
                          {formatTime(slot)}
                          {isTaken && <span className="block text-xs opacity-70">תפוס</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Details */}
            {step === 5 && (
              <div className="space-y-4">
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-on-surface-variant">שירות</span>
                    <span className="font-semibold">{selectedService?.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-on-surface-variant">עובד</span>
                    <span className="font-semibold">{selectedWorker?.name || 'הקצאה אוטומטית'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-on-surface-variant">תאריך</span>
                    <span className="font-semibold">{selectedDate?.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-on-surface-variant">שעה</span>
                    <span className="font-semibold">{selectedSlot ? formatTime(selectedSlot) : ''}</span>
                  </div>
                  <div className="border-t border-primary/20 pt-2 flex items-center justify-between text-sm">
                    <span className="text-on-surface-variant">מחיר</span>
                    <span className="text-primary font-bold text-lg">₪{selectedService?.price}</span>
                  </div>
                </div>

                {isCustomer ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                      {user.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-green-800">מזמין כ-{user.name}</p>
                      <p className="text-xs text-green-600">{user.email}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-on-surface">פרטי ההזמנה</p>
                      <span className="text-xs text-on-surface-variant">
                        יש לך חשבון?{' '}
                        <Link to={`/login?redirect=/book/${slug}`} className="text-primary font-bold underline">
                          כניסה
                        </Link>
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-on-surface mb-1">שם מלא *</label>
                      <input
                        type="text"
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                        placeholder="ישראל ישראלי"
                        className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-on-surface mb-1">אימייל *</label>
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={e => setGuestEmail(e.target.value)}
                        placeholder="you@example.com"
                        dir="ltr"
                        className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
                      />
                      <p className="text-xs text-on-surface-variant mt-1">ישלח אישור תור + קישור להגדרת סיסמה</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-on-surface mb-1.5">הערות (אופציונלי)</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="הוסף הערה..."
                    rows={3}
                    className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim resize-none"
                  />
                </div>
                {business?.terms_enabled && business?.terms_text && (
                  <div className="border border-outline-variant/20 rounded-2xl p-4">
                    <p className="text-xs font-semibold text-on-surface mb-2">תנאי שימוש</p>
                    <div className="text-xs text-on-surface-variant bg-surface-container-low rounded-lg p-3 max-h-32 overflow-y-auto mb-3 whitespace-pre-wrap">
                      {business.terms_text}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={e => setTermsAccepted(e.target.checked)}
                        className="w-4 h-4 text-primary rounded border-outline-variant/20 focus:ring-primary"
                      />
                      <span className="text-sm text-on-surface">קראתי ואני מסכים/ה לתנאי השימוש</span>
                    </label>
                  </div>
                )}
                {selectedSlot && bookedSlots.includes(selectedSlot) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <p className="text-amber-800 font-semibold text-sm">⏳ השעה שבחרת תפוסה</p>
                    <p className="text-amber-600 text-xs mt-1">הצטרף לרשימת המתנה — אם תתפנה נודיע לך במייל ויהיו לך 30 דקות לאשר</p>
                  </div>
                )}
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
                className="flex-1 py-3 bg-surface-container hover:opacity-80 text-on-surface-variant rounded-xl font-medium transition-opacity"
              >
                חזור
              </button>
            )}
            {step < 5 ? (
              <button
                onClick={goNext}
                disabled={!canGoNext()}
                className="flex-1 py-3 primary-gradient disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-opacity"
              >
                המשך
              </button>
            ) : bookedSlots.includes(selectedSlot) ? (
              <button
                onClick={handleJoinWaitlist}
                disabled={joiningWaitlist || !isCustomer}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                {joiningWaitlist ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    מצטרף...
                  </>
                ) : '⏳ הצטרף לרשימת המתנה'}
              </button>
            ) : (
              <button
                onClick={handleBook}
                disabled={booking || !canGoNext()}
                className="flex-1 py-3 primary-gradient disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-opacity flex items-center justify-center gap-2"
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
          <p className="text-on-surface-variant text-sm">לחץ על הכפתור למעלה כדי להתחיל בתהליך קביעת התור</p>
        </div>
      )}
    </div>
  );
}
