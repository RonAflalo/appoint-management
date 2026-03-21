import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCustomerDetail, updateCustomerNotes } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatDateTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';

const STATUS_LABELS = {
  pending: { label: 'ממתין', color: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'מאושר', color: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'הושלם', color: 'bg-blue-100 text-blue-800' },
  cancelled: { label: 'בוטל', color: 'bg-red-100 text-red-800' },
  reschedule_requested: { label: 'בקשת שינוי', color: 'bg-indigo-100 text-indigo-800' },
};

export default function AdminCustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [customer, setCustomer] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    getCustomerDetail(id)
      .then(data => {
        setCustomer(data.customer);
        setAppointments(data.appointments);
        setNotes(data.customer.admin_notes || '');
      })
      .catch(() => addToast('שגיאה בטעינת פרטי הלקוח', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await updateCustomerNotes(id, notes);
      addToast('הערות נשמרו', 'success');
    } catch {
      addToast('שגיאה בשמירת הערות', 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!customer) return <div className="text-center text-on-surface-variant mt-20">לקוח לא נמצא</div>;

  const totalRevenue = appointments
    .filter(a => ['completed', 'confirmed'].includes(a.status))
    .reduce((sum, a) => sum + (a.price || 0), 0);

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => navigate('/admin/customers')}
        className="mb-4 text-sm text-primary hover:underline flex items-center gap-1"
      >
        → חזרה ללקוחות
      </button>

      {/* Customer header */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">{customer.name}</h1>
            <div className="mt-2 space-y-1 text-sm text-on-surface-variant">
              <p dir="ltr">{customer.email}</p>
              {customer.phone && <p dir="ltr">{customer.phone}</p>}
              <p>לקוח מאז: {formatDateTime(customer.created_at)}</p>
            </div>
            <div className="mt-2">
              {customer.email_verified ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">✓ מאומת</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">⚠ לא מאומת</span>
              )}
            </div>
          </div>
          {/* Stats */}
          <div className="flex gap-4">
            <div className="text-center bg-primary/10 rounded-xl px-4 py-3">
              <p className="text-2xl font-bold text-primary">{appointments.length}</p>
              <p className="text-xs text-primary/70">תורים</p>
            </div>
            <div className="text-center bg-emerald-50 rounded-xl px-4 py-3">
              <p className="text-2xl font-bold text-emerald-700">₪{totalRevenue.toFixed(0)}</p>
              <p className="text-xs text-emerald-500">סה"כ הכנסה</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Appointment history */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-on-surface mb-3">היסטוריית תורים</h2>
          {appointments.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-8 text-center text-on-surface-variant">אין תורים עדיין</div>
          ) : (
            <div className="space-y-3">
              {appointments.map(appt => {
                const status = STATUS_LABELS[appt.status] || { label: appt.status, color: 'bg-surface-container text-on-surface-variant' };
                return (
                  <div key={appt.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-4">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-medium text-on-surface">{appt.service_name}</p>
                        <p className="text-sm text-on-surface-variant">עם {appt.worker_name}</p>
                        <p className="text-sm text-on-surface-variant">{formatDateTime(appt.start_time)}</p>
                        {appt.notes && <p className="text-xs text-on-surface-variant/60 mt-1">הערת לקוח: {appt.notes}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>{status.label}</span>
                        {appt.price > 0 && <span className="text-sm font-semibold text-on-surface">₪{appt.price}</span>}
                      </div>
                    </div>
                    {appt.photos && appt.photos.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-outline-variant/20">
                        <p className="text-xs text-on-surface-variant/60 mb-2">תמונות ({appt.photos.length})</p>
                        <div className="flex gap-2 flex-wrap">
                          {appt.photos.map(photo => (
                            <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer">
                              <img src={photo.url} alt="" className="w-16 h-16 object-cover rounded-xl border border-outline-variant/20 hover:opacity-80 transition-opacity" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Admin notes */}
        <div>
          <h2 className="text-lg font-semibold text-on-surface mb-3">הערות פנימיות</h2>
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-4">
            <p className="text-xs text-on-surface-variant/60 mb-2">הערות אלו גלויות רק לך ולא ללקוח</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={8}
              placeholder="הוסף הערות על הלקוח..."
              className="w-full text-sm bg-surface-container-low border-none rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim resize-none"
            />
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="mt-2 w-full primary-gradient text-white text-sm py-2 rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {savingNotes ? 'שומר...' : 'שמור הערות'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
