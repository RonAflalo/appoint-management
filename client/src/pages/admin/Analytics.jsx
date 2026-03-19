import { useState, useEffect } from 'react';
import { getAnalytics } from '../../api/admin';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

const MONTH_NAMES = {
  '01': 'ינו', '02': 'פבר', '03': 'מרץ', '04': 'אפר',
  '05': 'מאי', '06': 'יוני', '07': 'יולי', '08': 'אוג',
  '09': 'ספט', '10': 'אוק', '11': 'נוב', '12': 'דצמ',
};

function formatMonth(yyyymm) {
  const [y, m] = yyyymm.split('-');
  return `${MONTH_NAMES[m]} ${y}`;
}

function Bar({ value, max, color = 'bg-indigo-500', label }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-12 text-gray-500 text-xs text-left flex-shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-3">
        <div className={`${color} h-3 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-gray-700 text-xs text-right flex-shrink-0">{value}</span>
    </div>
  );
}

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getAnalytics()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 text-sm p-4">שגיאה בטעינת הנתונים</div>;

  const { monthlyRevenue, busiestHours, topServices, customerStats, totals } = data;

  const maxRevenue = Math.max(...(monthlyRevenue.map(m => m.revenue) || [1]), 1);
  const maxHour = Math.max(...(busiestHours.map(h => h.count) || [1]), 1);
  const maxService = Math.max(...(topServices.map(s => s.count) || [1]), 1);

  const newCustomers = (customerStats?.total_customers || 0) - (customerStats?.returning_customers || 0);
  const retentionPct = customerStats?.total_customers > 0
    ? Math.round((customerStats.returning_customers / customerStats.total_customers) * 100)
    : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">אנליטיקה</h1>
        <p className="text-gray-500 text-sm mt-1">נתוני ביצועים של העסק</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-2xl mb-1">💰</div>
          <div className="text-2xl font-bold text-gray-900">₪{Math.round(totals?.total_revenue || 0).toLocaleString()}</div>
          <div className="text-sm text-gray-500 mt-1">הכנסות סה"כ</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-2xl mb-1">📅</div>
          <div className="text-2xl font-bold text-gray-900">{totals?.total_appointments || 0}</div>
          <div className="text-sm text-gray-500 mt-1">תורים שהושלמו</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-2xl mb-1">👤</div>
          <div className="text-2xl font-bold text-gray-900">{customerStats?.total_customers || 0}</div>
          <div className="text-sm text-gray-500 mt-1">לקוחות סה"כ</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="text-2xl mb-1">🔄</div>
          <div className="text-2xl font-bold text-gray-900">{retentionPct}%</div>
          <div className="text-sm text-gray-500 mt-1">לקוחות חוזרים</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly Revenue */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">הכנסות חודשיות (6 חודשים אחרונים)</h2>
          {monthlyRevenue.length === 0 ? (
            <p className="text-gray-400 text-sm">אין נתונים</p>
          ) : (
            <div className="space-y-2.5">
              {monthlyRevenue.map(m => (
                <Bar
                  key={m.month}
                  label={formatMonth(m.month)}
                  value={Math.round(m.revenue)}
                  max={maxRevenue}
                  color="bg-indigo-500"
                />
              ))}
            </div>
          )}
        </div>

        {/* Top Services */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">שירותים מובילים</h2>
          {topServices.length === 0 ? (
            <p className="text-gray-400 text-sm">אין נתונים</p>
          ) : (
            <div className="space-y-2.5">
              {topServices.map(s => (
                <Bar
                  key={s.name}
                  label={s.name.length > 10 ? s.name.slice(0, 10) + '…' : s.name}
                  value={s.count}
                  max={maxService}
                  color="bg-emerald-500"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Busiest Hours */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">שעות עומס</h2>
          {busiestHours.length === 0 ? (
            <p className="text-gray-400 text-sm">אין נתונים</p>
          ) : (
            <div className="space-y-1.5">
              {busiestHours.map(h => (
                <Bar
                  key={h.hour}
                  label={HOUR_LABELS[h.hour]}
                  value={h.count}
                  max={maxHour}
                  color="bg-amber-500"
                />
              ))}
            </div>
          )}
        </div>

        {/* Customer Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">פילוח לקוחות</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl">
              <div>
                <p className="text-sm font-medium text-indigo-900">לקוחות חדשים</p>
                <p className="text-xs text-indigo-600">ביקרו פעם אחת בלבד</p>
              </div>
              <span className="text-2xl font-bold text-indigo-700">{newCustomers}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl">
              <div>
                <p className="text-sm font-medium text-emerald-900">לקוחות חוזרים</p>
                <p className="text-xs text-emerald-600">ביקרו יותר מפעם אחת</p>
              </div>
              <span className="text-2xl font-bold text-emerald-700">{customerStats?.returning_customers || 0}</span>
            </div>
            {customerStats?.total_customers > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>אחוז שימור לקוחות</span>
                  <span>{retentionPct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${retentionPct}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
