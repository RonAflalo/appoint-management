import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import {
  getAppointments, updateAppointmentStatus, getWorkers, requestAdminReschedule,
  getAppointmentPhotos, addAppointmentPhoto, deleteAppointmentPhoto,
} from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import ThreeDotMenu from '../../components/common/ThreeDotMenu';
import { formatDateTime, toDateString } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';

const STATUS_LABELS = { pending: 'ממתין', confirmed: 'מאושר', completed: 'הושלם', cancelled: 'בוטל', reschedule_requested: 'שינוי מועד' };

function exportCSV(appointments) {
  const headers = ['לקוח', 'אימייל', 'טלפון', 'שירות', 'עובד', 'תאריך ושעה', 'מחיר', 'סטטוס', 'הערות'];
  const rows = appointments.map(a => [
    a.customer_name, a.customer_email, a.customer_phone || '',
    a.service_name, a.worker_name, formatDateTime(a.start_time),
    a.price, STATUS_LABELS[a.status] || a.status, a.notes || '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `תורים_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportPDF(appointments) {
  const date = new Date().toLocaleDateString('he-IL');
  const rows = appointments.map(a => `
    <tr>
      <td>${a.customer_name}<br/><small>${a.customer_email}</small>${a.customer_phone ? `<br/><small>${a.customer_phone}</small>` : ''}</td>
      <td>${a.service_name}</td>
      <td>${a.worker_name}</td>
      <td>${formatDateTime(a.start_time)}</td>
      <td>₪${a.price}</td>
      <td>${STATUS_LABELS[a.status] || a.status}</td>
      <td>${a.notes || ''}</td>
    </tr>
  `).join('');
  const html = `
    <html dir="rtl">
    <head>
      <meta charset="UTF-8"/>
      <style>
        body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
        h2 { color: #4f46e5; margin-bottom: 4px; }
        p { color: #666; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #4f46e5; color: white; padding: 8px; text-align: right; }
        td { padding: 7px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
        tr:nth-child(even) td { background: #f5f5ff; }
        small { color: #888; font-size: 10px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h2>דוח תורים</h2>
      <p>תאריך הפקה: ${date} | סה"כ תורים: ${appointments.length}</p>
      <table>
        <thead><tr>
          <th>לקוח</th><th>שירות</th><th>עובד</th>
          <th>תאריך ושעה</th><th>מחיר</th><th>סטטוס</th><th>הערות</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

const STATUS_OPTIONS = [
  { value: '', label: 'כל הסטטוסים' },
  { value: 'pending', label: 'ממתין' },
  { value: 'confirmed', label: 'מאושר' },
  { value: 'reschedule_requested', label: 'שינוי מועד' },
  { value: 'completed', label: 'הושלם' },
  { value: 'cancelled', label: 'בוטל' },
];

export default function AdminAppointments() {
  const location = useLocation();
  const [appointments, setAppointments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(() => {
    const params = new URLSearchParams(location.search);
    return { workerId: '', date: params.get('date') || '', status: params.get('status') || '' };
  });

  // Detail modal
  const [detailAppt, setDetailAppt] = useState(null);
  const [apptPhotos, setApptPhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarRef = useRef(null);

  useEffect(() => {
    if (!calendarOpen) return;
    const handler = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) setCalendarOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [calendarOpen]);

  // Reschedule modal
  const [rescheduleAppt, setRescheduleAppt] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleNote, setRescheduleNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { addToast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.workerId) params.workerId = filters.workerId;
      if (filters.date) params.date = filters.date;
      if (filters.status) params.status = filters.status;
      const [apptData, workersData] = await Promise.all([getAppointments(params), getWorkers()]);
      setAppointments(apptData.appointments || []);
      setWorkers(workersData.workers || []);
    } catch {
      addToast('שגיאה בטעינת התורים', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);

  // Fetch photos when detail modal opens
  useEffect(() => {
    if (!detailAppt) { setApptPhotos([]); return; }
    setPhotosLoading(true);
    getAppointmentPhotos(detailAppt.id)
      .then(data => setApptPhotos(data.photos || []))
      .catch(() => {})
      .finally(() => setPhotosLoading(false));
  }, [detailAppt?.id]);

  const handleStatus = async (id, status) => {
    try {
      await updateAppointmentStatus(id, status);
      addToast(status === 'confirmed' ? 'התור אושר' : status === 'cancelled' ? 'התור בוטל' : 'הסטטוס עודכן');
      setDetailAppt(prev => prev?.id === id ? { ...prev, status } : prev);
      load();
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
    if (!rescheduleDate || !rescheduleTime) {
      addToast('יש לבחור תאריך ושעה', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await requestAdminReschedule(rescheduleAppt.id, {
        suggested_time: `${rescheduleDate}T${rescheduleTime}:00`,
        note: rescheduleNote || undefined,
      });
      addToast('בקשת שינוי המועד נשלחה ללקוח');
      setRescheduleAppt(null);
      load();
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה בשליחת הבקשה', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !detailAppt) return;
    setPhotoUploading(true);
    try {
      const data = await addAppointmentPhoto(detailAppt.id, file);
      setApptPhotos(prev => [...prev, data.photo]);
    } catch {
      addToast('שגיאה בהעלאת תמונה', 'error');
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!detailAppt) return;
    try {
      await deleteAppointmentPhoto(detailAppt.id, photoId);
      setApptPhotos(prev => prev.filter(p => p.id !== photoId));
    } catch {
      addToast('שגיאה במחיקת תמונה', 'error');
    }
  };

  const clearFilters = () => setFilters({ workerId: '', date: '', status: '' });

  const getMenuItems = (appt) => {
    const items = [];
    if (appt.status === 'pending') {
      items.push({ label: 'אשר', icon: '✓', onClick: () => handleStatus(appt.id, 'confirmed') });
      items.push({ label: 'שנה מועד', icon: '📅', onClick: () => openReschedule(appt) });
      items.push({ label: 'בטל', icon: '✕', onClick: () => handleStatus(appt.id, 'cancelled'), danger: true });
    }
    if (appt.status === 'confirmed') {
      items.push({ label: 'הושלם', icon: '✓', onClick: () => handleStatus(appt.id, 'completed') });
      items.push({ label: 'שנה מועד', icon: '📅', onClick: () => openReschedule(appt) });
      items.push({ label: 'בטל', icon: '✕', onClick: () => handleStatus(appt.id, 'cancelled'), danger: true });
    }
    if (appt.status === 'reschedule_requested') {
      items.push({ label: 'בטל', icon: '✕', onClick: () => handleStatus(appt.id, 'cancelled'), danger: true });
    }
    return items;
  };

  const ActionButtons = ({ appt }) => (
    <div className="flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
      {appt.status === 'pending' && (
        <>
          <button onClick={() => handleStatus(appt.id, 'confirmed')} className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl text-xs font-semibold transition-colors">אשר</button>
          <button onClick={(e) => openReschedule(appt, e)} className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-xl text-xs font-semibold transition-colors">שנה מועד</button>
          <button onClick={() => handleStatus(appt.id, 'cancelled')} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-error rounded-xl text-xs font-semibold transition-colors">בטל</button>
        </>
      )}
      {appt.status === 'confirmed' && (
        <>
          <button onClick={() => handleStatus(appt.id, 'completed')} className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-xs font-semibold transition-colors">הושלם</button>
          <button onClick={(e) => openReschedule(appt, e)} className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-xl text-xs font-semibold transition-colors">שנה מועד</button>
          <button onClick={() => handleStatus(appt.id, 'cancelled')} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-error rounded-xl text-xs font-semibold transition-colors">בטל</button>
        </>
      )}
      {appt.status === 'reschedule_requested' && (
        <button onClick={() => handleStatus(appt.id, 'cancelled')} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-error rounded-xl text-xs font-semibold transition-colors">בטל</button>
      )}
      {(appt.status === 'completed' || appt.status === 'cancelled') && (
        <span className="text-xs text-on-surface-variant opacity-30">—</span>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-headline font-extrabold text-3xl text-on-surface">תורים</h1>
          <p className="text-on-surface-variant text-sm mt-1">ניהול כל התורים</p>
        </div>
        {appointments.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => exportCSV(appointments)} className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl hover:bg-surface-container-low font-medium text-sm transition-colors shadow-sm">
              <span className="material-symbols-outlined text-base">download</span> CSV
            </button>
            <button onClick={() => exportPDF(appointments)} className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-lowest border border-outline-variant text-on-surface rounded-xl hover:bg-surface-container-low font-medium text-sm transition-colors shadow-sm">
              <span className="material-symbols-outlined text-base">picture_as_pdf</span> PDF
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 mb-6 space-y-3">
        {/* Row 1: Workers + Status */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <select
              value={filters.workerId}
              onChange={e => setFilters(p => ({ ...p, workerId: e.target.value }))}
              className="w-full px-3 py-2 border-none rounded-xl text-sm focus:outline-none text-on-surface bg-surface-low-override appearance-none"
            >
              <option value="">כל העובדים</option>
              {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <span className="material-symbols-outlined text-sm text-on-surface-variant absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">expand_more</span>
          </div>
          <div className="flex-1 relative">
            <select
              value={filters.status}
              onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
              className="w-full px-3 py-2 border-none rounded-xl text-sm focus:outline-none text-on-surface bg-surface-low-override appearance-none"
            >
              {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <span className="material-symbols-outlined text-sm text-on-surface-variant absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">expand_more</span>
          </div>
        </div>
        {/* Row 2: Date + Clear */}
        <div className="flex gap-3 items-center">
          <div className="flex-1 relative" ref={calendarRef}>
            <button
              type="button"
              onClick={() => setCalendarOpen(v => !v)}
              className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-sm text-on-surface-variant text-right flex items-center justify-between gap-2"
            >
              <span>{filters.date ? new Date(filters.date + 'T00:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }) : 'כל התאריכים'}</span>
              <span className="material-symbols-outlined text-base">calendar_month</span>
            </button>
            {calendarOpen && (
              <div className="absolute top-full mt-2 z-50 bg-surface-container-lowest rounded-2xl shadow-xl p-3 border border-outline-variant/20" style={{ minWidth: '300px' }}>
                <Calendar
                  onChange={(date) => {
                    setFilters(p => ({ ...p, date: toDateString(date) }));
                    setCalendarOpen(false);
                  }}
                  value={filters.date ? new Date(filters.date + 'T00:00:00') : null}
                  locale="he-IL"
                  className="w-full"
                />
                {filters.date && (
                  <button
                    onClick={() => { setFilters(p => ({ ...p, date: '' })); setCalendarOpen(false); }}
                    className="mt-2 w-full py-1.5 text-xs text-on-surface-variant hover:text-error hover:bg-red-50 rounded-xl transition-colors"
                  >
                    נקה תאריך
                  </button>
                )}
              </div>
            )}
          </div>
          {(filters.workerId || filters.date || filters.status) && (
            <button onClick={clearFilters} className="px-3 py-2 text-on-surface-variant hover:text-on-surface text-sm hover:bg-surface-container rounded-xl transition-colors whitespace-nowrap">
              נקה פילטרים ✕
            </button>
          )}
        </div>
        <p className="text-xs text-on-surface-variant opacity-60">{appointments.length} תורים מוצגים</p>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner />
      ) : appointments.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-12 text-center">
          <span className="text-5xl mb-4 block">📅</span>
          <h3 className="font-headline font-bold text-lg text-on-surface mb-2">אין תורים</h3>
          <p className="text-on-surface-variant text-sm">לא נמצאו תורים התואמים לפילטרים</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant/20">
                <th className="px-3 py-3 text-right font-semibold text-on-surface-variant uppercase text-xs">לקוח</th>
                <th className="px-3 py-3 text-right font-semibold text-on-surface-variant uppercase text-xs">תאריך ושעה</th>
                <th className="pl-3 pr-1 py-3 text-right font-semibold text-on-surface-variant uppercase text-xs">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {appointments.map(appt => (
                <tr
                  key={appt.id}
                  className="hover:bg-surface-container-low cursor-pointer transition-colors"
                  onClick={() => setDetailAppt(appt)}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-on-surface">{appt.customer_name}</span>
                      <StatusBadge status={appt.status} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-on-surface-variant whitespace-nowrap text-sm">
                    {formatDateTime(appt.start_time)}
                  </td>
                  <td className="py-0 pl-2 pr-0">
                    {getMenuItems(appt).length > 0
                      ? <ThreeDotMenu items={getMenuItems(appt)} />
                      : <span className="text-on-surface-variant opacity-30 text-sm px-3">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={!!detailAppt} onClose={() => setDetailAppt(null)} title="פרטי תור">
        {detailAppt && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <StatusBadge status={detailAppt.status} />
              {detailAppt.status === 'reschedule_requested' && detailAppt.suggested_time && (
                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-xl">
                  מוצע: {formatDateTime(detailAppt.suggested_time)}
                </span>
              )}
            </div>

            <div className="bg-surface-container-low rounded-2xl p-4 space-y-1.5">
              <p className="text-xs text-on-surface-variant font-medium uppercase">לקוח</p>
              <p className="font-semibold text-on-surface">{detailAppt.customer_name}</p>
              <p className="text-sm text-on-surface-variant" dir="ltr">{detailAppt.customer_email}</p>
              {detailAppt.customer_phone && (
                <p className="text-sm text-on-surface-variant" dir="ltr">{detailAppt.customer_phone}</p>
              )}
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

            {/* Photos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-on-surface-variant font-medium uppercase">תמונות</p>
                <label className={`text-xs font-medium px-2.5 py-1 rounded-xl cursor-pointer transition-colors ${photoUploading ? 'bg-surface-container text-on-surface-variant' : 'bg-primary-fixed text-primary hover:opacity-80'}`}>
                  {photoUploading ? 'מעלה...' : '+ הוסף תמונה'}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={photoUploading}
                  />
                </label>
              </div>
              {photosLoading ? (
                <div className="text-xs text-on-surface-variant opacity-60 py-2">טוען תמונות...</div>
              ) : apptPhotos.length === 0 ? (
                <div className="text-xs text-on-surface-variant opacity-40 py-2">אין תמונות</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {apptPhotos.map(photo => (
                    <div key={photo.id} className="relative group">
                      <img src={photo.url} alt="" className="w-full h-20 object-cover rounded-xl border border-outline-variant/20" />
                      <button
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="absolute top-1 left-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-1">
              <ActionButtons appt={detailAppt} />
            </div>
          </div>
        )}
      </Modal>

      {/* Reschedule Modal */}
      <Modal isOpen={!!rescheduleAppt} onClose={() => setRescheduleAppt(null)} title="בקשת שינוי מועד">
        {rescheduleAppt && (
          <form onSubmit={handleReschedule} className="space-y-4">
            <div className="bg-surface-container-low rounded-2xl p-4 text-sm text-on-surface-variant">
              <div className="text-on-surface">{rescheduleAppt.customer_name} — {rescheduleAppt.service_name}</div>
              <div className="text-xs text-on-surface-variant opacity-70 mt-0.5">מועד נוכחי: {formatDateTime(rescheduleAppt.start_time)}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">תאריך חדש מוצע</label>
              <input type="date" value={rescheduleDate} min={toDateString(new Date())} onChange={e => setRescheduleDate(e.target.value)} className="w-full px-3 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim text-on-surface" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">שעה חדשה מוצעת</label>
              <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} className="w-full px-3 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim text-on-surface" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">הערה ללקוח (אופציונלי)</label>
              <textarea value={rescheduleNote} onChange={e => setRescheduleNote(e.target.value)} rows={2} className="w-full px-3 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim resize-none text-on-surface" placeholder="סיבה לשינוי..." />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={submitting} className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl text-sm font-semibold transition-colors">{submitting ? 'שולח...' : 'שלח בקשה ללקוח'}</button>
              <button type="button" onClick={() => setRescheduleAppt(null)} className="flex-1 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl text-sm font-semibold transition-colors">ביטול</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
