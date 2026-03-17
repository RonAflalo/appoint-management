import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link to="/" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">← חזרה לדף הבית</Link>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">מדיניות פרטיות</h1>
          <p className="text-gray-400 text-sm mb-8">עדכון אחרון: מרץ 2026</p>

          <div className="prose prose-gray max-w-none space-y-6 text-gray-700 text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">1. מידע שאנו אוספים</h2>
              <p>אנו אוספים מידע שמסרת בעת ההרשמה: שם, כתובת אימייל, וסיסמה מוצפנת. כמו כן, אנו שומרים מידע על תורים שנקבעו, כולל תאריכים, שעות, ופרטי השירות.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">2. שימוש במידע</h2>
              <p>המידע שנאסף משמש לצורך:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>הספקת השירות וניהול התורים</li>
                <li>שליחת הודעות אימייל הקשורות לתורים (אישורים, תזכורות, ביטולים)</li>
                <li>שליחת הודעות מערכת (אימות אימייל, איפוס סיסמה)</li>
                <li>שיפור השירות ותמיכה טכנית</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">3. שיתוף מידע</h2>
              <p>אנו לא מוכרים, מסחרים, או מעבירים את המידע האישי שלך לצדדים שלישיים, למעט שירותי תשתית הכרחיים לתפעול השירות (כגון שרתי אחסון ושירות דוא"ל עסקי).</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">4. אבטחת מידע</h2>
              <p>אנו נוקטים באמצעי אבטחה סבירים להגנה על המידע שלך, כולל הצפנת סיסמאות ושימוש ב-HTTPS. עם זאת, אין אנו יכולים להבטיח אבטחה מוחלטת.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">5. עוגיות (Cookies)</h2>
              <p>השירות משתמש ב-cookies לצורך שמירת מצב ההתחברות. Cookie זה הכרחי לתפעול השירות ואינו משמש לצורכי פרסום.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">6. זכויות המשתמש</h2>
              <p>יש לך הזכות לבקש עיון, תיקון, או מחיקה של המידע האישי שלך. לבקשות כאלה ניתן לפנות אלינו בדוא"ל: privacy@torii.app</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-2">7. שינויים במדיניות</h2>
              <p>אנו עשויים לעדכן מדיניות פרטיות זו מעת לעת. נודיע על שינויים מהותיים בדוא"ל ו/או בהודעה בולטת באתר.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
