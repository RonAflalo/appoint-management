import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { getPublicServices, getPublicWorkers, getSlots, getAvailableDays, bookAppointment, addToWaitlist, getBusinessPolicy } from '../../api/user';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useToast } from '../../hooks/useToast';
import { toDateString, formatTime, formatDate } from '../../utils/dateUtils';

const STEPS = ['בחר שירות', 'בחר עובד', 'בחר תאריך', 'בחר שעה', 'אישור'];

export default function CustomerBook() {
  const [step, setStep] = useState(0);
  const [services, setServices] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [unavailableDates, setUnavailableDates] = useState(new Set());
  const [loadingData, setLoadingData] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingDays, setLoadingDays] = useState(false);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [booking, setBooking] = useState(false);
  const [notes, setNotes] = useState('');
  const [termsEnabled, setTermsEnabled] = useState(false);
  const [termsText, setTermsText] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [joinedWaitlist, setJoinedWaitlist] = useState(false);

  const [selectedService, setSelectedService] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState(null); // null = any
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const { addToast } = useToast();
  const navigate = useNavigate();
  const navRef = useRef(null);

  const scrollToNav = () => {
    if (navRef.current) {
      const rect = navRef.current.getBoundingClientRect();
      const bottomNavHeight = 100; // mobile bottom tab bar + padding
      const scrollAmount = rect.bottom - window.innerHeight + bottomNavHeight;
      if (scrollAmount > 0) {
        window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      }
    }
  };

  useEffect(() => {
    Promise.allSettled([getPublicServices(), getBusinessPolicy()])
      .then(([sRes, pRes]) => {
        if (sRes.status === 'fulfilled') setServices(sRes.value.services || []);
        if (pRes.status === 'fulfilled') {
          setTermsEnabled(!!pRes.value.terms_enabled);
          setTermsText(pRes.value.terms_text || '');
        }
      })
      .catch(() => addToast('שגיאה בטעינת נתונים', 'error'))
      .finally(() => setLoadingData(false));
  }, []);

  const fetchUnavailableDays = async (refDate, serviceOverride, workerOverride) => {
    const svc = serviceOverride ?? selectedService;
    const wrk = workerOverride !== undefined ? workerOverride : selectedWorker;
    if (!svc) return;
    setLoadingDays(true);
    try {
      const d = refDate || new Date();
      const params = {
        serviceId: svc.id,
        year: d.getFullYear(),
        month: d.getMonth() + 1, // 1-12
      };
      if (wrk) params.workerId = wrk.id;
      const data = await getAvailableDays(params);
      setUnavailableDates(new Set(data.unavailableDates || []));
    } catch {
      // silently ignore — the calendar just won't show red days
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
      const data = await getSlots(params);
      setSlots(data.slots || []);
      setBookedSlots(data.bookedSlots || []);
    } catch (e) {
      addToast('שגיאה בטעינת שעות פנויות', 'error');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    fetchSlots(date);
    scrollToNav();
  };

  const handleBook = async () => {
    if (!selectedService || !selectedSlot) return;
    setBooking(true);

    // Determine worker: if specific worker selected use that, otherwise find a worker with that slot
    let workerId = selectedWorker?.id;
    if (!workerId) {
      // Try to get slot workers from API if available (or just use first active worker)
      try {
        const params = { serviceId: selectedService.id, date: toDateString(selectedDate) };
        const data = await getSlots(params);
        const slotWorkers = data.slotWorkers;
        if (slotWorkers && slotWorkers[selectedSlot] && slotWorkers[selectedSlot].length > 0) {
          workerId = slotWorkers[selectedSlot][0];
        }
      } catch (e) {
        // fallback
      }
    }

    if (!workerId) {
      addToast('לא נמצא עובד זמין לשעה זו', 'error');
      setBooking(false);
      return;
    }

    try {
      await bookAppointment({
        workerId,
        serviceId: selectedService.id,
        start_time: selectedSlot,
        notes: notes || undefined,
        terms_accepted: termsEnabled ? termsAccepted : undefined,
      });
      addToast('התור נקבע בהצלחה!');
      navigate('/customer/appointments');
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה בקביעת התור', 'error');
    } finally {
      setBooking(false);
    }
  };

  const isBooked = (slot) => bookedSlots.includes(slot);

  const handleJoinWaitlist = async () => {
    if (!selectedService || !selectedSlot) return;
    setJoiningWaitlist(true);
    try {
      let workerId = selectedWorker?.id || null;
      await addToWaitlist({ serviceId: selectedService.id, workerId, slotTime: selectedSlot });
      setJoinedWaitlist(true);
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה בהצטרפות לרשימת המתנה', 'error');
    } finally {
      setJoiningWaitlist(false);
    }
  };

  const canGoNext = () => {
    if (step === 0) return !!selectedService;
    if (step === 1) return true; // worker is optional
    if (step === 2) return !!selectedDate;
    if (step === 3) return !!selectedSlot && !isBooked(selectedSlot);
    if (step === 4) return !termsEnabled || termsAccepted;
    return true;
  };

  const goNext = () => {
    if (step === 0 && selectedService) {
      // About to go to worker step: load workers filtered by selected service
      setLoadingWorkers(true);
      getPublicWorkers(selectedService.id)
        .then(d => setWorkers(d.workers || []))
        .catch(() => {})
        .finally(() => setLoadingWorkers(false));
    }
    if (step === 1) {
      // Entering the date-picker step: pre-load which days have no availability
      fetchUnavailableDays(selectedDate || new Date());
      if (selectedDate) fetchSlots(selectedDate);
    }
    if (step < 4) setStep(s => s + 1);
  };

  if (loadingData) return <LoadingSpinner />;

  if (joinedWaitlist) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-xl font-bold text-on-surface mb-2">נרשמת לרשימת המתנה!</h2>
        <p className="text-on-surface-variant text-sm mb-6">אם התור יתפנה נשלח לך מייל עם קישור לאישור — יש לך 30 דקות לאשר.</p>
        <button
          onClick={() => navigate('/customer/appointments')}
          className="px-6 py-3 primary-gradient text-white rounded-xl font-semibold transition-colors"
        >
          לתורים שלי
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-headline font-extrabold text-3xl text-on-surface">קביעת תור</h1>
        <p className="text-on-surface-variant text-sm mt-1">בחר שירות, עובד, תאריך ושעה</p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center mb-8 overflow-x-auto py-2 px-1">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center flex-shrink-0">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors
              ${i < step
                ? 'bg-emerald-500 text-white'
                : i === step
                  ? 'bg-primary text-white ring-4 ring-primary/20'
                  : 'bg-surface-container-high text-on-surface border-2 border-outline-variant'}`}>
              {i < step ? '✓' : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-8 mx-1 transition-colors ${i < step ? 'bg-emerald-500' : 'bg-outline-variant'}`}></div>
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 mb-6">
        <h2 className="text-lg font-semibold text-on-surface mb-4">{STEPS[step]}</h2>

        {/* Step 0: Service */}
        {step === 0 && (() => {
          const grouped = {};
          const uncategorized = [];
          for (const s of services) {
            if (s.category_id) {
              if (!grouped[s.category_id]) grouped[s.category_id] = { name: s.category_name, items: [] };
              grouped[s.category_id].items.push(s);
            } else {
              uncategorized.push(s);
            }
          }
          const renderService = (service) => (
            <button
              key={service.id}
              onClick={() => { setSelectedService(service); scrollToNav(); }}
              className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-right w-full
                ${selectedService?.id === service.id
                  ? 'border-primary bg-primary/10'
                  : 'border-outline-variant/20 hover:border-primary/40'}`}
            >
              <div>
                <div className="font-semibold text-on-surface">{service.name}</div>
                <div className="text-sm text-on-surface-variant mt-0.5">{service.duration_minutes} דקות</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-primary">₪{service.price}</div>
                {selectedService?.id === service.id && <div className="text-primary text-lg">✓</div>}
              </div>
            </button>
          );
          const hasCategories = Object.keys(grouped).length > 0;
          return (
            <div className="space-y-4">
              {Object.values(grouped).map(group => (
                <div key={group.name}>
                  <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">{group.name}</p>
                  <div className="grid grid-cols-1 gap-3">{group.items.map(renderService)}</div>
                </div>
              ))}
              {uncategorized.length > 0 && (
                <div className={hasCategories ? 'pt-1' : ''}>
                  <div className="grid grid-cols-1 gap-3">{uncategorized.map(renderService)}</div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Step 1: Worker */}
        {step === 1 && (
          <div className="space-y-3">
            {loadingWorkers ? (
              <div className="py-6 flex justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => { setSelectedWorker(null); scrollToNav(); }}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-right
                    ${selectedWorker === null
                      ? 'border-primary bg-primary/10'
                      : 'border-outline-variant/20 hover:border-primary/40'}`}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
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
                    onClick={() => { setSelectedWorker(worker); scrollToNav(); }}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-right
                      ${selectedWorker?.id === worker.id
                        ? 'border-primary bg-primary/10'
                        : 'border-outline-variant/20 hover:border-primary/40'}`}
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold">
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

        {/* Step 2: Date */}
        {step === 2 && (
          <div>
            <style>{`
              .unavailable-day {
                background: #fee2e2 !important;
                color: #b91c1c !important;
                border-radius: 6px;
                cursor: not-allowed !important;
                opacity: 0.7;
              }
              .unavailable-day:hover {
                background: #fecaca !important;
              }
              .unavailable-day abbr {
                text-decoration: line-through;
              }
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
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (date < today) return null; // past days handled by minDate
                const dateStr = toDateString(date);
                return unavailableDates.has(dateStr) ? 'unavailable-day' : null;
              }}
              tileDisabled={({ date, view }) => {
                if (view !== 'month') return false;
                return unavailableDates.has(toDateString(date));
              }}
              onActiveStartDateChange={({ activeStartDate, view }) => {
                if (view === 'month' && activeStartDate) {
                  fetchUnavailableDays(activeStartDate);
                }
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
                <div className="w-4 h-4 bg-surface-container-lowest rounded border border-outline-variant/30"></div>
                <span>זמין לתור</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Time slot */}
        {step === 3 && (
          <div>
            {loadingSlots ? (
              <LoadingSpinner />
            ) : slots.length === 0 && bookedSlots.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl mb-3 block">😔</span>
                <p className="text-on-surface-variant font-medium">אין שעות זמינות ביום זה</p>
                <p className="text-on-surface-variant/60 text-sm mt-1">נסה תאריך אחר</p>
                <button
                  onClick={() => setStep(2)}
                  className="mt-4 text-primary font-medium text-sm hover:text-primary/80"
                >
                  חזור לבחירת תאריך
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {[...slots, ...bookedSlots].sort().map(slot => {
                    const taken = isBooked(slot);
                    const selected = selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        onClick={() => { setSelectedSlot(slot); scrollToNav(); }}
                        className={`py-3 rounded-xl text-sm font-medium transition-all border
                          ${taken
                            ? selected
                              ? 'border-red-500 bg-red-500 text-white'
                              : 'bg-surface-container text-on-surface-variant/40 line-through cursor-not-allowed border-transparent'
                            : selected
                              ? 'border-primary bg-primary/10 text-primary font-semibold'
                              : 'bg-surface-container-lowest border-outline-variant/30 hover:border-primary hover:bg-primary/5 text-on-surface'}`}
                      >
                        <div>{formatTime(slot)}</div>
                        {taken && <div className="text-xs mt-0.5 opacity-80">תפוס</div>}
                      </button>
                    );
                  })}
                </div>
                {selectedSlot && isBooked(selectedSlot) && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
                    <p className="font-semibold mb-1">השעה הזו תפוסה</p>
                    <p className="text-amber-700 mb-3">ניתן להצטרף לרשימת המתנה — אם התור יתפנה תקבל הודעה במייל עם 30 דקות לאישור.</p>
                    <button
                      onClick={handleJoinWaitlist}
                      disabled={joiningWaitlist}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                      {joiningWaitlist ? 'מצטרף...' : 'הצטרף לרשימת המתנה'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="bg-primary/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">שירות</span>
                <span className="font-semibold text-on-surface">{selectedService?.name}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">עובד</span>
                <span className="font-semibold text-on-surface">{selectedWorker?.name || 'הקצאה אוטומטית'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">תאריך</span>
                <span className="font-semibold text-on-surface">
                  {selectedDate?.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">שעה</span>
                <span className="font-semibold text-on-surface">{selectedSlot ? formatTime(selectedSlot) : ''}</span>
              </div>
              <div className="border-t border-primary/20 pt-3 flex items-center justify-between text-sm">
                <span className="text-on-surface-variant">מחיר</span>
                <span className="font-bold text-primary text-lg">₪{selectedService?.price}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">הערות (אופציונלי)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="הוסף הערה לתור..."
                rows={3}
                className="w-full px-3 py-2 border border-outline-variant/30 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim resize-none bg-surface-container-lowest text-on-surface"
              />
            </div>

            {termsEnabled && termsText && (
              <div className="border border-outline-variant/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-on-surface mb-2">תנאי שימוש</p>
                <div className="text-xs text-on-surface-variant bg-surface-container-low rounded-lg p-3 max-h-32 overflow-y-auto mb-3 whitespace-pre-wrap">
                  {termsText}
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    className="w-4 h-4 text-primary rounded border-outline-variant/30 focus:ring-primary-fixed-dim"
                  />
                  <span className="text-sm text-on-surface">קראתי ואני מסכים/ה לתנאי השימוש</span>
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div ref={navRef} className="flex gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep(s => s - 1)}
            className="flex-1 py-3 text-on-surface rounded-xl font-bold transition-colors" style={{ backgroundColor: 'gainsboro' }}
          >
            חזור
          </button>
        )}
        {step < 4 ? (
          <button
            onClick={goNext}
            disabled={!canGoNext()}
            className="flex-1 py-3 primary-gradient disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-opacity"
          >
            המשך
          </button>
        ) : (
          <button
            onClick={handleBook}
            disabled={booking}
            className="flex-1 py-3 primary-gradient disabled:opacity-40 text-white rounded-xl font-bold transition-opacity flex items-center justify-center gap-2"
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
  );
}
