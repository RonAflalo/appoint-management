import { useState, useEffect } from 'react';
import { getServices, createService, updateService, deleteService } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import { useToast } from '../../hooks/useToast';

export default function AdminServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [form, setForm] = useState({ name: '', duration_minutes: 30, price: 0 });
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const load = async () => {
    try {
      const data = await getServices();
      setServices(data.services || []);
    } catch (e) {
      addToast('שגיאה בטעינת השירותים', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name || !form.duration_minutes) {
      addToast('יש למלא שם ומשך', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await createService(form);
      addToast('השירות נוסף בהצלחה');
      setShowAddModal(false);
      setForm({ name: '', duration_minutes: 30, price: 0 });
      load();
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה בהוספת שירות', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateService(editingService.id, form);
      addToast('השירות עודכן בהצלחה');
      setShowEditModal(false);
      setEditingService(null);
      load();
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה בעדכון שירות', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (service) => {
    if (!confirm(`האם למחוק את השירות "${service.name}"?`)) return;
    try {
      await deleteService(service.id);
      addToast('השירות הוסר בהצלחה');
      load();
    } catch (e) {
      addToast('שגיאה במחיקת שירות', 'error');
    }
  };

  const openEdit = (service) => {
    setEditingService(service);
    setForm({ name: service.name, duration_minutes: service.duration_minutes, price: service.price });
    setShowEditModal(true);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">שירותים</h1>
          <p className="text-gray-500 text-sm mt-1">{services.length} שירותים פעילים</p>
        </div>
        <button
          onClick={() => { setForm({ name: '', duration_minutes: 30, price: 0 }); setShowAddModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <span>+</span>
          הוסף שירות
        </button>
      </div>

      {services.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <span className="text-5xl mb-4 block">✂️</span>
          <h3 className="text-lg font-medium text-gray-900 mb-2">אין שירותים</h3>
          <p className="text-gray-500 text-sm mb-4">הוסף שירות ראשון</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
          >
            הוסף שירות
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(service => (
            <div key={service.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-xl">
                  ✂️
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(service)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(service)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">{service.name}</h3>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>⏱️ {service.duration_minutes} דקות</span>
                <span>💰 ₪{service.price}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal || showEditModal}
        onClose={() => { setShowAddModal(false); setShowEditModal(false); setEditingService(null); }}
        title={editingService ? 'ערוך שירות' : 'הוסף שירות חדש'}
      >
        <form onSubmit={editingService ? handleEdit : handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם השירות</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="לדוגמה: תספורת"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">משך בדקות</label>
            <input
              type="number"
              min="5"
              max="480"
              value={form.duration_minutes}
              onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 30 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">מחיר (₪)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.price}
              onChange={e => setForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-medium"
            >
              {submitting ? 'שומר...' : editingService ? 'שמור שינויים' : 'הוסף שירות'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
              className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
            >
              ביטול
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
