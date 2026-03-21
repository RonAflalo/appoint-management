import { useState, useEffect, useRef, useCallback } from 'react';
import { getNotifications, markNotificationsSeen } from '../../api/admin';

const TYPE_ICONS = {
  new_appointment: 'event',
  appointment_cancelled: 'cancel',
  appointment_completed: 'check_circle',
  new_customer: 'person_add',
  reschedule_accepted: 'event_available',
  reschedule_cancelled: 'event_busy',
  waitlist_joined: 'queue',
  waitlist_opened: 'notifications_active',
  worker_cancelled: 'person_off',
};

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr.replace(' ', 'T') + 'Z').getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'עכשיו';
  if (diffMin < 60) return `לפני ${diffMin} דקות`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `לפני ${diffH} שעות`;
  const diffD = Math.floor(diffH / 24);
  return `לפני ${diffD} ימים`;
}

export default function NotificationBell({ getNotifsFn = getNotifications, markSeenFn = markNotificationsSeen }) {
  const [notifications, setNotifications] = useState([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotifsFn();
      setNotifications(data.notifications || []);
      setUnseenCount(data.unseenCount || 0);
    } catch (_) {}
  }, [getNotifsFn]);

  // Initial fetch + polling every 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleOpen = async () => {
    const wasOpen = open;
    setOpen(!wasOpen);
    if (!wasOpen && unseenCount > 0) {
      try {
        await markSeenFn();
        setUnseenCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, seen: 1 })));
      } catch (_) {}
    }
  };

  const handleMarkAllSeen = async () => {
    try {
      await markSeenFn();
      setUnseenCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, seen: 1 })));
    } catch (_) {}
  };

  return (
    <div className="relative flex-shrink-0">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="relative w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
        aria-label="התראות"
      >
        <span className="material-symbols-outlined text-xl">notifications</span>
        {unseenCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
            {unseenCount > 99 ? '99+' : unseenCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-12 w-80 bg-surface-container-lowest rounded-2xl shadow-xl z-50 overflow-hidden border border-outline-variant/20"
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20">
            <span className="text-sm font-semibold text-on-surface">התראות</span>
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllSeen}
                className="text-xs text-[#3525cd] hover:underline font-medium"
              >
                סמן הכל כנקרא
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-on-surface-variant">
                אין התראות
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-outline-variant/10 last:border-b-0 transition-colors ${n.seen ? '' : 'bg-blue-50/60'}`}
                >
                  {/* Unread dot */}
                  <div className="flex-shrink-0 mt-1 w-2 flex items-center justify-center">
                    {!n.seen && (
                      <span className="w-2 h-2 rounded-full bg-[#3525cd] block" />
                    )}
                  </div>

                  {/* Icon */}
                  <span className="material-symbols-outlined text-xl text-on-surface-variant flex-shrink-0 mt-0.5">
                    {TYPE_ICONS[n.type] || 'info'}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface leading-snug">{n.message}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
