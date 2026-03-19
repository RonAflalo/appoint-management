import { useState, useEffect } from 'react';
import { getCustomerStore } from '../../api/user';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function CustomerStore() {
  const [loading, setLoading] = useState(true);
  const [storeEnabled, setStoreEnabled] = useState(false);
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    getCustomerStore()
      .then(data => { setStoreEnabled(data.store_enabled); setProducts(data.products); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  if (!storeEnabled) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-5xl mb-4">🛍️</p>
        <p className="text-lg font-medium">החנות אינה פעילה כרגע</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-5xl mb-4">🛍️</p>
        <p>אין מוצרים בחנות עדיין</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">החנות שלנו</h1>
        <p className="text-gray-500 text-sm mt-1">{products.length} מוצרים</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {products.map(p => (
          <div
            key={p.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelected(p)}
          >
            {p.image_url && (
              <div className="w-full h-48 bg-gray-50 flex items-center justify-center overflow-hidden">
                <img src={p.image_url} alt={p.name} className="w-full h-full object-contain" />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900 text-lg">{p.name}</h3>
                <span className="font-bold text-indigo-700 text-lg whitespace-nowrap">₪{p.price}</span>
              </div>
              {p.description && (
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{p.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Product modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelected(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {selected.image_url && (
              <div className="w-full bg-gray-50 flex items-center justify-center p-2">
                <img src={selected.image_url} alt={selected.name} className="max-h-64 w-full object-contain" />
              </div>
            )}
            <div className="p-5 overflow-y-auto flex-1">
              <div className="flex items-start justify-between gap-2 mb-3">
                <h2 className="text-xl font-bold text-gray-900">{selected.name}</h2>
                <span className="text-xl font-bold text-indigo-700 whitespace-nowrap">₪{selected.price}</span>
              </div>
              {selected.description && (
                <p className="text-gray-600 text-sm leading-relaxed">{selected.description}</p>
              )}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => setSelected(null)}
                className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
