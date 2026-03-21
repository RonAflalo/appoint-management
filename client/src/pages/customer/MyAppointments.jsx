import { useState, useEffect } from 'react';
import { getMyAppointments, cancelAppointment, acceptReschedule, getMyWaitlist, cancelWaitlistEntry, confirmWaitlistEntryInApp, getBusinessPolicy } from '../../api/user';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDateTime, isFuture } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';

const TABS = [
  { value: 'upcoming', label: 'עתידיים' },
  { value: 'past', label: 'עבר' },
  { value: 'waitlist', label: 'רשימת המתנה' },
];

export default function CustomerMyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [cancellationHours, setCancellationHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [busy, setBusy] = useState(null);
  const { addToast } = useToast();

  const load = async () => {
    try {
      const [apptData, wlData, policyData] = await Promise.all([
        getMyAppointments(),
        getMyWaitlist(),
        getBusinessPolicy().catch(() => null),
      ]);
      setAppointments(apptData.appointments || []);
      setWaitlist(wlData.waitlist || []);
      if (policyData?.cancellation_hours !== undefined) {
        setCancellationHours(policyData.cancellation_hours);
      }
    } catch {
      addToast('שגיאה בטעינת התורים', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const upcomingStatuses = ['pending', 'confirmed', 'reschedule_requested'];

  const upcomingAppointments = appointments.filter(
    a => isFuture(a.start_time) && upcomingStatuses.includes(a.status)
  ).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const pastAppointments = appointments.filter(
    a => !isFuture(a.start_time) || ['completed', 'cancelled'].includes(a.status)
  ).sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

  const displayedAppointments = activeTab === 'upcoming' ? upcomingAppointments : pastAppointments;

  const withBusy = async (id, fn, successMsg) => {
    setBusy(id);
    try {
      await fn();
      addToast(successMsg);
      load();
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = (id) => {
    if (!confirm('האם אתה בטוח שברצונך לבטל את התור?')) return;
    withBusy(id, () => cancelAppointment(id), 'התור בוטל בהצלחה');
  };

  const handleAcceptReschedule = (id) => {
    if (!confirm('לאשר את המועד החדש שהוצע?')) return;
    withBusy(id, () => acceptReschedule(id), 'המועד החדש אושר! ✅');
  };

  const handleCancelWaitlist = (id) => {
    if (!confirm('להסיר את עצמך מרשימת ההמתנה?')) return;
    withBusy(id, () => cancelWaitlistEntry(id), 'הוסרת מרשימת ההמתנה');
  };

  const handleConfirmWaitlist = (id) => {
    if (!confirm('לאשר את התור?')) return;
    withBusy(id, () => confirmWaitlistEntryInApp(id), 'התור אושר בהצלחה! ✅');
  };

  const canCancel = (appt) =>
    isFuture(appt.start_time) && ['pending', 'confirmed', 'reschedule_requested'].includes(appt.status);

  const isCancelBlocked = (appt) => {
    if (!canCancel(appt) || cancellationHours === 0) return false;
    const hoursUntil = (new Date(appt.start_time.replace(' ', 'T') + 'Z') - new Date()) / (1000 * 60 * 60);
    return hoursUntil < cancellationHours;
  };

  const tabCount = (tabValue) => {
    if (tabValue === 'upcoming') return upcomingAppointments.length;
    if (tabValue === 'past') return pastAppointments.length;
    return waitlist.length;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-headline font-extrabold text-3xl text-on-surface">התורים שלי</h1>
        <p className="text-on-surface-variant text-sm mt-1">{appointments.length} תורים סה"כ</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-container rounded-xl p-1 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${activeTab === tab.value
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant'}`}
          >
            {tab.label}
            <span className={`me-2 text-xs px-1.5 py-0.5 rounded-full
              ${activeTab === tab.value
                ? 'bg-primary/10 text-primary'
                : 'bg-surface-container-low text-on-surface-variant'}`}>
              {tabCount(tab.value)}
            </span>
          </button>
        ))}
      </div>

      {/* Waitlist tab */}
      {activeTab === 'waitlist' && !loading && (
        <div>
          {waitlist.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl p-12 text-center">
              <span className="text-5xl mb-4 block">⏳</span>
              <h3 className="text-lg font-medium text-on-surface mb-2">אינך ברשימת המתנה</h3>
              <p className="text-on-surface-variant text-sm">כשתגיע לשעה תפוסה תוכל להצטרף לרשימת ההמתנה</p>
            </div>
          ) : (
            <div className="space-y-4">
              {waitlist.map(entry => (
                <div key={entry.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-on-surface text-lg">{entry.service_name}</h3>
                      <p className="text-on-surface-variant text-sm">{entry.business_name}</p>
                      {entry.worker_name && (
                        <p className="text-on-surface-variant text-sm">עם {entry.worker_name}</p>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full
                      ${entry.status === 'notified'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'}`}>
                      {entry.status === 'notified' ? 'ממתין לאישורך' : 'בהמתנה'}
                    </span>
                  </div>
                  <div className="text-sm text-on-surface-variant mb-4">
                    <span>📅 </span>
                    {new Date(entry.slot_time).toLocaleString('he-IL', {
                      weekday: 'long', day: 'numeric', month: 'long',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                  {entry.status === 'notified' && entry.expires_at && (
                    <>
                      <div className="mb-3 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
                        <span className="font-semibold">התור זמין!</span> יש לך עד{' '}
                        {new Date(entry.expires_at.replace(' ', 'T') + 'Z').toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        {' '}לאשר.
                      </div>
                      <button
                        onClick={() => handleConfirmWaitlist(entry.id)}
                        disabled={busy === entry.id}
                        className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors mb-2"
                      >
                        {busy === entry.id ? 'מאשר...' : '✓ אשר את התור'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleCancelWaitlist(entry.id)}
                    disabled={busy === entry.id}
                    className="w-full py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {busy === entry.id ? 'מסיר...' : 'הסר מרשימת ההמתנה'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab !== 'waitlist' && loading ? (
        <LoadingSpinner />
      ) : activeTab !== 'waitlist' && !loading && displayedAppointments.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl p-12 text-center">
          <span className="text-5xl mb-4 block">{activeTab === 'upcoming' ? '📅' : '📋'}</span>
          <h3 className="text-lg font-medium text-on-surface mb-2">
            {activeTab === 'upcoming' ? 'אין תורים קרובים' : 'אין תורים בעבר'}
          </h3>
          <p className="text-on-surface-variant text-sm">
            {activeTab === 'upcoming' ? 'קבע תור חדש עכשיו!' : 'ההיסטוריה שלך תופיע כאן'}
          </p>
        </div>
      ) : activeTab !== 'waitlist' ? (
        <div className="space-y-4">
          {displayedAppointments.map(appt => (
            <div key={appt.id} className={`bg-surface-container-lowest rounded-2xl shadow-sm p-5 transition-colors
              ${appt.status === 'reschedule_requested' ? 'border border-orange-200' : 'border-none'}`}>

              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-on-surface text-lg">{appt.service_name}</h3>
                  <p className="text-on-surface-variant text-sm">עם {appt.worker_name}</p>
                </div>
                <StatusBadge status={appt.status} />
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <span>📅</span>
                  <span>{formatDateTime(appt.start_time)}</span>
                </div>
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <span>⏱️</span>
                  <span>{appt.duration_minutes} דקות</span>
                </div>
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <span>💰</span>
                  <span>₪{appt.price}</span>
                </div>
              </div>

              {appt.notes && (
                <div className="mb-3 text-xs text-on-surface-variant bg-surface-container-low rounded-lg p-2">
                  הערה: {appt.notes}
                </div>
              )}

              {/* Reschedule request banner */}
              {appt.status === 'reschedule_requested' && appt.suggested_time && (
                <div className="mb-4 bg-orange-50 border border-orange-200 rounded-2xl p-4">
                  <div className="font-semibold text-orange-800 mb-1">🔄 העובד מבקש לשנות את המועד</div>
                  <div className="text-sm text-orange-700 mb-1">
                    <span className="font-medium">מועד מוצע:</span> {formatDateTime(appt.suggested_time)}
                  </div>
                  {appt.reschedule_note && (
                    <div className="text-sm text-orange-600 mb-3">
                      <span className="font-medium">הערה:</span> {appt.reschedule_note}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptReschedule(appt.id)}
                      disabled={busy === appt.id}
                      className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                      {busy === appt.id ? '...' : '✓ אשר מועד חדש'}
                    </button>
                    {!isCancelBlocked(appt) && (
                      <button
                        onClick={() => handleCancel(appt.id)}
                        disabled={busy === appt.id}
                        className="flex-1 py-2 bg-surface-container-lowest border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                      >
                        ✕ בטל תור
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Regular cancel button for non-reschedule statuses */}
              {canCancel(appt) && appt.status !== 'reschedule_requested' && (
                isCancelBlocked(appt) ? (
                  <div className="w-full py-2.5 bg-surface-container border border-outline-variant/20 text-on-surface-variant/40 rounded-xl text-sm text-center">
                    ביטול אינו אפשרי (פחות מ-{cancellationHours} שעות לפני התור)
                  </div>
                ) : (
                  <button
                    onClick={() => handleCancel(appt.id)}
                    disabled={busy === appt.id}
                    className="w-full py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {busy === appt.id ? 'מבטל...' : 'בטל תור'}
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
