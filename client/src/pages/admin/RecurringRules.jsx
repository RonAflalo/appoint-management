import { useState, useEffect } from 'react';
import {
  getRecurringRules, createRecurringRule, updateRecurringRule, deleteRecurringRule,
  getWorkers, getServices, getCustomers,
} from '../../api/admin';
import { useToast } from '../../hooks/useToast';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const EMPTY_FORM = {
  customer_id: '',
  worker_id: '',
  service_id: '',
  day_of_week: '0',
  time: '09:00',
  start_date: '',
  end_date: '',
};

export default function AdminRecurringRules() {
  const [rules, setRules] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [services, setServices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(null);
  const { addToast } = useToast();

  const load = async () => {
    try {
      const [rulesData, workersData, servicesData, customersData] = await Promise.all([
        getRecurringRules(),
        getWorkers(),
        getServices(),
        getCustomers(),
      ]);
      setRules(rulesData.rules || []);
      setWorkers(workersData.workers || []);
      setServices(servicesData.services || []);
      setCustomers(customersData.customers || []);
    } catch {
      addToast('שגיאה בטעינת הנתונים', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_id || !form.worker_id || !form.service_id || !form.start_date) {
      addToast('יש למלא את כל השדות הנדרשים', 'error');
      return;
    }
    setSaving(true);
    try {
      await createRecurringRule(form);
      addToast('כלל חוזר נוסף בהצלחה!');
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה בשמירה', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule) => {
    setBusy(rule.id);
    try {
      await updateRecurringRule(rule.id, { is_active: rule.is_active ? 0 : 1 });
      addToast(rule.is_active ? 'הכלל הושבת' : 'הכלל הופעל');
      load();
    } catch {
      addToast('שגיאה', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('למחוק את הכלל החוזר? תורים עתידיים שנוצרו ממנו יבוטלו.')) return;
    setBusy(id);
    try {
      await deleteRecurringRule(id);
      addToast('הכלל נמחק');
      load();
    } catch {
      addToast('שגיאה במחיקה', 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">תורים קבועים</h1>
          <p className="text-gray-500 text-sm mt-1">תורים שחוזרים אוטומטית כל שבוע</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setForm(EMPTY_FORM); }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          + הוסף כלל חוזר
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">כלל חוזר חדש</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">לקוח *</label>
                <select
                  value={form.customer_id}
                  onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">בחר לקוח...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">עובד *</label>
                <select
                  value={form.worker_id}
                  onChange={e => setForm(f => ({ ...f, worker_id: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">בחר עובד...</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">שירות *</label>
                <select
                  value={form.service_id}
                  onChange={e => setForm(f => ({ ...f, service_id: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">בחר שירות...</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">יום בשבוע *</label>
                <select
                  value={form.day_of_week}
                  onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {DAYS_HE.map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">שעה *</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">תאריך התחלה *</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">תאריך סיום (אופציונלי)</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {saving ? 'שומר...' : 'שמור כלל'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                ביטול
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <span className="text-5xl mb-4 block">🔄</span>
          <h3 className="text-lg font-medium text-gray-900 mb-2">אין כללים חוזרים</h3>
          <p className="text-gray-500 text-sm">הוסף כלל חוזר לתורים שחוזרים כל שבוע</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`bg-white rounded-xl shadow-sm border p-5 transition-colors
                ${rule.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="font-semibold text-gray-900">{rule.customer_name}</div>
                  <div className="text-sm text-gray-500">
                    {rule.service_name} עם {rule.worker_name}
                  </div>
                  <div className="text-sm text-indigo-600 font-medium">
                    כל יום {DAYS_HE[rule.day_of_week]} בשעה {rule.time}
                  </div>
                  <div className="text-xs text-gray-400">
                    מ-{rule.start_date}{rule.end_date ? ` עד ${rule.end_date}` : ' (ללא תאריך סיום)'}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 mr-4">
                  <button
                    onClick={() => handleToggle(rule)}
                    disabled={busy === rule.id}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50
                      ${rule.is_active
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                        : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'}`}
                  >
                    {rule.is_active ? 'השבת' : 'הפעל'}
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    disabled={busy === rule.id}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50"
                  >
                    מחק
                  </button>
                </div>
              </div>
              {!rule.is_active && (
                <div className="mt-2 text-xs text-gray-400">כלל זה מושבת — לא יוצרו תורים חדשים</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
