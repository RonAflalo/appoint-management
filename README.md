# מנהל תורים

אפליקציה לניהול תורים לעסקים קטנים

## התקנה והרצה

### שרת (Backend)
```bash
cd server
npm install
node db/seed.js
npm start
```
השרת יעלה על פורט 3001.

### לקוח (Frontend)
```bash
cd client
npm install
npm run dev
```
הלקוח יעלה על פורט 5173.

## פרטי כניסה לדמו

### מנהל
- אימייל: admin@demo.com
- סיסמה: admin123

### עובד
- אימייל: worker@demo.com
- סיסמה: worker123

### לקוח
הרשם דרך דף ההרשמה

## טכנולוגיות
- Frontend: React 18 + Vite + Tailwind CSS + React Router v6
- Backend: Node.js + Express
- Database: SQLite (better-sqlite3)
- Auth: JWT בעוגיות httpOnly
