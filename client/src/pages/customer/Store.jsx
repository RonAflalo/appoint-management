import { useState, useEffect } from 'react';
import { getCustomerStore } from '../../api/user';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function CustomerStore() {
  const [loading, setLoading] = useState(true);
  const [storeEnabled, setStoreEnabled] = useState(false);
  const [products, setProducts] = useState([]);

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
          <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {p.image_url && (
              <img src={p.image_url} alt={p.name} className="w-full h-48 object-cover" />
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900 text-lg">{p.name}</h3>
                <span className="font-bold text-indigo-700 text-lg whitespace-nowrap">₪{p.price}</span>
              </div>
              {p.description && <p className="text-sm text-gray-500 mt-2">{p.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
