import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { completeOnboarding } from '../../api/admin';
import { useToast } from '../../hooks/useToast';

const STEPS = ['שעות פעילות', 'שירותים', 'הגדרת קישור'];

export default function AdminOnboarding() {
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await completeOnboarding();
      addToast('האונבורדינג הושלם! ברוך הבא לתוריי 🎉');
      navigate('/admin');
    } catch {
      addToast('שגיאה', 'error');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-3xl">📅</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">ברוך הבא לתוריי!</h1>
          <p className="text-gray-500 mt-2">בוא נגדיר את העסק שלך בכמה שלבים פשוטים</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors
                ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${i === step ? 'text-indigo-700 font-medium' : 'text-gray-400'}`}>{label}</span>
              {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {step === 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">שעות פעילות</h2>
              <p className="text-gray-500 text-sm mb-6">הגדר את שעות הפעילות של העסק שלך בהגדרות.</p>
              <div className="bg-indigo-50 rounded-xl p-4 mb-6 text-sm text-indigo-700">
                💡 ניתן לשנות את שעות הפעילות בכל עת דרך <strong>הגדרות &rarr; שעות פעילות</strong>
              </div>
              <button
                onClick={() => { navigate('/admin/settings'); }}
                className="w-full py-3 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold rounded-lg transition-colors text-sm mb-3"
              >
                פתח הגדרות שעות פעילות
              </button>
              <button
                onClick={() => setStep(1)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors text-sm"
              >
                המשך
              </button>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">שירותים</h2>
              <p className="text-gray-500 text-sm mb-6">הגדר את השירותים שהעסק שלך מציע.</p>
              <div className="bg-indigo-50 rounded-xl p-4 mb-6 text-sm text-indigo-700">
                💡 שירותים ברירת מחדל נוצרו אוטומטית. ניתן לערוך אותם בעמוד <strong>שירותים</strong>
              </div>
              <button
                onClick={() => navigate('/admin/services')}
                className="w-full py-3 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold rounded-lg transition-colors text-sm mb-3"
              >
                ערוך שירותים
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(0)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-lg transition-colors text-sm"
                >
                  חזרה
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors text-sm"
                >
                  המשך
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">קישור להזמנה</h2>
              <p className="text-gray-500 text-sm mb-6">הקישור שלך מוכן! שתף אותו עם הלקוחות.</p>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-sm text-green-700">
                ✅ העסק שלך מוכן לקבל תורים! ניתן למצוא את הקישור שלך בדשבורד.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-lg transition-colors text-sm"
                >
                  חזרה
                </button>
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  {completing ? (
                    <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>מסיים...</>
                  ) : 'סיים והתחל!'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
