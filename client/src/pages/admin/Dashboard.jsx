import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getAppointments, getWorkers, getSettings, updateAppointmentStatus, requestAdminReschedule, getDashboardStats } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { formatDateTime, toDateString } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';

const HE_DAYS_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState(null);
  const [copied, setCopied] = useState(false);
  const [detailAppt, setDetailAppt] = useState(null);
  const [rescheduleAppt, setRescheduleAppt] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleNote, setRescheduleNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dashStats, setDashStats] = useState(null);
  const [dashTab, setDashTab] = useState('upcoming');
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.allSettled([
      getAppointments({}),
      getWorkers(),
      getSettings(),
      getDashboardStats(),
    ]).then(([apptRes, workersRes, settingsRes, statsRes]) => {
      if (apptRes.status === 'fulfilled') setAppointments(apptRes.value.appointments || []);
      if (workersRes.status === 'fulfilled') setWorkers(workersRes.value.workers || []);
      if (settingsRes.status === 'fulfilled') {
        if (settingsRes.value.business?.slug) setSlug(settingsRes.value.business.slug);
        if (settingsRes.value.business?.onboarding_complete === 0) {
          navigate('/admin/onboarding', { replace: true });
        }
      }
      if (statsRes.status === 'fulfilled') setDashStats(statsRes.value);
    }).finally(() => setLoading(false));
  }, []);

  const bookingLink = slug ? `${window.location.origin}/book/${slug}` : null;

  const handleCopy = () => {
    if (!bookingLink) return;
    navigator.clipboard.writeText(bookingLink).then(() => {
      setCopied(true);
      addToast('הקישור הועתק!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const today = toDateString(new Date());
  const todayAppointments = appointments.filter(a => a.start_time.startsWith(today));
  const pendingAppointments = appointments.filter(a => a.status === 'pending');
  const customers = [...new Set(appointments.map(a => a.customer_id))];

  const activeWorkers = workers.filter(w => w.is_active);

  const revenueThisMonth = dashStats?.revenueThisMonth ?? null;
  const revenueLastMonth = dashStats?.revenueLastMonth ?? null;
  const revPctChange = revenueLastMonth && revenueLastMonth > 0
    ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
    : null;

  const stats = [
    { label: 'תורים היום', value: todayAppointments.length, icon: 'calendar_today', iconColor: 'text-blue-500', iconBg: 'bg-blue-50' },
    { label: 'ממתינים לאישור', value: pendingAppointments.length, icon: 'hourglass_empty', iconColor: 'text-amber-500', iconBg: 'bg-amber-50', onClick: () => navigate('/admin/appointments?status=pending') },
    { label: 'לקוחות סה"כ', value: customers.length, icon: 'person', iconColor: 'text-purple-500', iconBg: 'bg-purple-50' },
  ];

  // Compute upcoming and past appointments for the dashboard tabs
  // DB stores start_time as "YYYY-MM-DD HH:MM:SS", compare with "YYYY-MM-DD HH:MM"
  const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const tomorrowStr = toDateString(new Date(Date.now() + 86400000));

  const todayUpcoming = appointments
    .filter(a => a.start_time.startsWith(today) && a.start_time > nowStr && ['pending', 'confirmed'].includes(a.status))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const tomorrowUpcoming = appointments
    .filter(a => a.start_time.startsWith(tomorrowStr) && ['pending', 'confirmed'].includes(a.status))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const upcomingAppointments = todayUpcoming.length > 0 ? todayUpcoming : tomorrowUpcoming;
  const upcomingDayLabel = todayUpcoming.length > 0 ? 'היום' : 'מחר';

  const pastAppointments = appointments
    .filter(a => ['completed', 'cancelled'].includes(a.status))
    .sort((a, b) => b.start_time.localeCompare(a.start_time))
    .slice(0, 10);

  const tabAppointments = dashTab === 'upcoming' ? upcomingAppointments : pastAppointments;

  const handleStatus = async (id, status) => {
    try {
      await updateAppointmentStatus(id, status);
      addToast(status === 'confirmed' ? 'התור אושר' : status === 'cancelled' ? 'התור בוטל' : 'הסטטוס עודכן');
      setDetailAppt(prev => prev?.id === id ? { ...prev, status } : prev);
      const apptData = await getAppointments({});
      setAppointments(apptData.appointments || []);
    } catch {
      addToast('שגיאה בעדכון סטטוס', 'error');
    }
  };

  const openReschedule = (appt, e) => {
    e?.stopPropagation();
    setRescheduleAppt(appt);
    setRescheduleDate(toDateString(new Date()));
    setRescheduleTime('');
    setRescheduleNote('');
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleDate || !rescheduleTime) { addToast('יש לבחור תאריך ושעה', 'error'); return; }
    setSubmitting(true);
    try {
      await requestAdminReschedule(rescheduleAppt.id, { suggested_time: `${rescheduleDate}T${rescheduleTime}:00`, note: rescheduleNote || undefined });
      addToast('בקשת שינוי המועד נשלחה ללקוח');
      setRescheduleAppt(null);
      const apptData = await getAppointments({});
      setAppointments(apptData.appointments || []);
    } catch (err) {
      addToast(err.response?.data?.message || 'שגיאה בשליחת הבקשה', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const ActionButtons = ({ appt }) => (
    <div className="flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
      {appt.status === 'pending' && (<>
        <button onClick={() => handleStatus(appt.id, 'confirmed')} className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl text-xs font-semibold transition-colors">אשר</button>
        <button onClick={(e) => openReschedule(appt, e)} className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-xl text-xs font-semibold transition-colors">שנה מועד</button>
        <button onClick={() => handleStatus(appt.id, 'cancelled')} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-error rounded-xl text-xs font-semibold transition-colors">בטל</button>
      </>)}
      {appt.status === 'confirmed' && (<>
        <button onClick={() => handleStatus(appt.id, 'completed')} className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-semibold transition-colors">הושלם</button>
        <button onClick={(e) => openReschedule(appt, e)} className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-xl text-xs font-semibold transition-colors">שנה מועד</button>
        <button onClick={() => handleStatus(appt.id, 'cancelled')} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-error rounded-xl text-xs font-semibold transition-colors">בטל</button>
      </>)}
      {appt.status === 'reschedule_requested' && (
        <button onClick={() => handleStatus(appt.id, 'cancelled')} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-error rounded-xl text-xs font-semibold transition-colors">בטל</button>
      )}
      {(appt.status === 'completed' || appt.status === 'cancelled') && <span className="text-xs text-on-surface-variant">—</span>}
    </div>
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-headline font-extrabold text-3xl text-on-surface">דשבורד</h1>
        <p className="text-on-surface-variant text-sm mt-1">סקירה כללית של העסק</p>
      </div>

      {activeWorkers.filter(w => w.is_worker || w.role === 'worker').length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <span className="text-amber-500 text-xl flex-shrink-0">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800 text-sm">לא הוגדרו עובדים</p>
            <p className="text-amber-700 text-sm mt-0.5">
              כדי שלקוחות יוכלו לקבוע תורים, יש להוסיף לפחות עובד אחד פעיל.{' '}
              <Link to="/admin/workers" className="font-bold underline hover:no-underline">הוסף עובד עכשיו</Link>
            </p>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, i) => (
          <div
            key={i}
            className={`bg-surface-container-lowest rounded-2xl shadow-sm p-6 ${stat.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
            onClick={stat.onClick}
          >
            <div className="mb-3">
              <span className={`material-symbols-outlined text-2xl p-2 rounded-xl ${stat.iconColor} ${stat.iconBg}`}>{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold text-on-surface">{stat.value}</div>
            <div className="text-sm text-on-surface-variant mt-1">{stat.label}</div>
          </div>
        ))}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6">
          <div className="mb-3">
            <span className="material-symbols-outlined text-2xl p-2 rounded-xl text-green-600 bg-green-50">payments</span>
          </div>
          <div className="text-2xl font-bold text-on-surface">
            {revenueThisMonth !== null ? `₪${revenueThisMonth.toLocaleString()}` : '—'}
          </div>
          <div className="text-sm text-on-surface-variant mt-1">הכנסות החודש</div>
          {revPctChange !== null && (
            <div className={`text-xs font-medium mt-1 ${revPctChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {revPctChange >= 0 ? '▲' : '▼'} {Math.abs(revPctChange)}% מהחודש שעבר
            </div>
          )}
        </div>
      </div>

      {/* Weekly Revenue Chart + Upcoming Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {dashStats?.weeklyRevenue && (
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
            <h3 className="font-headline font-bold text-lg text-on-surface mb-4">הכנסות — 7 הימים האחרונים</h3>
            {(() => {
              const data = dashStats.weeklyRevenue;
              const maxRev = Math.max(...data.map(d => d.revenue), 1);
              return (
                <div className="flex items-end gap-1.5 h-28">
                  {data.map((d, i) => {
                    const dateObj = new Date(d.date + 'T00:00:00');
                    const dayShort = HE_DAYS_SHORT[dateObj.getDay()];
                    const barH = Math.max((d.revenue / maxRev) * 100, d.revenue > 0 ? 4 : 0);
                    const isToday = d.date === today;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        {d.revenue > 0 && (
                          <span className="text-xs text-on-surface-variant" style={{ fontSize: '10px' }}>₪{d.revenue}</span>
                        )}
                        <div className="w-full flex items-end" style={{ height: '80px' }}>
                          <div
                            className="w-full rounded-t-md transition-all"
                            style={{ height: `${barH}%`, backgroundColor: isToday ? '#3525cd' : 'rgba(53,37,205,0.2)' }}
                            title={`${d.date}: ₪${d.revenue}`}
                          />
                        </div>
                        <span className="text-xs font-medium" style={{ color: isToday ? '#3525cd' : '#464555' }}>{dayShort}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* 7-day upcoming appointments strip — click navigates with date filter */}
        {dashStats?.upcomingByDay && (
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5">
            <h3 className="font-headline font-bold text-lg text-on-surface mb-4">תורים — 7 ימים קרובים</h3>
            <div className="grid grid-cols-7 gap-1">
              {dashStats.upcomingByDay.map((d, i) => {
                const dateObj = new Date(d.date + 'T00:00:00');
                const dayShort = HE_DAYS_SHORT[dateObj.getDay()];
                const dayNum = dateObj.getDate();
                const isToday = d.date === today;
                return (
                  <button
                    key={i}
                    onClick={() => navigate(`/admin/appointments?date=${d.date}`)}
                    className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all cursor-pointer hover:border-primary/40
                      ${isToday ? 'border-primary bg-primary-fixed' : 'border-outline-variant/20 hover:bg-surface-container-low'}`}
                  >
                    <span className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-on-surface-variant'}`}>{dayShort}</span>
                    <span className={`text-sm font-bold mt-0.5 ${isToday ? 'text-primary' : 'text-on-surface'}`}>{dayNum}</span>
                    {d.count > 0 ? (
                      <span className={`mt-1 text-xs font-bold px-1.5 py-0.5 rounded-full ${isToday ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                        {d.count}
                      </span>
                    ) : (
                      <span className="mt-1 text-xs text-on-surface-variant/40">—</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Booking link card */}
      {bookingLink && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-primary-fixed rounded-2xl text-primary text-lg">🔗</div>
            <div>
              <h3 className="font-semibold text-on-surface text-sm">הקישור שלך להזמנות</h3>
              <p className="text-xs text-on-surface-variant">שתף קישור זה עם הלקוחות שלך</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-surface-container-low rounded-xl px-3 py-2 text-sm">
            <span className="text-primary font-mono truncate flex-1">{bookingLink}</span>
            <button
              onClick={handleCopy}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                copied ? 'bg-green-100 text-green-700' : 'primary-gradient text-white'
              }`}
            >
              {copied ? '✓ הועתק' : 'העתק קישור'}
            </button>
            <a
              href={bookingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors"
            >
              פתח
            </a>
          </div>
        </div>
      )}

      {/* Appointments section with tab toggle */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
          <h2 className="font-headline font-bold text-lg text-on-surface">
            {dashTab === 'upcoming' ? `תורים ${upcomingDayLabel}` : 'תורים — עבר'}
          </h2>
          <div className="flex bg-surface-container p-1 rounded-xl gap-1">
            <button
              onClick={() => setDashTab('upcoming')}
              className={`px-3 py-1 rounded-xl text-sm font-medium transition-colors ${dashTab === 'upcoming' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              קרובים
            </button>
            <button
              onClick={() => setDashTab('past')}
              className={`px-3 py-1 rounded-xl text-sm font-medium transition-colors ${dashTab === 'past' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              עבר
            </button>
          </div>
        </div>
        {tabAppointments.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant">
            <span className="text-4xl mb-3 block">📅</span>
            <p>{dashTab === 'upcoming' ? 'אין תורים קרובים' : 'אין תורים עבר'}</p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/20">
            {tabAppointments.map(appt => (
              <div
                key={appt.id}
                className="px-6 py-3 hover:bg-surface-container-low cursor-pointer flex items-center justify-between gap-4"
                onClick={() => setDetailAppt(appt)}
              >
                <div className="min-w-0">
                  <div className="font-medium text-on-surface text-sm truncate">{appt.customer_name}</div>
                  <div className="text-xs text-on-surface-variant truncate">{appt.service_name} • {appt.worker_name}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-xs text-on-surface-variant whitespace-nowrap">{formatDateTime(appt.start_time)}</div>
                  <StatusBadge status={appt.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!detailAppt} onClose={() => setDetailAppt(null)} title="פרטי תור">
        {detailAppt && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <StatusBadge status={detailAppt.status} />
              {detailAppt.status === 'reschedule_requested' && detailAppt.suggested_time && (
                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-xl">מוצע: {formatDateTime(detailAppt.suggested_time)}</span>
              )}
            </div>
            <div className="bg-surface-container-low rounded-2xl p-4 space-y-1.5">
              <p className="text-xs text-on-surface-variant font-medium uppercase">לקוח</p>
              <p className="font-semibold text-on-surface">{detailAppt.customer_name}</p>
              <p className="text-sm text-on-surface-variant" dir="ltr">{detailAppt.customer_email}</p>
              {detailAppt.customer_phone && <p className="text-sm text-on-surface-variant" dir="ltr">{detailAppt.customer_phone}</p>}
            </div>
            <div className="bg-surface-container-low rounded-2xl p-4 space-y-2.5">
              <p className="text-xs text-on-surface-variant font-medium uppercase">פרטי התור</p>
              <div className="grid grid-cols-2 gap-y-2.5 text-sm">
                <div><p className="text-xs text-on-surface-variant">שירות</p><p className="text-on-surface font-medium">{detailAppt.service_name}</p></div>
                <div><p className="text-xs text-on-surface-variant">מחיר</p><p className="text-on-surface font-medium">₪{detailAppt.price}</p></div>
                <div><p className="text-xs text-on-surface-variant">משך</p><p className="text-on-surface font-medium">{detailAppt.duration_minutes} דק'</p></div>
                <div><p className="text-xs text-on-surface-variant">עובד</p><p className="text-on-surface font-medium">{detailAppt.worker_name}</p></div>
                <div className="col-span-2"><p className="text-xs text-on-surface-variant">תאריך ושעה</p><p className="text-on-surface font-medium">{formatDateTime(detailAppt.start_time)}</p></div>
              </div>
            </div>
            {detailAppt.notes && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-3 text-sm text-yellow-800">
                <p className="text-xs text-yellow-600 font-medium mb-1">הערת לקוח</p>
                {detailAppt.notes}
              </div>
            )}
            <div className="pt-1"><ActionButtons appt={detailAppt} /></div>
          </div>
        )}
      </Modal>

      {/* Reschedule Modal */}
      <Modal isOpen={!!rescheduleAppt} onClose={() => setRescheduleAppt(null)} title="בקשת שינוי מועד">
        {rescheduleAppt && (
          <form onSubmit={handleReschedule} className="space-y-4">
            <div className="bg-surface-container-low rounded-2xl p-3 text-sm text-on-surface-variant">
              <div>{rescheduleAppt.customer_name} — {rescheduleAppt.service_name}</div>
              <div className="text-xs text-on-surface-variant/70 mt-0.5">מועד נוכחי: {formatDateTime(rescheduleAppt.start_time)}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">תאריך חדש מוצע</label>
              <input type="date" value={rescheduleDate} min={toDateString(new Date())} onChange={e => setRescheduleDate(e.target.value)} className="w-full px-3 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">שעה חדשה מוצעת</label>
              <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} className="w-full px-3 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">הערה ללקוח (אופציונלי)</label>
              <textarea value={rescheduleNote} onChange={e => setRescheduleNote(e.target.value)} rows={2} className="w-full px-3 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim resize-none" placeholder="סיבה לשינוי..." />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={submitting} className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl text-sm font-bold transition-colors">{submitting ? 'שולח...' : 'שלח בקשה ללקוח'}</button>
              <button type="button" onClick={() => setRescheduleAppt(null)} className="flex-1 py-2 bg-surface-container text-on-surface hover:bg-surface-container-high rounded-xl text-sm font-medium transition-colors">ביטול</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
