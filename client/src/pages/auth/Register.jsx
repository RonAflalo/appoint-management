import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { register } from '../../api/auth';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { getBusinessInfo } from '../../api/public';
import GoogleSignInButton from '../../components/common/GoogleSignInButton';

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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6" dir="rtl">
      {/* Decorative blobs */}
      <div className="fixed -top-20 -right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed -bottom-20 -left-20 w-96 h-96 bg-secondary/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="w-full max-w-[440px] flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl primary-gradient flex items-center justify-center shadow-lg shadow-primary/20 rotate-3">
            <span className="material-symbols-outlined text-white text-3xl">event_available</span>
          </div>
          <div>
            <h1 className="font-headline font-extrabold text-4xl tracking-tight text-on-surface">הרשמה</h1>
            {businessName ? (
              <p className="text-on-surface-variant mt-2">נרשם לעסק: <span className="font-semibold text-primary">{businessName}</span></p>
            ) : (
              <p className="text-on-surface-variant mt-2">צור חשבון חדש</p>
            )}
          </div>
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_32px_48px_-4px_rgba(25,28,30,0.08)] p-8 flex flex-col gap-6">
          {errors.general && (
            <div className="p-3 bg-error-container border border-red-200 rounded-xl text-error text-sm font-medium">
              {errors.general}
            </div>
          )}

          {/* Google sign up */}
          <GoogleSignInButton
            href={`/api/auth/google${slug ? `?slug=${slug}` : ''}`}
            label="הרשמה עם Google"
          />

          {/* Divider */}
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-surface-container-high" />
            <span className="mx-4 text-outline text-xs font-semibold uppercase tracking-widest">או עם אימייל וסיסמה</span>
            <div className="flex-grow border-t border-surface-container-high" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Name */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-on-surface-variant pr-1">שם מלא</label>
              <div className="relative">
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="ישראל ישראלי"
                  className={`w-full px-5 py-3.5 pl-11 bg-surface-container-low border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim text-on-surface placeholder:text-outline/50 transition-all${errors.name ? ' ring-2 ring-error' : ''}`}
                />
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline/40 text-xl">person</span>
              </div>
              {errors.name && <p className="text-xs text-error font-medium pr-1">{errors.name}</p>}
            </div>

            {/* Email */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-on-surface-variant pr-1">כתובת אימייל</label>
              <div className="relative">
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  dir="ltr"
                  className={`w-full px-5 py-3.5 pl-11 bg-surface-container-low border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim text-on-surface placeholder:text-outline/50 transition-all${errors.email ? ' ring-2 ring-error' : ''}`}
                />
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline/40 text-xl">mail</span>
              </div>
              {errors.email && <p className="text-xs text-error font-medium pr-1">{errors.email}</p>}
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-on-surface-variant pr-1">
                מספר טלפון <span className="text-outline font-normal">(אופציונלי)</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="050-0000000"
                  dir="ltr"
                  className="w-full px-5 py-3.5 pl-11 bg-surface-container-low border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim text-on-surface placeholder:text-outline/50 transition-all"
                />
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline/40 text-xl">phone</span>
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-on-surface-variant pr-1">סיסמה</label>
              <div className="relative">
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="לפחות 6 תווים"
                  className={`w-full px-5 py-3.5 pl-11 bg-surface-container-low border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim text-on-surface placeholder:text-outline/50 transition-all${errors.password ? ' ring-2 ring-error' : ''}`}
                />
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline/40 text-xl">lock</span>
              </div>
              {errors.password && <p className="text-xs text-error font-medium pr-1">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-on-surface-variant pr-1">אישור סיסמה</label>
              <div className="relative">
                <input
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="הזן שוב את הסיסמה"
                  className={`w-full px-5 py-3.5 pl-11 bg-surface-container-low border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim text-on-surface placeholder:text-outline/50 transition-all${errors.confirmPassword ? ' ring-2 ring-error' : ''}`}
                />
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline/40 text-xl">lock</span>
              </div>
              {errors.confirmPassword && <p className="text-xs text-error font-medium pr-1">{errors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 primary-gradient text-white font-headline font-bold text-base rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> נרשם...</>
              ) : 'הרשמה'}
            </button>
          </form>

          <p className="text-center text-sm text-on-surface-variant">
            כבר יש לך חשבון?{' '}
            <Link to={slug ? `/login?redirect=/book/${slug}` : '/login'} className="text-primary font-bold hover:underline mr-1">
              כניסה כאן
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
