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
        <h1 className="text-2xl font-bold text-gray-900">לקוחות</h1>
        <p className="text-gray-500 text-sm mt-1">כל הלקוחות הרשומים בעסק</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או אימייל..."
            className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <span className="text-4xl mb-3 block">👤</span>
            <p>{search ? 'לא נמצאו לקוחות' : 'אין לקוחות רשומים עדיין'}</p>
          </div>
        ) : (
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <th className="px-4 py-3 text-right font-medium">שם</th>
                  <th className="px-4 py-3 text-right font-medium">אימייל</th>
                  <th className="px-4 py-3 text-right font-medium hidden md:table-cell">טלפון</th>
                  <th className="px-4 py-3 text-right font-medium">תורים</th>
                  <th className="px-4 py-3 text-right font-medium hidden sm:table-cell">תור אחרון</th>
                  <th className="px-4 py-3 text-right font-medium">אימות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/customers/${c.id}`)}>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs" dir="ltr">{c.email}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell" dir="ltr">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.appointment_count}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">
                      {c.last_appointment ? formatDateTime(c.last_appointment) : '—'}
                    </td>
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
      <p className="text-xs text-gray-400 mt-3 text-center">{filtered.length} לקוחות</p>
    </div>
  );
}
