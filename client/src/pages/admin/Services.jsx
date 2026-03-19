import { useState, useEffect } from 'react';
import { getServices, createService, updateService, deleteService, getCategories, createCategory, updateCategory, deleteCategory } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import { useToast } from '../../hooks/useToast';

export default function AdminServices() {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [serviceForm, setServiceForm] = useState({ name: '', duration_minutes: 30, price: 0, category_id: '' });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const load = async () => {
    try {
      const [sData, cData] = await Promise.allSettled([getServices(), getCategories()]);
      if (sData.status === 'fulfilled') setServices(sData.value.services || []);
      if (cData.status === 'fulfilled') setCategories(cData.value.categories || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ---- Service handlers ----
  const openAddService = () => {
    setEditingService(null);
    setServiceForm({ name: '', duration_minutes: 30, price: 0, category_id: '' });
    setShowServiceModal(true);
  };

  const openEditService = (service) => {
    setEditingService(service);
    setServiceForm({ name: service.name, duration_minutes: service.duration_minutes, price: service.price, category_id: service.category_id || '' });
    setShowServiceModal(true);
  };

  const handleServiceSubmit = async (e) => {
    e.preventDefault();
    if (!serviceForm.name || !serviceForm.duration_minutes) {
      addToast('יש למלא שם ומשך', 'error');
      return;
    }
    setSubmitting(true);
    const payload = { ...serviceForm, category_id: serviceForm.category_id || null };
    try {
      if (editingService) {
        await updateService(editingService.id, payload);
        addToast('השירות עודכן בהצלחה');
      } else {
        await createService(payload);
        addToast('השירות נוסף בהצלחה');
      }
      setShowServiceModal(false);
      load();
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteService = async (service) => {
    if (!confirm(`האם למחוק את השירות "${service.name}"?`)) return;
    try {
      await deleteService(service.id);
      addToast('השירות הוסר');
      load();
    } catch {
      addToast('שגיאה במחיקת שירות', 'error');
    }
  };

  // ---- Category handlers ----
  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setShowCategoryModal(true);
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (!categoryName.trim()) return;
    setSubmitting(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, { name: categoryName.trim() });
        addToast('הקטגוריה עודכנה');
      } else {
        await createCategory({ name: categoryName.trim() });
        addToast('הקטגוריה נוספה');
      }
      setShowCategoryModal(false);
      load();
    } catch (e) {
      addToast(e.response?.data?.message || 'שגיאה', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (!confirm(`האם למחוק את הקטגוריה "${cat.name}"?\nהשירותים בקטגוריה זו לא יימחקו.`)) return;
    try {
      await deleteCategory(cat.id);
      addToast('הקטגוריה הוסרה');
      load();
    } catch {
      addToast('שגיאה במחיקת קטגוריה', 'error');
    }
  };

  if (loading) return <LoadingSpinner />;

  // Group services by category
  const grouped = {};
  const uncategorized = [];
  for (const s of services) {
    if (s.category_id) {
      if (!grouped[s.category_id]) grouped[s.category_id] = { name: s.category_name, services: [] };
      grouped[s.category_id].services.push(s);
    } else {
      uncategorized.push(s);
    }
  }

  const ServiceCard = ({ service }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-xl">✂️</div>
        <div className="flex gap-1">
          <button onClick={() => openEditService(service)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">✏️</button>
          <button onClick={() => handleDeleteService(service)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">🗑️</button>
        </div>
      </div>
      <h3 className="font-semibold text-gray-900 text-lg mb-2">{service.name}</h3>
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>⏱️ {service.duration_minutes} דקות</span>
        <span>💰 ₪{service.price}</span>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">שירותים</h1>
          <p className="text-gray-500 text-sm mt-1">{services.length} שירותים פעילים</p>
        </div>
        <button
          onClick={openAddService}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <span>+</span>הוסף שירות
        </button>
      </div>

      {/* Categories management */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">קטגוריות</h2>
          <button
            onClick={openAddCategory}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            + הוסף קטגוריה
          </button>
        </div>
        {categories.length === 0 ? (
          <p className="text-sm text-gray-400">אין קטגוריות עדיין</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1.5">
                <span className="text-sm font-medium text-indigo-800">{cat.name}</span>
                <button onClick={() => openEditCategory(cat)} className="text-indigo-400 hover:text-indigo-600 text-xs">✏️</button>
                <button onClick={() => handleDeleteCategory(cat)} className="text-indigo-300 hover:text-red-500 text-xs">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Services grouped */}
      {services.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <span className="text-5xl mb-4 block">✂️</span>
          <h3 className="text-lg font-medium text-gray-900 mb-2">אין שירותים</h3>
          <p className="text-gray-500 text-sm mb-4">הוסף שירות ראשון</p>
          <button onClick={openAddService} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">הוסף שירות</button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Categorized groups */}
          {Object.values(grouped).map(group => (
            <div key={group.name}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{group.name}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.services.map(s => <ServiceCard key={s.id} service={s} />)}
              </div>
            </div>
          ))}
          {/* Uncategorized */}
          {uncategorized.length > 0 && (
            <div>
              {Object.keys(grouped).length > 0 && (
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">ללא קטגוריה</h3>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {uncategorized.map(s => <ServiceCard key={s.id} service={s} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Service modal */}
      <Modal
        isOpen={showServiceModal}
        onClose={() => setShowServiceModal(false)}
        title={editingService ? 'ערוך שירות' : 'הוסף שירות חדש'}
      >
        <form onSubmit={handleServiceSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם השירות</label>
            <input
              type="text"
              value={serviceForm.name}
              onChange={e => setServiceForm(p => ({ ...p, name: e.target.value }))}
              placeholder="לדוגמה: תספורת"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">קטגוריה (אופציונלי)</label>
            <select
              value={serviceForm.category_id}
              onChange={e => setServiceForm(p => ({ ...p, category_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">ללא קטגוריה</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">משך בדקות</label>
            <input
              type="number"
              min="5"
              max="480"
              value={serviceForm.duration_minutes}
              onChange={e => setServiceForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 30 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">מחיר (₪)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={serviceForm.price}
              onChange={e => setServiceForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-medium">
              {submitting ? 'שומר...' : editingService ? 'שמור שינויים' : 'הוסף שירות'}
            </button>
            <button type="button" onClick={() => setShowServiceModal(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">
              ביטול
            </button>
          </div>
        </form>
      </Modal>

      {/* Category modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title={editingCategory ? 'ערוך קטגוריה' : 'הוסף קטגוריה חדשה'}
      >
        <form onSubmit={handleCategorySubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם הקטגוריה</label>
            <input
              type="text"
              value={categoryName}
              onChange={e => setCategoryName(e.target.value)}
              placeholder="לדוגמה: שיער"
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting || !categoryName.trim()} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-medium">
              {submitting ? 'שומר...' : editingCategory ? 'שמור' : 'הוסף'}
            </button>
            <button type="button" onClick={() => setShowCategoryModal(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">
              ביטול
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
