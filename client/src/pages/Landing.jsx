import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { checkSlug, registerBusiness } from '../api/public';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function Landing() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const signupRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  const [form, setForm] = useState({
    businessName: '',
    businessType: 'barber',
    ownerName: '',
    email: '',
    password: '',
    slug: '',
  });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState(null); // null | { available, message }
  const [slugChecking, setSlugChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const debouncedSlug = useDebounce(form.slug, 600);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-generate slug from business name (if not manually edited)
  useEffect(() => {
    if (!slugManuallyEdited && form.businessName) {
      const generated = slugify(form.businessName);
      if (generated) {
        setForm(prev => ({ ...prev, slug: generated }));
      }
    }
  }, [form.businessName, slugManuallyEdited]);

  // Debounced slug availability check
  useEffect(() => {
    if (!debouncedSlug || debouncedSlug.length < 3) {
      setSlugStatus(null);
      return;
    }
    setSlugChecking(true);
    checkSlug(debouncedSlug)
      .then(data => setSlugStatus(data))
      .catch(() => setSlugStatus(null))
      .finally(() => setSlugChecking(false));
  }, [debouncedSlug]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (name === 'slug') {
      setSlugManuallyEdited(true);
      setSlugStatus(null);
    }
    setError('');
  };

  const scrollToSignup = () => {
    signupRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.businessName || !form.ownerName || !form.email || !form.password || !form.slug) {
      setError('יש למלא את כל השדות');
      return;
    }
    if (form.password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }
    if (slugStatus && !slugStatus.available) {
      setError('הכתובת שנבחרה אינה זמינה');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const data = await registerBusiness(form);
      if (data.success) {
        setUser(data.user);
        navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה ברישום — נסה שנית');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-white font-sans">
      {/* Navbar */}
      <nav className={`fixed top-0 right-0 left-0 z-50 bg-white transition-shadow ${scrolled ? 'shadow-md' : ''}`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-2xl font-black text-indigo-600">📅 תוריי</span>
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
              <a href="#features" className="hover:text-indigo-600 transition-colors">איך זה עובד</a>
              <a href="#pricing" className="hover:text-indigo-600 transition-colors">תמחור</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors px-3 py-2">
              כניסה
            </Link>
            <button
              onClick={scrollToSignup}
              className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              התחל בחינם
            </button>
          </div>
        </div>
      </nav>

      {/* Logged-in banner */}
      {user && (
        <div className="fixed top-14 right-0 left-0 z-40 bg-indigo-50 border-b border-indigo-100 py-2 px-4 text-center text-sm">
          <span className="text-indigo-800">כבר מחובר כ-{user.name} — </span>
          <Link to="/admin" className="text-indigo-600 font-semibold hover:underline">לדשבורד</Link>
        </div>
      )}

      {/* Hero */}
      <section className={`min-h-screen flex items-center bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 ${user ? 'pt-24' : 'pt-16'}`}>
        <div className="max-w-6xl mx-auto px-4 py-20 flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 text-white text-center lg:text-right">
            <div className="inline-block bg-white/10 text-white text-sm font-medium px-3 py-1 rounded-full mb-6">
              ניהול תורים חכם לעסקים
            </div>
            <h1 className="text-5xl lg:text-6xl font-black mb-6 leading-tight">
              נהל תורים<br />כמו מקצוען
            </h1>
            <p className="text-xl text-indigo-100 mb-8 max-w-lg mx-auto lg:mx-0">
              פלטפורמה חכמה לניהול תורים לספרים, קליניקות, מורים ועוד. לקוחות מזמינים לבד, אתה מנהל הכל.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-end">
              <button
                onClick={scrollToSignup}
                className="w-full sm:w-auto bg-white text-indigo-700 font-bold px-8 py-4 rounded-xl hover:bg-indigo-50 transition-colors shadow-lg"
              >
                התחל בחינם — ללא כרטיס אשראי
              </button>
            </div>
          </div>
          <div className="flex-1 w-full max-w-md">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-2xl">
              <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400 font-medium">היום — יום שני</span>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">5 תורים</span>
                </div>
                {['09:00 — תספורת — דוד', '10:00 — גילוח — יוסי', '11:30 — עיצוב זקן — דוד'].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full flex-shrink-0"></div>
                    <span className="text-sm text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-indigo-500/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-black text-white">24</div>
                  <div className="text-xs text-indigo-100">תורים השבוע</div>
                </div>
                <div className="bg-purple-500/30 rounded-lg p-3 text-center">
                  <div className="text-2xl font-black text-white">₪1,840</div>
                  <div className="text-xs text-indigo-100">הכנסה צפויה</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-black text-gray-900 mb-4">הכל במקום אחד</h2>
            <p className="text-gray-500 text-lg">כל הכלים שאתה צריך לניהול עסק מוצלח</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '📅', title: 'ניהול לוח זמנים', desc: 'לוח שנה אינטראקטיבי לכל העובדים שלך' },
              { icon: '💌', title: 'התראות אוטומטיות', desc: 'אימיילים אוטומטיים ללקוחות ולעובדים' },
              { icon: '🔗', title: 'קישור הזמנה אישי', desc: 'שתף לינק ייחודי ולקוחות יזמינו לבד' },
              { icon: '📊', title: 'דשבורד ניהולי', desc: 'סטטיסטיקות ומידע בזמן אמת' },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-black text-gray-900 mb-4">איך זה עובד?</h2>
            <p className="text-gray-500 text-lg">מתחילים בשלוש צעדים פשוטים</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: '1', title: 'הירשם בחינם', desc: 'צור חשבון תוך דקות, ללא כרטיס אשראי' },
              { num: '2', title: 'הגדר את העסק שלך', desc: 'הוסף עובדים, שירותים ושעות עבודה' },
              { num: '3', title: 'שתף את הקישור שלך', desc: 'לקוחות מזמינים לבד דרך הדף האישי שלך' },
            ].map((s, i) => (
              <div key={i} className="text-center relative">
                <div className="w-16 h-16 bg-indigo-600 text-white text-2xl font-black rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                  {s.num}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-gray-500">{s.desc}</p>
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 left-0 w-full h-0.5 bg-indigo-100 -z-10" style={{ left: '-50%', width: '100%' }}></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-gradient-to-br from-indigo-600 to-purple-700">
        <div className="max-w-lg mx-auto px-4 text-center">
          <h2 className="text-4xl font-black text-white mb-4">תמחור פשוט</h2>
          <p className="text-indigo-100 mb-10">כל הפיצ'רים, מחיר אחד</p>
          <div className="bg-white rounded-3xl p-8 shadow-2xl">
            <div className="text-sm font-bold text-indigo-600 uppercase tracking-wide mb-2">תוכנית פרו</div>
            <div className="text-6xl font-black text-gray-900 mb-1">₪99</div>
            <div className="text-gray-400 mb-8">לחודש</div>
            <ul className="text-right space-y-3 mb-8">
              {[
                'עובדים ללא הגבלה',
                'תורים ללא הגבלה',
                'אימיילים אוטומטיים',
                'לוח שנה לצוות',
                'לינק הזמנה אישי',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-gray-700">
                  <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-xs font-bold flex-shrink-0">✓</div>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={scrollToSignup}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-colors"
            >
              התחל ניסיון חינם
            </button>
          </div>
        </div>
      </section>

      {/* Sign Up Form */}
      <section id="signup" ref={signupRef} className="py-20 bg-white">
        <div className="max-w-xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-black text-gray-900 mb-3">צור את העסק שלך עכשיו</h2>
            <p className="text-gray-500">הירשם בחינם ותתחיל לנהל תורים כבר היום</p>
          </div>
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">שם העסק</label>
              <input
                type="text"
                name="businessName"
                value={form.businessName}
                onChange={handleChange}
                placeholder="סלון הספר של דוד"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">סוג העסק</label>
              <select
                name="businessType"
                value={form.businessType}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="barber">ספרות</option>
                <option value="clinic">קליניקה</option>
                <option value="tutor">הוראה</option>
                <option value="other">אחר</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">שם הבעלים</label>
              <input
                type="text"
                name="ownerName"
                value={form.ownerName}
                onChange={handleChange}
                placeholder="דוד לוי"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">אימייל</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="david@example.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">סיסמה</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="לפחות 6 תווים"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                כתובת הדף שלך (באנגלית)
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="slug"
                  value={form.slug}
                  onChange={handleChange}
                  placeholder="my-business-name"
                  className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    slugStatus?.available === true ? 'border-green-400' :
                    slugStatus?.available === false ? 'border-red-400' :
                    'border-gray-200'
                  }`}
                  required
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  {slugChecking && (
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500"></div>
                  )}
                  {!slugChecking && slugStatus?.available === true && (
                    <span className="text-green-500 text-lg">✓</span>
                  )}
                  {!slugChecking && slugStatus?.available === false && (
                    <span className="text-red-500 text-lg">✕</span>
                  )}
                </div>
              </div>
              {form.slug && (
                <p className="text-xs text-gray-400 mt-1.5">
                  הלינק שלך: <span className="text-indigo-600 font-medium">yourapp.com/book/{form.slug}</span>
                </p>
              )}
              {slugStatus && (
                <p className={`text-xs mt-1 font-medium ${slugStatus.available ? 'text-green-600' : 'text-red-500'}`}>
                  {slugStatus.message}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">רק אותיות אנגליות קטנות, מספרים ומקפים (לפחות 3 תווים)</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || (slugStatus?.available === false)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  יוצר חשבון...
                </>
              ) : 'צור חשבון בחינם'}
            </button>

            <p className="text-center text-xs text-gray-400">
              כבר יש לך חשבון?{' '}
              <Link to="/login" className="text-indigo-600 font-medium hover:underline">כניסה</Link>
            </p>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm">
          <div className="text-white font-bold text-xl mb-3">📅 תוריי</div>
          <div className="flex items-center justify-center gap-6 mb-4">
            <a href="#features" className="hover:text-white transition-colors">תכונות</a>
            <a href="#pricing" className="hover:text-white transition-colors">תמחור</a>
            <Link to="/login" className="hover:text-white transition-colors">כניסה</Link>
            <Link to="/terms" className="hover:text-white transition-colors">תנאי שימוש</Link>
            <Link to="/privacy" className="hover:text-white transition-colors">פרטיות</Link>
          </div>
          <p>© 2026 תוריי. כל הזכויות שמורות.</p>
        </div>
      </footer>
    </div>
  );
}
