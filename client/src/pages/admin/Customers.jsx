import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCustomers } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatDateTime } from '../../utils/dateUtils';
import { useToast } from '../../hooks/useToast';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    getCustomers()
      .then(data => setCustomers(data.customers || []))
      .catch(() => addToast('שגיאה בטעינת הלקוחות', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-headline font-extrabold text-3xl text-on-surface">לקוחות</h1>
        <p className="text-on-surface-variant text-sm mt-1">כל הלקוחות הרשומים בעסק</p>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-outline-variant/20">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או אימייל..."
            className="w-full max-w-sm px-4 py-2 bg-surface-container-low border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant">
            <span className="text-4xl mb-3 block">👤</span>
            <p>{search ? 'לא נמצאו לקוחות' : 'אין לקוחות רשומים עדיין'}</p>
          </div>
        ) : (
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant text-xs uppercase">
                  <th className="px-4 py-3 text-right font-medium">שם</th>
                  <th className="px-4 py-3 text-right font-medium">תורים</th>
                  <th className="px-4 py-3 text-right font-medium">אימות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => navigate(`/admin/customers/${c.id}`)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-on-surface">{c.name}</div>
                      <div className="text-xs text-on-surface-variant mt-0.5" dir="ltr">{c.email}</div>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{c.appointment_count}</td>
                    <td className="px-4 py-3">
                      {c.email_verified ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">✓ מאומת</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">⚠ לא מאומת</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-on-surface-variant mt-3 text-center">{filtered.length} לקוחות</p>
    </div>
  );
}
