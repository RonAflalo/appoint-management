import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link to="/" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">← חזרה לדף הבית</Link>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">תנאי שימוש</h1>
          <p className="text-gray-400 text-sm mb-8">עדכון אחרון: מרץ 2026</p>

          <div className="prose prose-gray max-w-none space-y-6 text-gray-700 text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">1. כללי</h2>
              <p>תוריי ("השירות") מספקת פלטפורמה לניהול תורים עבור עסקים וגישה ללקוחות. השימוש בשירות כפוף לתנאים המפורטים להלן. שימוש בשירות מהווה הסכמה לתנאים אלה.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">2. רישום ואחריות המשתמש</h2>
              <p>המשתמש אחראי לדיוק המידע שמסר בעת הרישום. המשתמש אחראי לשמירת סודיות פרטי הכניסה לחשבונו. כל פעולה שתתבצע תחת חשבון המשתמש תיחשב כפעולה של המשתמש עצמו.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">3. שימוש מותר</h2>
              <p>השירות מיועד לניהול תורים עסקיים חוקיים בלבד. אסור להשתמש בשירות לצורך הונאה, ספאם, או פעולות הנוגדות את החוק. תוריי שומרת לעצמה את הזכות להשעות או לסגור חשבונות המפרים תנאים אלה.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">4. תשלומים וחיובים</h2>
              <p>השירות מוצע בתשלום חודשי/שנתי כפי שמפורסם באתר. החיובים אינם ניתנים להחזר, אלא אם נקבע אחרת במדיניות ההחזרים שלנו. תוריי שומרת לעצמה את הזכות לשנות את מחירי השירות בהתראה מראש.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">5. הגבלת אחריות</h2>
              <p>תוריי אינה אחראית לנזקים ישירים, עקיפים, מקריים, או תוצאתיים הנובעים משימוש בשירות. השירות מסופק "כפי שהוא" ללא כל אחריות מפורשת או משתמעת.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">6. שינויים בתנאים</h2>
              <p>תוריי שומרת לעצמה את הזכות לשנות תנאים אלה בכל עת. המשך השימוש בשירות לאחר שינוי התנאים מהווה הסכמה לתנאים החדשים. נעדכן את משתמשינו על שינויים מהותיים בדוא"ל.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">7. יצירת קשר</h2>
              <p>לשאלות בנוגע לתנאי השימוש, ניתן לפנות אלינו בדוא"ל: support@torii.app</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
