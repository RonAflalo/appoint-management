import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { register } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { getBusinessInfo } from '../../api/public';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [businessName, setBusinessName] = useState(null);
  const { setUser } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const slug = searchParams.get('slug');

  useEffect(() => {
    if (!slug) return;
    getBusinessInfo(slug)
      .then(data => { if (data.success) setBusinessName(data.business.name); })
      .catch(() => {});
  }, [slug]);

  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'יש להזין שם מלא';
    if (!form.email.trim()) newErrors.email = 'יש להזין כתובת אימייל';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'כתובת אימייל לא תקינה';
    if (!form.password) newErrors.password = 'יש להזין סיסמה';
    else if (form.password.length < 6) newErrors.password = 'הסיסמה חייבת להכיל לפחות 6 תווים';
    if (!form.confirmPassword) newErrors.confirmPassword = 'יש לאשר את הסיסמה';
    else if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'הסיסמאות אינן תואמות';
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setLoading(true);
    try {
      const data = await register({ name: form.name, email: form.email, phone: form.phone || undefined, password: form.password, slug: slug || undefined });
      setUser(data.user);
      addToast('נרשמת בהצלחה!');
      if (slug) navigate(`/book/${slug}`);
      else navigate('/customer');
    } catch (err) {
      setErrors({ general: err.response?.data?.message || 'שגיאה בהרשמה' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">📅</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">הרשמה</h1>
          {businessName ? (
            <p className="text-gray-500 mt-2">נרשם לעסק: <span className="font-semibold text-indigo-600">{businessName}</span></p>
          ) : (
            <p className="text-gray-500 mt-2">צור חשבון חדש</p>
          )}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">שם מלא</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="ישראל ישראלי"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all
                  ${errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">כתובת אימייל</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="your@email.com"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all
                  ${errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                dir="ltr"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">מספר טלפון <span className="text-gray-400 font-normal">(אופציונלי)</span></label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="050-0000000"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">סיסמה</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="לפחות 6 תווים"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all
                  ${errors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
              />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">אישור סיסמה</label>
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="הזן שוב את הסיסמה"
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all
                  ${errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
              />
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  נרשם...
                </>
              ) : 'הרשמה'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            כבר יש לך חשבון?{' '}
            <Link to={slug ? `/login?redirect=/book/${slug}` : '/login'} className="text-indigo-600 hover:text-indigo-700 font-medium">
              כניסה כאן
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
