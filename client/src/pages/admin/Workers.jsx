import { useState, useEffect } from 'react';
import { getWorkers, createWorker, updateWorker, deleteWorker, getWorkerAvailability, getServices, getWorkerServices, updateWorkerServices } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import ThreeDotMenu from '../../components/common/ThreeDotMenu';
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

  // Services modal state
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [servicesWorker, setServicesWorker] = useState(null);
  const [allServices, setAllServices] = useState([]);
  const [workerServiceIds, setWorkerServiceIds] = useState([]);
  const [savingServices, setSavingServices] = useState(false);
  const [allServicesToggle, setAllServicesToggle] = useState(true);

  // Delete worker state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingWorker, setDeletingWorker] = useState(false);

  const load = async () => {
    try {
      const [workersData, servicesData] = await Promise.allSettled([getWorkers(), getServices()]);
      if (workersData.status === 'fulfilled') setWorkers(workersData.value.workers || []);
      if (servicesData.status === 'fulfilled') setAllServices(servicesData.value.services || []);
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

  const handleDeleteWorker = async () => {
    if (!deletePassword) { addToast('יש להזין סיסמת מנהל', 'error'); return; }
    setDeletingWorker(true);
    try {
      await deleteWorker(deleteTarget.id, deletePassword);
      addToast(`${deleteTarget.name} הוסר מהמערכת`);
      setDeleteTarget(null);
      setDeletePassword('');
      load();
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה במחיקת עובד', 'error');
    } finally {
      setDeletingWorker(false);
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

  const openServices = async (worker) => {
    setServicesWorker(worker);
    try {
      const data = await getWorkerServices(worker.id);
      const ids = data.serviceIds || [];
      setWorkerServiceIds(ids);
      setAllServicesToggle(ids.length === 0);
    } catch {
      setWorkerServiceIds([]);
      setAllServicesToggle(true);
    }
    setShowServicesModal(true);
  };

  const handleSaveServices = async () => {
    if (!servicesWorker) return;
    setSavingServices(true);
    try {
      const serviceIds = allServicesToggle ? [] : workerServiceIds;
      await updateWorkerServices(servicesWorker.id, serviceIds);
      addToast('השירותים עודכנו בהצלחה');
      setShowServicesModal(false);
    } catch {
      addToast('שגיאה בשמירת השירותים', 'error');
    } finally {
      setSavingServices(false);
    }
  };

  const toggleServiceId = (id) => {
    setWorkerServiceIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const adminWorkers = workers.filter(w => w.role === 'admin');
  const regularWorkers = workers.filter(w => w.role === 'worker');

  const getWorkerMenuItems = (worker) => {
    if (worker.deleted_at) return [];
    return [
      { label: 'זמינות', icon: '🗓', onClick: () => openAvailability(worker) },
      { label: 'שירותים', icon: '✂️', onClick: () => openServices(worker) },
      { label: 'ערוך', icon: '✏️', onClick: () => openEdit(worker) },
      { label: worker.is_active ? 'השבת' : 'הפעל', icon: worker.is_active ? '⏸' : '▶', onClick: () => handleToggleActive(worker) },
      null,
      { label: 'מחק עובד', icon: '🗑', onClick: () => { setDeleteTarget(worker); setDeletePassword(''); }, danger: true },
    ];
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-headline font-extrabold text-3xl text-on-surface">עובדים</h1>
          <p className="text-on-surface-variant text-sm mt-1">{regularWorkers.filter(w => !w.deleted_at).length} עובדים פעילים במערכת</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 primary-gradient text-white rounded-xl px-4 py-2.5 font-bold text-sm transition-opacity hover:opacity-90"
        >
          <span>+</span>
          הוסף עובד
        </button>
      </div>

      {/* Admin-as-worker card */}
      {adminWorkers.map(admin => (
        <div key={admin.id} className="bg-surface-container-lowest border border-primary/40 rounded-2xl p-4 mb-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
            {admin.name?.[0]}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-on-surface flex items-center gap-2">
              {admin.name}
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">מנהל + עובד</span>
            </div>
            <div className="text-xs text-on-surface-variant mt-0.5">{admin.email}</div>
          </div>
          <ThreeDotMenu items={[
            { label: 'זמינות', icon: '🗓', onClick: () => openAvailability(admin) },
            { label: 'שירותים', icon: '✂️', onClick: () => openServices(admin) },
          ]} />
        </div>
      ))}

      {regularWorkers.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-12 text-center">
          <span className="text-5xl mb-4 block">👥</span>
          <h3 className="text-lg font-medium text-on-surface mb-2">אין עובדים נוספים</h3>
          <p className="text-on-surface-variant text-sm">הוסף עובד כדי לנהל לו תורים נפרדים</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-container border-b border-outline-variant/20">
                <th className="px-4 py-3 text-right font-semibold text-on-surface-variant uppercase text-xs">שם</th>
                <th className="px-4 py-3 text-right font-semibold text-on-surface-variant uppercase text-xs hidden sm:table-cell">אימייל</th>
                <th className="px-4 py-3 text-right font-semibold text-on-surface-variant uppercase text-xs">סטטוס</th>
                <th className="px-4 py-3 text-left font-semibold text-on-surface-variant uppercase text-xs">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {regularWorkers.map(worker => (
                <tr key={worker.id} className={`hover:bg-surface-container-low transition-colors ${worker.deleted_at ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-4 font-medium text-on-surface">
                    <div className="flex items-center gap-2">
                      {worker.name}
                      {worker.deleted_at && (
                        <span className="text-xs bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full">עובד לשעבר</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-on-surface-variant font-mono text-xs hidden sm:table-cell">{worker.email}</td>
                  <td className="px-4 py-4">
                    {worker.deleted_at ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-container text-on-surface-variant">הוסר</span>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${worker.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-container text-on-surface-variant'}`}>
                        {worker.is_active ? 'פעיל' : 'לא פעיל'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end">
                      <ThreeDotMenu items={getWorkerMenuItems(worker)} />
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
            <label className="block text-sm font-medium text-on-surface mb-1">שם מלא</label>
            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="שם העובד" className="w-full px-3 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">אימייל</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" className="w-full px-3 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">סיסמה</label>
            <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="סיסמה לחשבון" className="w-full px-3 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting} className="flex-1 py-2 primary-gradient disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-opacity hover:opacity-90">{submitting ? 'מוסיף...' : 'הוסף עובד'}</button>
            <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 bg-surface-container text-on-surface rounded-xl text-sm font-medium transition-colors hover:bg-surface-container-high">ביטול</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => { setDeleteTarget(null); setDeletePassword(''); }} title="מחיקת עובד">
        {deleteTarget && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="font-semibold text-red-800 text-sm">האם למחוק את {deleteTarget.name}?</p>
              <p className="text-red-700 text-xs mt-1">
                פעולה זו תסמן את העובד כ"עובד לשעבר". היסטוריית התורים תישמר.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1">סיסמת מנהל לאימות</label>
              <input
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="הזן את הסיסמה שלך"
                className="w-full px-3 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
                onKeyDown={e => e.key === 'Enter' && handleDeleteWorker()}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleDeleteWorker}
                disabled={deletingWorker || !deletePassword}
                className="flex-1 py-2 bg-error hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
              >
                {deletingWorker ? 'מוחק...' : 'אשר מחיקה'}
              </button>
              <button
                type="button"
                onClick={() => { setDeleteTarget(null); setDeletePassword(''); }}
                className="flex-1 py-2 bg-surface-container text-on-surface rounded-xl text-sm font-medium transition-colors hover:bg-surface-container-high"
              >
                ביטול
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Availability Modal */}
      <Modal isOpen={showAvailabilityModal} onClose={() => setShowAvailabilityModal(false)} title={`זמינות: ${availabilityData?.worker?.name || '...'}`}>
        {availabilityLoading ? (
          <div className="py-6 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
          </div>
        ) : availabilityData ? (
          <div className="space-y-4">
            {availabilityData.overrides.length === 0 ? (
              <div className="text-center py-6 text-on-surface-variant">
                <span className="text-3xl block mb-2">🗓</span>
                <p className="text-sm">העובד לא הגדיר חריגות זמינות</p>
                <p className="text-xs mt-1 text-on-surface-variant/60">שעות הפעילות הרגילות של העסק חלות</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-on-surface-variant mb-3">חריגות שהעובד הגדיר לימים ספציפיים:</p>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {availabilityData.overrides.map(ov => {
                    const dateObj = new Date(ov.date + 'T00:00:00');
                    const dayName = DAYS_HE[dateObj.getDay()];
                    const dateLabel = dateObj.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    return (
                      <div key={ov.id} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm ${ov.is_blocked ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="flex items-center gap-2">
                          <span>{ov.is_blocked ? '🔴' : '🔵'}</span>
                          <div>
                            <div className="font-medium text-on-surface">{dateLabel} ({dayName})</div>
                            {ov.is_blocked ? (
                              <div className="text-xs text-red-600">יום חסום — לא זמין</div>
                            ) : (
                              <div className="text-xs text-blue-600">שעות מותאמות: {ov.custom_start || '—'} עד {ov.custom_end || '—'}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <div className="pt-2 border-t border-outline-variant/20">
              <button onClick={() => setShowAvailabilityModal(false)} className="w-full py-2 bg-surface-container text-on-surface rounded-xl text-sm font-medium transition-colors hover:bg-surface-container-high">סגור</button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Services Modal */}
      <Modal isOpen={showServicesModal} onClose={() => setShowServicesModal(false)} title={`שירותים: ${servicesWorker?.name || '...'}`}>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
            <div>
              <p className="text-sm font-bold font-headline text-on-surface">כל השירותים</p>
              <p className="text-xs text-on-surface-variant mt-0.5">העובד יכול לבצע את כל השירותים</p>
            </div>
            <button
              type="button"
              onClick={() => setAllServicesToggle(v => !v)}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
              style={{ backgroundColor: allServicesToggle ? '#3525cd' : '#9ca3af' }}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allServicesToggle ? '-translate-x-6' : '-translate-x-1'}`} />
            </button>
          </div>

          {!allServicesToggle && (
            <div>
              <p className="text-xs text-on-surface-variant mb-2">בחר שירותים ספציפיים שהעובד מבצע:</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {allServices.length === 0 ? (
                  <p className="text-sm text-on-surface-variant text-center py-4">אין שירותים במערכת</p>
                ) : allServices.map(service => (
                  <label key={service.id} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${workerServiceIds.includes(service.id) ? 'border-primary bg-primary/10' : 'border-outline-variant/20 hover:bg-surface-container-low'}`}>
                    <input
                      type="checkbox"
                      checked={workerServiceIds.includes(service.id)}
                      onChange={() => toggleServiceId(service.id)}
                      className="w-4 h-4 text-primary rounded border-primary focus:ring-primary-fixed-dim"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-on-surface">{service.name}</span>
                      <span className="text-xs text-on-surface-variant mr-2">{service.duration_minutes} דק' • ₪{service.price}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleSaveServices} disabled={savingServices} className="flex-1 py-2 primary-gradient disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-opacity hover:opacity-90">{savingServices ? 'שומר...' : 'שמור'}</button>
            <button type="button" onClick={() => setShowServicesModal(false)} className="flex-1 py-2 bg-surface-container text-on-surface rounded-xl text-sm font-medium transition-colors hover:bg-surface-container-high">ביטול</button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="ערוך עובד">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">שם מלא</label>
            <input type="text" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">אימייל</label>
            <input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim" dir="ltr" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting} className="flex-1 py-2 primary-gradient disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-opacity hover:opacity-90">{submitting ? 'שומר...' : 'שמור שינויים'}</button>
            <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-2 bg-surface-container text-on-surface rounded-xl text-sm font-medium transition-colors hover:bg-surface-container-high">ביטול</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
