import { useState, useEffect } from 'react';
import { getWorkers, createWorker, updateWorker, deleteWorker, getWorkerAvailability } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import { useToast } from '../../hooks/useToast';
import { DAYS_HE } from '../../utils/dateUtils';

export default function AdminWorkers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [availabilityData, setAvailabilityData] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const load = async () => {
    try {
      const data = await getWorkers();
      setWorkers(data.workers || []);
    } catch (e) {
      addToast('שגיאה בטעינת העובדים', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      addToast('יש למלא את כל השדות', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await createWorker(form);
      addToast('העובד נוסף בהצלחה');
      setShowAddModal(false);
      setForm({ name: '', email: '', password: '' });
      load();
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה בהוספת עובד', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name || !editForm.email) {
      addToast('יש למלא שם ואימייל', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await updateWorker(editingWorker.id, editForm);
      addToast('העובד עודכן בהצלחה');
      setShowEditModal(false);
      setEditingWorker(null);
      load();
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה בעדכון עובד', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (worker) => {
    try {
      await updateWorker(worker.id, { is_active: worker.is_active ? 0 : 1 });
      addToast(worker.is_active ? 'העובד הושבת' : 'העובד הופעל');
      load();
    } catch (e) {
      addToast('שגיאה בעדכון סטטוס', 'error');
    }
  };

  const openEdit = (worker) => {
    setEditingWorker(worker);
    setEditForm({ name: worker.name, email: worker.email });
    setShowEditModal(true);
  };

  const openAvailability = async (worker) => {
    setAvailabilityData(null);
    setAvailabilityLoading(true);
    setShowAvailabilityModal(true);
    try {
      const data = await getWorkerAvailability(worker.id);
      setAvailabilityData(data);
    } catch {
      addToast('שגיאה בטעינת הזמינות', 'error');
      setShowAvailabilityModal(false);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const adminWorkers = workers.filter(w => w.role === 'admin');
  const regularWorkers = workers.filter(w => w.role === 'worker');


  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">עובדים</h1>
          <p className="text-gray-500 text-sm mt-1">{regularWorkers.length} עובדים במערכת</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <span>+</span>
          הוסף עובד
        </button>
      </div>

      {/* Admin-as-worker card */}
      {adminWorkers.map(admin => (
        <div key={admin.id} className="bg-white rounded-xl shadow-sm border border-indigo-100 p-4 mb-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg flex-shrink-0">
            {admin.name?.[0]}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-900 flex items-center gap-2">
              {admin.name}
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">מנהל + עובד</span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{admin.email}</div>
          </div>
          <button
            onClick={() => openAvailability(admin)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-xs font-medium px-2 py-1"
          >
            🗓 זמינות
          </button>
        </div>
      ))}

      {regularWorkers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <span className="text-5xl mb-4 block">👥</span>
          <h3 className="text-lg font-medium text-gray-900 mb-2">אין עובדים נוספים</h3>
          <p className="text-gray-500 text-sm mb-4">הוסף עובד כדי לנהל לו תורים נפרדים</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
          >
            הוסף עובד
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-right font-medium text-gray-600">שם</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">אימייל</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">סטטוס</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {regularWorkers.map(worker => (
                <tr key={worker.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 font-medium text-gray-900">{worker.name}</td>
                  <td className="px-4 py-4 text-gray-600 font-mono text-xs">{worker.email}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${worker.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {worker.is_active ? 'פעיל' : 'לא פעיל'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => openAvailability(worker)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-xs font-medium px-2 py-1"
                        title="זמינות"
                      >
                        🗓 זמינות
                      </button>
                      <button
                        onClick={() => openEdit(worker)}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="ערוך"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleToggleActive(worker)}
                        className={`p-1.5 rounded-lg transition-colors text-xs font-medium px-2 py-1
                          ${worker.is_active
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-green-600 hover:bg-green-50'}`}
                      >
                        {worker.is_active ? 'השבת' : 'הפעל'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setForm({ name: '', email: '', password: '' }); }} title="הוסף עובד חדש">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="שם העובד"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="email@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="סיסמה לחשבון"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? 'מוסיף...' : 'הוסף עובד'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      </Modal>

      {/* Availability Modal */}
      <Modal
        isOpen={showAvailabilityModal}
        onClose={() => setShowAvailabilityModal(false)}
        title={`זמינות: ${availabilityData?.worker?.name || '...'}`}
      >
        {availabilityLoading ? (
          <div className="py-6 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
          </div>
        ) : availabilityData ? (
          <div className="space-y-4">
            {availabilityData.overrides.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <span className="text-3xl block mb-2">🗓</span>
                <p className="text-sm">העובד לא הגדיר חריגות זמינות</p>
                <p className="text-xs mt-1 text-gray-300">שעות הפעילות הרגילות של העסק חלות</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-3">חריגות שהעובד הגדיר לימים ספציפיים:</p>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {availabilityData.overrides.map(ov => {
                    const dateObj = new Date(ov.date + 'T00:00:00');
                    const dayName = DAYS_HE[dateObj.getDay()];
                    const dateLabel = dateObj.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    return (
                      <div key={ov.id} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm
                        ${ov.is_blocked ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="flex items-center gap-2">
                          <span>{ov.is_blocked ? '🔴' : '🔵'}</span>
                          <div>
                            <div className="font-medium text-gray-800">{dateLabel} ({dayName})</div>
                            {ov.is_blocked ? (
                              <div className="text-xs text-red-600">יום חסום — לא זמין</div>
                            ) : (
                              <div className="text-xs text-blue-600">
                                שעות מותאמות: {ov.custom_start || '—'} עד {ov.custom_end || '—'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowAvailabilityModal(false)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                סגור
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="ערוך עובד">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
            <input
              type="text"
              value={editForm.name}
              onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
            <input
              type="email"
              value={editForm.email}
              onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              dir="ltr"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? 'שומר...' : 'שמור שינויים'}
            </button>
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
