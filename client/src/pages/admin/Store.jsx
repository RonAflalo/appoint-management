import { useState, useEffect } from 'react';
import { getStore, toggleStore, createProduct, updateProduct, deleteProduct, uploadImage } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useToast } from '../../hooks/useToast';

const emptyForm = { name: '', description: '', price: '', image_url: '' };

export default function AdminStore() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [storeEnabled, setStoreEnabled] = useState(false);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // product being edited
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getStore()
      .then(data => { setStoreEnabled(data.store_enabled); setProducts(data.products); })
      .catch(() => addToast('שגיאה בטעינת החנות', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    try {
      const data = await toggleStore();
      setStoreEnabled(data.store_enabled);
      addToast(data.store_enabled ? 'החנות הופעלה' : 'החנות הושבתה', 'success');
    } catch { addToast('שגיאה', 'error'); }
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (p) => { setEditing(p); setForm({ name: p.name, description: p.description || '', price: p.price, image_url: p.image_url || '' }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadImage(file);
      setForm(f => ({ ...f, image_url: data.url }));
    } catch { addToast('שגיאה בהעלאת תמונה', 'error'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.name || form.price === '') return addToast('שם ומחיר הם שדות חובה', 'error');
    setSaving(true);
    try {
      const payload = { ...form, price: parseFloat(form.price) };
      if (editing) {
        const data = await updateProduct(editing.id, payload);
        setProducts(prev => prev.map(p => p.id === editing.id ? data.product : p));
        addToast('המוצר עודכן', 'success');
      } else {
        const data = await createProduct(payload);
        setProducts(prev => [data.product, ...prev]);
        addToast('המוצר נוסף', 'success');
      }
      closeForm();
    } catch { addToast('שגיאה בשמירה', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('למחוק את המוצר?')) return;
    try {
      await deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      addToast('המוצר נמחק', 'success');
    } catch { addToast('שגיאה במחיקה', 'error'); }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-headline font-extrabold text-3xl text-on-surface">חנות</h1>
          <p className="text-on-surface-variant text-sm mt-1">נהל את מוצרי החנות שלך</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Toggle */}
          <button
            onClick={handleToggle}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              storeEnabled ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-zinc-200 text-on-surface-variant hover:bg-zinc-300'
            }`}
          >
            <span className={`w-3 h-3 rounded-full ${storeEnabled ? 'bg-green-500' : 'bg-zinc-700'}`} />
            {storeEnabled ? 'חנות פעילה' : 'חנות כבויה'}
          </button>
          <button
            onClick={openNew}
            className="primary-gradient text-white px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
          >
            + הוסף מוצר
          </button>
        </div>
      </div>

      {!storeEnabled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-sm text-yellow-800">
          החנות כרגע כבויה — הלקוחות לא רואים אותה. הפעל אותה למעלה כדי שתופיע ללקוחות.
        </div>
      )}

      {/* Product form */}
      {showForm && (
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-on-surface mb-4">{editing ? 'עריכת מוצר' : 'מוצר חדש'}</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="שם המוצר *"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
            />
            <textarea
              placeholder="תיאור המוצר"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim resize-none"
            />
            <input
              type="number"
              placeholder="מחיר (₪) *"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              min="0"
              step="0.01"
              className="w-full bg-surface-container-low border-none rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
            />
            {/* Image upload */}
            <div>
              <label className="block text-xs text-on-surface-variant mb-1">תמונת מוצר</label>
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="text-sm text-on-surface-variant" />
              {uploading && <p className="text-xs text-primary mt-1">מעלה תמונה...</p>}
              {form.image_url && (
                <img src={form.image_url} alt="preview" className="mt-2 h-24 w-24 object-cover rounded-xl border border-outline-variant/20" />
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving} className="primary-gradient text-white px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {saving ? 'שומר...' : 'שמור'}
            </button>
            <button onClick={closeForm} className="bg-surface-container text-on-surface-variant px-4 py-2 rounded-xl text-sm hover:bg-surface-container-low transition-colors">ביטול</button>
          </div>
        </div>
      )}

      {/* Products list */}
      {products.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-12 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 block mb-3">storefront</span>
          <p>אין מוצרים עדיין. לחץ על "הוסף מוצר" להתחיל.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <div key={p.id} className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
              {p.image_url && (
                <img src={p.image_url} alt={p.name} className="w-full h-36 object-contain bg-surface-container-low" />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-on-surface">{p.name}</h3>
                  <span className="font-bold text-primary whitespace-nowrap">₪{p.price}</span>
                </div>
                {p.description && <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">{p.description}</p>}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => openEdit(p)} className="flex-1 text-sm bg-surface-container text-on-surface-variant hover:bg-surface-container-low py-1.5 rounded-xl transition-colors">עריכה</button>
                  <button onClick={() => handleDelete(p.id)} className="flex-1 text-sm bg-red-50 hover:bg-red-100 text-red-600 py-1.5 rounded-xl transition-colors">מחיקה</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
